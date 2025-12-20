# 任务：保存 EXIF 解析出的拍摄时间
# 方案：使用独立表，保留解析时间与原始字符串

from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, DateTime, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.db import Base


class ImageCaptureTime(Base):
    __tablename__ = "image_capture_time"

    image_id: Mapped[int] = mapped_column(Integer, ForeignKey("images.id"), primary_key=True)
    taken_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    taken_at_raw: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    image = relationship("Image", back_populates="capture_time")
