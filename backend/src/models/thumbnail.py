# 任务：保存缩略图 base64 数据，满足“缩略图入库”要求
# 方案：以 1:1 关系存储格式、尺寸与 base64 字符串

from datetime import datetime
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey, BigInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.db import Base


class ImageThumbnail(Base):
    __tablename__ = "image_thumbnail"

    image_id: Mapped[int] = mapped_column(Integer, ForeignKey("images.id"), primary_key=True)
    format: Mapped[str] = mapped_column(String(16), nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=True)
    data_base64: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    image = relationship("Image", back_populates="thumbnail")
