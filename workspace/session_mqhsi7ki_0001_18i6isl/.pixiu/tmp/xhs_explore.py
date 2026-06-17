#!/usr/bin/env python3
"""
Fetch XiaoHongShu explore page to extract trending/hot topics.
"""
import urllib.request
import urllib.error
import re
import json

def fetch(url, headers=None):
    if headers is None:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Referer": "https://www.xiaohongshu.com/",
        }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return {"status": resp.status, "body": resp.read().decode("utf-8", errors="replace")}
    except urllib.error.HTTPError as e:
        return {"status": e.code, "body": e.read().decode("utf-8", errors="replace")}
    except Exception as e:
        return {"error": str(e)}

# Fetch explore page
print("Fetching https://www.xiaohongshu.com/explore ...")
result = fetch("https://www.xiaohongshu.com/explore")

if "error" in result:
    print(f"Error: {result['error']}")
    exit(1)

print(f"Status: {result['status']}, Length: {len(result['body'])}")

body = result["body"]

# Try to find SSR initial state JSON
ssr_match = re.search(r'window\.__INITIAL_STATE__\s*=\s*({.+?});', body)
if ssr_match:
    try:
        initial_state = json.loads(ssr_match.group(1))
        print("\n=== Found __INITIAL_STATE__ ===")
        print(json.dumps(initial_state, ensure_ascii=False, indent=2)[:5000])
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        print(f"Raw content length: {len(ssr_match.group(1))}")
else:
    print("\nNo __INITIAL_STATE__ found.")
    # Print first 3000 chars for manual inspection
    print(body[:3000])
