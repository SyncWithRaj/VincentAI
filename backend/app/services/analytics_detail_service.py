import json
import os
from typing import Any

import httpx

from app.core.http import fetch_json, parse_number
from app.services.instagram_service import fetch_instagram_analytics


def _safe_int(value: Any) -> int:
    try:
        return int(float(value))
    except Exception:
        return 0


def _unique_non_empty(values: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        clean = str(value or "").strip()
        if clean and clean not in seen:
            seen.add(clean)
            ordered.append(clean)
    return ordered


def _extract_instagram_comment_texts(rows: list[Any], limit: int) -> list[str]:
    comments: list[str] = []
    for row in rows:
        if not isinstance(row, dict):
            continue

        node = row.get("node") if isinstance(row.get("node"), dict) else row
        text = (
            node.get("text")
            or node.get("comment")
            or node.get("content")
            or node.get("body")
            or ""
        )
        clean = str(text).strip()
        if clean:
            comments.append(clean)
        if len(comments) >= limit:
            break

    return comments[:limit]


def _extract_instagram_thumbnail_candidates(post: dict[str, Any], permalink: str | None) -> list[str]:
    candidates: list[str] = []

    direct_candidates = [
        post.get("displayUrl"),
        post.get("thumbnailUrl"),
        post.get("thumbnail_url"),
        post.get("media_url"),
    ]
    for candidate in direct_candidates:
        if candidate:
            candidates.append(str(candidate))

    images = post.get("images")
    if isinstance(images, list):
        for image in images:
            if isinstance(image, dict):
                for key in ("url", "displayUrl", "src"):
                    if image.get(key):
                        candidates.append(str(image.get(key)))
                        break
            elif isinstance(image, str):
                candidates.append(image)

    child_posts = post.get("childPosts")
    if isinstance(child_posts, list):
        for child in child_posts:
            if isinstance(child, dict):
                if child.get("displayUrl"):
                    candidates.append(str(child.get("displayUrl")))
                elif child.get("thumbnailUrl"):
                    candidates.append(str(child.get("thumbnailUrl")))

    short_code = str(post.get("shortCode") or "").strip()
    if short_code:
        candidates.append(f"https://www.instagram.com/p/{short_code}/media/?size=l")

    if permalink:
        candidates.append(f"{permalink.rstrip('/')}/media/?size=l")

    return _unique_non_empty(candidates)


async def _run_instagram_scraper(payload: dict[str, Any], token: str) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            "https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items",
            params={"token": token},
            json=payload,
        )

    if response.status_code not in (200, 201):
        raise ValueError(f"Instagram detail scraper HTTP {response.status_code}: {response.text[:260]}")

    data = response.json()
    if not isinstance(data, list):
        return []

    return [row for row in data if isinstance(row, dict)]


def _estimate_new_subscribers(likes: int, comments: int, views: int | None = None) -> int:
    views_count = max(0, views or 0)
    estimate = (likes * 0.012) + (comments * 0.35) + (views_count * 0.0008)
    return max(0, int(round(estimate)))


def _engagement_rate(likes: int, comments: int, denominator: int) -> float | None:
    if denominator <= 0:
        return None
    rate = ((likes + comments) / denominator) * 100
    return round(rate, 2)


def _basic_sentiment_fallback(comments: list[str]) -> dict[str, Any]:
    if not comments:
        return {
            "overall": "neutral",
            "score": 50,
            "summary": "Not enough comments available to infer sentiment.",
            "breakdown": {"positive": 0, "neutral": 100, "negative": 0},
        }

    positive_markers = [
        "good", "great", "awesome", "love", "amazing", "nice", "helpful", "best", "cool", "wow",
    ]
    negative_markers = [
        "bad", "worst", "hate", "boring", "fake", "poor", "awful", "dislike", "waste", "trash",
    ]

    pos = 0
    neg = 0
    for comment in comments:
        lowered = comment.lower()
        if any(token in lowered for token in positive_markers):
            pos += 1
        if any(token in lowered for token in negative_markers):
            neg += 1

    total = max(1, len(comments))
    pos_pct = int(round((pos / total) * 100))
    neg_pct = int(round((neg / total) * 100))
    neu_pct = max(0, 100 - pos_pct - neg_pct)

    score = int(round(50 + (pos_pct - neg_pct) * 0.5))
    score = max(0, min(100, score))

    if score >= 65:
        overall = "positive"
    elif score <= 35:
        overall = "negative"
    else:
        overall = "neutral"

    return {
        "overall": overall,
        "score": score,
        "summary": "Fallback sentiment was computed from keyword signals in available comments.",
        "breakdown": {
            "positive": pos_pct,
            "neutral": neu_pct,
            "negative": neg_pct,
        },
    }


