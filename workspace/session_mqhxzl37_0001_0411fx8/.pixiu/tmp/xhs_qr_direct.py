#!/usr/bin/env python3
"""小红书二维码登录 - 直接使用 HTTP API"""
import sys
import time
import uuid
import qrcode
import requests

BASE = "https://edith.xiaohongshu.com"

def generate_a1():
    return str(uuid.uuid4()).replace('-', '')

def generate_webid():
    return str(uuid.uuid4()).replace('-', '')

def main():
    print("🔑 启动小红书二维码登录...\n")
    
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://www.xiaohongshu.com/",
        "Origin": "https://www.xiaohongshu.com",
    })
    
    # 1. 获取初始 cookies
    a1 = generate_a1()
    webid = generate_webid()
    session.cookies.set("a1", a1, domain=".xiaohongshu.com")
    session.cookies.set("webId", webid, domain=".xiaohongshu.com")
    
    # 2. 访问首页激活
    print("📡 连接小红书服务器...")
    session.get("https://www.xiaohongshu.com/", timeout=10)
    
    # 3. 创建二维码
    print("📱 生成登录二维码...\n")
    qr_resp = session.post(
        f"{BASE}/api/sns/web/v1/login/qrcode/create",
        json={},
        timeout=10,
    )
    qr_data = qr_resp.json().get("data", {})
    qr_url = qr_data.get("url", "")
    qr_id = qr_data.get("qr_id", "")
    code = qr_data.get("code", "")
    
    if not qr_url:
        print("❌ 无法获取二维码")
        print(qr_resp.text[:500])
        return 1
    
    # 4. 显示二维码
    qr = qrcode.QRCode(border=2)
    qr.add_data(qr_url)
    qr.make()
    qr.print_ascii(invert=True)
    
    print(f"\n📲 请用小红书 APP 扫描上方二维码")
    print(f"⏳ 等待扫码中... (240秒超时)\n")
    
    # 5. 轮询扫码状态
    start = time.time()
    last_status = -1
    
    while time.time() - start < 240:
        time.sleep(2)
        
        try:
            status_resp = session.post(
                f"{BASE}/api/sns/web/v1/login/qrcode/status",
                json={"qr_id": qr_id, "code": code},
                timeout=10,
            )
            status_data = status_resp.json().get("data", {})
            code_status = status_data.get("codeStatus", -1)
        except Exception as e:
            print(f"  轮询出错: {e}")
            continue
        
        if code_status != last_status:
            last_status = code_status
            if code_status == 0:
                print("  🕐 等待扫码...")
            elif code_status == 1:
                print("  📲 已扫描！等待确认...")
            elif code_status == 2:
                print("  ✅ 登录已确认！")
                break
    
    if last_status != 2:
        print("\n⏰ 二维码已过期，请重试")
        return 1
    
    # 6. 保存 cookies
    print("\n🎉 登录成功！")
    print(f"   a1: {a1[:20]}...")
    print(f"   webId: {webid[:20]}...")
    
    # 保存到 xhs 能识别的位置
    cookies_dict = {c.name: c.value for c in session.cookies}
    print(f"\n   获取到的 cookies: {list(cookies_dict.keys())}")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
