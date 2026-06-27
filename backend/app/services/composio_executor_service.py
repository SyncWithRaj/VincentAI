import os
from typing import Any

import httpx


COMPOSIO_BASE_URL = "https://backend.composio.dev"


class ComposioExecutionError(ValueError):
    pass


def _headers(api_key: str) -> dict[str, str]:
    return {
        "x-api-key": api_key,
        "Content-Type": "application/json",
    }


def _is_toolkit_like_slug(candidate: str, platform: str) -> bool:
    value = (candidate or "").strip()
    if not value:
        return True
    lowered = value.lower()
    # Tool slugs from Composio are usually action-like (e.g. INSTAGRAM_POST_IG_USER_MEDIA),
    # while plain toolkit names (instagram/linkedin/twitter/facebook) are not executable tools.
    return lowered in {"instagram", "linkedin", "twitter", "facebook", platform.lower()}


def _pick_tool_slug(search_json: dict[str, Any]) -> str | None:
    results = search_json.get("results") or []
    if not isinstance(results, list) or not results:
        return None

    first = results[0] or {}
    primary = first.get("primary_tool_slugs") or []
    related = first.get("related_tool_slugs") or []

    if isinstance(primary, list) and primary:
        return str(primary[0])
    if isinstance(related, list) and related:
        return str(related[0])
    return None


def _all_tool_slugs(search_json: dict[str, Any]) -> list[str]:
    results = search_json.get("results") or []
    if not isinstance(results, list) or not results:
        return []

    first = results[0] or {}
    primary = first.get("primary_tool_slugs") or []
    related = first.get("related_tool_slugs") or []
    combined = [*primary, *related]

    unique: list[str] = []
    seen: set[str] = set()
    for slug in combined:
        text = str(slug or "").strip()
        if not text:
            continue
        upper = text.upper()
        if upper in seen:
            continue
        seen.add(upper)
        unique.append(text)
    return unique


def _pick_instagram_publish_slug(search_json: dict[str, Any]) -> str | None:
    slugs = _all_tool_slugs(search_json)
    if not slugs:
        return None

    # Prefer the explicit IG publish endpoint.
    for slug in slugs:
        upper = slug.upper()
        if "IG_USER_MEDIA_PUBLISH" in upper:
            return slug

    # Fallback to any publish-like Instagram tool.
    for slug in slugs:
        upper = slug.upper()
        if "INSTAGRAM" in upper and "PUBLISH" in upper:
            return slug

    return None


def _pick_instagram_create_slug(search_json: dict[str, Any]) -> str | None:
    slugs = _all_tool_slugs(search_json)
    if not slugs:
        return None

    # Prefer media container creation endpoint.
    for slug in slugs:
        upper = slug.upper()
        if "IG_USER_MEDIA" in upper and "PUBLISH" not in upper:
            return slug

    return None


def _extract_toolkit_user_id(search_json: dict[str, Any], toolkit: str) -> str | None:
    statuses = search_json.get("toolkit_connection_statuses") if isinstance(search_json, dict) else None
    if not isinstance(statuses, list):
        return None

    tk = (toolkit or "").strip().lower()
    for item in statuses:
        if str((item or {}).get("toolkit", "")).strip().lower() != tk:
            continue
        info = item.get("current_user_info") if isinstance(item, dict) else None
        if isinstance(info, dict):
            user_id = info.get("id") or info.get("user_id")
            if user_id:
                return str(user_id).strip()
    return None


def _candidate_values(platform: str, caption: str, video_url: str | None) -> dict[str, Any]:
    return {
        "platform": platform,
        "text": caption,
        "caption": caption,
        "message": caption,
        "content": caption,
        "description": caption,
        "post_text": caption,
        "tweet_text": caption,
        "body": caption,
        "url": video_url,
        "video_url": video_url,
        "media_url": video_url,
        "file_url": video_url,
        "source_url": video_url,
        "reel_url": video_url,
    }


