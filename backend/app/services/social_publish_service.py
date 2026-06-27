import asyncio
import ipaddress
import os
from urllib.parse import urlunparse
from urllib.parse import urlparse
from typing import Any

import httpx


SUPPORTED_PLATFORMS = {"instagram", "linkedin", "twitter", "facebook"}
SUPPORTED_METHODS = {"raw_api", "composio"}


class SocialPublishError(ValueError):
    pass


def _trim_caption(text: str, limit: int = 3000) -> str:
    return (text or "").strip()[:limit]


def _non_empty(value: str | None) -> bool:
    return bool(value and value.strip())


def _to_bool(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def _headers_json(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def _is_inbound_composio_webhook(url: str) -> bool:
    """Detect misconfiguration where outbound publish URL points to our inbound event webhook."""
    parsed = urlparse((url or "").strip())
    return parsed.path.rstrip("/").endswith("/api/composio/webhook")


def _is_local_composio_executor(url: str) -> bool:
    parsed = urlparse((url or "").strip())
    return parsed.path.rstrip("/").endswith("/api/composio/publish-exec")


def _is_local_or_private_hostname(hostname: str | None) -> bool:
    host = str(hostname or "").strip().lower()
    if not host:
        return True
    if host in {"localhost", "127.0.0.1", "0.0.0.0"} or host.endswith(".local"):
        return True

    try:
        ip = ipaddress.ip_address(host)
        return ip.is_private or ip.is_loopback or ip.is_link_local
    except ValueError:
        return False


async def _detect_public_base_url() -> str | None:
    configured = (os.getenv("PUBLIC_BASE_URL") or os.getenv("NGROK_PUBLIC_URL") or "").strip()
    if configured:
        return configured.rstrip("/")

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            res = await client.get("http://127.0.0.1:4040/api/tunnels")
        if res.status_code >= 400:
            return None

        payload = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
        tunnels = payload.get("tunnels") if isinstance(payload, dict) else None
        if not isinstance(tunnels, list):
            return None

        # Prefer tunnels that point to backend :4000.
        preferred = None
        fallback = None
        for tunnel in tunnels:
            if not isinstance(tunnel, dict):
                continue
            public_url = str(tunnel.get("public_url") or "").strip().rstrip("/")
            if not public_url.startswith("https://"):
                continue
            config = tunnel.get("config") if isinstance(tunnel.get("config"), dict) else {}
            addr = str(config.get("addr") or "")
            if ":4000" in addr:
                preferred = public_url
                break
            if not fallback:
                fallback = public_url

        return preferred or fallback
    except Exception:
        return None


async def _public_video_url(video_url: str | None) -> str | None:
    raw = (video_url or "").strip()
    if not raw:
        return None

    parsed = urlparse(raw)
    if not _is_local_or_private_hostname(parsed.hostname):
        return raw

    base = await _detect_public_base_url()
    if not base:
        return raw

    base_parsed = urlparse(base)
    path = parsed.path or "/"
    if not path.startswith("/"):
        path = f"/{path}"

    return urlunparse((
        base_parsed.scheme,
        base_parsed.netloc,
        path,
        "",
        parsed.query,
        "",
    ))


def _nested_execution_proof(data: dict[str, Any]) -> tuple[str | None, str | None]:
    provider_response = data.get("provider_response")
    if not isinstance(provider_response, dict):
        return None, None

    execution = provider_response.get("execution")
    if not isinstance(execution, dict):
        return None, None

    execution_data = execution.get("data")
    execution_data = execution_data if isinstance(execution_data, dict) else {}

    execution_id = (
        execution.get("execution_id")
        or execution.get("run_id")
        or execution.get("job_id")
        or execution.get("id")
        or execution_data.get("execution_id")
        or execution_data.get("run_id")
        or execution_data.get("job_id")
    )
    status = (
        execution.get("status")
        or execution.get("state")
        or execution_data.get("status")
        or execution_data.get("state")
    )
    return execution_id, status


def get_publish_options() -> dict[str, Any]:
    instagram_raw_missing = [
        key for key in ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_USER_ID"] if not _non_empty(os.getenv(key))
    ]
    facebook_raw_missing = [
        key for key in ["FACEBOOK_PAGE_ACCESS_TOKEN", "FACEBOOK_PAGE_ID"] if not _non_empty(os.getenv(key))
    ]
    linkedin_raw_missing = [
        key for key in ["LINKEDIN_ACCESS_TOKEN", "LINKEDIN_AUTHOR_URN"] if not _non_empty(os.getenv(key))
    ]
    twitter_raw_missing = [
        key for key in ["X_ACCESS_TOKEN"] if not _non_empty(os.getenv(key))
    ]

    composio_webhook_url = (os.getenv("COMPOSIO_PUBLISH_WEBHOOK_URL") or "").strip()
    composio_missing = [
        key for key in ["COMPOSIO_PUBLISH_WEBHOOK_URL", "COMPOSIO_API_KEY"] if not _non_empty(os.getenv(key))
    ]
    if composio_webhook_url and _is_inbound_composio_webhook(composio_webhook_url):
        composio_missing.append("COMPOSIO_PUBLISH_WEBHOOK_URL (must be an executor endpoint, not /api/composio/webhook)")

    platforms = {
        "instagram": {
            "raw_api": {"ready": len(instagram_raw_missing) == 0, "missing": instagram_raw_missing},
            "composio": {"ready": len(composio_missing) == 0, "missing": composio_missing},
        },
        "facebook": {
            "raw_api": {"ready": len(facebook_raw_missing) == 0, "missing": facebook_raw_missing},
            "composio": {"ready": len(composio_missing) == 0, "missing": composio_missing},
        },
        "linkedin": {
            "raw_api": {"ready": len(linkedin_raw_missing) == 0, "missing": linkedin_raw_missing},
            "composio": {"ready": len(composio_missing) == 0, "missing": composio_missing},
        },
        "twitter": {
            "raw_api": {"ready": len(twitter_raw_missing) == 0, "missing": twitter_raw_missing},
            "composio": {"ready": len(composio_missing) == 0, "missing": composio_missing},
        },
    }

    recommended_method = "raw_api"
    if all(not v["raw_api"]["ready"] for v in platforms.values()) and all(v["composio"]["ready"] for v in platforms.values()):
        recommended_method = "composio"

    return {
        "methods": ["raw_api", "composio"],
        "recommended_method": recommended_method,
        "platforms": platforms,
        "notes": [
            "Instagram and Facebook video publishing requires a publicly accessible video URL.",
            "X/Twitter full video upload needs media upload flow (OAuth signing) or a Composio workflow.",
            "LinkedIn video publishing requires approved permissions and may require app review.",
            "COMPOSIO_PUBLISH_WEBHOOK_URL is an outbound executor URL. Do not set it to your inbound /api/composio/webhook endpoint.",
            "Recommended local value: http://127.0.0.1:4000/api/composio/publish-exec",
        ],
    }


async def publish_social_content(
    *,
    platform: str,
    caption: str,
    video_url: str | None = None,
    method: str = "raw_api",
) -> dict[str, Any]:
    normalized_platform = (platform or "").strip().lower()
    normalized_method = (method or "raw_api").strip().lower()
    normalized_caption = _trim_caption(caption)
    normalized_video_url = (video_url or "").strip() or None

    if normalized_platform not in SUPPORTED_PLATFORMS:
        raise SocialPublishError(f"Unsupported platform: {platform}")
    if normalized_method not in SUPPORTED_METHODS:
        raise SocialPublishError(f"Unsupported publish method: {method}")
    if not normalized_caption:
        raise SocialPublishError("Caption is required.")

    if normalized_method == "composio":
        return await _publish_via_composio(
            platform=normalized_platform,
            caption=normalized_caption,
            video_url=normalized_video_url,
        )

    if normalized_platform == "instagram":
        return await _publish_instagram(caption=normalized_caption, video_url=normalized_video_url)
    if normalized_platform == "facebook":
        return await _publish_facebook(caption=normalized_caption, video_url=normalized_video_url)
    if normalized_platform == "linkedin":
        return await _publish_linkedin(caption=normalized_caption, video_url=normalized_video_url)
    return await _publish_twitter(caption=normalized_caption, video_url=normalized_video_url)


async def _publish_via_composio(*, platform: str, caption: str, video_url: str | None) -> dict[str, Any]:
    webhook_url = os.getenv("COMPOSIO_PUBLISH_WEBHOOK_URL", "").strip()
    api_key = os.getenv("COMPOSIO_API_KEY", "").strip()

    if not webhook_url or not api_key:
        raise SocialPublishError(
            "Composio publish is not configured. Set COMPOSIO_PUBLISH_WEBHOOK_URL and COMPOSIO_API_KEY."
        )

    if _is_inbound_composio_webhook(webhook_url):
        raise SocialPublishError(
            "COMPOSIO_PUBLISH_WEBHOOK_URL is pointing to /api/composio/webhook, which is only for inbound events. "
            "Use your Composio workflow/tool-execution endpoint URL for outbound publishing."
        )

    # If this points to local executor endpoint, this is an expected in-app bridge flow.
    if _is_local_composio_executor(webhook_url):
        pass

    resolved_video_url = await _public_video_url(video_url)
    parsed_video_host = urlparse((resolved_video_url or "")).hostname if resolved_video_url else None
    if platform == "instagram" and resolved_video_url and _is_local_or_private_hostname(parsed_video_host):
        raise SocialPublishError(
            "Instagram publish requires a public video URL. Could not auto-map your local URL to a public tunnel. "
            "Start ngrok for backend (:4000) or set PUBLIC_BASE_URL/NGROK_PUBLIC_URL in backend/.env."
        )

    payload = {
        "platform": platform,
        "caption": caption,
        "video_url": resolved_video_url,
    }

    timeout_seconds_raw = (os.getenv("COMPOSIO_EXECUTOR_TIMEOUT_SECONDS") or "180").strip()
    try:
        timeout_seconds = max(30.0, float(timeout_seconds_raw))
    except ValueError:
        timeout_seconds = 180.0

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(
                webhook_url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
    except httpx.TimeoutException as exc:
        raise SocialPublishError(
            "Composio publish request timed out while waiting for executor response. "
            "Please retry in a moment, or increase COMPOSIO_EXECUTOR_TIMEOUT_SECONDS in backend/.env."
        ) from exc
    except httpx.HTTPError as exc:
        raise SocialPublishError(f"Composio publish request failed: {exc}") from exc

    if response.status_code >= 400:
        raise SocialPublishError(f"Composio publish failed ({response.status_code}): {response.text[:400]}")

    data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}

    post_id = data.get("post_id") or data.get("id")
    post_url = data.get("post_url") or data.get("url")
    execution_id = data.get("execution_id") or data.get("job_id") or data.get("run_id")
    status = str(data.get("status") or "").lower()

    if not execution_id or not status:
        nested_execution_id, nested_status = _nested_execution_proof(data)
        execution_id = execution_id or nested_execution_id
        status = status or str(nested_status or "").lower()

    has_success_status = any(
        token in status
        for token in ["published", "queued", "scheduled", "success", "completed", "executed", "ok"]
    )

    has_publish_proof = bool(
        post_id
        or post_url
        or execution_id
        or has_success_status
    )
    if not has_publish_proof:
        raise SocialPublishError(
            "Composio endpoint responded but did not return publish proof (post_id/post_url/execution_id). "
            "Your endpoint likely only acknowledges events and does not execute social publish actions."
        )

    return {
        "ok": bool(data.get("ok", True)),
        "platform": platform,
        "method": "composio",
        "post_id": post_id,
        "post_url": post_url,
        "notes": data.get("notes") or ["Published via Composio connector."],
        "provider_response": data,
    }


async def _publish_instagram(*, caption: str, video_url: str | None) -> dict[str, Any]:
    access_token = os.getenv("INSTAGRAM_ACCESS_TOKEN", "").strip()
    user_id = os.getenv("INSTAGRAM_USER_ID", "").strip()
    version = os.getenv("META_GRAPH_API_VERSION", "v25.0").strip() or "v25.0"

    if not access_token or not user_id:
        raise SocialPublishError("Instagram publish is not configured. Set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID.")
    if not video_url:
        raise SocialPublishError("Instagram publish requires a public video URL.")

    async with httpx.AsyncClient(timeout=45.0) as client:
        create_container = await client.post(
            f"https://graph.facebook.com/{version}/{user_id}/media",
            json={
                "media_type": "REELS",
                "video_url": video_url,
                "caption": caption,
                "access_token": access_token,
            },
        )

        if create_container.status_code >= 400:
            raise SocialPublishError(
                f"Instagram container creation failed ({create_container.status_code}): {create_container.text[:400]}"
            )

        container_id = create_container.json().get("id")
        if not container_id:
            raise SocialPublishError("Instagram container ID missing from API response.")

        status_code = "IN_PROGRESS"
        for _ in range(6):
            status_res = await client.get(
                f"https://graph.facebook.com/{version}/{container_id}",
                params={"fields": "status_code,status", "access_token": access_token},
            )
            if status_res.status_code < 400:
                status_json = status_res.json()
                status_code = str(status_json.get("status_code") or status_json.get("status") or "").upper()
                if status_code in {"FINISHED", "PUBLISHED"}:
                    break
                if status_code in {"ERROR", "EXPIRED"}:
                    raise SocialPublishError(f"Instagram processing failed with status={status_code}.")
            await asyncio.sleep(3)

        publish_res = await client.post(
            f"https://graph.facebook.com/{version}/{user_id}/media_publish",
            json={"creation_id": container_id, "access_token": access_token},
        )
        if publish_res.status_code >= 400:
            raise SocialPublishError(f"Instagram publish failed ({publish_res.status_code}): {publish_res.text[:400]}")

        media_id = publish_res.json().get("id")

    return {
        "ok": True,
        "platform": "instagram",
        "method": "raw_api",
        "post_id": media_id,
        "post_url": None,
        "notes": [
            "Instagram accepted the reel publish request.",
            "If visibility is delayed, poll media status in Meta dashboard.",
        ],
    }


async def _publish_facebook(*, caption: str, video_url: str | None) -> dict[str, Any]:
    access_token = os.getenv("FACEBOOK_PAGE_ACCESS_TOKEN", "").strip()
    page_id = os.getenv("FACEBOOK_PAGE_ID", "").strip()
    version = os.getenv("META_GRAPH_API_VERSION", "v25.0").strip() or "v25.0"

    if not access_token or not page_id:
        raise SocialPublishError("Facebook publish is not configured. Set FACEBOOK_PAGE_ACCESS_TOKEN and FACEBOOK_PAGE_ID.")
    if not video_url:
        raise SocialPublishError("Facebook publish requires a public video URL.")

    async with httpx.AsyncClient(timeout=45.0) as client:
        res = await client.post(
            f"https://graph-video.facebook.com/{version}/{page_id}/videos",
            data={
                "access_token": access_token,
                "description": caption,
                "file_url": video_url,
            },
        )

    if res.status_code >= 400:
        raise SocialPublishError(f"Facebook publish failed ({res.status_code}): {res.text[:400]}")

    video_id = res.json().get("id")
    post_url = f"https://www.facebook.com/{video_id}" if video_id else None
    return {
        "ok": True,
        "platform": "facebook",
        "method": "raw_api",
        "post_id": video_id,
        "post_url": post_url,
        "notes": ["Facebook video publish request completed."],
    }


async def _publish_linkedin(*, caption: str, video_url: str | None) -> dict[str, Any]:
    token = os.getenv("LINKEDIN_ACCESS_TOKEN", "").strip()
    author_urn = os.getenv("LINKEDIN_AUTHOR_URN", "").strip()
    linkedin_version = os.getenv("LINKEDIN_VERSION", "202506").strip() or "202506"

    if not token or not author_urn:
        raise SocialPublishError("LinkedIn publish is not configured. Set LINKEDIN_ACCESS_TOKEN and LINKEDIN_AUTHOR_URN.")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
        "Linkedin-Version": linkedin_version,
    }

    notes: list[str] = []
    video_urn = None

    if video_url and _to_bool(os.getenv("LINKEDIN_ENABLE_VIDEO_UPLOAD")):
        try:
            video_urn = await _linkedin_upload_video(headers=headers, owner_urn=author_urn, video_url=video_url)
            notes.append("LinkedIn video uploaded successfully.")
        except Exception as error:
            notes.append(f"LinkedIn video upload skipped: {str(error)}")

    post_body: dict[str, Any] = {
        "author": author_urn,
        "commentary": caption,
        "visibility": "PUBLIC",
        "distribution": {
            "feedDistribution": "MAIN_FEED",
            "targetEntities": [],
            "thirdPartyDistributionChannels": [],
        },
        "lifecycleState": "PUBLISHED",
        "isReshareDisabledByAuthor": False,
    }

    if video_urn:
        post_body["content"] = {
            "media": {
                "id": video_urn,
                "title": "AI Generated Video",
            }
        }

    async with httpx.AsyncClient(timeout=45.0) as client:
        post_res = await client.post("https://api.linkedin.com/rest/posts", headers=headers, json=post_body)

    if post_res.status_code >= 400:
        raise SocialPublishError(f"LinkedIn publish failed ({post_res.status_code}): {post_res.text[:400]}")

    post_id = post_res.headers.get("x-restli-id")
    post_url = None
    if post_id and "urn:li:" in post_id:
        post_url = f"https://www.linkedin.com/feed/update/{post_id}/"

    if not video_urn and video_url:
        notes.append("Video was not attached. Enable LINKEDIN_ENABLE_VIDEO_UPLOAD=true and ensure app permissions include video upload scopes.")

    return {
        "ok": True,
        "platform": "linkedin",
        "method": "raw_api",
        "post_id": post_id,
        "post_url": post_url,
        "notes": notes or ["LinkedIn post published."],
    }


async def _linkedin_upload_video(*, headers: dict[str, str], owner_urn: str, video_url: str) -> str:
    async with httpx.AsyncClient(timeout=80.0) as client:
        download_res = await client.get(video_url)
        if download_res.status_code >= 400:
            raise SocialPublishError(f"Failed to download video for LinkedIn upload ({download_res.status_code}).")
        video_bytes = download_res.content
        if not video_bytes:
            raise SocialPublishError("Downloaded LinkedIn video file is empty.")

        init_res = await client.post(
            "https://api.linkedin.com/rest/videos?action=initializeUpload",
            headers=headers,
            json={
                "initializeUploadRequest": {
                    "owner": owner_urn,
                    "fileSizeBytes": len(video_bytes),
                }
            },
        )
        if init_res.status_code >= 400:
            raise SocialPublishError(f"LinkedIn initialize upload failed ({init_res.status_code}): {init_res.text[:300]}")

        init_json = init_res.json()
        value = init_json.get("value", init_json)
        upload_url = None
        video_urn = None

        instructions = value.get("uploadInstructions") or value.get("upload_urls") or []
        if instructions and isinstance(instructions, list):
            first = instructions[0]
            if isinstance(first, dict):
                upload_url = first.get("uploadUrl") or first.get("upload_url")

        upload_url = upload_url or value.get("uploadUrl") or value.get("upload_url")
        video_urn = value.get("video") or value.get("videoUrn") or value.get("id")

        if not upload_url:
            raise SocialPublishError("LinkedIn upload URL missing from initializeUpload response.")

        upload_res = await client.put(
            upload_url,
            headers={"Content-Type": "application/octet-stream"},
            content=video_bytes,
        )
        if upload_res.status_code >= 400:
            raise SocialPublishError(f"LinkedIn binary upload failed ({upload_res.status_code}): {upload_res.text[:300]}")

        if not video_urn:
            raise SocialPublishError("LinkedIn video URN missing after upload.")

        return str(video_urn)


async def _publish_twitter(*, caption: str, video_url: str | None) -> dict[str, Any]:
    access_token = os.getenv("X_ACCESS_TOKEN", "").strip()
    media_id = os.getenv("X_MEDIA_ID", "").strip()

    if not access_token:
        raise SocialPublishError("X publish is not configured. Set X_ACCESS_TOKEN.")

    payload: dict[str, Any] = {"text": caption[:280]}
    notes: list[str] = []

    if media_id:
        payload["media"] = {"media_ids": [media_id]}
    elif video_url:
        notes.append(
            "Video attachment for X needs media upload (OAuth signed). Set X_MEDIA_ID from your upload pipeline or use Composio method."
        )

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(
            "https://api.x.com/2/tweets",
            headers=_headers_json(access_token),
            json=payload,
        )

    if res.status_code >= 400:
        raise SocialPublishError(f"X publish failed ({res.status_code}): {res.text[:400]}")

    data = res.json().get("data", {})
    post_id = data.get("id")
    post_url = f"https://x.com/i/web/status/{post_id}" if post_id else None

    if not media_id and video_url:
        notes.append("Posted as text-only because no uploaded X media ID was configured.")

    return {
        "ok": True,
        "platform": "twitter",
        "method": "raw_api",
        "post_id": post_id,
        "post_url": post_url,
        "notes": notes or ["X post published."],
    }
