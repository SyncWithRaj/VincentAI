import html
import json
import math
import os
import re
from typing import Any, TypedDict
from datetime import datetime

import httpx
from langchain_core.messages import HumanMessage
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, START, END

from app.core.config import get_frontend_origin


class ProducerState(TypedDict):
    item_id: str
    input_payload: dict[str, Any]
    platform_data: dict[str, Any]
    algorithm_insights: list[dict[str, Any]]
    viral_prediction: dict[str, Any]
    link_analysis: dict[str, Any]
    frame_analysis: dict[str, Any]
    voice_to_viral: dict[str, Any]
    trend_tracker: dict[str, Any]
    executive_summary: str


def _get_llm() -> ChatGroq:
    return ChatGroq(temperature=0.4, model_name="llama-3.3-70b-versatile")


def _groq_available() -> bool:
    return bool(os.getenv("GROQ_API_KEY"))


def _clean_json(content: str) -> str:
    cleaned = content.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:-3].strip()
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:-3].strip()
    return cleaned


def _parse_json(content: str, fallback: dict[str, Any]) -> dict[str, Any]:
    try:
        return json.loads(_clean_json(content))
    except Exception:
        return fallback


def _normalize_url(url: str) -> str:
    return url.strip()


def _count_matches(text: str, pattern: str) -> int:
    return len(re.findall(pattern, text))


def _compute_virality_score(text: str, likes: int, comments: int) -> int:
    content = (text or "").strip()
    lowered = content.lower()

    content_length = len(content)
    hashtags_count = _count_matches(content, r"#[\w]+")
    emoji_count = _count_matches(content, r"[\U0001F300-\U0001FAFF]")

    virality_keywords = [
        "new", "secret", "proven", "viral", "trend", "ai", "launch", "breakthrough",
        "must", "discover", "boost", "strategy", "growth", "creator", "exclusive",
        "free", "today", "now", "ultimate",
    ]
    cta_keywords = ["comment", "share", "save", "follow", "click", "try", "watch", "join", "dm"]

    keyword_hits = sum(1 for term in virality_keywords if term in lowered)
    cta_hits = sum(1 for term in cta_keywords if term in lowered)
    hook_hits = _count_matches(lowered, r"\b\d+\s*(ways?|tips?|steps?|reasons?)\b")

    length_score = max(0, 16 - round(abs(content_length - 180) / 14)) if content_length > 0 else 0
    keyword_score = min(keyword_hits * 2, 14)
    cta_score = min(cta_hits * 4, 12)
    hashtag_score = min(hashtags_count * 2, 8)
    emoji_score = min(round(emoji_count * 1.5), 6)
    hook_score = min(hook_hits * 4, 9)

    text_score = length_score + keyword_score + cta_score + hashtag_score + emoji_score + hook_score

    weighted_engagement = max(0, likes) + max(0, comments) * 3
    engagement_score = min(round(math.log10(weighted_engagement + 1) * 16), 45)

    return max(0, min(100, round(10 + text_score + engagement_score)))


def _jina_url(url: str) -> str:
    cleaned = url.strip()
    if cleaned.startswith("https://"):
        cleaned = cleaned[len("https://"):]
    elif cleaned.startswith("http://"):
        cleaned = cleaned[len("http://"):]
    return f"https://r.jina.ai/http://{cleaned}"


def _extract_meta_content(html_text: str, key: str) -> str | None:
    patterns = [
        rf'property="{re.escape(key)}" content="([^"]+)"',
        rf'name="{re.escape(key)}" content="([^"]+)"',
    ]
    for pattern in patterns:
        match = re.search(pattern, html_text, re.IGNORECASE)
        if match:
            return html.unescape(match.group(1)).strip()
    return None


