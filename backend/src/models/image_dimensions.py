# 任务：记录图片分辨率，满足“元数据拆表”要求
# 方案：1:1 关系存储 width/height

from sqlalchemy import Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.db import Base


class ImageDimensions(Base):
    __tablename__ = "image_dimensions"

    image_id: Mapped[int] = mapped_column(Integer, ForeignKey("images.id"), primary_key=True)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)

    image = relationship("Image", back_populates="dimensions")
