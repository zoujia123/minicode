#!/usr/bin/env python3
"""
Try to extract XiaoHongShu cookies from local browsers using browser-cookie3.
"""
import browser_cookie3

try:
    # Try Chrome
    cj = browser_cookie3.chrome(domain_name='xiaohongshu.com')
    cookies = {c.name: c.value for c in cj}
    if cookies:
        print("Found Xiaohongshu cookies from Chrome:")
        for k, v in cookies.items():
            print(f"  {k}={v[:50]}{'...' if len(v) > 50 else ''}")
        # Also print cookie string format
        cookie_str = '; '.join([f"{k}={v}" for k, v in cookies.items()])
        print(f"\nCookie string:\n{cookie_str}\n")
    else:
        print("No Xiaohongshu cookies found in Chrome.")
except Exception as e:
    print(f"Chrome error: {e}")

try:
    # Try Firefox
    cj = browser_cookie3.firefox(domain_name='xiaohongshu.com')
    cookies = {c.name: c.value for c in cj}
    if cookies:
        print("Found Xiaohongshu cookies from Firefox:")
        for k, v in cookies.items():
            print(f"  {k}={v[:50]}{'...' if len(v) > 50 else ''}")
        cookie_str = '; '.join([f"{k}={v}" for k, v in cookies.items()])
        print(f"\nCookie string:\n{cookie_str}\n")
    else:
        print("No Xiaohongshu cookies found in Firefox.")
except Exception as e:
    print(f"Firefox error: {e}")

print("\nDone checking browsers.")