async def _scrape_social_url(url: str) -> dict[str, Any]:
    apify_token = os.getenv("APIFY_API_TOKEN", "")
    if not apify_token:
        return {"scrape_error": "APIFY_API_TOKEN not set"}

    domain = "web"
    if "instagram.com" in url:
        domain = "instagram"
    elif "linkedin.com" in url:
        domain = "linkedin"
    elif "youtube.com" in url or "youtu.be" in url:
        domain = "youtube"
    elif "twitter.com" in url or "x.com" in url:
        domain = "twitter"

    actor_map = {
        "instagram": "apify/instagram-scraper",
        "youtube": "apify/youtube-scraper",
        "twitter": "quacker/twitter-scraper",
        "linkedin": "curious_coder/linkedin-post-scraper",
        "web": "apify/web-scraper",
    }

    actor = actor_map.get(domain, "apify/web-scraper")
    actor_path = actor.replace("/", "~")

    payload = {"startUrls": [{"url": url}], "directUrls": [url]}

    scraped_text = ""
    likes = 0
    comments = 0
    thumbnail_url = None
    video_embed_url = None
    video_url = None
    frame_thumbnails: list[str] = []
    oembed_html = None
    scrape_error = None
    apify_error = None

    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"https://api.apify.com/v2/acts/{actor_path}/run-sync-get-dataset-items",
                params={"token": apify_token},
                json=payload,
                timeout=60.0,
            )
        if res.status_code not in (200, 201):
            apify_error = f"Apify HTTP {res.status_code}: {res.text}"
            data = []
        else:
            data = res.json()
        if data:
            first_item = data[0]
            scraped_text = first_item.get(
                "caption",
                first_item.get(
                    "text",
                    first_item.get(
                        "full_text",
                        first_item.get("description", first_item.get("title", "")),
                    ),
                ),
            )
            scraped_text = html.unescape(str(scraped_text))
            scraped_text = re.sub(r"https?://\S+", "", scraped_text).strip()
            likes = first_item.get("likesCount", first_item.get("likeCount", first_item.get("likes", first_item.get("favorite_count", 0))))
            comments = first_item.get("commentsCount", first_item.get("commentCount", first_item.get("replies", first_item.get("reply_count", 0))))
            try:
                likes = int(likes)
            except Exception:
                likes = 0
            try:
                comments = int(comments)
            except Exception:
                comments = 0
            if domain == "youtube":
                match = re.search(r"(?:v=|youtu\.be/)([\w-]{11})", url)
                if match:
                    yt_id = match.group(1)
                    video_embed_url = f"https://www.youtube.com/embed/{yt_id}?autoplay=0"
                    thumbnail_url = f"https://img.youtube.com/vi/{yt_id}/hqdefault.jpg"
                    frame_thumbnails = [
                        f"https://img.youtube.com/vi/{yt_id}/1.jpg",
                        f"https://img.youtube.com/vi/{yt_id}/2.jpg",
                        f"https://img.youtube.com/vi/{yt_id}/3.jpg",
                    ]
            else:
                media_list = (
                    first_item.get("media")
                    or first_item.get("extendedMedia")
                    or (first_item.get("extended_entities") or {}).get("media")
                    or (first_item.get("entities") or {}).get("media")
                    or first_item.get("photos")
                    or first_item.get("images")
                    or None
                )
                if isinstance(media_list, str):
                    thumbnail_url = media_list
                elif isinstance(media_list, list) and len(media_list) > 0:
                    media_item = media_list[0]
                    if isinstance(media_item, dict):
                        thumbnail_url = (
                            media_item.get("media_url_https")
                            or media_item.get("previewImageUrl")
                            or media_item.get("image_url")
                            or media_item.get("url")
                        )
                        variants = (
                            (media_item.get("video_info") or {}).get("variants")
                            or media_item.get("variants")
                            or []
                        )
                        if variants:
                            mp4_variants = [v for v in variants if v.get("content_type") == "video/mp4"]
                            if mp4_variants:
                                video_url = max(mp4_variants, key=lambda v: v.get("bitrate", 0)).get("url")
                    elif isinstance(media_item, str):
                        thumbnail_url = media_item
                if not thumbnail_url:
                    thumbnail_url = (
                        first_item.get("displayUrl")
                        or first_item.get("thumbnailUrl")
                        or first_item.get("thumbnail")
                        or first_item.get("previewUrl")
                    )
                if thumbnail_url:
                    frame_thumbnails = [thumbnail_url, thumbnail_url, thumbnail_url]
    except Exception as error:
        apify_error = f"Apify exception: {str(error)}"

    fallback_caption = None
    if not scraped_text:
        try:
            async with httpx.AsyncClient() as client:
                fallback_res = await client.get(_jina_url(url), timeout=12.0)
            if fallback_res.status_code == 200:
                fallback_html = fallback_res.text
                fallback_caption = (
                    _extract_meta_content(fallback_html, "og:description")
                    or _extract_meta_content(fallback_html, "twitter:description")
                    or _extract_meta_content(fallback_html, "description")
                    or _extract_meta_content(fallback_html, "og:title")
                )
                fallback_image = _extract_meta_content(fallback_html, "og:image")
                if fallback_caption:
                    scraped_text = fallback_caption
                if fallback_image and not thumbnail_url:
                    thumbnail_url = fallback_image
        except Exception:
            pass

    if domain == "twitter" and not video_embed_url:
        try:
            async with httpx.AsyncClient() as client:
                oe = await client.get(
                    "https://publish.twitter.com/oembed",
                    params={"url": url, "omit_script": "true", "theme": "dark", "dnt": "true"},
                    timeout=8.0,
                )
            if oe.status_code == 200:
                oembed_html = oe.json().get("html", None)
        except Exception:
            pass

    if not scraped_text and apify_error:
        scrape_error = apify_error
    elif scraped_text:
        scrape_error = None

    return {
        "platform": domain,
        "scraped_text": scraped_text,
        "likes": likes,
        "comments": comments,
        "thumbnail_url": thumbnail_url,
        "video_url": video_url,
        "video_embed_url": video_embed_url,
        "frame_thumbnails": frame_thumbnails,
        "oembed_html": oembed_html,
        "scrape_error": scrape_error,
    }


