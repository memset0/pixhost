# 任务：根据用户描述从标签库挑选相关标签并返回完整 AI 输出
# 方案：拼接标签库 prompt -> 调用 Qwen 文本接口 -> 解析 ###### answer 行为标签列表

from typing import Dict, List, Tuple
import re

import requests

from src.core.errors import ApiError, ERROR_UNSUPPORTED, ERROR_VALIDATION
from src.services.ai_tag_service import _extract_text, _load_qwen_config

_ANSWER_PATTERN = re.compile(r"^######\s*answer\s*:\s*(.+)$", re.IGNORECASE | re.MULTILINE)


def _build_prompt(tag_pool: List[str], query: str, max_tags: int) -> str:
    # 任务：生成引导 AI 从标签库中选择标签的 prompt
    # 方案：强调只能在标签池内选择，要求输出思考过程与固定格式的答案行
    tag_lines = "\n".join(f"- {tag}" for tag in tag_pool)
    answer_line = "。".join([f"标签{i + 1}" for i in range(max_tags)])
    return (
        "你是图片标签匹配助手。\n"
        "下面是可选标签库（只能从中选择）：\n"
        f"{tag_lines}\n\n"
        "用户描述：\n"
        f"{query}\n\n"
        "任务要求：\n"
        f"1) 从标签库中挑选与用户描述最相关的 {max_tags} 个标签。\n"
        "2) 标签用中文句号“。”分隔。\n"
        "3) 请输出你的思考过程。\n"
        f"4) 在回答末尾单独一行追加：###### answer: {answer_line}\n"
        "注意：答案行里的标签必须来自标签库。\n"
    )


def _build_text_payload(prompt: str, cfg: Dict) -> Dict:
    compatible_mode = "compatible-mode" in cfg["base_url"].lower()

    if compatible_mode:
        messages = [{"role": "user", "content": prompt}]
        data = {
            "model": cfg["model"],
            "messages": messages,
            "max_tokens": 800,
            "temperature": 0.2,
        }
    else:
        messages = [{"role": "user", "content": [{"text": prompt}]}]
        data = {
            "model": cfg["model"],
            "input": {"messages": messages},
            "parameters": {"max_tokens": 800, "temperature": 0.2},
        }

    headers = {"Authorization": f"Bearer {cfg['api_key']}", "Content-Type": "application/json"}
    if not compatible_mode:
        headers["X-DashScope-SSE"] = "disable"

    if compatible_mode:
        api_url = f"{cfg['base_url']}/chat/completions"
    elif "vl" in cfg["model"].lower():
        api_url = f"{cfg['base_url']}/services/aigc/multimodal/generation/generation"
    else:
        api_url = f"{cfg['base_url']}/services/aigc/text-generation/generation"

    return {"data": data, "headers": headers, "url": api_url}


def _request_ai_text(prompt: str, cfg: Dict) -> str:
    payload = _build_text_payload(prompt, cfg)

    for attempt in range(cfg["max_retries"]):
        response = requests.post(
            payload["url"], json=payload["data"], headers=payload["headers"], timeout=cfg["timeout"]
        )
        if response.status_code == 200:
            try:
                content = response.json()
            except ValueError as exc:
                raise ApiError(502, ERROR_UNSUPPORTED, "Qwen 响应解析失败") from exc
            text = _extract_text(content)
            if text:
                return text
            raise ApiError(502, ERROR_UNSUPPORTED, "Qwen 返回内容为空")
        if response.status_code in (401, 403):
            raise ApiError(502, ERROR_UNSUPPORTED, "Qwen API key 无效或无权限")
        if response.status_code == 429 and attempt < cfg["max_retries"] - 1:
            continue
        if response.status_code >= 500 and attempt < cfg["max_retries"] - 1:
            continue
        message = response.text or "Qwen API 调用失败"
        raise ApiError(502, ERROR_UNSUPPORTED, message)
    raise ApiError(502, ERROR_UNSUPPORTED, "Qwen API 多次调用失败")


def _split_tags(raw_text: str) -> List[str]:
    if not raw_text:
        return []
    parts = [item.strip() for item in re.split(r"[。．，,、；;\n]+", raw_text) if item.strip()]
    if not parts:
        parts = raw_text.split()

    tags: List[str] = []
    for item in parts:
        cleaned = item.strip("，。；：,.;:！？!? ")
        if cleaned and cleaned not in tags:
            tags.append(cleaned)
    return tags


def _parse_answer_tags(ai_text: str, tag_pool: List[str], max_tags: int) -> List[str]:
    # 任务：从 AI 输出中解析并过滤标签
    # 方案：优先读取 ###### answer 行，再按分隔符拆分并过滤不在标签库的结果
    match = _ANSWER_PATTERN.search(ai_text or "")
    cleaned_text = (ai_text or "").strip()
    raw_answer = match.group(1).strip() if match else cleaned_text
    parsed = _split_tags(raw_answer)
    tag_set = set(tag_pool)
    filtered = [tag for tag in parsed if tag in tag_set]
    final_tags = filtered if filtered else parsed
    return final_tags[:max_tags]


def generate_search_tags(tag_pool: List[str], query: str) -> Tuple[str, List[str]]:
    # 任务：根据用户查询从标签库中生成匹配标签并返回 AI 输出
    # 方案：校验配置与输入，调用 Qwen 文本接口，解析标签行并限制数量
    cfg = _load_qwen_config()
    if not cfg["enabled"]:
        raise ApiError(400, ERROR_VALIDATION, "未开启 AI 自动标签功能")
    if not cfg["api_key"]:
        raise ApiError(400, ERROR_VALIDATION, "Qwen API key 未配置")
    if not tag_pool:
        raise ApiError(400, ERROR_VALIDATION, "标签库为空，无法进行检索")

    max_tags = min(5, len(tag_pool))
    prompt = _build_prompt(tag_pool, query, max_tags)

    try:
        ai_text = _request_ai_text(prompt, cfg)
    except requests.RequestException as exc:
        raise ApiError(502, ERROR_UNSUPPORTED, f"Qwen API 请求失败: {exc}") from exc

    tags = _parse_answer_tags(ai_text, tag_pool, max_tags)
    return ai_text, tags
