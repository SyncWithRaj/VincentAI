import json
import os
import logging

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.services.composio_executor_service import (
    ComposioExecutionError,
    create_toolkit_connect_link,
    execute_publish_via_composio,
    get_toolkit_connection_status,
)


router = APIRouter(prefix="/composio")
logger = logging.getLogger(__name__)


class ComposioPublishExecRequest(BaseModel):
    platform: str
    caption: str
    video_url: str | None = None


@router.get("/webhook/health")
async def composio_webhook_health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/webhook")
async def composio_webhook_receiver(
    request: Request,
    x_composio_signature: str | None = Header(default=None),
) -> JSONResponse:
    expected_secret = os.getenv("COMPOSIO_WEBHOOK_SECRET", "").strip()

    if expected_secret and x_composio_signature != expected_secret:
        raise HTTPException(status_code=401, detail="Invalid Composio webhook signature.")

    payload = await request.json()

    try:
        event_type = payload.get("type") or payload.get("event")
        print("[COMPOSIO WEBHOOK]", event_type, json.dumps(payload)[:1200])
    except Exception:
        print("[COMPOSIO WEBHOOK] Received payload")

    return JSONResponse(content={"ok": True})


@router.post("/publish-exec")
async def composio_publish_exec(
    body: ComposioPublishExecRequest,
    authorization: str | None = Header(default=None),
) -> JSONResponse:
    expected_key = (os.getenv("COMPOSIO_API_KEY") or "").strip()
    bearer = (authorization or "").strip()

    if expected_key and bearer != f"Bearer {expected_key}":
        raise HTTPException(status_code=401, detail="Invalid authorization for composio publish executor.")

    try:
        payload = await execute_publish_via_composio(
            platform=(body.platform or "").strip().lower(),
            caption=body.caption,
            video_url=body.video_url,
        )
        return JSONResponse(content=payload)
    except ComposioExecutionError as error:
        return JSONResponse(status_code=400, content={"ok": False, "message": str(error)})
    except Exception as error:
        logger.exception("Unexpected error in /api/composio/publish-exec")
        return JSONResponse(status_code=500, content={"ok": False, "message": "Composio publish executor failed.", "details": str(error)})


@router.get("/connection-status")
async def composio_connection_status(toolkit: str) -> JSONResponse:
    try:
        payload = await get_toolkit_connection_status(toolkit=toolkit)
        return JSONResponse(content=payload)
    except ComposioExecutionError as error:
        return JSONResponse(status_code=400, content={"ok": False, "message": str(error)})
    except Exception as error:
        logger.exception("Unexpected error in /api/composio/connection-status")
        return JSONResponse(status_code=500, content={"ok": False, "message": "Failed to get Composio connection status.", "details": str(error)})


@router.post("/connect-link")
async def composio_connect_link(toolkit: str, callbackUrl: str | None = None) -> JSONResponse:
    try:
        payload = await create_toolkit_connect_link(toolkit=toolkit, callback_url=callbackUrl)
        return JSONResponse(content=payload)
    except ComposioExecutionError as error:
        return JSONResponse(status_code=400, content={"ok": False, "message": str(error)})
    except Exception as error:
        logger.exception("Unexpected error in /api/composio/connect-link")
        return JSONResponse(status_code=500, content={"ok": False, "message": "Failed to create Composio connect link.", "details": str(error)})
