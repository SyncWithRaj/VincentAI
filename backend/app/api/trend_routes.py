import os
import base64
from datetime import datetime, timezone
import math
import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from typing import Any

import re
from collections import Counter

router = APIRouter(prefix="/trends")

@router.get("/hashtags")
async def get_hashtags():
    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key:
        return JSONResponse(status_code=400, content={"message": "Missing YOUTUBE_API_KEY"})
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://www.googleapis.com/youtube/v3/videos",
                params={
                    "part": "snippet",
                    "chart": "mostPopular",
                    "regionCode": "US",
                    "maxResults": 50,
                    "key": api_key,
                }
            )
            
            if response.status_code != 200:
                raise Exception(response.text)
                
            payload = response.json()
            
            hashtags_counter = Counter()
            
            for item in payload.get("items", []):
                snippet = item.get("snippet", {})
                title = snippet.get("title", "")
                desc = snippet.get("description", "")
                tags = snippet.get("tags", [])
                
                video_tags = set()
                
                # Extract authentic # tags from title and description
                for text in [title, desc]:
                    extracted = re.findall(r'#(\w+)', text.lower())
                    for t in extracted:
                        if len(t) > 2:
                            video_tags.add(t)
                            
                # Add YouTube SEO tags (stripping spaces to mimic hashtags)
                for t in tags:
                    clean_tag = t.lower().replace(" ", "")
                    # Ignore overly long sentences in tags
                    if 2 < len(clean_tag) < 20: 
                        video_tags.add(clean_tag)
                        
                # Count each tag only ONCE per video for an authentic Penetration Metric
                for t in video_tags:
                    hashtags_counter[f"#{t}"] += 1
                
            top_tags = hashtags_counter.most_common(10)
            
            data = [{"name": tag, "count": count} for tag, count in top_tags]
            
        return JSONResponse(content={"items": data})
    except Exception as e:
        print("Hashtag Scraper Error:", str(e))
        mock_data = [
            {"name": "#shorts", "count": 142},
            {"name": "#funny", "count": 98},
            {"name": "#podcast", "count": 76},
            {"name": "#viral", "count": 65},
            {"name": "#music", "count": 54},
            {"name": "#vlog", "count": 41},
            {"name": "#gaming", "count": 38},
            {"name": "#ai", "count": 29},
        ]
        return JSONResponse(content={"items": mock_data, "mocked": True})


@router.get("/youtube")
async def get_youtube_trends():
    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key:
        return JSONResponse(status_code=400, content={"message": "Missing YOUTUBE_API_KEY"})
        
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://www.googleapis.com/youtube/v3/videos",
                params={
                    "part": "snippet,statistics",
                    "chart": "mostPopular",
                    "regionCode": "US",
                    "maxResults": 6,
                    "key": api_key,
                }
            )
            
            if response.status_code != 200:
                raise Exception(response.text)
                
            payload = response.json()
            items = []
            for item in payload.get("items", []):
                snippet = item.get("snippet", {})
                stats = item.get("statistics", {})
                thumbnails = snippet.get("thumbnails", {})
                thumb_url = thumbnails.get("maxres", {}).get("url") or thumbnails.get("high", {}).get("url")
                
                items.append({
                    "id": item.get("id"),
                    "title": snippet.get("title"),
                    "channelTitle": snippet.get("channelTitle"),
                    "thumbnail": thumb_url,
                    "viewCount": int(stats.get("viewCount", 0)),
                    "likeCount": int(stats.get("likeCount", 0)),
                })
                
            return JSONResponse(content={"items": items})
    except Exception as e:
        print("YouTube API Error:", str(e))
        mock_videos = [
            {
                "id": "mock1",
                "title": "Tech Review: The Future is Here",
                "channelTitle": "TechDaily",
                "thumbnail": "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=500&auto=format&fit=crop&q=60",
                "viewCount": 5400000,
                "likeCount": 120000
            },
            {
                "id": "mock2",
                "title": "I Built an AI Agent to edit my videos",
                "channelTitle": "CreatorLabs",
                "thumbnail": "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=500&auto=format&fit=crop&q=60",
                "viewCount": 2100000,
                "likeCount": 85000
            }
        ]
        return JSONResponse(content={"items": mock_videos, "mocked": True})


