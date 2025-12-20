# 任务：保存 EXIF KV 信息，满足“EXIF 单独条目”要求
# 方案：使用 image_id + key/value 的 KV 结构

from typing import Optional
from sqlalchemy import Integer, String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.db import Base


class ImageExifEntry(Base):
    __tablename__ = "image_exif_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    image_id: Mapped[int] = mapped_column(Integer, ForeignKey("images.id"), index=True, nullable=False)
    exif_key: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    exif_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    image = relationship("Image", back_populates="exif_entries")
