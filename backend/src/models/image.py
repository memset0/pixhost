# 任务：定义图片主表，记录上传信息与软删除状态
# 方案：将核心字段集中在 images 表，其余元数据拆分到子表

from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime, Boolean, Integer, BigInteger, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.db import Base


class Image(Base):
    __tablename__ = "images"

    id: Mapped[int] = mapped_column(primary_key=True)
    uploader_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    original_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ext: Mapped[str] = mapped_column(String(16), nullable=False)
    hash: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    storage_relpath: Mapped[str] = mapped_column(String(512), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    mime_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    sha256: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    # 任务：新增收藏状态，支撑前端收藏按钮与轮播列表
    # 方案：在 images 表记录 is_favorite 布尔值，默认 false 并加索引便于查询
    is_favorite: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    uploader = relationship("User", back_populates="images")
    dimensions = relationship("ImageDimensions", uselist=False, back_populates="image")
    capture_time = relationship("ImageCaptureTime", uselist=False, back_populates="image")
    location = relationship("ImageLocation", uselist=False, back_populates="image")
    exif_entries = relationship("ImageExifEntry", back_populates="image")
    tags = relationship("Tag", secondary="image_tags", back_populates="images")
    thumbnail = relationship("ImageThumbnail", uselist=False, back_populates="image")
