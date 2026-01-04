import subprocess
import sys
import signal
import time
import threading
import os
from datetime import datetime

"""
任务:
1. 同时启动前端 (cd frontend && pnpm run dev) 和后端 (cd backend && python app.py)
2. 脚本终止时自动 kill 子进程
3. 使用 subprocess 启动
4. 日志显示需包含进程名、时间戳，且区分颜色，捕获 stdout 和 stderr

实现方案:
- 使用 `subprocess.Popen` 启动两个子进程，设置 `cwd` 分别为 frontend 和 backend。
- 使用 `os.setsid` (Linux/Mac) 创建进程组，以便在退出时通过 `os.killpg` 杀死整个进程树（确保 pnpm/python 衍生的子进程也被杀死）。
- 使用 `threading` 创建线程分别实时读取两个进程的 stdout 和 stderr。
- 定义 `Colors` 类处理 ANSI 颜色代码。
- 注册 `signal.SIGINT` 和 `signal.SIGTERM` 处理器，在主进程退出时清理子进程。
"""

# ANSI Colors
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    RESET = '\033[0m'
    BOLD = '\033[1m'
    GRAY = '\033[90m'

processes = []

def log_stream(stream, process_name, color_code):
    """
    Reads from a stream line by line and prints with formatted prefix.
    """
    try:
        # iter(stream.readline, b'') works for binary streams from Popen
        for line in iter(stream.readline, b''):
            timestamp = datetime.now().strftime('%H:%M:%S.%f')[:-3] # HH:MM:SS.mmm
            try:
                line_str = line.decode('utf-8').rstrip()
            except UnicodeDecodeError:
                line_str = line.decode('latin-1', errors='replace').rstrip()
            
            if line_str:
                # Format: (name) {timestamp} message
                prefix = f"{Colors.GRAY}[{timestamp}] {Colors.BOLD}{color_code}({process_name}){Colors.RESET}"
                print(f"{prefix} {line_str}")
    except ValueError:
        pass # Stream might be closed on exit

def start_service(name, command, cwd, color):
    print(f"{Colors.HEADER}Starting {name}...{Colors.RESET}")
    
    # Use preexec_fn=os.setsid to create a new process group on Unix
    # This allows us to kill the whole tree (shell + child) later
    preexec = os.setsid if os.name == 'posix' else None
    
    process = subprocess.Popen(
        command,
        cwd=cwd,
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=preexec
    )
    
    processes.append(process)
    
    # Start threads to monitor stdout and stderr
    t_out = threading.Thread(target=log_stream, args=(process.stdout, name, color))
    t_out.daemon = True
    t_out.start()
    
    t_err = threading.Thread(target=log_stream, args=(process.stderr, name, color))
    t_err.daemon = True
    t_err.start()
    
    return process

def cleanup(signum, frame):
    print(f"\n{Colors.YELLOW}Shutting down services...{Colors.RESET}")
    for p in processes:
        try:
            if os.name == 'posix':
                # Kill the process group
                os.killpg(os.getpgid(p.pid), signal.SIGTERM)
            else:
                p.terminate()
        except Exception:
            pass
    sys.exit(0)

if __name__ == "__main__":
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    print(f"{Colors.BOLD}Development Environment Initializing...{Colors.RESET}")

    # Start Backend
    # Command: cd backend && python app.py
    start_service("backend", "source .venv/bin/activate && python app.py", "backend", Colors.CYAN)

    # Start Frontend
    # Command: cd frontend && pnpm run dev
    start_service("frontend", "pnpm run dev", "frontend", Colors.GREEN)

    # Keep the main thread running to catch signals
    while True:
        time.sleep(1)
