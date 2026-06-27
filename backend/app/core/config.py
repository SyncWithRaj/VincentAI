import os
from pathlib import Path

from dotenv import load_dotenv

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_ENV_PATH = _BACKEND_ROOT / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=True)


def get_frontend_origin() -> str:
    return os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")


def get_backend_port() -> int:
    try:
        return int(os.getenv("PORT", "4000"))
    except ValueError:
        return 4000


def get_youtube_analytics_lookback_days() -> int:
    try:
        return int(os.getenv("YOUTUBE_ANALYTICS_LOOKBACK_DAYS", "28"))
    except ValueError:
        return 28
