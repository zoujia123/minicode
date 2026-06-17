#!/usr/bin/env python3
"""
Fetch XiaoHongShu (小红书) hot/trending topics using Playwright.
"""
import asyncio
import json
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            locale="zh-CN",
        )
        page = await context.new_page()

        # Intercept API responses for trending/hot data
        trending_data = []
        feed_data = []

        async def handle_response(response):
            url = response.url
            if "trending" in url or "hot" in url or "search_feed" in url:
                try:
                    body = await response.json()
                    trending_data.append({"url": url, "body": body})
                except Exception:
                    pass
            if "homefeed" in url or "feed" in url or "recommend" in url:
                try:
                    body = await response.json()
                    feed_data.append({"url": url, "body": body})
                except Exception:
                    pass

        page.on("response", handle_response)

        # Visit explore / search page where trending topics appear
        urls_to_try = [
            "https://www.xiaohongshu.com/explore",
            "https://www.xiaohongshu.com/search_result",
        ]

        for url in urls_to_try:
            try:
                await page.goto(url, wait_until="networkidle", timeout=30000)
                await asyncio.sleep(3)
            except Exception as e:
                print(f"Failed to load {url}: {e}")

        # Also try to extract topics from page content
        try:
            topics_from_page = await page.eval_on_selector_all(
                "[class*='trending'], [class*='hot'], [class*='topic']",
                "elements => elements.map(el => el.textContent.trim()).filter(t => t.length > 0)"
            )
        except Exception:
            topics_from_page = []

        await browser.close()

        # Try a direct API call with requests-like headers for trending
        import urllib.request
        req = urllib.request.Request(
            "https://edith.xiaohongshu.com/api/sns/web/v1/search/trending",
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json",
                "Referer": "https://www.xiaohongshu.com/",
                "Origin": "https://www.xiaohongshu.com",
            }
        )
        direct_trending = None
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                direct_trending = json.loads(resp.read().decode())
        except Exception as e:
            direct_trending = {"error": str(e)}

        result = {
            "trending_api_responses": trending_data,
            "feed_api_responses": feed_data,
            "topics_from_page": topics_from_page[:30],
            "direct_trending_api": direct_trending,
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
