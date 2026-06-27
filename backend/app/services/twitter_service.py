"""
Twitter Analytics via Apify actor: apidojo/tweet-scraper
Confirmed output schema (from official docs):
{
  "type": "tweet",
  "id": "...",
  "url": "...",
  "text": "...",
  "likeCount": 104121,
  "retweetCount": 11311,
  "replyCount": 6526,
  "quoteCount": 2915,
  "createdAt": "Fri Nov 24 17:49:36 +0000 2023",
  "author": {
    "type": "user",
    "userName": "elonmusk",
    "name": "Elon Musk",
    "id": "44196397",
    "followers": 172669889,   ← NESTED under author
    "following": 538,
    "profilePicture": "https://..."
  }
}
NOTE: author.followers is NESTED, NOT a flat authorFollowers field.
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
        raise ValueError(f"Apify HTTP {res.status_code}: {res.text[:400]}")
    data = res.json()
    if not isinstance(data, list):
        raise ValueError(f"Unexpected Apify response: {str(data)[:300]}")
    if data:
        print(f"[APIFY {actor_path}] items={len(data)}, sample_keys={list(data[0].keys())[:18]}")
        if isinstance(data[0], dict):
            author = data[0].get("author") or {}
            print(f"[TWITTER DEBUG] author keys={list(author.keys())}")
    else:
        print(f"[APIFY {actor_path}] EMPTY RESULT")
    return data


def _safe_int(val) -> int:
    try:
        return int(str(val).replace(",", "").replace("+", "").strip())
    except Exception:
        return 0


def _is_placeholder_row(row: Any) -> bool:
    if not isinstance(row, dict):
        return True

    # Common placeholder responses returned by some actors/plans.
    if row.get("noResults") is True:
        return True
    if row.get("demo") is True and not (row.get("text") or row.get("full_text")):
        return True
    if row.get("error") and not (row.get("text") or row.get("full_text")):
        return True

    return False


def _extract_valid_tweets(data: list) -> list[dict[str, Any]]:
    return [row for row in data if isinstance(row, dict) and not _is_placeholder_row(row)]


def _dedupe_keep_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        if value and value not in seen:
            seen.add(value)
            ordered.append(value)
    return ordered


def _extract_author_details(tweet: dict[str, Any], username: str) -> dict[str, Any]:
    author = tweet.get("author") if isinstance(tweet.get("author"), dict) else {}
    if author:
        return {
            "username": author.get("userName") or author.get("screen_name") or username,
            "name": author.get("name") or author.get("userName") or username,
            "followers": author.get("followers") or author.get("followersCount") or 0,
            "following": author.get("following") or author.get("followingCount") or 0,
            "listed": author.get("listedCount") or author.get("listed_count") or 0,
            "tweet_count": author.get("statusesCount") or author.get("tweetsCount") or 0,
            "profile_image": author.get("profilePicture") or author.get("profilePic") or author.get("avatar"),
        }

    user = tweet.get("user") if isinstance(tweet.get("user"), dict) else {}
    legacy = user.get("legacy") if isinstance(user.get("legacy"), dict) else {}
    avatar = user.get("avatar") if isinstance(user.get("avatar"), dict) else {}

    return {
        "username": legacy.get("screen_name") or username,
        "name": legacy.get("name") or username,
        "followers": legacy.get("followers_count") or 0,
        "following": legacy.get("friends_count") or 0,
        "listed": legacy.get("listed_count") or 0,
        "tweet_count": legacy.get("statuses_count") or 0,
        "profile_image": avatar.get("image_url") or legacy.get("profile_image_url_https") or legacy.get("profile_image_url"),
    }


def _extract_media_url(tweet: dict[str, Any]) -> str | None:
    ext_media = tweet.get("extendedEntities") or tweet.get("extended_entities") or {}
    media_list = (
        ext_media.get("media")
        or (tweet.get("entities") or {}).get("media")
        or tweet.get("media")
        or tweet.get("mediaUrls")
        or []
    )

    if isinstance(media_list, list) and media_list:
        media_item = media_list[0]
        if isinstance(media_item, dict):
            return (
                media_item.get("media_url_https")
                or media_item.get("media_url")
                or media_item.get("mediaUrl")
                or media_item.get("previewImageUrl")
                or media_item.get("url")
            )
        if isinstance(media_item, str):
            return media_item

    if isinstance(tweet.get("user"), dict):
        avatar = (tweet.get("user") or {}).get("avatar")
        if isinstance(avatar, dict):
            return avatar.get("image_url")

    return None


async def _try_actor_with_payloads(
    actor_path: str,
    payloads: list[dict[str, Any]],
    token: str,
) -> tuple[list[dict[str, Any]], list[str]]:
    errors: list[str] = []

    for payload in payloads:
        try:
            data = await _run_apify(actor_path, payload, token)
            valid = _extract_valid_tweets(data)
            if valid:
                return valid, errors

            if data and isinstance(data[0], dict):
                if data[0].get("error"):
                    errors.append(str(data[0].get("error")))
                elif data[0].get("demo"):
                    errors.append("actor returned demo-mode placeholders")
                elif data[0].get("noResults"):
                    errors.append("actor returned noResults placeholders")
        except Exception as error:
            errors.append(str(error))

    return [], errors


async def fetch_twitter_analytics(
    username_override: str | None,
    max_results: int,
) -> dict[str, Any]:
    apify_token = os.getenv("APIFY_API_TOKEN", "")
    username = (username_override or os.getenv("TWITTER_DEFAULT_USERNAME", "")).lstrip("@")

    if not apify_token:
        raise ValueError("Missing APIFY_API_TOKEN in backend environment.")
    if not username:
        raise ValueError(
            "Missing Twitter username. "
            "Provide ?username= query param or set TWITTER_DEFAULT_USERNAME in .env"
        )

    query_max_items = max(max_results, 50)

    primary_payloads = [
        {
            "searchTerms": [f"from:{username} -filter:retweets"],
            "maxItems": query_max_items,
            "sort": "Latest",
        },
        {
            "searchTerms": [f"from:{username} -filter:retweets"],
            "maxItems": query_max_items,
            "sort": "Top",
        },
        {
            "searchTerms": [f"from:{username}"],
            "maxItems": query_max_items,
            "sort": "Latest",
        },
        {
            "twitterHandles": [username],
            "maxItems": query_max_items,
        },
        {
            "startUrls": [{"url": f"https://x.com/{username}"}],
            "maxItems": query_max_items,
        },
    ]

    notes: list[str] = []
    valid_tweets, primary_errors = await _try_actor_with_payloads(
        "apidojo~tweet-scraper",
        primary_payloads,
        apify_token,
    )
    if primary_errors:
        notes.extend(primary_errors)

    actor_used = "apidojo~tweet-scraper"

    if not valid_tweets:
        fallback_actor = os.getenv("TWITTER_FALLBACK_ACTOR", "gentle_cloud~twitter-tweets-scraper").strip()
        fallback_payloads = [
            {
                "startUrls": [{"url": f"https://x.com/{username}"}],
                "maxItems": max(max_results, 20),
            },
            {
                "searchTerms": [f"from:{username}"],
                "maxItems": max(max_results, 20),
            },
        ]
        valid_tweets, fallback_errors = await _try_actor_with_payloads(
            fallback_actor,
            fallback_payloads,
            apify_token,
        )
        if fallback_errors:
            notes.extend(fallback_errors)
        if valid_tweets:
            actor_used = fallback_actor

    if not valid_tweets:
        # Return a normalized empty payload instead of hard failing when actor
        # access is restricted or only placeholders are returned.
        compact_notes = _dedupe_keep_order(notes)
        return {
            "platform": "twitter",
            "account": {
                "id": username,
                "username": username,
                "name": username,
                "profile_image_url": None,
            },
            "metrics": {
                "followersCount": 0,
                "followingCount": 0,
                "tweetCount": 0,
                "listedCount": 0,
            },
            "items": [],
            "notes": [
                f"No tweet rows returned for @{username} from configured Apify actors.",
                "This usually means actor demo/plan limits or temporary upstream restrictions.",
                *compact_notes[:3],
            ],
        }

    first = valid_tweets[0]
    author = _extract_author_details(first, username)

    followers = _safe_int(author.get("followers") or 0)
    following = _safe_int(author.get("following") or 0)
    name = author.get("name") or username
    account_username = (author.get("username") or username).lstrip("@")
    pic = author.get("profile_image")

    # tweetCount: use statusesCount from author if available
    tweet_count = _safe_int(
        author.get("tweet_count") or
        len(valid_tweets)
    )

    items = []
    for tweet in valid_tweets[:max_results]:
        likes = _safe_int(tweet.get("likeCount") or tweet.get("likes") or tweet.get("favorite_count") or 0)
        retweets = _safe_int(tweet.get("retweetCount") or tweet.get("retweets") or tweet.get("retweet_count") or 0)
        replies = _safe_int(tweet.get("replyCount") or tweet.get("replies") or tweet.get("reply_count") or 0)

        media_url = _extract_media_url(tweet)
        tweet_id = tweet.get("id") or tweet.get("id_str") or tweet.get("tweetId")
        permalink = (
            tweet.get("url")
            or tweet.get("twitterUrl")
            or (f"https://x.com/{account_username}/status/{tweet_id}" if tweet_id else None)
        )

        items.append({
            "id": tweet_id,
            "caption": tweet.get("text") or tweet.get("full_text") or "(no text)",
            "publishedAt": tweet.get("createdAt") or tweet.get("created_at"),
            "like_count": likes,
            "retweet_count": retweets,
            "reply_count": replies,
            "media_url": media_url,
            "media_type": "TWEET",
            "permalink": permalink,
        })

    return {
        "platform": "twitter",
        "account": {
            "id": account_username,
            "username": account_username,
            "name": name,
            "profile_image_url": pic,
        },
        "metrics": {
            "followersCount": followers,
            "followingCount": following,
            "tweetCount": tweet_count,
            "listedCount": _safe_int(author.get("listed") or 0),
        },
        "items": items,
        "notes": [f"tweets source actor: {actor_used}"],
    }
