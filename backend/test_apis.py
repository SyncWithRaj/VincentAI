"""Quick test to dump raw JSON from Apify for Twitter and LinkedIn."""
import asyncio, json, os, sys
sys.stdout.reconfigure(encoding='utf-8')
from dotenv import load_dotenv
load_dotenv()

import httpx

async def test_twitter():
    token = os.getenv("APIFY_API_TOKEN")
    username = os.getenv("TWITTER_DEFAULT_USERNAME", "").lstrip("@")
    print(f"\n{'='*60}")
    print(f"TWITTER: username={username}")
    print(f"{'='*60}")
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        res = await client.post(
            "https://api.apify.com/v2/acts/apidojo~tweet-scraper/run-sync-get-dataset-items",
            params={"token": token},
            json={
                "searchTerms": [f"from:{username} -filter:retweets"],
                "maxItems": 50,
                "sort": "Latest",
            },
        )
    print(f"Status: {res.status_code}")
    data = res.json()
    # Dump first 2 items raw
    print(f"Type: {type(data)}, len: {len(data) if isinstance(data, list) else 'N/A'}")
    print("RAW first 2 items:")
    if isinstance(data, list):
        for i, item in enumerate(data[:2]):
            print(f"  Item {i}: {json.dumps(item, ensure_ascii=False)[:600]}")
    else:
        print(f"  {json.dumps(data, ensure_ascii=False)[:1000]}")


async def test_linkedin():
    token = os.getenv("APIFY_API_TOKEN")
    profile_url = os.getenv("LINKEDIN_DEFAULT_PROFILE_URL", "")
    print(f"\n{'='*60}")
    print(f"LINKEDIN: profile_url={profile_url}")
    print(f"{'='*60}")
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        res = await client.post(
            "https://api.apify.com/v2/acts/dev_fusion~linkedin-profile-scraper/run-sync-get-dataset-items",
            params={"token": token},
            json={
                "profileUrls": [profile_url],
            },
        )
    print(f"Status: {res.status_code}")
    data = res.json()
    print(f"Type: {type(data)}, len: {len(data) if isinstance(data, list) else 'N/A'}")
    print("RAW first item:")
    if isinstance(data, list) and data:
        print(json.dumps(data[0], ensure_ascii=False)[:2000])
    else:
        print(json.dumps(data, ensure_ascii=False)[:2000])

async def main():
    await test_twitter()
    await test_linkedin()

asyncio.run(main())
