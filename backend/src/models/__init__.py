# 任务：集中导入模型，便于 Base.metadata 获取全部表结构
# 方案：显式导入各模型模块触发表定义

from src.models.user import User  # noqa: F401
from src.models.image import Image  # noqa: F401
from src.models.image_dimensions import ImageDimensions  # noqa: F401
from src.models.image_capture_time import ImageCaptureTime  # noqa: F401
from src.models.image_location import ImageLocation  # noqa: F401
from src.models.image_exif import ImageExifEntry  # noqa: F401
from src.models.tag import Tag, ImageTag  # noqa: F401
from src.models.thumbnail import ImageThumbnail  # noqa: F401