async def _transcribe_audio(audio_url: str, content_type: str | None) -> str:
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        return ""

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            media_res = await client.get(audio_url)
            if media_res.status_code != 200:
                return ""

            files = {
                "file": ("voice", media_res.content, content_type or "audio/ogg"),
            }
            data = {"model": "whisper-large-v3"}
            res = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {groq_api_key}"},
                data=data,
                files=files,
            )

        if res.status_code != 200:
            return ""

        payload = res.json()
        return payload.get("text", "") or ""
    except Exception:
        return ""


async def _insights_node(state: ProducerState) -> dict[str, Any]:
    def build_dynamic_insights() -> tuple[list[dict[str, Any]], dict[str, Any]]:
        payload = state.get("input_payload", {})
        platform_data = state.get("platform_data", {})
        scraped_text = platform_data.get("scraped_text", "")
        insights: list[dict[str, Any]] = []

        scrape_error = platform_data.get("scrape_error")
        if scrape_error:
            insights.append({
                "signal": f"Scrape error: {scrape_error}",
                "why_it_matters": "Without live post data, predictions become less accurate.",
                "impact": "high",
            })

        link = payload.get("link")
        if link:
            if "instagram.com" in link:
                signal = "Instagram reel link provided"
            elif "linkedin.com" in link:
                signal = "LinkedIn post link provided"
            elif "twitter.com" in link or "x.com" in link:
                signal = "Twitter/X post link provided"
            elif "youtube.com" in link or "youtu.be" in link:
                signal = "YouTube link provided"
            else:
                signal = "Social link provided"
            insights.append({
                "signal": signal,
                "why_it_matters": "Link type informs how the algorithm ranks and distributes content.",
                "impact": "medium",
            })

        if not payload.get("media_url") and not payload.get("media_type"):
            insights.append({
                "signal": "No media URL or media type provided",
                "why_it_matters": "Missing media metadata limits frame-level and visual analysis.",
                "impact": "medium",
            })

        if payload.get("from_number"):
            insights.append({
                "signal": "WhatsApp source detected",
                "why_it_matters": "Messaging-sourced content often needs stronger hooks for algorithmic reach.",
                "impact": "medium",
            })

        if scraped_text:
            insights.append({
                "signal": f"Caption length: {len(scraped_text)} characters",
                "why_it_matters": "Length influences watch time and comment velocity.",
                "impact": "medium",
            })

        if len(insights) < 3:
            insights.append({
                "signal": "Hook clarity",
                "why_it_matters": "Early retention drives reach.",
                "impact": "high",
            })

        baseline = _compute_virality_score(
            scraped_text,
            int(platform_data.get("likes", 0) or 0),
            int(platform_data.get("comments", 0) or 0),
        ) if scraped_text else None
        score = baseline if baseline is not None and baseline > 0 else (40 if scrape_error else 60)
        prediction = {
            "score": score,
            "confidence": 0.6 if scrape_error else 0.7,
            "reasoning": "Score reflects data availability and initial signal strength.",
        }

        return insights[:4], prediction

    if not _groq_available():
        insights, prediction = build_dynamic_insights()
        return {"algorithm_insights": insights, "viral_prediction": prediction}

    llm = _get_llm()
    payload = state.get("input_payload", {})
    platform_data = state.get("platform_data", {})
    prompt = f"""
You are a Digital Producer agent for Vincent.ai.

Input:
{json.dumps(payload, ensure_ascii=True)}

Platform data:
{json.dumps(platform_data, ensure_ascii=True)}

Return a JSON object with:
- algorithm_insights: list of 4 items, each {{"signal": "", "why_it_matters": "", "impact": "high|medium|low"}}
- viral_prediction: {{"score": 0-100, "confidence": 0-1, "reasoning": ""}}
"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    parsed = _parse_json(response.content, {
        "algorithm_insights": [],
        "viral_prediction": {},
    })

    insights = parsed.get("algorithm_insights")
    prediction = parsed.get("viral_prediction")
    if not isinstance(insights, list) or not insights:
        insights, prediction = build_dynamic_insights()

    return {"algorithm_insights": insights, "viral_prediction": prediction or {}}


async def _link_analysis_node(state: ProducerState) -> dict[str, Any]:
    payload = state.get("input_payload", {})
    link = payload.get("link")
    platform_data = state.get("platform_data", {})
    scraped_text = platform_data.get("scraped_text", "")
    scrape_error = platform_data.get("scrape_error")

    if not link and not scraped_text:
        return {"link_analysis": {}}

    if not _groq_available():
        return {"link_analysis": {"error": "GROQ_API_KEY not set"}}

    llm = _get_llm()
    before_score = _compute_virality_score(
        scraped_text,
        int(platform_data.get("likes", 0) or 0),
        int(platform_data.get("comments", 0) or 0),
    ) if scraped_text else state.get("viral_prediction", {}).get("score")
    prompt = f"""
