# 任务：保存 EXIF GPS 信息，满足“地点独立条目”要求
# 方案：经纬度/海拔单独表存储，允许为空

from typing import Optional
from sqlalchemy import Integer, Numeric, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.db import Base


class ImageLocation(Base):
    __tablename__ = "image_location"

    image_id: Mapped[int] = mapped_column(Integer, ForeignKey("images.id"), primary_key=True)
    latitude: Mapped[Optional[float]] = mapped_column(Numeric(10, 7), nullable=True, index=True)
    longitude: Mapped[Optional[float]] = mapped_column(Numeric(10, 7), nullable=True, index=True)
    altitude: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    gps_raw: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    image = relationship("Image", back_populates="location")
