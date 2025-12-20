# 任务：生成小尺寸缩略图与处理图片编辑（裁剪/色调）
# 方案：Pillow 处理并控制缩略图最大边与最大字节数

from io import BytesIO
from PIL import Image
import base64


def generate_thumbnail(image_path, max_edge: int, max_bytes: int, output_format: str, base_quality: int):
    with Image.open(image_path) as img:
        img = img.convert("RGB")
        img.thumbnail((max_edge, max_edge))
        width, height = img.size

        quality = base_quality
        data = _save_with_quality(img, output_format, quality)
        while len(data) > max_bytes and quality > 40:
            quality -= 10
            data = _save_with_quality(img, output_format, quality)

        data_base64 = base64.b64encode(data).decode("utf-8")
        return {
            "format": output_format,
            "width": width,
            "height": height,
            "data_base64": data_base64,
        }


def _save_with_quality(img, output_format: str, quality: int) -> bytes:
    buffer = BytesIO()
    img.save(buffer, format=output_format.upper(), quality=quality, optimize=True)
    return buffer.getvalue()


def crop_image(image_path, ratios: dict):
    with Image.open(image_path) as img:
        width, height = img.size
        left_px = int(width * ratios["left"] / 100)
        right_px = int(width * (1 - ratios["right"] / 100))
        top_px = int(height * ratios["top"] / 100)
        bottom_px = int(height * (1 - ratios["bottom"] / 100))
        if left_px >= right_px or top_px >= bottom_px:
            raise ValueError("invalid crop ratios")
        cropped = img.crop((left_px, top_px, right_px, bottom_px))
        cropped.save(image_path)


def adjust_hue(image_path, delta: float):
    with Image.open(image_path) as img:
        hsv = img.convert("HSV")
        h, s, v = hsv.split()
        shift = int((delta / 360.0) * 255) % 256
        h = h.point(lambda x: (x + shift) % 256)
        merged = Image.merge("HSV", (h, s, v)).convert("RGB")
        merged.save(image_path)
