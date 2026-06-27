from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.core.exceptions import UpstreamRequestError
from app.services.instagram_service import fetch_instagram_analytics
from app.services.youtube_service import fetch_youtube_analytics
from app.services.twitter_service import fetch_twitter_analytics
from app.services.linkedin_service import fetch_linkedin_analytics
from app.services.analytics_detail_service import fetch_analytics_item_detail
from app.api.agent_routes import router as agent_router
from app.api.trend_routes import router as trend_router
from app.api.publish_routes import router as publish_router
from app.api.composio_routes import router as composio_router
from app.api.live_store_routes import router as live_store_router
from app.api.whatsapp_routes import router as whatsapp_router

router = APIRouter(prefix="/api")
router.include_router(agent_router)
router.include_router(trend_router)
router.include_router(publish_router)
router.include_router(composio_router)
router.include_router(live_store_router)
router.include_router(whatsapp_router)


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/analytics/instagram")
async def get_instagram_analytics(
    username: str | None = Query(default=None),
    mediaLimit: int = Query(default=10, ge=1, le=25),
) -> JSONResponse:
    try:
        payload = await fetch_instagram_analytics(username, mediaLimit)
        return JSONResponse(content=payload)
    except ValueError as error:
        return JSONResponse(status_code=400, content={"message": str(error)})
    except UpstreamRequestError as error:
        return JSONResponse(
            status_code=error.status_code,
            content={"message": error.message, "details": error.payload},
        )
    except Exception as error:
        return JSONResponse(
            status_code=500,
            content={
                "message": "Failed to fetch Instagram analytics.",
                "details": str(error),
            },
        )


@router.get("/analytics/youtube")
async def get_youtube_analytics(
    channelId: str | None = Query(default=None),
    maxResults: int = Query(default=8, ge=1, le=20),
) -> JSONResponse:
    try:
        payload = await fetch_youtube_analytics(channelId, maxResults)
        return JSONResponse(content=payload)
    except ValueError as error:
        return JSONResponse(status_code=400, content={"message": str(error)})
    except UpstreamRequestError as error:
        return JSONResponse(
            status_code=error.status_code,
            content={"message": error.message, "details": error.payload},
        )
    except Exception as error:
        import traceback
        return JSONResponse(
            status_code=500,
            content={"message": "Failed to fetch YouTube analytics.", "details": str(error), "traceback": traceback.format_exc()},
        )

@router.get("/analytics/twitter")
async def get_twitter_analytics(
    username: str | None = Query(default=None),
    maxResults: int = Query(default=10, ge=1, le=100),
) -> JSONResponse:
    try:
        payload = await fetch_twitter_analytics(username, maxResults)
        return JSONResponse(content=payload)
    except ValueError as error:
        return JSONResponse(status_code=400, content={"message": str(error)})
    except UpstreamRequestError as error:
        return JSONResponse(
            status_code=error.status_code,
            content={"message": error.message, "details": error.payload},
        )
    except Exception as error:
        import traceback
        return JSONResponse(
            status_code=500,
            content={"message": "Failed to fetch Twitter analytics.", "details": str(error), "traceback": traceback.format_exc()},
        )

@router.get("/analytics/linkedin")
async def get_linkedin_analytics(
    profileUrl: str | None = Query(default=None),
    maxResults: int = Query(default=5, ge=1, le=50),
) -> JSONResponse:
    try:
        payload = await fetch_linkedin_analytics(profileUrl, maxResults)
        return JSONResponse(content=payload)
    except ValueError as error:
        return JSONResponse(status_code=400, content={"message": str(error)})
    except UpstreamRequestError as error:
        return JSONResponse(
            status_code=error.status_code,
            content={"message": error.message, "details": error.payload},
        )
    except Exception as error:
        import traceback
        return JSONResponse(
            status_code=500,
            content={"message": "Failed to fetch LinkedIn analytics.", "details": str(error), "traceback": traceback.format_exc()},
        )


@router.get("/analytics/detail")
async def get_analytics_item_detail(
    platform: str = Query(...),
    itemId: str = Query(...),
    username: str | None = Query(default=None),
    channelId: str | None = Query(default=None),
    maxComments: int = Query(default=80, ge=1, le=200),
) -> JSONResponse:
    try:
        payload = await fetch_analytics_item_detail(
            platform=platform,
            item_id=itemId,
            username_override=username,
            channel_id_override=channelId,
            max_comments=maxComments,
        )
        return JSONResponse(content=payload)
    except ValueError as error:
        return JSONResponse(status_code=400, content={"message": str(error)})
    except UpstreamRequestError as error:
        return JSONResponse(
            status_code=error.status_code,
            content={"message": error.message, "details": error.payload},
        )
    except Exception as error:
        import traceback
        return JSONResponse(
            status_code=500,
            content={
                "message": "Failed to fetch analytics item detail.",
                "details": str(error),
                "traceback": traceback.format_exc(),
            },
        )