def _platform_specific_value(*, platform: str, key: str, video_url: str | None) -> Any:
    lowered = key.lower()

    if platform == "instagram":
        if lowered in {"ig_user_id", "instagram_user_id"}:
            return (
                (os.getenv("COMPOSIO_INSTAGRAM_IG_USER_ID") or "").strip()
                or (os.getenv("INSTAGRAM_USER_ID") or "").strip()
                or None
            )
        if lowered == "media_type":
            configured = (os.getenv("COMPOSIO_INSTAGRAM_MEDIA_TYPE") or "").strip().upper()
            if configured:
                return configured
            return "REELS" if video_url else "CAROUSEL"

    return None


def _infer_arguments(
    schema: dict[str, Any] | None,
    *,
    platform: str,
    caption: str,
    video_url: str | None,
) -> dict[str, Any]:
    # Default-safe payload when schema is missing.
    if not schema:
        payload = {"caption": caption, "text": caption}
        if video_url:
            payload["video_url"] = video_url
        return payload

    properties = schema.get("properties") if isinstance(schema, dict) else None
    required = schema.get("required") if isinstance(schema, dict) else None

    args: dict[str, Any] = {}
    candidates = _candidate_values(platform, caption, video_url)

    if isinstance(properties, dict):
        for key, _definition in properties.items():
            platform_specific = _platform_specific_value(platform=platform, key=key, video_url=video_url)
            if platform_specific is not None:
                args[key] = platform_specific
                continue

            if key in candidates and candidates[key] is not None:
                args[key] = candidates[key]
                continue

            lowered = key.lower()
            if any(token in lowered for token in ["caption", "text", "message", "content", "description", "body"]):
                args[key] = caption
            elif any(token in lowered for token in ["video", "media", "file", "asset", "url", "link"]) and "type" not in lowered:
                # Avoid sending video URL into image/cover fields unless explicitly mapped.
                if video_url and "image" not in lowered and "cover" not in lowered and "thumbnail" not in lowered:
                    args[key] = video_url
            elif lowered in {"platform", "channel", "network"}:
                args[key] = platform

    # Ensure required fields are not left blank when we can infer a text fallback.
    if isinstance(required, list):
        for key in required:
            if key in args:
                continue
            lowered = str(key).lower()

            platform_specific = _platform_specific_value(platform=platform, key=str(key), video_url=video_url)
            if platform_specific is not None:
                args[key] = platform_specific
                continue

            if any(token in lowered for token in ["caption", "text", "message", "content", "description", "body", "title"]):
                args[key] = caption
            elif any(token in lowered for token in ["video", "media", "file", "asset", "url", "link"]) and "type" not in lowered and video_url:
                if "image" not in lowered and "cover" not in lowered and "thumbnail" not in lowered:
                    args[key] = video_url
            elif lowered in {"platform", "channel", "network"}:
                args[key] = platform

    return args


def _first_non_empty(*values: Any) -> str | None:
    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return None


def _resolve_timeout_seconds() -> float:
    raw = (os.getenv("COMPOSIO_EXECUTOR_TIMEOUT_SECONDS") or "180").strip()
    try:
        return max(30.0, float(raw))
    except ValueError:
        return 180.0


async def _post_json(
    client: httpx.AsyncClient,
    *,
    url: str,
    headers: dict[str, str],
    payload: dict[str, Any],
    action: str,
) -> httpx.Response:
    try:
        return await client.post(url, headers=headers, json=payload)
    except httpx.TimeoutException as exc:
        raise ComposioExecutionError(
            f"Composio {action} timed out. Retry in a moment, or increase COMPOSIO_EXECUTOR_TIMEOUT_SECONDS."
        ) from exc
    except httpx.HTTPError as exc:
        raise ComposioExecutionError(f"Composio {action} request failed: {exc}") from exc


