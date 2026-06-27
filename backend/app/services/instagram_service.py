"""
Instagram Analytics via Apify actor: apify/instagram-scraper
Strategy:
 - Call with resultsType="details" and directUrls=[profile_url]
   → returns one item per profile: { followersCount, postsCount, fullName,
     profilePicUrl, biography, latestPosts: [...] }
 - latestPosts embedded in the profile item contains recent post data
"""

import os
from typing import Any
import httpx


async def _run_apify(actor_path: str, payload: dict, token: str) -> list:
    async with httpx.AsyncClient(timeout=120.0) as client:
        res = await client.post(
            f"https://api.apify.com/v2/acts/{actor_path}/run-sync-get-dataset-items",
            params={"token": token},
            json=payload,
        )
    print(f"[APIFY {actor_path}] status={res.status_code}")
    if res.status_code not in (200, 201):
        body = (res.text or "")[:800]
        if res.status_code == 403 and "platform-feature-disabled" in body and "Monthly usage hard limit exceeded" in body:
            raise ValueError(
                "Apify returned 403 (Monthly usage hard limit exceeded) for the currently loaded token. "
                "If you recently changed APIFY_API_TOKEN, restart backend to reload .env. "
                "Also check Apify Console -> Billing -> Usage limits (hard limit)."
            )
        raise ValueError(f"Apify HTTP {res.status_code}: {body[:400]}")
    data = res.json()
    if not isinstance(data, list):
        raise ValueError(f"Unexpected Apify response: {str(data)[:300]}")
    if data:
        print(f"[APIFY {actor_path}] items={len(data)}, sample_keys={list(data[0].keys())[:18]}")
    else:
        print(f"[APIFY {actor_path}] EMPTY RESULT")
    return data


def _safe_int(val) -> int:
    try:
        return int(str(val).replace(",", "").replace("+", "").strip())
    except Exception:
        return 0


def _extract_instagram_comment_texts(post: dict[str, Any], limit: int = 3) -> list[str]:
    candidates: list[str] = []

    possible_lists = [
        post.get("latestComments"),
        post.get("latest_comments"),
        post.get("previewComments"),
        post.get("comments"),
        (post.get("edge_media_to_parent_comment") or {}).get("edges"),
        (post.get("edge_media_to_comment") or {}).get("edges"),
    ]

    for comment_list in possible_lists:
        if not isinstance(comment_list, list):
            continue

        for entry in comment_list:
            if isinstance(entry, dict):
                node = entry.get("node") if isinstance(entry.get("node"), dict) else entry
                text = (
                    node.get("text")
                    or node.get("comment")
                    or node.get("content")
                    or node.get("body")
                    or ""
                )
            elif isinstance(entry, str):
                text = entry
            else:
                text = ""

            clean = str(text).strip()
            if clean:
                candidates.append(clean)

            if len(candidates) >= limit:
                return candidates[:limit]

    return candidates[:limit]


async def fetch_instagram_analytics(
    username_override: str | None,
    media_limit: int,
) -> dict[str, Any]:
    apify_token = os.getenv("APIFY_API_TOKEN", "")
    username = (username_override or os.getenv("INSTAGRAM_DEFAULT_USERNAME", "")).lstrip("@")

    if not apify_token:
        raise ValueError("Missing APIFY_API_TOKEN in backend environment.")
    if not username:
        raise ValueError(
            "Missing Instagram username. "
            "Provide ?username= query param or set INSTAGRAM_DEFAULT_USERNAME in .env"
        )

    profile_url = f"https://www.instagram.com/{username}/"

    # resultsType="details" returns the full profile object with latestPosts embedded
    data = await _run_apify("apify~instagram-scraper", {
        "directUrls": [profile_url],
        "resultsType": "details",
        "resultsLimit": 1,
    }, apify_token)

    if not data:
        raise ValueError(f"Apify returned no data for @{username}. The account may be private.")

    profile = data[0]
    print(f"[IG DEBUG] followersCount={profile.get('followersCount')} postsCount={profile.get('postsCount')}")

    followers   = _safe_int(profile.get("followersCount") or profile.get("edge_followed_by", {}).get("count") or 0)
    posts_count = _safe_int(profile.get("postsCount") or profile.get("mediaCount") or 0)
    full_name   = profile.get("fullName") or profile.get("full_name") or username
    bio         = profile.get("biography") or profile.get("bio") or ""
    pic_url     = profile.get("profilePicUrl") or profile.get("profilePicUrlHD")

    # latestPosts is embedded inside the details result
    latest_posts = profile.get("latestPosts") or profile.get("edge_owner_to_timeline_media", {}).get("edges") or []
    items = []
    for post in latest_posts[:media_limit]:
        # Handle both flat post objects and GraphQL edge wrappers
        if "node" in post:
            post = post["node"]
        likes    = _safe_int(post.get("likesCount") or post.get("edge_media_preview_like", {}).get("count") or 0)
        comments = _safe_int(post.get("commentsCount") or post.get("edge_media_to_comment", {}).get("count") or 0)
        comments_preview = _extract_instagram_comment_texts(post, limit=3)
        items.append({
            "id"            : post.get("id") or post.get("shortCode"),
            "caption"       : post.get("caption") or post.get("edge_media_to_caption", {}).get("edges", [{}])[0].get("node", {}).get("text") or "(no caption)",
            "publishedAt"   : post.get("timestamp"),
            "like_count"    : likes,
            "comments_count": comments,
            "comments_preview": comments_preview,
            "media_url"     : post.get("displayUrl") or post.get("thumbnail_url"),
            "media_type"    : (post.get("type") or "IMAGE").upper(),
            "permalink"     : post.get("url") or f"https://instagram.com/p/{post.get('shortCode', '')}",
        })

    reels_count = sum(1 for i in items if "VIDEO" in i["media_type"] or "REEL" in i["media_type"])

    return {
        "platform": "instagram",
        "account": {
            "id"               : username,
            "username"         : username,
            "name"             : full_name,
            "bio"              : bio,
            "profile_image_url": pic_url,
        },
        "metrics": {
            "followersCount"    : followers,
            "postsCount"        : posts_count,
            "reelsUploaded"     : reels_count,
            "totalMediaUploaded": posts_count,
            "reach"             : None,
            "impressions"       : None,
        },
        "items": items,
    }
