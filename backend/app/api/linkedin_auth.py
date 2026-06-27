"""
LinkedIn OAuth 2.0 Helper Routes
==================================
GET /linkedin/auth      → Redirects browser to LinkedIn login/consent page
GET /linkedin/callback  → Exchanges auth code for access token, saves it to .env

Usage:
  1. Make sure LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET are set in .env
  2. Open http://localhost:4000/linkedin/auth in your browser
  3. Approve on LinkedIn → you'll be redirected back automatically
  4. The access token is saved to .env and you're done!
"""

import os
import re
import urllib.parse

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, RedirectResponse

router = APIRouter(tags=["LinkedIn OAuth"])

_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
_AUTH_URL  = "https://www.linkedin.com/oauth/v2/authorization"
_SCOPES    = "openid profile email w_member_social"

_ENV_FILE  = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
_ENV_FILE  = os.path.normpath(_ENV_FILE)


def _get_redirect_uri(request: Request) -> str:
    """Build the callback URL from the incoming request's base URL."""
    return str(request.base_url).rstrip("/") + "/linkedin/callback"


def _write_token_to_env(token: str) -> None:
    """Upsert LINKEDIN_ACCESS_TOKEN in the .env file on disk."""
    if not os.path.exists(_ENV_FILE):
        return

    with open(_ENV_FILE, "r", encoding="utf-8") as f:
        content = f.read()

    pattern = r"^LINKEDIN_ACCESS_TOKEN=.*$"
    replacement = f"LINKEDIN_ACCESS_TOKEN={token}"

    if re.search(pattern, content, flags=re.MULTILINE):
        content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
    else:
        content = content.rstrip("\n") + f"\n{replacement}\n"

    with open(_ENV_FILE, "w", encoding="utf-8") as f:
        f.write(content)

    # Also update the live process environment so restart isn't required
    os.environ["LINKEDIN_ACCESS_TOKEN"] = token


@router.get("/linkedin/auth", include_in_schema=True, summary="Start LinkedIn OAuth flow")
async def linkedin_auth(request: Request):
    """Redirect the browser to LinkedIn's consent screen."""
    client_id = os.getenv("LINKEDIN_CLIENT_ID", "")
    if not client_id:
        return HTMLResponse(
            "<h2>❌ LINKEDIN_CLIENT_ID is not set in .env</h2>", status_code=500
        )

    redirect_uri = _get_redirect_uri(request)
    params = urllib.parse.urlencode({
        "response_type": "code",
        "client_id":     client_id,
        "redirect_uri":  redirect_uri,
        "scope":         _SCOPES,
        "state":         "vincent_ai_linkedin",
        "prompt":        "consent",   # force full consent screen every time
    })
    auth_url = f"{_AUTH_URL}?{params}"
    return RedirectResponse(url=auth_url)


