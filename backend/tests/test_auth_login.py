# 任务：启动后端服务器并用 admin/123456 调用 /api/auth/login 做单元验证
# 方案：pytest 中用子进程按指定端口启动 Connexion 应用，轮询健康检查等待就绪，再用 requests 发送登录请求并断言返回的令牌信息

import socket
import subprocess
import sys
import time
from pathlib import Path

import pytest
import requests


def _find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def _wait_for_health(base_url, timeout=15):
    deadline = time.time() + timeout
    health_url = f"{base_url}/api/health"
    while time.time() < deadline:
        try:
            response = requests.get(health_url, timeout=1)
        except requests.RequestException:
            time.sleep(0.2)
            continue
        if response.status_code == 200:
            return
        time.sleep(0.2)
    pytest.fail("后端启动超时，健康检查未通过")


@pytest.fixture(scope="module")
def server_url():
    port = _find_free_port()
    backend_dir = Path(__file__).resolve().parents[1]
    cmd = [
        sys.executable,
        "-c",
        f"from app import app; app.run(port={port}, host='127.0.0.1')",
    ]
    process = subprocess.Popen(cmd, cwd=backend_dir)
    try:
        _wait_for_health(f"http://127.0.0.1:{port}")
        yield f"http://127.0.0.1:{port}"
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


def test_admin_login_success(server_url):
    login_url = f"{server_url}/api/auth/login"
    response = requests.post(
        login_url,
        json={"username": "admin", "password": "123456"},
        timeout=3,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["token_type"].lower() == "bearer"
    assert data["role"] == "admin"
    assert isinstance(data["access_token"], str) and data["access_token"]
    assert data["expires_in"] > 0
