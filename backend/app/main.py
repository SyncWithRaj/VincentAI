from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pathlib import Path
from app.api.routes import router as api_router
from app.api.linkedin_auth import router as linkedin_oauth_router
from app.core.config import get_backend_port, get_frontend_origin
from app.core.live_store import live_store

app = FastAPI(title="Backend Analytics API", version="1.0.0")

frontend_origin = get_frontend_origin()
allow_origins = ["*"] if frontend_origin == "*" else [frontend_origin]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(linkedin_oauth_router)


ROOT_DIR = Path(__file__).resolve().parents[2]
DEMO_VIDEO_PATH = ROOT_DIR / "frontend" / "public" / "demo_video_TTSV.mp4"


@app.get("/demo_video_TTSV.mp4", include_in_schema=False)
async def serve_demo_video() -> FileResponse:
    if not DEMO_VIDEO_PATH.exists():
        raise HTTPException(status_code=404, detail="Demo video not found.")
    return FileResponse(str(DEMO_VIDEO_PATH), media_type="video/mp4")


@app.websocket("/ws/live-store")
async def live_store_ws(websocket: WebSocket):
    await live_store.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await live_store.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn

    port = get_backend_port()
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