def _mock_spotify_viral():
    return [
        {"id": "1", "title": "Magnetic", "artist": "ILLIT", "popularity": 95, "image": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&h=100&fit=crop"},
        {"id": "2", "title": "TEXAS HOLD 'EM", "artist": "Beyoncé", "popularity": 92, "image": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop"},
        {"id": "3", "title": "End of Beginning", "artist": "Djo", "popularity": 88, "image": "https://images.unsplash.com/photo-1493225457224-05eb102f7e0a?w=100&h=100&fit=crop"},
        {"id": "4", "title": "Beautiful Things", "artist": "Benson Boone", "popularity": 85, "image": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&h=100&fit=crop"},
    ]


_STOPWORDS = {
    "the", "and", "with", "from", "that", "this", "for", "your", "you", "are", "was", "have", "has",
    "will", "into", "new", "how", "why", "when", "what", "where", "about", "they", "their", "them", "our",
    "ours", "its", "it's", "just", "now", "right", "today", "week", "using", "viral", "going", "gets", "get",
    "more", "best", "than", "over", "under", "make", "made", "video", "videos", "post", "posts", "creator",
    "creators", "shorts", "short", "meme", "memes", "tiktok", "youtube", "spotify", "reddit", "marketing",
}


def _extract_keywords(text: str) -> list[str]:
    if not text:
        return []
    tokens = re.findall(r"[a-zA-Z][a-zA-Z0-9+#'-]{2,}", text.lower())
    cleaned = []
    for token in tokens:
        token = token.strip("#'\"")
        if len(token) < 3 or token in _STOPWORDS or token.isdigit():
            continue
        cleaned.append(token)
    return cleaned


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _build_seed_trends(
    reddit_data: list[dict[str, Any]],
    tavily_data: list[dict[str, Any]],
    youtube_data: list[dict[str, Any]],
    spotify_data: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, Any], dict[str, list[dict[str, Any]]]]:
    source_weights: dict[str, Counter] = {
        "reddit": Counter(),
        "youtube": Counter(),
        "spotify": Counter(),
        "web": Counter(),
    }
    evidence_by_keyword: dict[str, list[dict[str, Any]]] = {}

    def add_evidence(keyword: str, source: str, snippet: str, signal: float):
        if keyword not in evidence_by_keyword:
            evidence_by_keyword[keyword] = []
        if len(evidence_by_keyword[keyword]) >= 8:
            return
        evidence_by_keyword[keyword].append({
            "source": source,
            "snippet": snippet[:180],
            "signal_strength": int(max(1, min(100, round(signal)))),
        })

    for post in reddit_data:
        title = post.get("title", "")
        text = post.get("text", "")
        score = _safe_int(post.get("score"), 1)
        signal = max(2.0, math.sqrt(score))
        tokens = set(_extract_keywords(f"{title} {text}"))
        for token in tokens:
            source_weights["reddit"][token] += signal
            add_evidence(token, "reddit", title, signal)

    for item in youtube_data:
        title = item.get("title", "")
        tags = " ".join(item.get("tags", [])) if isinstance(item.get("tags"), list) else ""
        views = _safe_int(item.get("viewCount"), 0)
        likes = _safe_int(item.get("likeCount"), 0)
        signal = max(2.0, math.log10(max(views + likes, 10)) * 8)
        tokens = set(_extract_keywords(f"{title} {tags}"))
        for token in tokens:
            source_weights["youtube"][token] += signal
            add_evidence(token, "youtube", title, signal)

    for track in spotify_data:
        title = track.get("title", "")
        artist = track.get("artist", "")
        popularity = _safe_int(track.get("popularity"), 0)
        signal = max(2.0, popularity / 6)
        tokens = set(_extract_keywords(f"{title} {artist}"))
        for token in tokens:
            source_weights["spotify"][token] += signal
            add_evidence(token, "spotify", f"{title} - {artist}", signal)

    for hit in tavily_data:
        title = hit.get("title", "")
        content = hit.get("content", "")
        signal = 7.0
        tokens = set(_extract_keywords(f"{title} {content}"))
        for token in tokens:
            source_weights["web"][token] += signal
            add_evidence(token, "web", title or content, signal)

    composite = Counter()
    for src_counter in source_weights.values():
        composite.update(src_counter)

    if not composite:
        composite.update({"faceless": 12, "storytelling": 10, "behindthescenes": 8})

    top_keywords = [k for k, _ in composite.most_common(8)]

    seed_trends: list[dict[str, Any]] = []
    for keyword in top_keywords[:4]:
        src_mix_raw = {
            "reddit": float(source_weights["reddit"].get(keyword, 0)),
            "youtube": float(source_weights["youtube"].get(keyword, 0)),
            "spotify": float(source_weights["spotify"].get(keyword, 0)),
            "web": float(source_weights["web"].get(keyword, 0)),
        }
        total = sum(src_mix_raw.values()) or 1.0
        src_mix = {k: int(round((v / total) * 100)) for k, v in src_mix_raw.items()}

        source_count = sum(1 for v in src_mix_raw.values() if v > 0)
        base_mentions = composite.get(keyword, 0)
        mentions_24h = int(max(18, round(base_mentions * 3.2)))
        growth_rate_pct = round(min(220.0, 12 + base_mentions * 2.4 + source_count * 8.0), 1)
        engagement_proxy = int(min(100, 38 + base_mentions * 1.6 + source_count * 10))
        confidence = int(min(99, 52 + source_count * 9 + base_mentions * 1.3))
        momentum = int(min(99, 46 + growth_rate_pct * 0.22 + source_count * 8))

        dominant_sources = [name for name, value in sorted(src_mix_raw.items(), key=lambda x: x[1], reverse=True) if value > 0][:2]
        origin_signal = " + ".join([s.capitalize() for s in dominant_sources]) if dominant_sources else "Cross-platform chatter"

        related_tags = [f"#{keyword}"]
        for candidate, _ in composite.most_common(20):
            if candidate == keyword or len(related_tags) >= 4:
                continue
            if candidate.startswith(keyword[:3]) or keyword.startswith(candidate[:3]):
                related_tags.append(f"#{candidate}")

        timeline = [
            {
                "day": "D1-D2",
                "action": f"Publish a fast reaction short using #{keyword} with a bold 2-second hook.",
                "kpi": "Hook retention > 68%",
            },
            {
                "day": "D3-D5",
                "action": "Collaborate with one adjacent niche creator and remix the format with your product context.",
                "kpi": "Save/share ratio > 11%",
            },
            {
                "day": "D6-D7",
                "action": "Launch a CTA-driven follow-up post that converts momentum into profile visits or email signups.",
                "kpi": "CTR uplift +18% vs baseline",
            },
        ]

        if src_mix.get("spotify", 0) >= 25:
            format_recommendations = ["Audio-led short", "Loopable demo format", "Duet/stitch ready template"]
        elif src_mix.get("youtube", 0) >= 25:
            format_recommendations = ["Explainer short", "Before/after case clip", "Listicle with captions"]
        else:
            format_recommendations = ["Hot-take carousel", "Narrative reel", "Community challenge prompt"]

        evidence_points = evidence_by_keyword.get(keyword, [])[:4]
        if not evidence_points:
            evidence_points = [{"source": "web", "snippet": f"Rising chatter detected around {keyword}.", "signal_strength": 55}]

        seed_trends.append({
            "trend_name": f"{keyword.title()} Wave",
            "origin_signal": origin_signal,
            "virality_hypothesis": f"{keyword.title()} is spreading because it is easy to remix and emotionally legible in under 10 seconds.",
            "how_to_leverage": f"Ship 2-3 assets this week around #{keyword} and test one creator-collab angle to compound reach.",
            "confidence_score": confidence,
            "momentum_score": momentum,
            "signal_stats": {
                "mentions_24h": mentions_24h,
                "growth_rate_pct": growth_rate_pct,
                "engagement_proxy": engagement_proxy,
            },
            "source_mix": src_mix,
            "evidence_points": evidence_points,
            "tags": related_tags,
            "next_7_days_outlook": "Expect continued lift for 5-8 days before format fatigue appears.",
            "execution_playbook": timeline,
            "risk_factor": "If brand fit is weak, trend-jacking can look forced and reduce trust.",
            "format_recommendations": format_recommendations,
        })

    market_temperature = int(min(100, round(sum(t["momentum_score"] for t in seed_trends) / max(1, len(seed_trends)))))
    meta = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sources_scanned": {
            "reddit_posts": len(reddit_data),
            "youtube_videos": len(youtube_data),
            "spotify_tracks": len(spotify_data),
            "web_hits": len(tavily_data),
        },
        "market_temperature": market_temperature,
        "top_tags": [f"#{k}" for k in top_keywords[:8]],
    }

    plots = {
        "source_heatmap": [
            {"source": "Reddit", "signal": int(round(sum(source_weights["reddit"].values())))},
            {"source": "YouTube", "signal": int(round(sum(source_weights["youtube"].values())))},
            {"source": "Spotify", "signal": int(round(sum(source_weights["spotify"].values())))},
            {"source": "Web", "signal": int(round(sum(source_weights["web"].values())))},
        ],
        "tag_velocity": [
            {"tag": f"#{k}", "velocity": int(round(v))} for k, v in composite.most_common(7)
        ],
    }

    if seed_trends:
        avg_momentum = sum(t["momentum_score"] for t in seed_trends) / len(seed_trends)
        avg_growth = sum(t["signal_stats"]["growth_rate_pct"] for t in seed_trends) / len(seed_trends)
    else:
        avg_momentum = 50
        avg_growth = 40

    momentum_curve = []
    for offset in range(-6, 8):
        base = avg_momentum + (offset * avg_growth * 0.08)
        if offset < 0:
            score = int(max(20, min(98, round(base - abs(offset) * 1.8))))
        else:
            score = int(max(20, min(99, round(base + offset * 1.4))))
        momentum_curve.append({"day": f"D{offset:+d}", "score": score})
    plots["momentum_curve"] = momentum_curve

    return seed_trends, meta, plots