def _infer_instagram_publish_arguments(
    schema: dict[str, Any] | None,
    *,
    creation_id: str,
    ig_user_id: str | None,
) -> dict[str, Any]:
    # Safe fallback when schema is unavailable.
    if not schema:
        payload = {"creation_id": creation_id}
        if ig_user_id:
            payload["ig_user_id"] = ig_user_id
        return payload

    properties = schema.get("properties") if isinstance(schema, dict) else None
    required = schema.get("required") if isinstance(schema, dict) else None

    args: dict[str, Any] = {}

    def set_creation_id(key: str) -> None:
        if not args.get(key):
            args[key] = creation_id

    def set_ig_user_id(key: str) -> None:
        if ig_user_id and not args.get(key):
            args[key] = ig_user_id

    if isinstance(properties, dict):
        for key in properties.keys():
            lowered = str(key).lower()
            if lowered in {"ig_user_id", "instagram_user_id"}:
                set_ig_user_id(key)
            elif "creation" in lowered or lowered in {"container_id", "media_id", "id"}:
                set_creation_id(key)

    if isinstance(required, list):
        for key in required:
            key_str = str(key)
            lowered = key_str.lower()
            if lowered in {"ig_user_id", "instagram_user_id"}:
                set_ig_user_id(key_str)
            elif "creation" in lowered or lowered in {"container_id", "media_id", "id"}:
                set_creation_id(key_str)

    if not any("creation" in str(k).lower() for k in args.keys()):
        args["creation_id"] = creation_id
    if ig_user_id and not any(str(k).lower() in {"ig_user_id", "instagram_user_id"} for k in args.keys()):
        args["ig_user_id"] = ig_user_id

    # Video containers can legitimately need longer processing time before publish.
    props = properties if isinstance(properties, dict) else {}
    wait_raw = (os.getenv("COMPOSIO_INSTAGRAM_MAX_WAIT_SECONDS") or "180").strip()
    poll_raw = (os.getenv("COMPOSIO_INSTAGRAM_POLL_INTERVAL_SECONDS") or "3").strip()
    try:
        wait_val = max(60, min(300, int(wait_raw)))
    except ValueError:
        wait_val = 180
    try:
        poll_val = max(1, min(30, int(poll_raw)))
    except ValueError:
        poll_val = 3

    if "max_wait_seconds" in props and "max_wait_seconds" not in args:
        args["max_wait_seconds"] = wait_val
    if "poll_interval_seconds" in props and "poll_interval_seconds" not in args:
        args["poll_interval_seconds"] = poll_val

    return args


