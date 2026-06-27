import asyncio
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.core.live_store import live_store
from app.services.digital_producer_service import build_initial_item
from app.services.live_store_service import detect_content_type, detect_link, process_live_store_item

router = APIRouter(prefix="/whatsapp")


@router.post("/webhook")
async def whatsapp_webhook(request: Request) -> JSONResponse:
    content_type = request.headers.get("content-type", "")
    payload: dict[str, Any] = {}

    if "application/json" in content_type:
        payload = await request.json()
    else:
        form = await request.form()
        payload = dict(form)

    def _first(value: Any) -> Any:
        if isinstance(value, list):
            return value[0] if value else None
        return value

    body = _first(payload.get("Body")) or _first(payload.get("text")) or ""
    from_number = _first(payload.get("From")) or _first(payload.get("from_number"))
    profile_name = _first(payload.get("ProfileName")) or _first(payload.get("profile_name"))

    num_media = int(_first(payload.get("NumMedia")) or _first(payload.get("num_media")) or 0)
    media_url = _first(payload.get("MediaUrl0")) or _first(payload.get("media_url"))
    media_type = _first(payload.get("MediaContentType0")) or _first(payload.get("media_type"))

    if num_media == 0:
        media_url = payload.get("media_url") or media_url
        media_type = payload.get("media_type") or media_type

    link = _first(payload.get("link")) or detect_link(body)

    content_kind = _first(payload.get("content_type")) or detect_content_type(media_type)

    item_payload = {
        "text": body,
        "link": link,
        "media_url": media_url,
        "media_type": media_type,
        "content_type": content_kind,
        "niche": _first(payload.get("niche")),
        "from_number": from_number,
        "profile_name": profile_name,
    }

    item = await live_store.add_item(build_initial_item(item_payload))
    await live_store.broadcast({"type": "live_store.item", "payload": item})

    asyncio.create_task(process_live_store_item(item["id"], from_number))

    return JSONResponse(content={"status": "accepted", "item_id": item["id"]})
