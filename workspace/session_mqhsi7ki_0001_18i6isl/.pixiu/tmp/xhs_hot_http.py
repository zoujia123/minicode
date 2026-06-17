#!/usr/bin/env python3
"""
Fetch XiaoHongShu (小红书) hot/trending topics via HTTP API.
"""
import json
import urllib.request
import urllib.error

def fetch(url, headers=None):
    if headers is None:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Referer": "https://www.xiaohongshu.com/",
            "Origin": "https://www.xiaohongshu.com",
        }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return {"status": resp.status, "body": json.loads(resp.read().decode())}
    except urllib.error.HTTPError as e:
        return {"status": e.code, "body": e.read().decode()}
    except Exception as e:
        return {"error": str(e)}

# Try several known endpoints for hot/trending/search suggestions
endpoints = [
    "https://edith.xiaohongshu.com/api/sns/web/v1/search/trending",
    "https://www.xiaohongshu.com/api/sns/web/v1/search/trending",
    "https://edith.xiaohongshu.com/api/sns/web/v1/search/hot",
    "https://edith.xiaohongshu.com/api/sns/web/v1/search/suggest",
    "https://www.xiaohongshu.com/api/sns/web/v1/search/suggest",
]

results = {}
for ep in endpoints:
    results[ep] = fetch(ep)

print(json.dumps(results, ensure_ascii=False, indent=2))