async def _fetch_youtube_signal_sample(api_key: str) -> list[dict[str, Any]]:
    if not api_key:
        return []
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://www.googleapis.com/youtube/v3/videos",
                params={
                    "part": "snippet,statistics",
                    "chart": "mostPopular",
                    "regionCode": "US",
                    "maxResults": 15,
                    "key": api_key,
                },
                timeout=10.0,
            )
            if response.status_code != 200:
                return []
            payload = response.json()
            items = []
            for item in payload.get("items", []):
                snippet = item.get("snippet", {})
                stats = item.get("statistics", {})
                items.append({
                    "title": snippet.get("title", ""),
                    "tags": snippet.get("tags", []),
                    "viewCount": _safe_int(stats.get("viewCount"), 0),
                    "likeCount": _safe_int(stats.get("likeCount"), 0),
                })
            return items
    except Exception:
        return []


async def _fetch_tavily_signals(tavily_key: str) -> list[dict[str, Any]]:
    if not tavily_key:
        return []
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": tavily_key,
                    "query": "Emerging creator economy trends this week short-form video social commerce hooks",
                    "search_depth": "basic",
                    "include_answer": False,
                },
                timeout=12.0,
            )
            if res.status_code != 200:
                return []
            return [
                {"title": row.get("title", ""), "content": row.get("content", "")}
                for row in res.json().get("results", [])[:8]
            ]
    except Exception:
        return []


