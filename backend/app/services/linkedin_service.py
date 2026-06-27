"""
LinkedIn Analytics via Apify actor: dev_fusion/linkedin-profile-scraper
Confirmed output schema (from official docs):
{
  "linkedinUrl": "...",
  "firstName": "Bill", "lastName": "Gates", "fullName": "Bill Gates",
  "headline": "...",
  "connections": 500,    ← NOT connectionsCount
  "followers": 15000,    ← NOT followersCount
  "publicIdentifier": "williamhgates",
  "experiences": [{ "title": "...", "companyName": "...", ... }],
  "skills": [{ "name": "..." }],
  "educations": [...],
}
"""

import os
from typing import Any
import httpx


async def _run_apify(actor_path: str, payload: dict, token: str) -> list:
    async with httpx.AsyncClient(timeout=120.0) as client:
        res = await client.post(
            f"https://api.apify.com/v2/acts/{actor_path}/run-sync-get-dataset-items",
            params={"token": token},
            json=payload,
        )
    print(f"[APIFY {actor_path}] status={res.status_code}")
    if res.status_code not in (200, 201):
        raise ValueError(f"Apify HTTP {res.status_code}: {res.text[:400]}")
    data = res.json()
    if not isinstance(data, list):
        raise ValueError(f"Unexpected Apify response: {str(data)[:300]}")
    if data:
        print(f"[APIFY {actor_path}] items={len(data)}, sample_keys={list(data[0].keys())[:20]}")
    else:
        print(f"[APIFY {actor_path}] EMPTY RESULT")
    return data


def _safe_int(val) -> int:
    try:
        return int(str(val).replace(",", "").replace("+", "").strip())
    except Exception:
        return 0


async def _try_apify_profile(
    actor_path: str,
    profile_url: str,
    token: str,
) -> tuple[dict[str, Any] | None, str | None]:
    payloads = [
        {"profileUrls": [profile_url]},
        {"startUrls": [{"url": profile_url}]},
        {"urls": [profile_url]},
    ]

    last_error: str | None = None
    for payload in payloads:
        try:
            data = await _run_apify(actor_path, payload, token)
            if not data:
                last_error = f"{actor_path}: empty dataset"
                continue

            first = data[0] if isinstance(data[0], dict) else None
            if not first:
                last_error = f"{actor_path}: invalid item format"
                continue

            if first.get("error"):
                return None, f"{actor_path}: {first.get('error')}"

            return first, None
        except Exception as error:
            last_error = f"{actor_path}: {str(error)}"

    return None, last_error