async def execute_publish_via_composio(*, platform: str, caption: str, video_url: str | None) -> dict[str, Any]:
    api_key = (os.getenv("COMPOSIO_API_KEY") or "").strip()
    if not api_key:
        raise ComposioExecutionError("COMPOSIO_API_KEY is missing.")

    user_id = (os.getenv("COMPOSIO_USER_ID") or "aify_default_user").strip()
    fixed_tool_slug = (os.getenv(f"COMPOSIO_{platform.upper()}_TOOL_SLUG") or "").strip()
    account_override = (os.getenv(f"COMPOSIO_{platform.upper()}_ACCOUNT") or "").strip()

    if _is_toolkit_like_slug(fixed_tool_slug, platform):
        fixed_tool_slug = ""

    use_case = (
        f"Publish a {platform} post with this caption and video URL. "
        f"Caption: {caption[:240]} "
        f"Video URL: {video_url or 'none'}"
    )

    timeout_seconds = _resolve_timeout_seconds()

    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        # 1) Create a session
        session_res = await _post_json(
            client,
            url=f"{COMPOSIO_BASE_URL}/api/v3/tool_router/session",
            headers=_headers(api_key),
            payload={"user_id": user_id},
            action="session creation",
        )
        if session_res.status_code >= 400:
            raise ComposioExecutionError(
                f"Composio session creation failed ({session_res.status_code}): {session_res.text[:300]}"
            )
        session_json = session_res.json()
        session_id = session_json.get("session_id")
        if not session_id:
            raise ComposioExecutionError("Composio session_id missing from create session response.")

        # 2) Resolve tool slug (from env override or search)
        tool_slug = fixed_tool_slug
        search_json: dict[str, Any] = {}
        if not tool_slug or platform == "instagram":
            search_res = await _post_json(
                client,
                url=f"{COMPOSIO_BASE_URL}/api/v3/tool_router/session/{session_id}/search",
                headers=_headers(api_key),
                payload={"queries": [{"use_case": use_case}]},
                action="tool search",
            )
            if search_res.status_code >= 400:
                raise ComposioExecutionError(
                    f"Composio tool search failed ({search_res.status_code}): {search_res.text[:300]}"
                )
            search_json = search_res.json()

        if platform == "instagram":
            create_slug = _pick_instagram_create_slug(search_json)
            if tool_slug:
                if "PUBLISH" in tool_slug.upper() and create_slug:
                    tool_slug = create_slug
            elif create_slug:
                tool_slug = create_slug

        if not tool_slug:
            tool_slug = _pick_tool_slug(search_json)

        if not tool_slug:
            raise ComposioExecutionError(
                "Could not find a Composio publish tool slug automatically. "
                f"Set COMPOSIO_{platform.upper()}_TOOL_SLUG in .env after checking your connected toolkit tools."
            )

        tool_schema = None
        tool_schemas = search_json.get("tool_schemas") if isinstance(search_json, dict) else None
        if isinstance(tool_schemas, dict):
            candidate = tool_schemas.get(tool_slug)
            if isinstance(candidate, dict):
                tool_schema = candidate.get("input_schema")

        args = _infer_arguments(tool_schema, platform=platform, caption=caption, video_url=video_url)
        discovered_ig_user_id: str | None = None

        if platform == "instagram":
            discovered_ig_user_id = _extract_toolkit_user_id(search_json, "instagram")
            ig_keys: list[str] = []

            if isinstance(tool_schema, dict):
                properties = tool_schema.get("properties")
                if isinstance(properties, dict):
                    ig_keys.extend(
                        [k for k in properties.keys() if str(k).lower() in {"ig_user_id", "instagram_user_id"}]
                    )
                required = tool_schema.get("required")
                if isinstance(required, list):
                    ig_keys.extend(
                        [str(k) for k in required if str(k).lower() in {"ig_user_id", "instagram_user_id"}]
                    )

            if not ig_keys:
                ig_keys = ["ig_user_id"]

            for key in set(ig_keys):
                if not str(args.get(key) or "").strip() and discovered_ig_user_id:
                    args[key] = discovered_ig_user_id

        execute_payload: dict[str, Any] = {
            "tool_slug": tool_slug,
            "arguments": args,
        }
        if account_override:
            execute_payload["account"] = account_override

        # 3) Execute
        exec_res = await _post_json(
            client,
            url=f"{COMPOSIO_BASE_URL}/api/v3/tool_router/session/{session_id}/execute",
            headers=_headers(api_key),
            payload=execute_payload,
            action=f"execute ({tool_slug})",
        )
        if exec_res.status_code >= 400:
            raise ComposioExecutionError(
                f"Composio execute failed ({exec_res.status_code}): {exec_res.text[:500]}"
            )

        exec_json = exec_res.json()
        data = exec_json.get("data") if isinstance(exec_json, dict) else None
        data = data if isinstance(data, dict) else {}
        executed_tool_slug = tool_slug

        execution_error = _first_non_empty(
            exec_json.get("error"),
            data.get("error"),
            data.get("message"),
        )
        if execution_error:
            extra = ""
            if "ig_user_id" in execution_error:
                extra = " Set COMPOSIO_INSTAGRAM_IG_USER_ID (or INSTAGRAM_USER_ID) in backend/.env."
            if platform == "instagram" and "creation_id" in execution_error:
                extra = (
                    " Instagram publish tool requires media container creation first. "
                    "Leave COMPOSIO_INSTAGRAM_TOOL_SLUG blank or set it to INSTAGRAM_POST_IG_USER_MEDIA."
                )
            raise ComposioExecutionError(f"Composio execution error: {execution_error}.{extra}".strip())

        # Instagram often requires a 2-step flow: create container, then publish container.
        if platform == "instagram":
            publish_slug = _pick_instagram_publish_slug(search_json)
            if fixed_tool_slug and "PUBLISH" in fixed_tool_slug.upper():
                publish_slug = fixed_tool_slug
            if publish_slug and publish_slug.upper() != tool_slug.upper():
                creation_id = _first_non_empty(
                    data.get("creation_id"),
                    data.get("container_id"),
                    data.get("media_id"),
                    data.get("id"),
                )
                if not creation_id:
                    raise ComposioExecutionError(
                        "Instagram container creation succeeded but no creation id was returned for publish step."
                    )

                publish_schema = None
                if isinstance(tool_schemas, dict):
                    publish_candidate = tool_schemas.get(publish_slug)
                    if isinstance(publish_candidate, dict):
                        publish_schema = publish_candidate.get("input_schema")

                ig_user_id = _first_non_empty(
                    args.get("ig_user_id"),
                    args.get("instagram_user_id"),
                    discovered_ig_user_id,
                    os.getenv("COMPOSIO_INSTAGRAM_IG_USER_ID"),
                    os.getenv("INSTAGRAM_USER_ID"),
                )

                publish_args = _infer_instagram_publish_arguments(
                    publish_schema,
                    creation_id=creation_id,
                    ig_user_id=ig_user_id,
                )

                publish_payload: dict[str, Any] = {
                    "tool_slug": publish_slug,
                    "arguments": publish_args,
                }
                if account_override:
                    publish_payload["account"] = account_override

                publish_res = await _post_json(
                    client,
                    url=f"{COMPOSIO_BASE_URL}/api/v3/tool_router/session/{session_id}/execute",
                    headers=_headers(api_key),
                    payload=publish_payload,
                    action=f"publish execute ({publish_slug})",
                )
                if publish_res.status_code >= 400:
                    raise ComposioExecutionError(
                        f"Composio publish step failed ({publish_res.status_code}): {publish_res.text[:500]}"
                    )

                exec_json = publish_res.json()
                data = exec_json.get("data") if isinstance(exec_json, dict) else None
                data = data if isinstance(data, dict) else {}
                executed_tool_slug = publish_slug

                execution_error = _first_non_empty(
                    exec_json.get("error"),
                    data.get("error"),
                    data.get("message"),
                )
                if execution_error:
                    raise ComposioExecutionError(f"Composio publish step error: {execution_error}")

            if "publish" not in executed_tool_slug.lower():
                raise ComposioExecutionError(
                    "Instagram container was created but final publish step was not executed. "
                    "Set COMPOSIO_INSTAGRAM_TOOL_SLUG=INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH or leave it blank for auto flow."
                )

        post_id = data.get("post_id") or data.get("id") or data.get("tweet_id") or data.get("media_id")
        post_url = data.get("post_url") or data.get("url") or data.get("permalink")
        execution_id = _first_non_empty(
            exec_json.get("execution_id"),
            exec_json.get("run_id"),
            exec_json.get("job_id"),
            exec_json.get("id"),
            data.get("execution_id"),
            data.get("run_id"),
            data.get("job_id"),
        )
        status = _first_non_empty(
            exec_json.get("status"),
            exec_json.get("state"),
            data.get("status"),
            data.get("state"),
        )

        return {
            "ok": True,
            "platform": platform,
            "method": "composio",
            "post_id": post_id,
            "post_url": post_url,
            "execution_id": execution_id,
            "status": status,
            "notes": [
                f"Executed Composio tool: {executed_tool_slug}",
                "If no post URL is returned, inspect provider_response for platform-native IDs.",
            ],
            "provider_response": {
                "session_id": session_id,
                "tool_slug": executed_tool_slug,
                "initial_tool_slug": tool_slug,
                "arguments": args,
                "execution": exec_json,
            },
        }


