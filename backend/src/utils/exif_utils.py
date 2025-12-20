# 任务：解析图片 EXIF 信息并提取结构化字段
# 方案：使用 Pillow ExifTags 映射，GPS 转换为十进制度

from datetime import datetime
from PIL import ExifTags


_TAGS = ExifTags.TAGS
_GPS_TAGS = ExifTags.GPSTAGS


def extract_exif_dict(image) -> dict:
    exif_raw = image.getexif()
    if not exif_raw:
        return {}
    data = {}
    for key, value in exif_raw.items():
        tag_name = _TAGS.get(key, str(key))
        data[tag_name] = value
    return data


def _rational_to_float(rational):
    try:
        return rational.numerator / rational.denominator
    except AttributeError:
        return float(rational[0]) / float(rational[1])


def _gps_to_decimal(values, ref):
    degrees = _rational_to_float(values[0])
    minutes = _rational_to_float(values[1])
    seconds = _rational_to_float(values[2])
    decimal = degrees + minutes / 60.0 + seconds / 3600.0
    if ref in ["S", "W"]:
        decimal = -decimal
    return decimal


def parse_capture_time(exif_dict: dict):
    raw = exif_dict.get("DateTimeOriginal") or exif_dict.get("DateTime")
    if not raw:
        return None, None
    try:
        parsed = datetime.strptime(raw, "%Y:%m:%d %H:%M:%S")
    except ValueError:
        return None, raw
    return parsed, raw


def parse_location(exif_dict: dict):
    gps_info = exif_dict.get("GPSInfo")
    if not gps_info:
        return None, None, None, None
    gps_data = {}
    for key, value in gps_info.items():
        gps_data[_GPS_TAGS.get(key, str(key))] = value
    latitude = None
    longitude = None
    altitude = None
    if "GPSLatitude" in gps_data and "GPSLatitudeRef" in gps_data:
        latitude = _gps_to_decimal(gps_data["GPSLatitude"], gps_data["GPSLatitudeRef"])
    if "GPSLongitude" in gps_data and "GPSLongitudeRef" in gps_data:
        longitude = _gps_to_decimal(gps_data["GPSLongitude"], gps_data["GPSLongitudeRef"])
    if "GPSAltitude" in gps_data:
        altitude = _rational_to_float(gps_data["GPSAltitude"])
    return latitude, longitude, altitude, gps_data


def build_exif_tags(exif_dict: dict) -> list:
    tags = []
    for key in ["Make", "Model", "LensModel"]:
        value = exif_dict.get(key)
        if value:
            tags.append(str(value))
    return tags