async def _analyze_sentiment_with_groq(comments: list[str]) -> tuple[dict[str, Any], str | None]:
    fallback = _basic_sentiment_fallback(comments)
    groq_api_key = os.getenv("GROQ_API_KEY", "").strip()

    if not groq_api_key:
        return fallback, "GROQ_API_KEY is not configured. Used fallback sentiment model."

    if not comments:
        return fallback, "No comments available for sentiment analysis."

    sample_comments = [c.strip()[:220] for c in comments if str(c).strip()][:80]
    if not sample_comments:
        return fallback, "No valid comment text available for sentiment analysis."

    prompt = (
        "You are a social media sentiment analyst. Analyze the comment set and return only a valid JSON object "
        "with this exact schema: "
        "{\"overall\":\"positive|neutral|negative|mixed\","
        "\"score\":0-100,"
        "\"summary\":\"short summary\","
        "\"breakdown\":{\"positive\":0-100,\"neutral\":0-100,\"negative\":0-100}}. "
        "Ensure breakdown percentages sum to 100.\n\n"
        f"COMMENTS:\n{json.dumps(sample_comments, ensure_ascii=False)}"
    )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {groq_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2,
                    "response_format": {"type": "json_object"},
                },
            )

        if response.status_code != 200:
            return fallback, f"Groq sentiment request failed: HTTP {response.status_code}. Used fallback sentiment model."

        content = (
            response.json()
            .get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .replace("```json", "")
            .replace("```", "")
            .strip()
        )

        parsed = json.loads(content)
        breakdown = parsed.get("breakdown") if isinstance(parsed.get("breakdown"), dict) else {}

        positive = _safe_int(breakdown.get("positive"))
        neutral = _safe_int(breakdown.get("neutral"))
        negative = _safe_int(breakdown.get("negative"))

        total = positive + neutral + negative
        if total <= 0:
            breakdown_clean = fallback["breakdown"]
        else:
            breakdown_clean = {
                "positive": int(round((positive / total) * 100)),
                "neutral": int(round((neutral / total) * 100)),
                "negative": max(0, 100 - int(round((positive / total) * 100)) - int(round((neutral / total) * 100))),
            }

        sentiment = {
            "overall": str(parsed.get("overall") or fallback["overall"]).lower(),
            "score": max(0, min(100, _safe_int(parsed.get("score") if parsed.get("score") is not None else fallback["score"]))),
            "summary": str(parsed.get("summary") or fallback["summary"]),
            "breakdown": breakdown_clean,
        }

        return sentiment, None
    except Exception:
        return fallback, "Groq sentiment parsing failed. Used fallback sentiment model."


async def _fetch_youtube_comments(
    client: httpx.AsyncClient,
    api_key: str,
    video_id: str,
    max_comments: int,
) -> list[str]:
    comments: list[str] = []
    page_token: str | None = None

    while len(comments) < max_comments:
        batch_size = min(50, max_comments - len(comments))
        params = {
            "part": "snippet",
            "videoId": video_id,
            "maxResults": batch_size,
            "textFormat": "plainText",
            "order": "relevance",
            "key": api_key,
        }
        if page_token:
            params["pageToken"] = page_token

        try:
            payload = await fetch_json(
                client,
                "https://www.googleapis.com/youtube/v3/commentThreads",
                params=params,
            )
        except Exception:
            break

        rows = payload.get("items") if isinstance(payload.get("items"), list) else []
        if not rows:
            break

        for row in rows:
            snippet = (
                (row.get("snippet") or {})
                .get("topLevelComment", {})
                .get("snippet", {})
            )
            text = str(snippet.get("textDisplay") or snippet.get("textOriginal") or "").strip()
            if text:
                comments.append(text)
                if len(comments) >= max_comments:
                    break

        page_token = payload.get("nextPageToken")
        if not page_token:
            break

    return comments[:max_comments]