async def get_toolkit_connection_status(*, toolkit: str) -> dict[str, Any]:
    api_key = (os.getenv("COMPOSIO_API_KEY") or "").strip()
    if not api_key:
        raise ComposioExecutionError("COMPOSIO_API_KEY is missing.")

    user_id = (os.getenv("COMPOSIO_USER_ID") or "aify_default_user").strip()
    tk = (toolkit or "").strip().lower()
    if not tk:
        raise ComposioExecutionError("Toolkit is required.")

    use_case = f"Publish a {tk} post with caption and video"

    timeout_seconds = _resolve_timeout_seconds()

    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        session_res = await _post_json(
            client,
            url=f"{COMPOSIO_BASE_URL}/api/v3/tool_router/session",
            headers=_headers(api_key),
            payload={"user_id": user_id},
            action="session creation",
        )
        if session_res.status_code >= 400:
            raise ComposioExecutionError(
                f"Composio session creation failed ({session_res.status_code}): {session_res.text[:300]}"
            )
        session_id = session_res.json().get("session_id")
        if not session_id:
            raise ComposioExecutionError("Composio session_id missing from create session response.")

        search_res = await _post_json(
            client,
            url=f"{COMPOSIO_BASE_URL}/api/v3/tool_router/session/{session_id}/search",
            headers=_headers(api_key),
            payload={"queries": [{"use_case": use_case}]},
            action="tool search",
        )
        if search_res.status_code >= 400:
            raise ComposioExecutionError(
                f"Composio tool search failed ({search_res.status_code}): {search_res.text[:300]}"
            )

        search_json = search_res.json()
        statuses = search_json.get("toolkit_connection_statuses") or []
        toolkit_status = None
        for item in statuses:
            if str(item.get("toolkit", "")).lower() == tk:
                toolkit_status = item
                break

        first_result = (search_json.get("results") or [{}])[0] or {}

        return {
            "ok": True,
            "user_id": user_id,
            "session_id": session_id,
            "toolkit": tk,
            "toolkit_status": toolkit_status,
            "primary_tool_slugs": first_result.get("primary_tool_slugs") or [],
            "related_tool_slugs": first_result.get("related_tool_slugs") or [],
        }


