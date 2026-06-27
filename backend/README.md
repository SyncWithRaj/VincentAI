# Backend Analytics API (FastAPI)

This backend keeps your API keys secure and exposes normalized endpoints for the frontend analytics page.

## 1. Setup

```bash
cd backend
python -m venv .venv
```

### Windows PowerShell

```bash
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

### macOS/Linux

```bash
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Fill `.env` with your values.
After changing any API key in `.env`, restart the backend process so new values are picked up.

For YouTube:
- `YOUTUBE_API_KEY` + `YOUTUBE_CHANNEL_ID` are used for channel/profile/recent videos.
- Real reach/impressions require YouTube Analytics API OAuth credentials:
	- either `YOUTUBE_OAUTH_ACCESS_TOKEN`
	- or `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`
	- OAuth scope must include: `https://www.googleapis.com/auth/yt-analytics.readonly`

For LinkedIn:
- Primary actor `dev_fusion/linkedin-profile-scraper` may be UI-only on free Apify plans.
- Optional fallback actor can be configured with `LINKEDIN_FALLBACK_ACTOR`.
- If actor scraping is unavailable, backend can fallback to LinkedIn OAuth profile (`/linkedin/auth`), when `LINKEDIN_ACCESS_TOKEN` is set.

For social publishing from Create Post with AI:
- `GET /api/publish/options` reports which platforms are currently configured.
- `POST /api/publish/social` publishes caption + video URL using either:
	- `raw_api` mode (direct platform APIs)
	- `composio` mode (your Composio webhook bridge)
- Composio inbound webhook receiver endpoint is available at:
	- `POST /api/composio/webhook`
	- Optional health check: `GET /api/composio/webhook/health`
- Important Composio URL distinction:
	- `POST /api/composio/webhook` is inbound only (Composio -> your app events)
	- `COMPOSIO_PUBLISH_WEBHOOK_URL` must be outbound executor URL (your app -> Composio workflow/tool execution)
	- Do not set `COMPOSIO_PUBLISH_WEBHOOK_URL` to `/api/composio/webhook`
	- Built-in outbound executor is available at `POST /api/composio/publish-exec`
	- Local recommended value: `COMPOSIO_PUBLISH_WEBHOOK_URL=http://127.0.0.1:4000/api/composio/publish-exec`
- Configure these env vars in `.env` as needed:
	- Instagram: `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID`
	- Facebook: `FACEBOOK_PAGE_ACCESS_TOKEN`, `FACEBOOK_PAGE_ID`
	- LinkedIn: `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_AUTHOR_URN`, optional `LINKEDIN_ENABLE_VIDEO_UPLOAD=true`
	- X: `X_ACCESS_TOKEN`, optional `X_MEDIA_ID`
	- Composio bridge: `COMPOSIO_PUBLISH_WEBHOOK_URL`, `COMPOSIO_API_KEY`
	- Composio inbound verification (optional): `COMPOSIO_WEBHOOK_SECRET`
	- Optional Composio execution controls: `COMPOSIO_USER_ID`, `COMPOSIO_<PLATFORM>_TOOL_SLUG`, `COMPOSIO_<PLATFORM>_ACCOUNT`, `COMPOSIO_EXECUTOR_TIMEOUT_SECONDS`
	- Instagram publish wait tuning: `COMPOSIO_INSTAGRAM_MAX_WAIT_SECONDS`, `COMPOSIO_INSTAGRAM_POLL_INTERVAL_SECONDS`

## 2. Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 4000
```

Server default: `http://localhost:4000`

## 3. Endpoints

- `GET /api/health`
- `GET /api/analytics/instagram?username=<handle>&mediaLimit=10`
- `GET /api/analytics/youtube?channelId=<id>&maxResults=8`
- `GET /api/analytics/twitter?username=<handle>&maxResults=10`
- `GET /api/analytics/linkedin?profileUrl=<linkedin_profile_url>&maxResults=5`
- `GET /api/analytics/detail?platform=instagram|youtube&itemId=<id>&username=<optional>&channelId=<optional>&maxComments=80`
- `GET /api/publish/options`
- `POST /api/publish/social`
- `GET /api/composio/webhook/health`
- `POST /api/composio/webhook`
- `POST /api/composio/publish-exec`
- `GET /api/composio/connection-status?toolkit=instagram|linkedin|twitter|facebook`
- `POST /api/composio/connect-link?toolkit=instagram|linkedin|twitter|facebook&callbackUrl=<optional_url>`

If `username`, `channelId`, or `profileUrl` are omitted, backend falls back to `.env` values.

When OAuth is configured correctly, YouTube reach/impressions come from YouTube Analytics API.

Note: depending on channel/report availability, YouTube Analytics may not expose a direct `impressions` metric in this report query. In that case the backend uses Analytics-derived fallbacks (`viewerPercentage` or `views`) while still preferring Analytics over Data API totals.
