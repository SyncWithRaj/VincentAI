import re
from typing import Any

from app.core.live_store import live_store
from app.services.digital_producer_service import producer_app, build_dashboard_link, send_whatsapp_summary


def detect_link(text: str | None) -> str | None:
    if not text:
        return None
    match = re.search(r"https?://\S+", text)
    return match.group(0) if match else None


def detect_content_type(media_type: str | None) -> str:
    if not media_type:
        return "text"
    if media_type.startswith("image/"):
        return "image"
    if media_type.startswith("audio/"):
        return "audio"
    if media_type.startswith("video/"):
        return "video"
    return "text"


async def process_live_store_item(item_id: str, whatsapp_to: str | None) -> None:
    item = await live_store.get_item(item_id)
    if not item:
        return

    await live_store.update_item(item_id, {"status": "processing", "stage": "scrape"})
    updated = await live_store.get_item(item_id)
    if updated:
        await live_store.broadcast({"type": "live_store.update", "payload": updated})

    initial_state = {
        "item_id": item_id,
        "input_payload": item.get("input", {}),
        "platform_data": {},
        "algorithm_insights": [],
        "viral_prediction": {},
        "frame_analysis": {},
        "voice_to_viral": {},
        "trend_tracker": {},
        "executive_summary": "",
    }

    try:
        async for event in producer_app.astream(initial_state):
            for node_name, update in event.items():
                patched = await live_store.update_item(item_id, {**update, "stage": node_name})
                if patched:
                    await live_store.broadcast({"type": "live_store.update", "payload": patched})

        final_item = await live_store.update_item(item_id, {"status": "complete", "stage": "done"})
        if final_item:
            await live_store.broadcast({"type": "live_store.update", "payload": final_item})

        if whatsapp_to and final_item:
            summary = (final_item.get("executive_summary", "") if isinstance(final_item, dict) else "").strip()
            link_analysis = final_item.get("link_analysis") if isinstance(final_item, dict) else None
            if summary or link_analysis:
                await send_whatsapp_summary(
                    whatsapp_to,
                    summary,
                    build_dashboard_link(item_id),
                    link_analysis=link_analysis,
                )
    except Exception as error:
        error_item = await live_store.update_item(item_id, {"status": "error", "error": str(error), "stage": "error"})
        if error_item:
            await live_store.broadcast({"type": "live_store.update", "payload": error_item})
