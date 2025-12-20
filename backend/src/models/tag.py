# 任务：定义标签与图片的多对多关系，支持 custom/exif/ai 来源
# 方案：tags 表 + image_tags 关联表，唯一约束避免重复标签

from datetime import datetime
from sqlalchemy import Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.db import Base


class ImageTag(Base):
    __tablename__ = "image_tags"

    image_id: Mapped[int] = mapped_column(Integer, ForeignKey("images.id"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(Integer, ForeignKey("tags.id"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("name", "source", name="uq_tag_name_source"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    source: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    images = relationship("Image", secondary="image_tags", back_populates="tags")