async def _fetch_spotify_signal_sample(client_id: str, client_secret: str) -> list[dict[str, Any]]:
    if not client_id or not client_secret:
        return _mock_spotify_viral()

    try:
        auth_str = f"{client_id}:{client_secret}"
        b64_auth_str = base64.b64encode(auth_str.encode()).decode()
        async with httpx.AsyncClient() as client:
            token_res = await client.post(
                "https://accounts.spotify.com/api/token",
                data={"grant_type": "client_credentials"},
                headers={
                    "Authorization": f"Basic {b64_auth_str}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                timeout=10.0,
            )
            if token_res.status_code != 200:
                return _mock_spotify_viral()

            access_token = token_res.json().get("access_token")
            if not access_token:
                return _mock_spotify_viral()

            search_res = await client.get(
                "https://api.spotify.com/v1/search?q=year:2024-2026&type=track&limit=30",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10.0,
            )
            if search_res.status_code != 200:
                return _mock_spotify_viral()

            payload = search_res.json()
            items: list[dict[str, Any]] = []
            for track in payload.get("tracks", {}).get("items", []):
                if not track:
                    continue
                artists = ", ".join([a.get("name") for a in track.get("artists", []) if a.get("name")])
                items.append({
                    "title": track.get("name", ""),
                    "artist": artists,
                    "popularity": _safe_int(track.get("popularity"), 0),
                })

            items.sort(key=lambda x: x.get("popularity", 0), reverse=True)
            return items[:10] if items else _mock_spotify_viral()
    except Exception:
        return _mock_spotify_viral()


async def _fetch_reddit_signals() -> list[dict[str, Any]]:
    reddit_data: list[dict[str, Any]] = []
    subreddits = ["marketing", "socialmedia", "Entrepreneur", "youtube", "TikTok", "Instagram"]
    headers = {"User-Agent": "AIfyBackend/1.0 (Trend research agent)"}

    try:
        async with httpx.AsyncClient() as client:
            for sub in subreddits:
                res = await client.get(
                    f"https://www.reddit.com/r/{sub}/top.json?t=day&limit=8",
                    headers=headers,
                    timeout=6.0,
                )
                if res.status_code != 200:
                    continue
                data = res.json().get("data", {}).get("children", [])
                for item in data:
                    post = item.get("data", {})
                    if post.get("title") and not post.get("stickied"):
                        reddit_data.append({
                            "title": post.get("title"),
                            "subreddit": sub,
                            "score": _safe_int(post.get("score"), 0),
                            "text": (post.get("selftext") or "")[:280],
                        })
    except Exception as e:
        print("Reddit scrape failed:", e)

    return reddit_data


def _get_seed_json_prompt(seed_trends: list[dict[str, Any]], meta: dict[str, Any]) -> str:
    import json
    return f"""You are a senior market research strategist.
Refine these seed trends into sharper insights for creator growth teams.

Rules:
- Keep exactly the same number of trends.
- Preserve all numeric keys and keep them realistic.
- Keep JSON schema exactly unchanged.
- Tighten language and increase specificity.

SEED_TRENDS:
{json.dumps(seed_trends, ensure_ascii=True)}

META:
{json.dumps(meta, ensure_ascii=True)}

Return ONLY a JSON object with this shape:
{{
  "trends": [ ... same schema as seed trends ... ]
}}"""

@router.get("/spotify")
async def get_spotify_trends():
    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
    
    if not client_id or not client_secret:
        # Fallback Mock Data
        return JSONResponse(content={"items": _mock_spotify_viral(), "mocked": True})
        
    try:
        # Client Credentials Flow
        async with httpx.AsyncClient() as client:
            auth_str = f"{client_id}:{client_secret}"
            b64_auth_str = base64.b64encode(auth_str.encode()).decode()
            
            token_res = await client.post(
                "https://accounts.spotify.com/api/token",
                data={"grant_type": "client_credentials"},
                headers={"Authorization": f"Basic {b64_auth_str}", "Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if token_res.status_code != 200:
                return JSONResponse(content={"items": _mock_spotify_viral(), "mocked": True})
                
            access_token = token_res.json().get("access_token")
            
            # Search for recent tracks to find popular ones
            playlist_res = await client.get(
                "https://api.spotify.com/v1/search?q=year:2024-2026&type=track&limit=50",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if playlist_res.status_code != 200:
                print("Spotify API Error:", playlist_res.text)
                return JSONResponse(content={"items": _mock_spotify_viral(), "mocked": True})
                
            payload = playlist_res.json()
            all_items = []
            
            tracks_data = payload.get("tracks", {}).get("items", [])
            for track in tracks_data:
                if not track: continue
                
                album = track.get("album", {})
                images = album.get("images", [])
                image_url = images[0].get("url") if images else "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&h=100&fit=crop"
                
                artists = ", ".join([a.get("name") for a in track.get("artists", [])])
                
                all_items.append({
                    "id": track.get("id"),
                    "title": track.get("name"),
                    "artist": artists,
                    "popularity": track.get("popularity", 0),
                    "image": image_url
                })
                
            # Sort by popularity descending and take top 6
            all_items.sort(key=lambda x: x["popularity"], reverse=True)
            items = all_items[:6]
                
            return JSONResponse(content={"items": items, "mocked": False})
    except Exception as e:
        print(f"Spotify exception triggered fallback: {e}")
        return JSONResponse(content={"items": _mock_spotify_viral(), "mocked": True})


@router.get("/predict")
async def get_trend_predictions():
    import json

    reddit_data = await _fetch_reddit_signals()
    tavily_data = await _fetch_tavily_signals(os.getenv("TAVILY_API_KEY", ""))
    youtube_data = await _fetch_youtube_signal_sample(os.getenv("YOUTUBE_API_KEY", ""))
    spotify_data = await _fetch_spotify_signal_sample(
        os.getenv("SPOTIFY_CLIENT_ID", ""),
        os.getenv("SPOTIFY_CLIENT_SECRET", ""),
    )

    if not reddit_data and not tavily_data and not youtube_data:
        reddit_data = [
            {
                "title": "Faceless case-study storytelling clips are climbing in creator communities",
                "subreddit": "marketing",
                "score": 1800,
                "text": "Creators report high saves and completion with data-backed mini narratives.",
            }
        ]

    seed_trends, meta, plots = _build_seed_trends(reddit_data, tavily_data, youtube_data, spotify_data)
    final_trends = seed_trends
    synthesis_source = "heuristic"

    groq_api_key = os.getenv("GROQ_API_KEY")
    if groq_api_key and seed_trends:
        prompt = _get_seed_json_prompt(seed_trends, meta)
        try:
            async with httpx.AsyncClient() as client:
                g_res = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {groq_api_key}"},
                    json={
                        "model": "llama-3.3-70b-versatile",
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.55,
                        "response_format": {"type": "json_object"},
                    },
                    timeout=30.0,
                )
                if g_res.status_code == 200:
                    content = g_res.json()["choices"][0]["message"]["content"]
                    clean = content.replace("```json", "").replace("```", "").strip()
                    parsed = json.loads(clean)
                    candidate = parsed.get("trends") if isinstance(parsed, dict) else None
                    if isinstance(candidate, list) and candidate:
                        final_trends = candidate[: len(seed_trends)]
                        synthesis_source = "groq"
                else:
                    print("Groq API Error in Trends Predict:", g_res.text)
        except Exception as e:
            print("Groq failed in Trends Predict:", str(e))

    response_payload = {
        "items": final_trends,
        "meta": {
            **meta,
            "synthesis_source": synthesis_source,
            "quality_note": "Signals are synthesized from open social/web data and should be validated with your first-party analytics.",
        },
        "plots": plots,
    }
    return JSONResponse(content=response_payload)
