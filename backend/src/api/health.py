# 任务：提供健康检查接口，便于部署与调试
# 方案：返回固定 JSON 状态值


def check():
    return {"status": "ok"}
