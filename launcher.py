"""
CivicLens Command Center — Launcher
Starts the FastAPI backend and Next.js frontend, then opens the browser.
First run auto-creates the Python virtual environment.
"""

import os
import sys
import time
import signal
import subprocess
import shutil
import webbrowser

BASE_DIR = os.path.dirname(os.path.abspath(sys.argv[0] if getattr(sys, "frozen", False) else __file__))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
VENV_DIR = os.path.join(BACKEND_DIR, "venv")
PYTHON = os.path.join(VENV_DIR, "Scripts", "python.exe")
NODE = os.path.join(BASE_DIR, "node", "node.exe")

BACKEND_PORT = 8000
FRONTEND_PORT = 3000

WORKER_ONLY = os.environ.get("WORKER_ONLY", "").strip() == "1"

processes: list[subprocess.Popen] = []


def log(msg: str):
    print(f"[CivicLens] {msg}", flush=True)


def find_system_python() -> str | None:
    for name in ("python", "python3", "py"):
        path = shutil.which(name)
        if path:
            return path
    return None


def fix_pyvenv_cfg():
    cfg = os.path.join(VENV_DIR, "pyvenv.cfg")
    bundled_python = os.path.join(BASE_DIR, "python")
    if not os.path.isdir(bundled_python) or not os.path.isfile(cfg):
        return
    log("Fixing Python environment paths for this machine...")
    lines = []
    with open(cfg, "r") as f:
        for line in f:
            if line.startswith("home ="):
                lines.append(f"home = {bundled_python}\n")
            elif line.startswith("executable ="):
                lines.append(f"executable = {os.path.join(bundled_python, 'python.exe')}\n")
            elif line.startswith("command ="):
                lines.append(f"command = {os.path.join(bundled_python, 'python.exe')} -m venv {VENV_DIR}\n")
            else:
                lines.append(line)
    with open(cfg, "w") as f:
        f.writelines(lines)


def ensure_venv():
    if os.path.isfile(PYTHON):
        fix_pyvenv_cfg()
        return True

    log("First run detected — setting up Python environment...")
    sys_python = find_system_python()
    if not sys_python:
        log("ERROR: Python 3.10+ is required but not found on this system.")
        log("Install Python from https://www.python.org/downloads/ and re-run.")
        return False

    log(f"Using system Python: {sys_python}")
    log("Creating virtual environment (this takes a minute)...")

    try:
        subprocess.check_call([sys_python, "-m", "venv", VENV_DIR])
    except subprocess.CalledProcessError:
        log("ERROR: Failed to create virtual environment.")
        return False

    log("Installing dependencies (this takes 2-3 minutes on first run)...")
    pip = os.path.join(VENV_DIR, "Scripts", "pip.exe")
    reqs = os.path.join(BACKEND_DIR, "requirements.txt")

    try:
        subprocess.check_call([pip, "install", "-r", reqs, "--quiet"])
    except subprocess.CalledProcessError:
        log("ERROR: Failed to install dependencies. Try manually:")
        log(f"  {PYTHON} -m pip install -r {reqs}")
        return False

    log("Setup complete!")
    return True


def start_backend():
    log("Starting backend on port 8000...")
    env = os.environ.copy()
    env["PYTHONPATH"] = BACKEND_DIR
    proc = subprocess.Popen(
        [PYTHON, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(BACKEND_PORT)],
        cwd=BACKEND_DIR,
        env=env,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
    )
    processes.append(proc)
    return proc


def start_frontend():
    log("Starting frontend on port 3000...")
    env = os.environ.copy()
    env["PORT"] = str(FRONTEND_PORT)
    env["HOSTNAME"] = "127.0.0.1"
    server_js = os.path.join(FRONTEND_DIR, "server.js")
    proc = subprocess.Popen(
        [NODE, server_js],
        cwd=FRONTEND_DIR,
        env=env,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
    )
    processes.append(proc)
    return proc


def wait_for(port: int, timeout: int = 60):
    import socket

    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=1):
                return True
        except (ConnectionRefusedError, OSError):
            time.sleep(0.5)
    return False


def shutdown(*_):
    log("Shutting down...")
    for p in processes:
        try:
            p.terminate()
        except Exception:
            pass
    for p in processes:
        try:
            p.wait(timeout=5)
        except Exception:
            p.kill()
    log("Stopped.")


def main():
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    log("=== CivicLens Command Center ===")
    log("")

    if not ensure_venv():
        input("Press Enter to exit...")
        return

    if WORKER_ONLY:
        log("Worker-only mode: starting backend only (no frontend)...")
        backend = start_backend()
        log("Waiting for backend to be ready...")
        wait_for(BACKEND_PORT)
        log(f"Worker node ready — API at http://127.0.0.1:{BACKEND_PORT}")
        log("Press Ctrl+C to stop.")
        try:
            while True:
                if backend.poll() is not None:
                    break
                time.sleep(2)
        except KeyboardInterrupt:
            pass
        shutdown()
        return

    if not os.path.isfile(NODE):
        log(f"ERROR: Node.js not found at {NODE}")
        log("Download Node.js from https://nodejs.org and place node.exe in the 'node' folder.")
        input("Press Enter to exit...")
        return

    backend = start_backend()
    frontend = start_frontend()

    log("Waiting for services to be ready...")
    backend_ok = wait_for(BACKEND_PORT)
    frontend_ok = wait_for(FRONTEND_PORT)

    if not backend_ok:
        log("ERROR: Backend failed to start.")
        log("Check that ports 8000 and 3000 are not in use by another application.")
        shutdown()
        input("Press Enter to exit...")
        return

    if not frontend_ok:
        log("WARNING: Frontend not ready, opening backend API directly...")
        webbrowser.open(f"http://127.0.0.1:{BACKEND_PORT}/docs")
    else:
        log(f"CivicLens is ready! Opening http://localhost:{FRONTEND_PORT}")
        webbrowser.open(f"http://localhost:{FRONTEND_PORT}")

    log("")
    log("Press Ctrl+C to stop all services.")
    log("")

    try:
        while True:
            if backend.poll() is not None:
                log("Backend process exited unexpectedly.")
                break
            if frontend.poll() is not None:
                log("Frontend process exited unexpectedly.")
                break
            time.sleep(2)
    except KeyboardInterrupt:
        pass

    shutdown()


if __name__ == "__main__":
    main()