You are an elite Digital Marketing AI. Improve the post and predict virality.

Post text:
"{scraped_text}"

Scrape error (if any): {scrape_error}

Engagement:
Likes: {platform_data.get('likes', 0)}
Comments: {platform_data.get('comments', 0)}

Current virality score (baseline): {before_score}

Return JSON with:
{ {
  "enhanced_text": "",
  "suggested_improvements": ["", "", ""],
  "predicted_virality_after": {"score": 0-100, "confidence": 0-1, "reasoning": ""}
} }
"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    parsed = _parse_json(response.content, {
        "enhanced_text": "",
        "suggested_improvements": [],
        "predicted_virality_after": {"score": before_score or 0, "confidence": 0.4, "reasoning": ""},
    })

    return {
        "link_analysis": {
            "original_text": scraped_text,
            "enhanced_text": parsed.get("enhanced_text", ""),
            "suggested_improvements": parsed.get("suggested_improvements", []),
            "predicted_virality_after": parsed.get("predicted_virality_after", {}),
            "baseline_score": before_score,
        }
    }


async def _frame_analysis_node(state: ProducerState) -> dict[str, Any]:
    payload = state.get("input_payload", {})
    if payload.get("content_type") != "video":
        return {"frame_analysis": {"attention_drop_segments": [], "recommendations": []}}

    if not _groq_available():
        return {
            "frame_analysis": {
                "attention_drop_segments": [
                    {
                        "start": "0:04",
                        "end": "0:08",
                        "issue": "Hook loses specificity",
                        "confidence": 0.4,
                        "recommendation": "Add a concrete promise in the first 5 seconds.",
                    }
                ],
                "recommendations": [
                    "Tighten the intro to under 3 seconds.",
                    "Add a pattern break around 10 seconds.",
                ],
            }
        }

    llm = _get_llm()
    prompt = f"""
You are a frame-level video analyst. The user provided a video with the following context:
{json.dumps(payload, ensure_ascii=True)}

Return JSON:
{{
  "attention_drop_segments": [
    {{"start": "0:04", "end": "0:08", "issue": "", "confidence": 0-1, "recommendation": ""}}
  ],
  "recommendations": ["", "", ""]
}}
"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    parsed = _parse_json(response.content, {"attention_drop_segments": [], "recommendations": []})
    return {"frame_analysis": parsed}


async def _voice_to_viral_node(state: ProducerState) -> dict[str, Any]:
    payload = state.get("input_payload", {})
    transcript = payload.get("text", "")
    if not transcript:
        transcript = state.get("platform_data", {}).get("scraped_text", "")
    if payload.get("content_type") == "audio":
        transcript = await _transcribe_audio(payload.get("media_url", ""), payload.get("media_type")) or transcript

    if not _groq_available():
        return {
            "voice_to_viral": {
                "transcript": transcript,
                "script": "Hook: " + (transcript[:80] or "Share a bold promise") + "\nBody: Share 3 quick steps.\nCTA: Ask for a follow.",
                "distribution_strategy": [
                    "Post as a 30-45s vertical short.",
                    "Repurpose into a LinkedIn carousel.",
                ],
            }
        }

    llm = _get_llm()
    prompt = f"""
