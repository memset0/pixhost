# 任务：为 AI 生成标签功能提供单元测试，直接调用 Qwen API 且不触碰数据库/本地文件写入
# 方案：从远程图片获取并转为 JPEG base64，monkeypatch _image_to_base64 后调用 _request_tags，断言标签结果

import base64
import io
import os
import sys
from pathlib import Path

import pytest
import requests
from PIL import Image

# 任务：测试中补齐模块搜索路径，确保能导入 backend/src
# 方案：把 backend 目录加入 sys.path，复用现有 package 结构
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from src.services.ai_tag_service import _load_qwen_config, _request_tags

IMAGE_URL = "https://mem.ac/avatar-4x.png"


def _load_test_qwen_config():
    cfg = _load_qwen_config()
    enabled_env = os.getenv("QWEN_ENABLED")
    if enabled_env is not None:
        cfg["enabled"] = enabled_env.lower() in ("1", "true", "yes", "on")
    api_key_env = os.getenv("QWEN_API_KEY")
    if api_key_env:
        cfg["api_key"] = api_key_env
    base_url_env = os.getenv("QWEN_BASE_URL")
    if base_url_env:
        cfg["base_url"] = base_url_env.rstrip("/")
    model_env = os.getenv("QWEN_MODEL")
    if model_env:
        cfg["model"] = model_env
    max_tags_env = os.getenv("QWEN_MAX_TAGS")
    if max_tags_env:
        cfg["max_tags"] = int(max_tags_env)
    timeout_env = os.getenv("QWEN_TIMEOUT")
    if timeout_env:
        cfg["timeout"] = int(timeout_env)
    max_retries_env = os.getenv("QWEN_MAX_RETRIES")
    if max_retries_env:
        cfg["max_retries"] = int(max_retries_env)
    return cfg


def _fetch_image_base64(url: str) -> str:
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    with Image.open(io.BytesIO(response.content)) as img:
        if img.mode != "RGB":
            img = img.convert("RGB")
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=85)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def test_generate_ai_tags_with_qwen(monkeypatch):
    cfg = _load_test_qwen_config()
    if not cfg["enabled"] or not cfg["api_key"]:
        pytest.skip("未配置 Qwen，设置 QWEN_ENABLED=1 与 QWEN_API_KEY 后再运行")

    image_base64 = _fetch_image_base64(IMAGE_URL)
    monkeypatch.setattr("src.services.ai_tag_service._image_to_base64", lambda _: image_base64)

    tags = _request_tags("unused", cfg)
    assert isinstance(tags, list)
    assert tags
    assert len(tags) <= cfg["max_tags"]
    assert len(set(tags)) == len(tags)
    assert all(isinstance(tag, str) and tag.strip() for tag in tags)
