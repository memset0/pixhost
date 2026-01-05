# 任务：提供标签聚合查询能力给 AI 检索与前端使用
# 方案：直接读取 tags 表并按名称排序返回

from typing import List

from src.models.tag import Tag


def list_all_tag_names(session) -> List[str]:
    # 任务：获取数据库中所有标签名称
    # 方案：distinct 去重后按字母序排序，减少重复标签干扰检索
    rows = session.query(Tag.name).distinct().order_by(Tag.name.asc()).all()
    return [row[0] for row in rows]
