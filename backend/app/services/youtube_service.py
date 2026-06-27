import os
import asyncio
from datetime import date, timedelta
from typing import Any

import httpx

from app.core.config import get_youtube_analytics_lookback_days
from app.core.exceptions import UpstreamRequestError
from app.core.http import fetch_json, parse_number


async def fetch_youtube_comment_preview(
    client: httpx.AsyncClient,
    api_key: str,
    video_id: str,
    max_comments: int = 3,
) -> list[str]:
    if not video_id:
        return []

    try:
        payload = await fetch_json(
            client,
            "https://www.googleapis.com/youtube/v3/commentThreads",
            params={
                "part": "snippet",
                "videoId": video_id,
                "maxResults": max_comments,
                "textFormat": "plainText",
                "order": "relevance",
                "key": api_key,
            },
        )
    except Exception:
        return []

    rows = payload.get("items") if isinstance(payload.get("items"), list) else []
    comments: list[str] = []
    for row in rows:
        top_level = (
            (row.get("snippet") or {})
            .get("topLevelComment", {})
            .get("snippet", {})
        )
        text = str(top_level.get("textDisplay") or top_level.get("textOriginal") or "").strip()
        if text:
            comments.append(text)

    return comments[:max_comments]


async def get_youtube_oauth_access_token(client: httpx.AsyncClient) -> str | None:
    # Option 1: use a pre-generated short-lived OAuth access token.
    direct_access_token = os.getenv("YOUTUBE_OAUTH_ACCESS_TOKEN", "").strip()
    if direct_access_token:
        return direct_access_token

    # Option 2: generate an access token using refresh token flow.
    client_id = os.getenv("YOUTUBE_CLIENT_ID", "").strip()
    client_secret = os.getenv("YOUTUBE_CLIENT_SECRET", "").strip()
    refresh_token = os.getenv("YOUTUBE_REFRESH_TOKEN", "").strip()

    if not (client_id and client_secret and refresh_token):
        return None

    token_response = await client.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
    )

    try:
        token_payload = token_response.json()
    except ValueError:
        token_payload = {}

    if token_response.status_code >= 400:
        message = (
            token_payload.get("error_description")
            or token_payload.get("error")
            or f"OAuth token request failed: {token_response.status_code}"
        )
        raise UpstreamRequestError(token_response.status_code, message, token_payload)

    access_token = token_payload.get("access_token")
    if not access_token:
        raise UpstreamRequestError(
            500,
            "OAuth token response missing access_token.",
            token_payload,
        )

    return access_token


async def fetch_youtube_analytics_metrics(
    client: httpx.AsyncClient,
    oauth_access_token: str,
    lookback_days: int,
) -> dict[str, int | float]:
    safe_lookback_days = max(1, lookback_days)
    end_date = date.today() - timedelta(days=1)
    start_date = end_date - timedelta(days=safe_lookback_days - 1)

    async def run_report(metrics: str) -> dict[str, Any]:
        payload = await fetch_json(
            client,
            "https://youtubeanalytics.googleapis.com/v2/reports",
            params={
                "ids": "channel==MINE",
                "startDate": start_date.isoformat(),
                "endDate": end_date.isoformat(),
                "metrics": metrics,
            },
            headers={"Authorization": f"Bearer {oauth_access_token}"},
        )
        return payload

    def payload_to_metrics_map(payload: dict[str, Any]) -> dict[str, Any]:
        column_headers = payload.get("columnHeaders") if isinstance(payload.get("columnHeaders"), list) else []
        rows = payload.get("rows") if isinstance(payload.get("rows"), list) else []

        header_names: list[str] = []
        for header in column_headers:
            if isinstance(header, dict):
                name = str(header.get("name", ""))
                header_names.append(name.split(".")[-1])

        row_values: list[Any] = rows[0] if rows else []
        metrics_map: dict[str, Any] = {}
        for index, header_name in enumerate(header_names):
            if index < len(row_values):
                metrics_map[header_name] = row_values[index]

        return metrics_map

    # Try supported metric combinations in order.
    # `viewerPercentage` is used as the closest available Analytics metric when
    # direct impression-like metric is unavailable.
    primary_metrics = "views,uniqueViewers,viewerPercentage"
    fallback_metrics = "views,uniqueViewers"
    legacy_metrics = "views"

    errors: list[str] = []

    for metrics_query in (primary_metrics, fallback_metrics, legacy_metrics):
        try:
            payload = await run_report(metrics_query)
            metrics_map = payload_to_metrics_map(payload)

            views = parse_number(metrics_map.get("views"), 0)
            unique_viewers = parse_number(metrics_map.get("uniqueViewers"), 0)
            viewer_percentage = parse_number(metrics_map.get("viewerPercentage"), 0)

            reach = unique_viewers if unique_viewers else views

            # We cannot always fetch a true impressions metric from this report.
            # Use viewerPercentage when available as an Analytics-derived proxy;
            # otherwise fallback to views.
            impressions_like = viewer_percentage if viewer_percentage else views

            return {
                "impressions": impressions_like,
                "views": views,
                "reach": reach,
            }
        except UpstreamRequestError as error:
            errors.append(error.message)

    raise UpstreamRequestError(
        400,
        "YouTube Analytics API request failed for all metric combinations.",
        {"errors": errors},
    )


