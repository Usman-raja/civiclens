"""
Build script: assembles the CivicLens distribution folder.
Run this to create a deployable package in dist/CivicLens/

Usage: python build_dist.py

The output folder can be:
  1. Copied to any Windows PC (needs Python 3.10+ pre-installed)
  2. Packaged with Inno Setup (see installer.iss) for a professional installer
"""

import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, "dist", "CivicLens")
BACKEND_SRC = os.path.join(ROOT, "backend")
FRONTEND_SRC = os.path.join(ROOT, "civiclens-frontend")
DIST_BACKEND = os.path.join(DIST, "backend")
DIST_FRONTEND = os.path.join(DIST, "frontend")
DIST_NODE = os.path.join(DIST, "node")

PYTHON = os.path.join(BACKEND_SRC, "venv", "Scripts", "python.exe")


def log(msg):
    print(f"[build] {msg}", flush=True)


def clean():
    if os.path.exists(DIST):
        log("Cleaning previous build...")
        shutil.rmtree(DIST)
    os.makedirs(DIST, exist_ok=True)


def copy_launcher():
    log("Copying CivicLens.exe launcher...")
    exe = os.path.join(ROOT, "dist", "CivicLens.exe")
    if not os.path.isfile(exe):
        log("ERROR: dist/CivicLens.exe not found. Run PyInstaller first.")
        sys.exit(1)
    shutil.copy2(exe, os.path.join(DIST, "CivicLens.exe"))


def copy_backend():
    log("Copying backend source...")
    os.makedirs(DIST_BACKEND, exist_ok=True)

    # Copy app source
    app_src = os.path.join(BACKEND_SRC, "app")
    app_dst = os.path.join(DIST_BACKEND, "app")
    if os.path.exists(app_dst):
        shutil.rmtree(app_dst)
    shutil.copytree(app_src, app_dst, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))

    # Copy requirements
    shutil.copy2(os.path.join(BACKEND_SRC, "requirements.txt"), DIST_BACKEND)

    # Copy model weights
    weights_src = os.path.join(BACKEND_SRC, "weights")
    if os.path.isdir(weights_src):
        log("Copying ML weights (~340MB)...")
        shutil.copytree(weights_src, os.path.join(DIST_BACKEND, "weights"))

    for f in ("yolov8n.pt", "yolov8s-worldv2.pt"):
        src = os.path.join(BACKEND_SRC, f)
        if os.path.isfile(src):
            shutil.copy2(src, DIST_BACKEND)

    venv_src = os.path.join(BACKEND_SRC, "venv")
    venv_dst = os.path.join(DIST_BACKEND, "venv")
    if os.path.isdir(venv_src):
        log("Copying pre-built Python environment...")
        shutil.copytree(
            venv_src, venv_dst,
            ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
        )
        log("Bundled venv copied — no Python needed on target machine.")
    else:
        log("WARNING: backend/venv not found. Target machine will need Python 3.10+.")

    log("Backend copied.")


def copy_frontend():
    log("Copying frontend standalone build...")
    standalone = os.path.join(FRONTEND_SRC, ".next", "standalone")
    if not os.path.isdir(standalone):
        log("ERROR: Frontend not built. Run: cd civiclens-frontend && npx next build")
        sys.exit(1)

    if os.path.exists(DIST_FRONTEND):
        shutil.rmtree(DIST_FRONTEND)
    shutil.copytree(standalone, DIST_FRONTEND, ignore=shutil.ignore_patterns("node_modules"))

    # Copy static assets
    static_src = os.path.join(FRONTEND_SRC, ".next", "static")
    static_dst = os.path.join(DIST_FRONTEND, ".next", "static")
    if os.path.isdir(static_src):
        shutil.copytree(static_src, static_dst, dirs_exist_ok=True)

    # Copy public folder
    public_src = os.path.join(FRONTEND_SRC, "public")
    public_dst = os.path.join(DIST_FRONTEND, "public")
    if os.path.isdir(public_src):
        shutil.copytree(public_src, public_dst, dirs_exist_ok=True)

    # Copy node_modules needed by server.js
    nm_src = os.path.join(standalone, "node_modules")
    nm_dst = os.path.join(DIST_FRONTEND, "node_modules")
    if os.path.isdir(nm_src):
        shutil.copytree(nm_src, nm_dst)

    log("Frontend standalone copied.")


def copy_node():
    log("Checking for Node.js...")
    os.makedirs(DIST_NODE, exist_ok=True)

    # Check if node.exe exists in our node/ folder
    node_exe = os.path.join(ROOT, "node", "node.exe")
    if os.path.isfile(node_exe):
        shutil.copy2(node_exe, os.path.join(DIST_NODE, "node.exe"))
        log("Node.exe copied from node/ folder.")
    else:
        # Try system node
        node_path = shutil.which("node")
        if node_path:
            log(f"Found system Node.js: {node_path}")
            log("NOTE: Copy the node.exe from your Node.js install to dist/CivicLens/node/")
            log("      or install Node.js on the target machine.")
        else:
            log("WARNING: Node.js not found. Frontend won't work on target machine.")
            log("Download from https://nodejs.org and place node.exe in the 'node' folder.")


def copy_python():
    log("Bundling Python runtime...")
    cfg_path = os.path.join(BACKEND_SRC, "venv", "pyvenv.cfg")
    py_home = None
    if os.path.isfile(cfg_path):
        with open(cfg_path) as f:
            for line in f:
                if line.startswith("home ="):
                    py_home = line.split("=", 1)[1].strip()
                    break
    if not py_home or not os.path.isdir(py_home):
        log("WARNING: Could not locate base Python installation from pyvenv.cfg.")
        return
    dist_py = os.path.join(DIST, "python")
    if os.path.exists(dist_py):
        shutil.rmtree(dist_py)
    shutil.copytree(
        py_home, dist_py,
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
    )
    log(f"Python bundled from {py_home}")


def create_readme():
    readme = """CivicLens Command Center
========================

FIRST RUN:
  1. Double-click CivicLens.exe
  2. Browser opens automatically when ready
  3. Create the first administrator account on the bootstrap screen

REQUIREMENTS:
  - Windows 10/11 (64-bit)
  - No Python or Node.js installation required

PORTS:
  Frontend: http://localhost:3000
  Backend:  http://127.0.0.1:8000

SUPPORT:
  Usman Farid — 0317 750 5992
  Made in Pakistan
"""
    with open(os.path.join(DIST, "README.txt"), "w") as f:
        f.write(readme)


def summary():
    total = 0
    for dirpath, _, filenames in os.walk(DIST):
        for f in filenames:
            total += os.path.getsize(os.path.join(dirpath, f))
    mb = total / (1024 * 1024)
    log(f"Distribution size: {mb:.0f} MB")
    log(f"Output: {DIST}")
    log("")
    log("Next steps:")
    log("  1. Run Inno Setup: iscc installer.iss")
    log("  2. This creates CivicLens-Setup.exe — a single-click installer")
    log("")
    log("Or copy dist/CivicLens/ directly to a target machine.")


if __name__ == "__main__":
    log("Building CivicLens distribution...")
    log("")
    clean()
    copy_launcher()
    copy_backend()
    copy_python()
    copy_frontend()
    copy_node()
    create_readme()
    log("")
    summary()