async def _fetch_instagram_item_detail(
    item_id: str,
    username_override: str | None,
    max_comments: int,
) -> dict[str, Any]:
    analytics = await fetch_instagram_analytics(username_override, media_limit=25)
    items = analytics.get("items") if isinstance(analytics.get("items"), list) else []

    selected = None
    for item in items:
        identifier = str(item.get("id") or "")
        if identifier == item_id:
            selected = item
            break

    if not selected:
        raise ValueError("Instagram post not found in latest media set.")

    likes = _safe_int(selected.get("like_count"))
    comments_count = _safe_int(selected.get("comments_count"))
    followers = _safe_int((analytics.get("metrics") or {}).get("followersCount"))
    permalink = str(selected.get("permalink") or "").strip()

    comments = [
        str(text).strip()
        for text in (selected.get("comments_preview") or [])
        if str(text).strip()
    ][:max_comments]

    thumbnail_candidates = _extract_instagram_thumbnail_candidates(selected, permalink)
    scrape_notes: list[str] = []

    apify_token = os.getenv("APIFY_API_TOKEN", "").strip()
    if apify_token and permalink:
        # Pull post-level details to get fresh thumbnail/comment fields.
        try:
            detail_rows = await _run_instagram_scraper(
                {
                    "directUrls": [permalink],
                    "resultsType": "details",
                    "resultsLimit": 1,
                },
                apify_token,
            )
            if detail_rows:
                detail_post = detail_rows[0]
                likes = max(likes, _safe_int(detail_post.get("likesCount")))
                comments_count = max(comments_count, _safe_int(detail_post.get("commentsCount")))

                latest_comment_rows = detail_post.get("latestComments") if isinstance(detail_post.get("latestComments"), list) else []
                comments = _extract_instagram_comment_texts(latest_comment_rows, max_comments) + comments

                thumbnail_candidates = _unique_non_empty(
                    thumbnail_candidates + _extract_instagram_thumbnail_candidates(detail_post, permalink)
                )
        except Exception as error:
            scrape_notes.append(f"Post detail fetch failed: {str(error)}")

        # If still sparse, fetch dedicated comments dataset.
        if len(_unique_non_empty(comments)) < min(5, max_comments):
            try:
                comment_rows = await _run_instagram_scraper(
                    {
                        "directUrls": [permalink],
                        "resultsType": "comments",
                        "resultsLimit": max_comments,
                    },
                    apify_token,
                )
                comments = comments + _extract_instagram_comment_texts(comment_rows, max_comments)
            except Exception as error:
                scrape_notes.append(f"Comments fetch failed: {str(error)}")

    comments = _unique_non_empty(comments)[:max_comments]
    thumbnail_candidates = _unique_non_empty(thumbnail_candidates)
    thumbnail = thumbnail_candidates[0] if thumbnail_candidates else None
    thumbnail_fallbacks = thumbnail_candidates[1:]

    sentiment, sentiment_note = await _analyze_sentiment_with_groq(comments)

    estimated_new_subscribers = _estimate_new_subscribers(likes, comments_count)
    engagement_rate = _engagement_rate(likes, comments_count, followers)

    notes: list[str] = [
        "New subscribers for Instagram posts are estimated from engagement signals.",
    ]
    notes.extend(scrape_notes[:2])
    if sentiment_note:
        notes.append(sentiment_note)

    return {
        "platform": "instagram",
        "itemId": str(selected.get("id") or item_id),
        "title": selected.get("caption") or "Instagram Post",
        "publishedAt": selected.get("publishedAt"),
        "permalink": permalink,
        "thumbnail": thumbnail,
        "thumbnailFallbacks": thumbnail_fallbacks,
        "metrics": {
            "likesCount": likes,
            "commentsCount": comments_count,
            "viewsCount": None,
            "estimatedNewSubscribers": estimated_new_subscribers,
            "engagementRate": engagement_rate,
        },
        "sentiment": sentiment,
        "comments": comments,
        "notes": notes,
    }