You are a Voice-to-Viral agent. Convert the idea into a formatted script and cross-platform strategy.
Idea transcript:
{transcript}

Return JSON:
{{
  "transcript": "",
  "script": "",
  "distribution_strategy": ["", "", ""]
}}
"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    parsed = _parse_json(response.content, {"transcript": transcript, "script": "", "distribution_strategy": []})
    if not parsed.get("transcript"):
        parsed["transcript"] = transcript
    return {"voice_to_viral": parsed}


async def _trend_tracker_node(state: ProducerState) -> dict[str, Any]:
    if not _groq_available():
        return {
            "trend_tracker": {
                "topics": ["behind-the-scenes", "creator workflows", "AI editing"],
                "hashtags": ["#creator", "#shorts", "#contenttips"],
                "audio": ["ambient synth", "punchy voiceover"],
                "formats": ["split-screen tips", "before/after"],
            }
        }

    llm = _get_llm()
    payload = state.get("input_payload", {})
    niche = payload.get("niche") or "creator economy"
    prompt = f"""
You are a Trend Tracker for {niche} creators. Return JSON with:
{{
  "topics": ["", "", ""],
  "hashtags": ["", "", ""],
  "audio": ["", ""],
  "formats": ["", ""]
}}
"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    parsed = _parse_json(response.content, {"topics": [], "hashtags": [], "audio": [], "formats": []})
    return {"trend_tracker": parsed}


async def _summary_node(state: ProducerState) -> dict[str, Any]:
    if not _groq_available():
        return {"executive_summary": "Virality score: 54/100. Focus on a sharper opening hook, add a clear payoff, and tighten pacing for the first 10 seconds."}

    llm = _get_llm()
    prompt = f"""
Create a concise executive summary for a WhatsApp reply. Include a virality score and top 3 actionable insights.

Insights:
{json.dumps(state.get('algorithm_insights', []), ensure_ascii=True)}

Viral Prediction:
{json.dumps(state.get('viral_prediction', {}), ensure_ascii=True)}

Frame Analysis:
{json.dumps(state.get('frame_analysis', {}), ensure_ascii=True)}

Voice-to-Viral:
{json.dumps(state.get('voice_to_viral', {}), ensure_ascii=True)}

Trend Tracker:
{json.dumps(state.get('trend_tracker', {}), ensure_ascii=True)}