async def fetch_youtube_analytics(
    channel_id_override: str | None,
    max_results: int,
) -> dict[str, Any]:
    api_key = os.getenv("YOUTUBE_API_KEY", "")
    channel_id = channel_id_override or os.getenv("YOUTUBE_CHANNEL_ID", "")

    if not api_key:
        raise ValueError("Missing YOUTUBE_API_KEY in backend environment.")

    if not channel_id:
        raise ValueError(
            "Missing YouTube channel ID. Provide channelId query param or YOUTUBE_CHANNEL_ID in backend environment."
        )

    channels_params = {
        "part": "snippet,statistics",
        "id": channel_id,
        "key": api_key,
    }
    recent_videos_params = {
        "part": "snippet",
        "channelId": channel_id,
        "order": "date",
        "type": "video",
        "maxResults": max_results,
        "key": api_key,
    }

    analytics_lookback_days = get_youtube_analytics_lookback_days()

    async with httpx.AsyncClient(timeout=25.0) as client:
        channels_payload = await fetch_json(
            client,
            "https://www.googleapis.com/youtube/v3/channels",
            channels_params,
        )

        items = channels_payload.get("items") if isinstance(channels_payload.get("items"), list) else []
        channel = items[0] if items else None

        if not channel:
            raise UpstreamRequestError(
                404,
                "No YouTube channel found for the given channelId.",
            )

        recent_payload = await fetch_json(
            client,
            "https://www.googleapis.com/youtube/v3/search",
            recent_videos_params,
        )

        recent_items = recent_payload.get("items") if isinstance(recent_payload.get("items"), list) else []
        video_ids = [
            item.get("id", {}).get("videoId")
            for item in recent_items
            if isinstance(item, dict) and item.get("id", {}).get("videoId")
        ]

        comment_results = await asyncio.gather(
            *(
                fetch_youtube_comment_preview(client, api_key, video_id)
                for video_id in video_ids
            ),
            return_exceptions=True,
        )
        comments_by_video_id: dict[str, list[str]] = {}
        for idx, video_id in enumerate(video_ids):
            result = comment_results[idx]
            comments_by_video_id[video_id] = result if isinstance(result, list) else []

        oauth_access_token = await get_youtube_oauth_access_token(client)

        analytics_metrics: dict[str, int | float] | None = None
        analytics_error: str | None = None

        if oauth_access_token:
            try:
                analytics_metrics = await fetch_youtube_analytics_metrics(
                    client,
                    oauth_access_token,
                    analytics_lookback_days,
                )
            except UpstreamRequestError as error:
                analytics_error = f"YouTube Analytics API error: {error.message}"

    recent_videos = [
        {
            "videoId": item.get("id", {}).get("videoId"),
            "title": item.get("snippet", {}).get("title"),
            "publishedAt": item.get("snippet", {}).get("publishedAt"),
            "thumbnail": (
                item.get("snippet", {}).get("thumbnails", {}).get("medium", {}).get("url")
                or item.get("snippet", {}).get("thumbnails", {}).get("default", {}).get("url")
            ),
            "comments_preview": comments_by_video_id.get(item.get("id", {}).get("videoId"), []),
        }
        for item in recent_items
    ]

    statistics = channel.get("statistics", {}) if isinstance(channel, dict) else {}
    snippet = channel.get("snippet", {}) if isinstance(channel, dict) else {}

    subscribers_count = parse_number(statistics.get("subscriberCount"), 0)
    total_views = parse_number(statistics.get("viewCount"), 0)
    videos_uploaded = parse_number(statistics.get("videoCount"), 0)

    reach_value = total_views
    impressions_value = total_views
    notes: list[str] = []

    if analytics_metrics:
        reach_value = parse_number(analytics_metrics.get("reach"), total_views)
        impressions_value = parse_number(
            analytics_metrics.get("impressions"),
            total_views,
        )
        notes.append(
            "YouTube Analytics API metrics are enabled. Reach uses uniqueViewers (or views fallback); impressions uses viewerPercentage when available."
        )
    else:
        if analytics_error:
            notes.append(analytics_error)
        notes.extend(
            [
                "Using YouTube Data API fallback values for reach/impressions.",
                "To fetch real YouTube Analytics metrics, configure OAuth in backend .env (YOUTUBE_OAUTH_ACCESS_TOKEN or refresh-token credentials).",
            ]
        )

    return {
        "platform": "youtube",
        "account": {"channelId": channel_id, "title": snippet.get("title")},
        "metrics": {
            "subscribersCount": subscribers_count,
            "estimatedReach": reach_value,
            "estimatedImpressions": impressions_value,
            "videosUploaded": videos_uploaded,
        },
        "notes": notes,
        "items": recent_videos,
    }