async def create_toolkit_connect_link(*, toolkit: str, callback_url: str | None = None) -> dict[str, Any]:
    api_key = (os.getenv("COMPOSIO_API_KEY") or "").strip()
    if not api_key:
        raise ComposioExecutionError("COMPOSIO_API_KEY is missing.")

    user_id = (os.getenv("COMPOSIO_USER_ID") or "aify_default_user").strip()
    tk = (toolkit or "").strip().lower()
    if not tk:
        raise ComposioExecutionError("Toolkit is required.")

    timeout_seconds = _resolve_timeout_seconds()

    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        session_res = await _post_json(
            client,
            url=f"{COMPOSIO_BASE_URL}/api/v3/tool_router/session",
            headers=_headers(api_key),
            payload={"user_id": user_id},
            action="session creation",
        )
        if session_res.status_code >= 400:
            raise ComposioExecutionError(
                f"Composio session creation failed ({session_res.status_code}): {session_res.text[:300]}"
            )
        session_id = session_res.json().get("session_id")
        if not session_id:
            raise ComposioExecutionError("Composio session_id missing from create session response.")

        body: dict[str, Any] = {"toolkit": tk}
        if callback_url:
            body["callback_url"] = callback_url

        link_res = await _post_json(
            client,
            url=f"{COMPOSIO_BASE_URL}/api/v3/tool_router/session/{session_id}/link",
            headers=_headers(api_key),
            payload=body,
            action=f"connect link ({tk})",
        )
        if link_res.status_code >= 400:
            raise ComposioExecutionError(
                f"Composio connect link failed ({link_res.status_code}): {link_res.text[:300]}"
            )

        link_json = link_res.json()
        return {
            "ok": True,
            "user_id": user_id,
            "session_id": session_id,
            "toolkit": tk,
            "redirect_url": link_json.get("redirect_url"),
            "link_token": link_json.get("link_token"),
            "connected_account_id": link_json.get("connected_account_id"),
            "provider_response": link_json,
        }