@router.get("/linkedin/callback", include_in_schema=True, summary="Handle LinkedIn OAuth callback")
async def linkedin_callback(request: Request, code: str | None = None, error: str | None = None):
    """Exchange the auth code for an access token and save it."""

    if error:
        return HTMLResponse(
            f"<h2>\u274c LinkedIn denied access: <code>{error}</code></h2>"
            f"<p>Make sure your LinkedIn App has the <strong>'Share on LinkedIn'</strong> product enabled.<br>"
            f"Go to <a href='https://www.linkedin.com/developers/apps' target='_blank'>linkedin.com/developers/apps</a> "
            f"&rarr; your app &rarr; <strong>Products</strong> tab &rarr; request <strong>Share on LinkedIn</strong>.</p>"
            f"<p><a href='/linkedin/auth'>Try again &rarr;</a></p>",
            status_code=400,
        )

    if not code:
        return HTMLResponse(
            "<h2>❌ No authorization code received from LinkedIn.</h2>"
            "<p>Please start over at <a href='/linkedin/auth'>/linkedin/auth</a></p>",
            status_code=400,
        )

    client_id     = os.getenv("LINKEDIN_CLIENT_ID", "")
    client_secret = os.getenv("LINKEDIN_CLIENT_SECRET", "")
    redirect_uri  = _get_redirect_uri(request)

    if not client_id or not client_secret:
        return HTMLResponse(
            "<h2>❌ LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET is missing from .env</h2>",
            status_code=500,
        )

    # Exchange the code for an access token
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                _TOKEN_URL,
                data={
                    "grant_type":    "authorization_code",
                    "code":          code,
                    "redirect_uri":  redirect_uri,
                    "client_id":     client_id,
                    "client_secret": client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

        if resp.status_code != 200:
            return HTMLResponse(
                f"<h2>❌ Token exchange failed (HTTP {resp.status_code})</h2>"
                f"<pre>{resp.text}</pre>",
                status_code=502,
            )

        payload = resp.json()
        access_token = payload.get("access_token", "")
        expires_in   = payload.get("expires_in", "unknown")

        if not access_token:
            return HTMLResponse(
                f"<h2>❌ LinkedIn returned no access_token</h2><pre>{payload}</pre>",
                status_code=502,
            )

    except httpx.RequestError as exc:
        return HTMLResponse(
            f"<h2>❌ Network error: {exc}</h2>", status_code=502
        )

    # Persist the token to .env
    _write_token_to_env(access_token)

    expires_days = round(int(expires_in) / 86400) if str(expires_in).isdigit() else "?"

    return HTMLResponse(f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LinkedIn Connected ✅</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a0f;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 2rem;
    }}
    .card {{
      background: linear-gradient(135deg, #0d1b2e 0%, #0a0a1a 100%);
      border: 1px solid rgba(0, 119, 181, 0.4);
      border-radius: 16px;
      padding: 2.5rem;
      max-width: 520px;
      width: 100%;
      text-align: center;
      box-shadow: 0 0 60px rgba(0, 119, 181, 0.15);
    }}
    .icon {{ font-size: 3rem; margin-bottom: 1rem; }}
    h1 {{ color: #0ea5e9; font-size: 1.6rem; margin-bottom: 0.5rem; }}
    p {{ color: #94a3b8; margin-bottom: 1.2rem; line-height: 1.6; }}
    .token-box {{
      background: #111827;
      border: 1px solid #1e3a5f;
      border-radius: 8px;
      padding: 1rem;
      font-family: monospace;
      font-size: 0.75rem;
      color: #38bdf8;
      word-break: break-all;
      text-align: left;
      margin-bottom: 1.5rem;
    }}
    .badge {{
      display: inline-block;
      background: rgba(0, 119, 181, 0.15);
      border: 1px solid rgba(0, 119, 181, 0.4);
      color: #38bdf8;
      padding: 0.3rem 0.8rem;
      border-radius: 999px;
      font-size: 0.8rem;
      margin-bottom: 1.5rem;
    }}
    a.btn {{
      display: inline-block;
      background: linear-gradient(135deg, #0077b5, #0ea5e9);
      color: white;
      text-decoration: none;
      padding: 0.75rem 2rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.95rem;
    }}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>LinkedIn Connected!</h1>
    <p>Your access token has been automatically saved to <code>.env</code>.<br>
       No restart needed — the server is already using it.</p>
    <div class="badge">⏱ Expires in ~{expires_days} days</div>
    <div class="token-box">LINKEDIN_ACCESS_TOKEN={access_token[:40]}...</div>
    <p>You can now fetch your LinkedIn profile data from the API.</p>
    <a class="btn" href="/api/analytics/linkedin">Test LinkedIn Analytics →</a>
  </div>
</body>
</html>
""")


@router.get("/linkedin/debug", include_in_schema=True, summary="Debug LinkedIn token scopes")
async def linkedin_debug(request: Request):
    """Probe every LinkedIn endpoint to reveal which scopes the current token has."""
    token = os.getenv("LINKEDIN_ACCESS_TOKEN", "").strip()
    if not token:
        return HTMLResponse(
            "<h2>No LINKEDIN_ACCESS_TOKEN set. "
            "Visit <a href='/linkedin/auth'>/linkedin/auth</a> first.</h2>"
        )

    headers = {
        "Authorization": f"Bearer {token}",
        "X-Restli-Protocol-Version": "2.0.0",
    }

    tests = [
        ("OpenID /v2/userinfo",    "https://api.linkedin.com/v2/userinfo"),
        ("Profile /v2/me (bare)",  "https://api.linkedin.com/v2/me"),
        ("Email /v2/emailAddress", "https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))"),
    ]

    rows = ""
    member_id = ""

    async with httpx.AsyncClient(timeout=10) as client:
        for label, url in tests:
            r = await client.get(url, headers=headers)
            color = "#22c55e" if r.status_code == 200 else "#ef4444"
            body = r.text[:300].replace("<", "&lt;").replace(">", "&gt;")
            rows += (
                f"<tr><td style='padding:8px 12px;color:#e2e8f0'>{label}</td>"
                f"<td style='padding:8px 12px;font-weight:bold;color:{color}'>{r.status_code}</td>"
                f"<td style='padding:8px 12px;font-size:0.75rem;color:#94a3b8;font-family:monospace'>{body}</td></tr>"
            )
            if r.status_code == 200 and "userinfo" in url:
                member_id = r.json().get("sub", "")

        # UGC Posts — requires w_member_social
        if member_id:
            enc = urllib.parse.quote(f"urn:li:person:{member_id}", safe="")
            posts_url = f"https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List({enc})&count=3"
            r = await client.get(posts_url, headers=headers)
            color = "#22c55e" if r.status_code == 200 else "#ef4444"
            body = r.text[:400].replace("<", "&lt;").replace(">", "&gt;")
            rows += (
                f"<tr><td style='padding:8px 12px;color:#e2e8f0'>Posts /v2/ugcPosts (w_member_social)</td>"
                f"<td style='padding:8px 12px;font-weight:bold;color:{color}'>{r.status_code}</td>"
                f"<td style='padding:8px 12px;font-size:0.75rem;color:#94a3b8;font-family:monospace'>{body}</td></tr>"
            )

    return HTMLResponse(f"""<!DOCTYPE html><html><head><title>LinkedIn Debug</title>
<style>
body{{font-family:-apple-system,sans-serif;background:#0a0a0f;color:#e2e8f0;padding:2rem}}
h1{{color:#38bdf8;margin-bottom:0.5rem}} p{{color:#94a3b8;margin-bottom:1.5rem}}
table{{width:100%;border-collapse:collapse;background:#0d1b2e;border-radius:8px;overflow:hidden}}
th{{background:#1e3a5f;padding:10px 12px;text-align:left;color:#7dd3fc}}
tr:nth-child(even){{background:#111827}}
.btn{{display:inline-block;margin-top:1.5rem;background:#0077b5;color:white;
padding:0.6rem 1.5rem;border-radius:8px;text-decoration:none;font-weight:600;margin-right:1rem}}
</style></head><body>
<h1>LinkedIn Token Scope Debug</h1>
<p>Token: <code style='color:#38bdf8'>{token[:50]}...</code></p>
<table><thead><tr><th>Endpoint</th><th>HTTP Status</th><th>Response Preview</th></tr></thead>
<tbody>{rows}</tbody></table>
<a class='btn' href='/linkedin/auth'>Re-authenticate (force consent screen)</a>
<a class='btn' href='/api/analytics/linkedin'>Test Analytics Endpoint</a>
</body></html>""")