async def _fetch_youtube_item_detail(
    item_id: str,
    channel_id_override: str | None,
    max_comments: int,
) -> dict[str, Any]:
    api_key = os.getenv("YOUTUBE_API_KEY", "").strip()
    if not api_key:
        raise ValueError("Missing YOUTUBE_API_KEY in backend environment.")

    channel_id = channel_id_override or os.getenv("YOUTUBE_CHANNEL_ID", "").strip()

    async with httpx.AsyncClient(timeout=25.0) as client:
        video_payload = await fetch_json(
            client,
            "https://www.googleapis.com/youtube/v3/videos",
            params={
                "part": "snippet,statistics",
                "id": item_id,
                "key": api_key,
            },
        )

        video_rows = video_payload.get("items") if isinstance(video_payload.get("items"), list) else []
        if not video_rows:
            raise ValueError("YouTube video not found.")

        video = video_rows[0]
        snippet = video.get("snippet") or {}
        stats = video.get("statistics") or {}

        comments = await _fetch_youtube_comments(client, api_key, item_id, max_comments=max_comments)

        subscribers_count = 0
        if channel_id:
            try:
                channel_payload = await fetch_json(
                    client,
                    "https://www.googleapis.com/youtube/v3/channels",
                    params={
                        "part": "statistics",
                        "id": channel_id,
                        "key": api_key,
                    },
                )
                channel_rows = channel_payload.get("items") if isinstance(channel_payload.get("items"), list) else []
                if channel_rows:
                    subscribers_count = _safe_int((channel_rows[0].get("statistics") or {}).get("subscriberCount"))
            except Exception:
                subscribers_count = 0

    likes = _safe_int(parse_number(stats.get("likeCount"), 0))
    comments_count = _safe_int(parse_number(stats.get("commentCount"), 0))
    views = _safe_int(parse_number(stats.get("viewCount"), 0))

    sentiment, sentiment_note = await _analyze_sentiment_with_groq(comments)

    estimated_new_subscribers = _estimate_new_subscribers(likes, comments_count, views)
    engagement_rate = _engagement_rate(likes, comments_count, views)

    thumbnails = snippet.get("thumbnails") or {}
    thumbnail = (
        (thumbnails.get("high") or {}).get("url")
        or (thumbnails.get("medium") or {}).get("url")
        or (thumbnails.get("default") or {}).get("url")
    )

    notes: list[str] = [
        "New subscribers per video are estimated from views and engagement signals.",
    ]
    if not subscribers_count:
        notes.append("Channel subscribers were unavailable for this request.")
    if sentiment_note:
        notes.append(sentiment_note)

    return {
        "platform": "youtube",
        "itemId": item_id,
        "title": snippet.get("title") or "YouTube Video",
        "publishedAt": snippet.get("publishedAt"),
        "permalink": f"https://www.youtube.com/watch?v={item_id}",
        "thumbnail": thumbnail,
        "metrics": {
            "likesCount": likes,
            "commentsCount": comments_count,
            "viewsCount": views,
            "subscribersCount": subscribers_count,
            "estimatedNewSubscribers": estimated_new_subscribers,
            "engagementRate": engagement_rate,
        },
        "sentiment": sentiment,
        "comments": comments,
        "notes": notes,
    }


async def fetch_analytics_item_detail(
    platform: str,
    item_id: str,
    username_override: str | None,
    channel_id_override: str | None,
    max_comments: int,
) -> dict[str, Any]:
    normalized_platform = (platform or "").strip().lower()

    if normalized_platform == "instagram":
        return await _fetch_instagram_item_detail(item_id, username_override, max_comments)

    if normalized_platform == "youtube":
        return await _fetch_youtube_item_detail(item_id, channel_id_override, max_comments)

    raise ValueError("Detailed analysis is currently available only for Instagram and YouTube.")
