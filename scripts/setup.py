#!/usr/bin/env python3
"""
Code Sentinel - Enterprise Automated Setup System
One-command bootstrap for new machines or clean clone environments.
Prepares dependencies, verifies environment, restores secrets, and runs quality checks.
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent

def check_cmd(cmd, name, min_version=None):
    cli = shutil.which(cmd)
    if not cli:
        print(f"  [MISSING] {name} ({cmd}) is not installed or not in PATH.")
        return None
    print(f"  [OK] {name} found: {cli}")
    return cli

def run(cmd, desc, fatal=True):
    print(f"\n--> {desc}...")
    res = subprocess.run(cmd, shell=True, cwd=ROOT_DIR)
    if res.returncode != 0:
        print(f"Error during '{desc}' (Exit code: {res.returncode})", file=sys.stderr)
        if fatal:
            sys.exit(res.returncode)
    return res.returncode == 0

def main():
    print("=======================================================")
    print("CODE SENTINEL - AUTOMATED REPRODUCIBLE SETUP")
    print("=======================================================")
    
    # 1. Prerequisites Check
    print("\n[STEP 1] Checking Prerequisites...")
    node = check_cmd("node", "Node.js (>=20.12)")
    pnpm = check_cmd("pnpm", "pnpm Package Manager")
    git = check_cmd("git", "Git Version Control")
    docker = check_cmd("docker", "Docker (for PostgreSQL)")
    keepassxc = check_cmd("keepassxc-cli", "KeePassXC CLI") or check_cmd("keepassxc-cli.exe", "KeePassXC CLI")
    rclone = check_cmd("rclone", "rclone (for Google Drive)")
    
    if not node or not pnpm:
        print("\nFatal: Node.js and pnpm are required to run Code Sentinel.", file=sys.stderr)
        sys.exit(1)
        
    # 2. Install Dependencies
    print("\n[STEP 2] Installing Node Dependencies via pnpm...")
    run("pnpm install", "pnpm install dependencies")
    
    # 3. Environment & Secret Configuration
    print("\n[STEP 3] Configuring Environment Secrets...")
    env_path = ROOT_DIR / ".env"
    example_path = ROOT_DIR / ".env.example"
    vault_path = ROOT_DIR / "secrets" / "code-sentinel-vault.kdbx"
    
    if not env_path.exists():
        if vault_path.exists() and keepassxc:
            print("  Found existing KeePassXC vault. Exporting .env...")
            run("python scripts/vault_manager.py export-env", "Export .env from vault", fatal=False)
        else:
            print("  Creating local .env from .env.example template...")
            shutil.copy(example_path, env_path)
            print("  [ACTION REQUIRED] Please edit .env with your credentials or run scripts/vault_manager.py")
    else:
        print("  [OK] Local .env file already exists.")
        
    # 4. Database Setup (if Docker is running)
    print("\n[STEP 4] Checking Database Infrastructure...")
    if docker:
        check_docker = subprocess.run("docker info", shell=True, capture_output=True)
        if check_docker.returncode == 0:
            print("  Docker daemon is active. Booting PostgreSQL container...")
            run("pnpm db:up", "Start PostgreSQL container", fatal=False)
            print("  Seeding admin user...")
            run("node scripts/create-admin.cjs", "Create default admin", fatal=False)
        else:
            print("  Docker is installed but daemon is not running. Start Docker Desktop to boot PostgreSQL.")
    else:
        print("  Docker not detected. Ensure external PostgreSQL is configured in DATABASE_URL.")
        
    # 5. Verification
    print("\n[STEP 5] Running System Verification...")
    run("python scripts/verify_system.py", "Run test suite and quality gates", fatal=False)
    
    print("\n=======================================================")
    print("CODE SENTINEL SETUP COMPLETED")
    print("Run 'pnpm dev' to launch the application at http://localhost:3400")
    print("=======================================================\n")

if __name__ == "__main__":
    main()
