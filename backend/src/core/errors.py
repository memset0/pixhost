# 任务：统一 API 错误结构，便于前端按 OpenAPI 约定处理
# 方案：定义 ApiError 并携带状态码、错误码与详细信息

class ApiError(Exception):
    def __init__(self, status_code, code, message, details=None):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or {}


ERROR_VALIDATION = "VALIDATION_ERROR"
ERROR_UNAUTHORIZED = "UNAUTHORIZED"
ERROR_FORBIDDEN = "FORBIDDEN"
ERROR_NOT_FOUND = "NOT_FOUND"
ERROR_CONFLICT = "CONFLICT"
ERROR_TOO_LARGE = "PAYLOAD_TOO_LARGE"
ERROR_UNSUPPORTED = "UNSUPPORTED_MEDIA_TYPE"
ERROR_NOT_IMPLEMENTED = "NOT_IMPLEMENTED"
