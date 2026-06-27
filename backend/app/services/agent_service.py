import os
import json
from typing import TypedDict, List, Dict, Any
from urllib.parse import quote_plus
import xml.etree.ElementTree as ET
import re

import httpx
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, START, END
from tavily import AsyncTavilyClient

# State Definition
class AgentState(TypedDict):
    company_description: str
    social_goal: str
    target_audience: str
    keywords: List[str]
    research_data: str
    strategy: str
    draft: str
    hashtags: List[str]

# Initialize LLM
def get_llm():
    return ChatGroq(temperature=0.7, model_name="llama-3.3-70b-versatile")


def _get_tavily_api_key() -> str:
    raw = os.environ.get("TAVILY_API_KEY") or os.environ.get("TAVILY_KEY") or ""
    return raw.strip().strip('"').strip("'")


def get_tavily_client():
    return AsyncTavilyClient(api_key=_get_tavily_api_key())


def _strip_html(text: str) -> str:
    if not text:
        return ""
    return re.sub(r"<[^>]+>", "", text).strip()


async def _search_google_news_rss(query: str, max_results: int = 3) -> str:
    rss_url = f"https://news.google.com/rss/search?q={quote_plus(query)}&hl=en-US&gl=US&ceid=US:en"

    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        response = await client.get(rss_url)
        response.raise_for_status()

    root = ET.fromstring(response.text)
    items = root.findall("./channel/item")[:max_results]
    results_text = []

    for item in items:
        title = (item.findtext("title") or "Untitled").strip()
        link = (item.findtext("link") or "#").strip()
        description = _strip_html(item.findtext("description") or "")
        if not description:
            description = "Latest market update relevant to your query."

        results_text.append(f"### {title}\n{description}\n\n**Source:** [{link}]({link})")

    return "\n\n---\n\n".join(results_text)

# Nodes
async def onboarding_node(state: AgentState):
    llm = get_llm()
    prompt = f"""
    You are an Onboarding Agent. Extract the target audience and a list of 3-5 core search keywords from the following startup info.
    Company Description: {state['company_description']}
    Goal: {state['social_goal']}
    
    Respond STRICTLY in JSON format with keys "target_audience" (string) and "keywords" (list of strings).
    """
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    
    content = response.content.strip()
    if content.startswith("```json"):
        content = content[7:-3]
    elif content.startswith("```"):
        content = content[3:-3]
        
    try:
        data = json.loads(content)
        target_audience = data.get("target_audience", "General Audience")
        keywords = data.get("keywords", [])
    except Exception:
        target_audience = "General Audience"
        keywords = ["startup trends", "social media"]
    
    return {"target_audience": target_audience, "keywords": keywords}

async def research_node(state: AgentState):
    keywords = state.get("keywords", [])
    company = state.get("company_description", "")
    social_goal = state.get("social_goal", "")
    query = " ".join(keywords[:2]).strip()
    if not query:
        query = f"{company} {social_goal}".strip()
    query = f"{query} current trends and news".strip()
    
    research_summary = ""
    try:
        tavily_key = _get_tavily_api_key()
        if tavily_key:
            client = get_tavily_client()
            search_result = await client.search(query=query, search_depth="advanced", max_results=3)

            results_text = []
            for result in search_result.get("results", []):
                url = result.get("url", "#")
                title = result.get("title", "Untitled")
                content = result.get("content", "")
                results_text.append(f"### {title}\n{content}\n\n**Source:** [{url}]({url})")
            research_summary = "\n\n---\n\n".join(results_text)
    except Exception as e:
        print(f"[research] Tavily search failed: {e}")

    if not research_summary:
        try:
            research_summary = await _search_google_news_rss(query=query, max_results=3)
        except Exception as e:
            print(f"[research] RSS fallback failed: {e}")

    if not research_summary:
        research_summary = "Live research is temporarily unavailable. Continuing with strategy based on your business context."

    return {"research_data": research_summary}

async def strategist_node(state: AgentState):
    llm = get_llm()
    prompt = f"""
    You are a Content Strategist Agent.
    Based on the Company Description: {state['company_description']}
    Target Audience: {state['target_audience']}
    Social Goal: {state['social_goal']}
    Recent Market Research: {state['research_data']}
    
    Determine the best content strategy (e.g., tone, platform to focus on, type of post, key message). 
    Provide a concise strategy paragraph.
    """
    response = await llm.ainvoke([
        SystemMessage(content="You are a brilliant marketing strategist."), 
        HumanMessage(content=prompt)
    ])
    return {"strategy": response.content}

async def copywriter_node(state: AgentState):
    llm = get_llm().with_config({"temperature": 0.5}) # slightly less creative for stable JSON
    prompt = f"""
    You are a world-class Copywriter Agent.
    Strategy: {state['strategy']}
    Goal: {state['social_goal']}
    
    Draft the final social media post. Include an engaging hook and the main body.
    DO NOT include hashtags inside the main draft text!
    Instead, generate a discrete list of highly relevant, trending hashtags based on the content.
    
    Return your response STRICTLY as a JSON object with the following schema:
    {{
      "draft_text": "The main body of the post here...",
      "hashtags": ["#marketing", "#example"]
    }}
    """
    response = await llm.ainvoke([
        SystemMessage(content="You are an expert copywriter. You must ONLY output a valid JSON object."), 
        HumanMessage(content=prompt)
    ])
    
    content = response.content.strip()
    if content.startswith("```json"):
        content = content[7:-3].strip()
    elif content.startswith("```"):
        content = content[3:-3].strip()
        
    try:
        data = json.loads(content)
        draft = data.get("draft_text", "")
        hashtags = data.get("hashtags", [])
        if not draft:
            draft = content # Fallback if JSON parsed but schema was wrong
    except Exception:
        draft = content
        hashtags = []
        
    return {"draft": draft, "hashtags": hashtags}

# Build Graph
workflow = StateGraph(AgentState)
workflow.add_node("onboarding", onboarding_node)
workflow.add_node("research", research_node)
workflow.add_node("strategist", strategist_node)
workflow.add_node("copywriter", copywriter_node)

workflow.add_edge(START, "onboarding")
workflow.add_edge("onboarding", "research")
workflow.add_edge("research", "strategist")
workflow.add_edge("strategist", "copywriter")
workflow.add_edge("copywriter", END)

agent_app = workflow.compile()