async def _fetch_linkedin_oauth_profile() -> tuple[dict[str, Any] | None, str | None]:
    token = os.getenv("LINKEDIN_ACCESS_TOKEN", "").strip()
    if not token:
        return None, "LINKEDIN_ACCESS_TOKEN not set"

    headers = {
        "Authorization": f"Bearer {token}",
        "X-Restli-Protocol-Version": "2.0.0",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get("https://api.linkedin.com/v2/userinfo", headers=headers)
        if res.status_code != 200:
            return None, f"LinkedIn OAuth /v2/userinfo HTTP {res.status_code}: {res.text[:200]}"

        userinfo = res.json()
        return {
            "publicIdentifier": userinfo.get("sub") or "linkedin-oauth-user",
            "fullName": userinfo.get("name") or "LinkedIn User",
            "firstName": userinfo.get("given_name") or "",
            "lastName": userinfo.get("family_name") or "",
            "headline": "",
            "location": "",
            "summary": "",
            "profilePicture": userinfo.get("picture"),
            "connections": 0,
            "followers": 0,
            "experiences": [],
            "skills": [],
            "certifications": [],
            "_oauthFallback": True,
        }, None
    except Exception as error:
        return None, f"LinkedIn OAuth fallback failed: {str(error)}"


async def fetch_linkedin_analytics(
    profile_url_override: str | None,
    max_results: int,
) -> dict[str, Any]:
    apify_token = os.getenv("APIFY_API_TOKEN", "")
    profile_url = profile_url_override or os.getenv("LINKEDIN_DEFAULT_PROFILE_URL", "")

    if not apify_token:
        raise ValueError("Missing APIFY_API_TOKEN in backend environment.")
    if not profile_url:
        raise ValueError(
            "Missing LinkedIn profile URL. "
            "Provide ?profileUrl= query param or set LINKEDIN_DEFAULT_PROFILE_URL in .env"
        )

    notes: list[str] = []

    profile, primary_error = await _try_apify_profile(
        "dev_fusion~linkedin-profile-scraper",
        profile_url,
        apify_token,
    )
    if primary_error:
        notes.append(primary_error)

    # Optional env override for a backup actor, useful when primary actor is plan-restricted.
    if not profile:
        fallback_actor = os.getenv("LINKEDIN_FALLBACK_ACTOR", "").strip()
        if fallback_actor:
            fallback_profile, fallback_error = await _try_apify_profile(
                fallback_actor,
                profile_url,
                apify_token,
            )
            if fallback_error:
                notes.append(fallback_error)
            if fallback_profile:
                profile = fallback_profile
                notes.append(f"linkedin source actor: {fallback_actor}")

    if not profile:
        oauth_profile, oauth_error = await _fetch_linkedin_oauth_profile()
        if oauth_error:
            notes.append(oauth_error)
        if oauth_profile:
            profile = oauth_profile
            notes.append("linkedin source: OAuth /v2/userinfo fallback")

    if not profile:
        return {
            "platform": "linkedin",
            "account": {
                "id": profile_url,
                "username": "LinkedIn User",
                "name": "LinkedIn User",
                "headline": "",
                "location": "",
                "summary": "",
                "profile_image_url": None,
                "profile_url": profile_url,
            },
            "metrics": {
                "followersCount": 0,
                "connectionsCount": 0,
                "experiencesCount": 0,
                "skillsCount": 0,
                "certificationsCount": 0,
            },
            "experiences": [],
            "skills": [],
            "items": [],
            "notes": [
                "No LinkedIn profile rows returned from configured sources.",
                *notes[:4],
            ],
        }

    # Mark source when primary actor succeeds.
    if not any(note.startswith("linkedin source") for note in notes):
        notes.append("linkedin source actor: dev_fusion~linkedin-profile-scraper")

    print(f"[LI DEBUG] connections={profile.get('connections')} followers={profile.get('followers')}")

    # Confirmed field names from docs: "connections" and "followers" (no "Count" suffix)
    connections = _safe_int(profile.get("connections") or profile.get("connectionsCount") or 0)
    followers   = _safe_int(profile.get("followers") or profile.get("followersCount") or 0)

    full_name  = profile.get("fullName") or f"{profile.get('firstName','')} {profile.get('lastName','')}".strip() or "LinkedIn User"
    headline   = profile.get("headline") or profile.get("title") or ""
    location   = profile.get("location") or profile.get("geoLocation") or ""
    summary    = profile.get("summary") or profile.get("about") or ""
    photo_url  = profile.get("profilePicture") or profile.get("photoUrl") or profile.get("photo")
    profile_id = profile.get("publicIdentifier") or profile.get("username") or profile_url

    # Experiences: field is "experiences" with "title" and "companyName"
    experience_raw = profile.get("experiences") or profile.get("experience") or []
    experiences = []
    if isinstance(experience_raw, list):
        for exp in experience_raw[:max(max_results, 1)]:
            if isinstance(exp, dict):
                experiences.append({
                    "title"   : exp.get("title") or exp.get("position") or "",
                    "company" : exp.get("companyName") or exp.get("company") or "",
                    "duration": exp.get("currentJobDuration") or exp.get("duration") or exp.get("jobStartedOn") or "",
                })

    # Skills: field is "skills" with "name"
    skills_raw = profile.get("skills") or []
    skills = []
    if isinstance(skills_raw, list):
        for s in skills_raw[:12]:
            if isinstance(s, dict):
                skills.append(s.get("name") or s.get("title") or str(s))
            elif isinstance(s, str):
                skills.append(s)

    # Certifications
    certs_raw = profile.get("certifications") or profile.get("licenses") or []
    cert_count = len(certs_raw) if isinstance(certs_raw, list) else 0

    items = [
        {
            "id": f"exp-{idx}",
            "caption": f"{exp.get('title') or 'Role'} at {exp.get('company') or 'Company'}",
            "publishedAt": None,
            "like_count": None,
            "comments_count": None,
            "media_url": None,
            "media_type": "EXPERIENCE",
            "permalink": profile_url,
        }
        for idx, exp in enumerate(experiences, start=1)
    ]

    return {
        "platform": "linkedin",
        "account": {
            "id"               : profile_id,
            "username"         : full_name,
            "name"             : full_name,
            "headline"         : headline,
            "location"         : location,
            "summary"          : summary,
            "profile_image_url": photo_url,
            "profile_url"      : profile_url,
        },
        "metrics": {
            "followersCount"   : followers,
            "connectionsCount" : connections,
            "experiencesCount" : len(experiences),
            "skillsCount"      : len(skills),
            "certificationsCount": cert_count,
        },
        "experiences": experiences,
        "skills"     : skills,
        "items"      : items,
        "notes"      : notes,
    }
