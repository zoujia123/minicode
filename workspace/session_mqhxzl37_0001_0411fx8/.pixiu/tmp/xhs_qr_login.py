#!/usr/bin/env python3
"""
小红书纯 HTTP 二维码登录脚本
绕过浏览器，直接在终端显示二维码
"""

import sys
import os
import time
import qrcode

# 添加 xhs_cli 到 Python 路径
sys.path.insert(0, '/home/gujing/miniconda3/envs/pixiu-tools/lib/python3.12/site-packages')

from xhs_cli.qr_login import (
    _http_qrcode_login,
    _emit_status,
    _generate_a1,
    _generate_webid,
    _apply_session_cookies,
    _build_saved_cookies,
    _complete_confirmed_session,
    _resolved_user_id,
    _display_qr_in_terminal,
    POLL_TIMEOUT_S,
    POLL_INTERVAL_S,
    QR_WAITING,
    QR_SCANNED,
    QR_CONFIRMED,
)
from xhs_cli.client import XhsClient
from xhs_cli.cookies import save_cookies
from xhs_cli.exceptions import XhsApiError


def main():
    print("🔑 启动小红书纯 HTTP 二维码登录...")
    
    try:
        # 直接使用 HTTP 二维码登录
        cookies = _http_qrcode_login(
            on_status=lambda msg: print(msg),
            timeout_s=240,
        )
        print(f"\n✅ 登录成功！")
        print(f"📋 Cookie 已保存，可执行: xhs hot")
        return 0
    except Exception as e:
        print(f"\n❌ 登录失败: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
