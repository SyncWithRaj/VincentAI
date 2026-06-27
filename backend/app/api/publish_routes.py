from typing import Literal
import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.services.social_publish_service import (
    SocialPublishError,
    get_publish_options,
    publish_social_content,
)


router = APIRouter(prefix="/publish")
logger = logging.getLogger(__name__)


class SocialPublishRequest(BaseModel):
    platform: Literal["instagram", "linkedin", "twitter", "facebook"]
    caption: str
    videoUrl: str | None = None
    method: Literal["raw_api", "composio"] = "raw_api"


@router.get("/options")
async def get_social_publish_options() -> JSONResponse:
    return JSONResponse(content=get_publish_options())


@router.post("/social")
async def publish_social_post(body: SocialPublishRequest) -> JSONResponse:
    try:
        payload = await publish_social_content(
            platform=body.platform,
            caption=body.caption,
            video_url=body.videoUrl,
            method=body.method,
        )
        return JSONResponse(content=payload)
    except SocialPublishError as error:
        return JSONResponse(
            status_code=400,
            content={"ok": False, "message": str(error), "error_type": type(error).__name__},
        )
    except Exception as error:
        logger.exception("Unhandled error while publishing social content")
        details = str(error) or repr(error)
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "message": "Failed to publish content.",
                "details": details,
                "error_type": type(error).__name__,
            },
        )