Link Analysis:
{json.dumps(state.get('link_analysis', {}), ensure_ascii=True)}
"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    summary = response.content.strip()
    return {"executive_summary": summary}


async def _scrape_node(state: ProducerState) -> dict[str, Any]:
    payload = state.get("input_payload", {})
    link = payload.get("link")
    if not link:
        return {"platform_data": {}}
    return {"platform_data": await _scrape_social_url(_normalize_url(link))}


workflow = StateGraph(ProducerState)
workflow.add_node("scrape", _scrape_node)
workflow.add_node("insights", _insights_node)
workflow.add_node("link_analysis_node", _link_analysis_node)
workflow.add_node("frame_analysis_node", _frame_analysis_node)
workflow.add_node("voice_to_viral_node", _voice_to_viral_node)
workflow.add_node("trend_tracker_node", _trend_tracker_node)
workflow.add_node("summary", _summary_node)

workflow.add_edge(START, "scrape")
workflow.add_edge("scrape", "insights")
workflow.add_edge("insights", "link_analysis_node")
workflow.add_edge("link_analysis_node", "frame_analysis_node")
workflow.add_edge("frame_analysis_node", "voice_to_viral_node")
workflow.add_edge("voice_to_viral_node", "trend_tracker_node")
workflow.add_edge("trend_tracker_node", "summary")
workflow.add_edge("summary", END)

producer_app = workflow.compile()


def build_dashboard_link(item_id: str) -> str:
    origin = get_frontend_origin().rstrip("/")
    return f"{origin}/dashboard?tab=live-store&itemId={item_id}"


def _format_link_analysis_message(link_analysis: dict[str, Any] | None) -> str:
    if not link_analysis:
        return ""

    baseline = link_analysis.get("baseline_score")
    predicted = (link_analysis.get("predicted_virality_after") or {}).get("score")
    improvements = link_analysis.get("suggested_improvements") or []
    enhanced_text = link_analysis.get("enhanced_text") or ""

    lines: list[str] = ["Post Optimization (Link Analysis)"]
    lines.append(f"Baseline Score: {baseline if baseline is not None else '--'}")
    lines.append(f"Predicted After: {predicted if predicted is not None else '--'}")
    lines.append("Suggested Improvements:")
    if improvements:
        for tip in improvements:
            lines.append(f"- {tip}")
    else:
        lines.append("- Not available yet.")

    if enhanced_text:
        lines.append("Enhanced Text:")
        lines.append(enhanced_text)

    return "\n".join(lines)


def build_initial_item(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "source": "whatsapp",
        "status": "queued",
        "stage": "intake",
        "input": payload,
        "platform_data": {},
        "algorithm_insights": [],
        "viral_prediction": {},
        "link_analysis": {},
        "frame_analysis": {},
        "voice_to_viral": {},
        "trend_tracker": {},
        "executive_summary": "",
        "created_at": datetime.utcnow().isoformat() + "Z",
    }


async def send_whatsapp_summary(
    to_number: str,
    summary: str,
    dashboard_link: str,
    link_analysis: dict[str, Any] | None = None,
) -> bool:
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_WHATSAPP_NUMBER")

    if not (account_sid and auth_token and from_number and to_number):
        print("[TWILIO] Missing credentials or destination number.")
        return False

    optimization_block = _format_link_analysis_message(link_analysis)
    parts = [summary.strip()] if summary else []
    if optimization_block:
        parts.append(optimization_block)
    parts.append(f"Full dashboard: {dashboard_link}")
    message = "\n\n".join(parts).strip()

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json",
                auth=(account_sid, auth_token),
                data={
                    "From": from_number,
                    "To": to_number,
                    "Body": message[:1500],
                },
            )
        if res.status_code not in (200, 201):
            print(f"[TWILIO] Send failed: {res.status_code} {res.text[:400]}")
        else:
            print(f"[TWILIO] Message sent to {to_number}.")
        return res.status_code in (200, 201)
    except Exception as error:
        print(f"[TWILIO] Send exception: {str(error)}")
        return False
