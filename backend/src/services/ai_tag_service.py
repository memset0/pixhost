# 任务：调用 Qwen 接口为图片生成标签并入库
# 方案：读取本地图片转 base64，走兼容模式或标准模式请求，解析结果落库 source=ai

import base64
import io
from typing import Dict, List

import requests
from PIL import Image

from src.core.config_loader import get_config
from src.core.errors import (
    ApiError,
    ERROR_NOT_FOUND,
    ERROR_UNSUPPORTED,
    ERROR_VALIDATION,
)
from src.models.image import Image as ImageModel
from src.services.image_service import find_or_create_tags
from src.utils.path_utils import resolve_path


def _load_qwen_config() -> Dict:
    cfg = get_config().get("qwen", {}) or {}
    return {
        "enabled": bool(cfg.get("enabled")),
        "api_key": cfg.get("api_key") or "",
        "base_url": (cfg.get("base_url") or "https://dashscope.aliyuncs.com/compatible-mode/v1/").rstrip(
            "/"
        ),
        "model": cfg.get("model") or "qwen3-vl-flash",
        "max_retries": int(cfg.get("max_retries") or 3),
        "timeout": int(cfg.get("timeout") or 30),
        "max_tags": int(cfg.get("max_tags") or 5),
    }


def _image_to_base64(image_path) -> str:
    with Image.open(image_path) as img:
        if img.mode != "RGB":
            img = img.convert("RGB")
        img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)

        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=85)
        buffer.seek(0)
        return base64.b64encode(buffer.getvalue()).decode("utf-8")


def _build_request_payload(image_base64: str, cfg: Dict) -> Dict:
    compatible_mode = "compatible-mode" in cfg["base_url"].lower()

    if compatible_mode:
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}},
                    {
                        "type": "text",
                        "text": "请分析这张图片的内容，用中文生成不超过5个相关标签，标签需要简洁、有意义，用中文逗号分隔。只返回标签文本。",
                    },
                ],
            }
        ]
        data = {"model": cfg["model"], "messages": messages, "max_tokens": 200, "temperature": 0.6}
    else:
        messages = [
            {
                "role": "user",
                "content": [
                    {"image": f"data:image/jpeg;base64,{image_base64}"},
                    {
                        "text": "请分析这张图片的内容，用中文生成不超过5个相关标签，标签需要简洁、有意义，用中文逗号分隔。只返回标签文本。",
                    },
                ],
            }
        ]
        data = {
            "model": cfg["model"],
            "input": {"messages": messages},
            "parameters": {"max_tokens": 200, "temperature": 0.6},
        }

    headers = {"Authorization": f"Bearer {cfg['api_key']}", "Content-Type": "application/json"}
    if not compatible_mode:
        headers["X-DashScope-SSE"] = "disable"

    api_url: str
    if compatible_mode:
        api_url = f"{cfg['base_url']}/chat/completions"
    elif "vl" in cfg["model"].lower():
        api_url = f"{cfg['base_url']}/services/aigc/multimodal/generation/generation"
    else:
        api_url = f"{cfg['base_url']}/services/aigc/text-generation/generation"

    return {"data": data, "headers": headers, "url": api_url}


def _extract_text(response_data: Dict) -> str:
    if "choices" in response_data and "output" not in response_data:
        choices = response_data.get("choices") or []
        if choices:
            return (choices[0].get("message") or {}).get("content") or ""
    if "output" in response_data:
        output = response_data["output"]
        if isinstance(output, dict):
            if "text" in output:
                return output.get("text") or ""
            choices = output.get("choices") or []
            if choices:
                return (choices[0].get("message") or {}).get("content") or ""
        if isinstance(output, str):
            return output
    return ""


def _parse_tags(text: str, max_tags: int) -> List[str]:
    cleaned_text = (text or "").strip()
    if not cleaned_text:
        return []
    separators = ["，", ",", "、", "；", ";", "\n"]
    raw_tags: List[str] = []
    for sep in separators:
        if sep in cleaned_text:
            raw_tags = [item.strip() for item in cleaned_text.split(sep)]
            break
    if not raw_tags:
        raw_tags = cleaned_text.split()

    tags: List[str] = []
    for item in raw_tags:
        tag = item.strip("，。；：,.;:！？!? ")
        if 1 < len(tag) <= 20 and tag not in tags:
            tags.append(tag)
        if len(tags) >= max_tags:
            break
    return tags


def _request_tags(image_path, cfg: Dict) -> List[str]:
    image_base64 = _image_to_base64(image_path)
    payload = _build_request_payload(image_base64, cfg)

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
            tags = _parse_tags(text, cfg["max_tags"])
            if tags:
                return tags
            raise ApiError(502, ERROR_UNSUPPORTED, "qwen 返回为空或无法解析标签")
        if response.status_code in (401, 403):
            raise ApiError(502, ERROR_UNSUPPORTED, "Qwen API key 无效或无权限")
        if response.status_code == 429 and attempt < cfg["max_retries"] - 1:
            continue
        if response.status_code >= 500 and attempt < cfg["max_retries"] - 1:
            continue
        message = response.text or "Qwen API 调用失败"
        raise ApiError(502, ERROR_UNSUPPORTED, message)
    raise ApiError(502, ERROR_UNSUPPORTED, "Qwen API 多次调用失败")


def generate_ai_tags(session, image: ImageModel) -> List[str]:
    cfg = _load_qwen_config()
    if not cfg["enabled"]:
        raise ApiError(400, ERROR_VALIDATION, "未开启 AI 自动标签功能")
    if not cfg["api_key"]:
        raise ApiError(400, ERROR_VALIDATION, "Qwen API key 未配置")

    root_dir = resolve_path(get_config()["storage"]["root_dir"])
    image_path = root_dir / image.storage_relpath
    if not image_path.exists():
        raise ApiError(404, ERROR_NOT_FOUND, "image file not found")

    try:
        ai_tags = _request_tags(image_path, cfg)
    except requests.RequestException as exc:
        raise ApiError(502, ERROR_UNSUPPORTED, f"Qwen API 请求失败: {exc}") from exc

    keep_tags = [tag for tag in image.tags if tag.source != "ai"]
    new_tags = find_or_create_tags(session, ai_tags, "ai")
    image.tags = keep_tags + new_tags
    return [tag.name for tag in new_tags]
