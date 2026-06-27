import asyncio
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.live_store import live_store
from app.services.digital_producer_service import build_initial_item
from app.services.live_store_service import detect_content_type, detect_link, process_live_store_item

router = APIRouter(prefix="/live-store")


class LiveStoreIngestRequest(BaseModel):
    text: str | None = None
    link: str | None = None
    media_url: str | None = None
    media_type: str | None = None
    content_type: str | None = None
    niche: str | None = None
    from_number: str | None = None
    profile_name: str | None = None


@router.post("/ingest")
async def ingest_item(payload: LiveStoreIngestRequest) -> dict[str, Any]:
    link = payload.link or detect_link(payload.text)
    content_type = payload.content_type or detect_content_type(payload.media_type)

    item_payload = {
        "text": payload.text or "",
        "link": link,
        "media_url": payload.media_url,
        "media_type": payload.media_type,
        "content_type": content_type,
        "niche": payload.niche,
        "from_number": payload.from_number,
        "profile_name": payload.profile_name,
    }

    item = await live_store.add_item(build_initial_item(item_payload))
    await live_store.broadcast({"type": "live_store.item", "payload": item})

    asyncio.create_task(process_live_store_item(item["id"], payload.from_number))

    return {"item": item}


@router.get("/items")
async def list_items(limit: int = 30) -> dict[str, Any]:
    items = await live_store.list_items(limit)
    return {"items": items}


@router.get("/items/{item_id}")
async def get_item(item_id: str) -> dict[str, Any]:
    item = await live_store.get_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Live Store item not found.")
    return {"item": item}
