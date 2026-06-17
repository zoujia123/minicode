#!/usr/bin/env python3
"""
Try fetching XHS hot data from third-party aggregators or web search.
"""
import urllib.request
import urllib.error
import json
import re

def fetch(url, headers=None):
    if headers is None:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return {"status": resp.status, "body": resp.read().decode("utf-8", errors="replace")}
    except urllib.error.HTTPError as e:
        return {"status": e.code, "body": e.read().decode("utf-8", errors="replace")}
    except Exception as e:
        return {"error": str(e)}

# Some potential third-party hot-topic pages
urls = [
    "https://tophub.today/n/mPvdM0R",
    "https://tophub.today/n/xhs",
    "https://tophub.today/n/xiaohongshu",
    "https://weibotop.cn/hot",
    "https://www.51xhs.com/",
]

for url in urls:
    print(f"\n=== {url} ===")
    result = fetch(url)
    if "error" in result:
        print(f"Error: {result['error']}")
    else:
        # Print first 2000 chars for inspection
        body = result["body"]
        print(f"Status: {result['status']}, Length: {len(body)}")
        print(body[:2000])
