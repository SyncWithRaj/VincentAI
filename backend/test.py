import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv(".env")
try:
    from pytrends.request import TrendReq
except ImportError:
    TrendReq = None

async def main():
    print("Testing Google...")
    try:
        pytrend = TrendReq(hl='en-US', tz=360)
        kw_list = ["AI Tools", "Content Automation", "Vlogging"]
        pytrend.build_payload(kw_list, cat=0, timeframe='today 1-m', geo='US')
        df = pytrend.interest_over_time()
        print("Google Success!")
    except Exception as e:
        import traceback
        traceback.print_exc()

    print("Testing YouTube...")
    try:
        api_key = os.getenv("YOUTUBE_API_KEY")
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
            print("YouTube Status:", response.status_code)
            if response.status_code != 200:
                print(response.text)
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
