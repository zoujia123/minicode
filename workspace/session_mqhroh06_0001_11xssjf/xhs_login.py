#!/usr/bin/env python3
"""
小红书二维码登录脚本 - 在无头环境中获取二维码并转为终端显示
"""
from playwright.sync_api import sync_playwright
import qrcode
import time
import sys

def generate_terminal_qr(url, title="小红书扫码登录"):
    """将URL转为终端可显示的二维码"""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=1,
        border=1,
    )
    qr.add_data(url)
    qr.make(fit=True)
    print(f"\n{'='*40}")
    print(f"  {title}")
    print(f"{'='*40}\n")
    qr.print_tty()
    print(f"\n扫码URL: {url[:80]}...")
    print(f"{'='*40}\n")

def run_login():
    with sync_playwright() as p:
        # 使用 chromium 无头模式
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(
            viewport={"width": 1280, "height": 800}
        )
        
        # 访问小红书登录页（探索页会跳转到登录）
        page.goto("https://www.xiaohongshu.com/explore", wait_until="networkidle")
        
        # 等待页面加载
        time.sleep(3)
        
        # 截图保存
        page.screenshot(path="xhs_page.png")
        print("已保存页面截图到 xhs_page.png")
        
        # 检查是否有登录弹窗或二维码
        # 尝试查找二维码元素（小红书可能使用 canvas/img 或数据属性）
        qr_selectors = [
            'canvas',
            'img[src*="qr"]',
            '[class*="qr"]',
            '[class*="login"] img',
        ]
        
        found_qr = False
        for selector in qr_selectors:
            try:
                element = page.locator(selector).first
                if element.is_visible(timeout=1000):
                    element.screenshot(path="xhs_qr.png")
                    print(f"已找到二维码元素 ({selector})，已截图保存到 xhs_qr.png")
                    found_qr = True
                    break
            except:
                continue
        
        if not found_qr:
            # 尝试从页面源码提取二维码URL（如果有的话）
            content = page.content()
            import re
            qr_match = re.search(r'(https?://[^"\'>\s]*qr[^"\'>\s]*)', content, re.IGNORECASE)
            if qr_match:
                qr_url = qr_match.group(1)
                print(f"找到二维码URL: {qr_url}")
                generate_terminal_qr(qr_url)
            else:
                print("未能在页面中找到二维码")
                print("页面已保存为 xhs_page.png，请查看")
        
        # 监听页面获取 cookie（如果用户已经登录过的话）
        cookies = page.context.cookies()
        web_session = None
        for c in cookies:
            if c.get('name') == 'web_session':
                web_session = c.get('value')
                print(f"\n找到 web_session cookie: {web_session[:30]}...")
                break
        
        if web_session:
            print("\n✅ 当前已有登录态！")
        else:
            print("\n⏳ 等待扫码登录（60秒）...")
            for i in range(12):
                time.sleep(5)
                cookies = page.context.cookies()
                for c in cookies:
                    if c.get('name') == 'web_session':
                        web_session = c.get('value')
                        print(f"\n✅ 登录成功！web_session: {web_session[:30]}...")
                        break
                if web_session:
                    break
                print(f"  等待中... {i+1}/12")
        
        # 保存 cookies 供 xhs-cli 使用
        if web_session:
            print("\n🎉 登录成功！可以将上述 web_session 用于 xhs-cli")
        else:
            print("\n❌ 登录超时，请检查截图并手动扫码")
        
        browser.close()
        return web_session

if __name__ == "__main__":
    session = run_login()
    sys.exit(0 if session else 1)
