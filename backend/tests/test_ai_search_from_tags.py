# 任务：验证从数据库读取标签并让模型推荐风景照相关标签
# 方案：读取标签库 -> 调用 AI 生成标签 -> 解析非空 -> 输出 AI 原文与解析结果

import os
import sys
from pathlib import Path

import pytest

# 任务：测试中补齐模块搜索路径，确保能导入 backend/src
# 方案：把 backend 目录加入 sys.path，复用现有 package 结构
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from src.core.db import session_scope
from src.services.ai_search_service import generate_search_tags
from src.services.ai_tag_service import _load_qwen_config
from src.services.tag_service import list_all_tag_names


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


def test_ai_search_tags_from_db_for_scenery():
    cfg = _load_test_qwen_config()
    if not cfg["enabled"] or not cfg["api_key"]:
        pytest.skip("未配置 Qwen，设置 QWEN_ENABLED=1 与 QWEN_API_KEY 后再运行")

    with session_scope() as session:
        tag_pool = list_all_tag_names(session)
    if not tag_pool:
        pytest.skip("标签库为空，无法进行检索")

    ai_output, tags = generate_search_tags(tag_pool, "我想找一张风景照")

    print("\nAI 输出:\n", ai_output)
    print("解析标签:", tags)

    assert isinstance(tags, list)
    assert tags
