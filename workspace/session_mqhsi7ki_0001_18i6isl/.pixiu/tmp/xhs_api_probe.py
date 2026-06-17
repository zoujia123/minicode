#!/usr/bin/env python3
"""
Try various XHS API endpoints to find one that works without login.
"""
import urllib.request
import urllib.error
import json
import re
import gzip

def fetch(url, headers=None, method="GET", data=None):
    if headers is None:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Referer": "https://www.xiaohongshu.com/",
            "Origin": "https://www.xiaohongshu.com",
            "Accept-Encoding": "gzip, deflate, br",
        }
    req = urllib.request.Request(url, headers=headers, method=method)
    if data:
        req.data = data.encode() if isinstance(data, str) else data
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = resp.read()
            if resp.headers.get('Content-Encoding') == 'gzip':
                body = gzip.decompress(body)
            return {"status": resp.status, "body": body.decode("utf-8", errors="replace")}
    except urllib.error.HTTPError as e:
        body = e.read()
        try:
            if e.headers.get('Content-Encoding') == 'gzip':
                body = gzip.decompress(body)
            body = body.decode("utf-8", errors="replace")
        except:
            body = "<binary>"
        return {"status": e.code, "body": body}
    except Exception as e:
        return {"error": str(e)}

endpoints = [
    ("GET", "https://edith.xiaohongshu.com/api/sns/web/v1/search/recommend", None),
    ("GET", "https://www.xiaohongshu.com/api/sns/web/v1/search/recommend", None),
    ("GET", "https://edith.xiaohongshu.com/api/sns/web/v1/search/hots", None),
    ("GET", "https://www.xiaohongshu.com/api/sns/web/v1/search/hots", None),
    ("GET", "https://edith.xiaohongshu.com/api/sns/web/v1/homefeed", None),
    ("GET", "https://www.xiaohongshu.com/api/sns/web/v1/homefeed", None),
    ("GET", "https://edith.xiaohongshu.com/api/sns/web/v1/feed", None),
    ("POST", "https://edith.xiaohongshu.com/api/sns/web/v1/search/notes", 
     '{"keyword":"热门","page":1,"page_size":10,"sort":"general","note_type":0}'),
]

special_headers = {
    "Content-Type": "application/json;charset=UTF-8",
    "X-S": "",  # might need signature, but let's try
}

for method, url, payload in endpoints:
    print(f"\n{'='*60}")
    print(f"[{method}] {url}")
    h = None
    if payload:
        h = dict(special_headers)
        h["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        h["Accept"] = "application/json, text/plain, */*"
        h["Referer"] = "https://www.xiaohongshu.com/"
    result = fetch(url, headers=h, method=method, data=payload)
    if "error" in result:
        print(f"Error: {result['error']}")
    else:
        print(f"Status: {result['status']}")
        try:
            parsed = json.loads(result['body'])
            print(json.dumps(parsed, ensure_ascii=False, indent=2)[:2000])
        except:
            print(result['body'][:500])
