from typing import Any

import httpx

from app.core.exceptions import UpstreamRequestError


def parse_number(value: Any, fallback: int | float = 0) -> int | float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback

    if parsed.is_integer():
        return int(parsed)
    return parsed


async def fetch_json(
    client: httpx.AsyncClient,
    url: str,
    params: dict[str, Any],
    headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    response = await client.get(url, params=params, headers=headers)

    try:
        payload = response.json()
    except ValueError:
        payload = {}

    if response.status_code >= 400:
        message = (
            payload.get("error", {}).get("message")
            if isinstance(payload, dict)
            else None
        ) or f"Upstream request failed: {response.status_code}"
        raise UpstreamRequestError(response.status_code, message, payload)

    if isinstance(payload, dict):
        return payload
    return {}
