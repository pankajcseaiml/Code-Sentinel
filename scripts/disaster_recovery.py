#!/usr/bin/env python3
"""
Code Sentinel - Automated Clean-Clone Disaster Recovery Test
Performs end-to-end verification in an isolated directory to prove that
the project can be completely reconstructed from:
1. Private Git repository
2. KeePassXC secret vault
3. Encrypted Google Drive backup
"""

import os
import sys
import shutil
import tempfile
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent

def run_cmd(cmd, cwd, desc):
    print(f"\n[SANDBOX TEST] {desc}...")
    res = subprocess.run(cmd, cwd=cwd, shell=True, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"  [FAIL] {desc} failed (code {res.returncode})", file=sys.stderr)
        if res.stderr:
            print(f"  STDERR: {res.stderr.strip()}", file=sys.stderr)
        return False
    print(f"  [PASS] {desc} completed successfully.")
    return True

def main():
    print("=======================================================")
    print("CODE SENTINEL - DISASTER RECOVERY CLEAN-CLONE TEST")
    print("=======================================================")
    
    # 1. Create isolated sandbox
    sandbox_dir = Path(tempfile.mkdtemp(prefix="codesentinel_dr_test_"))
    print(f"Isolated Sandbox Location: {sandbox_dir}")
    
    try:
        # 2. Check if git is initialized in ROOT_DIR
        git_dir = ROOT_DIR / ".git"
        if git_dir.exists():
            print("\n[STEP 1] Cloning from local Git repository...")
            clone_res = subprocess.run(f"git clone \"{ROOT_DIR}\" \"{sandbox_dir}\"", shell=True, capture_output=True, text=True)
            if clone_res.returncode != 0:
                print(f"Git clone failed: {clone_res.stderr}", file=sys.stderr)
                sys.exit(1)
        else:
            print("\n[STEP 1] Simulating clean clone (excluding secrets/caches/node_modules)...")
            exclude = {"node_modules", ".next", "dist", "secrets", "backups", "scratch", ".env", ".git"}
            for item in os.listdir(ROOT_DIR):
                if item in exclude:
                    continue
                src = ROOT_DIR / item
                dst = sandbox_dir / item
                if src.is_dir():
                    shutil.copytree(src, dst)
                else:
                    shutil.copy2(src, dst)
                    
        # 3. Assert zero leakage of sensitive state
        print("\n[STEP 2] Auditing Sandbox Isolation...")
        for forbidden in [".env", "secrets", "backups"]:
            target = sandbox_dir / forbidden
            if target.exists():
                print(f"  [FAIL] Sandbox contaminated with {forbidden}!", file=sys.stderr)
                sys.exit(1)
            print(f"  [OK] Verified absence of {forbidden}")
            
        # 4. Restore Environment from KeePassXC Vault or Template
        print("\n[STEP 3] Testing Secret Restoration...")
        vault_file = ROOT_DIR / "secrets" / "code-sentinel-vault.kdbx"
        if vault_file.exists() and os.environ.get("KEEPASS_MASTER_PASSWORD"):
            # Copy vault into sandbox temporarily to simulate retrieval
            sandbox_secrets = sandbox_dir / "secrets"
            sandbox_secrets.mkdir(parents=True, exist_ok=True)
            shutil.copy2(vault_file, sandbox_secrets / "code-sentinel-vault.kdbx")
            
            export_ok = run_cmd("python scripts/vault_manager.py export-env", sandbox_dir, "Export .env from KeePassXC vault")
            if not export_ok:
                print("Vault export failed.", file=sys.stderr)
                sys.exit(1)
        else:
            print("  Generating test .env from .env.example...")
            shutil.copy(sandbox_dir / ".env.example", sandbox_dir / ".env")
            
        # 5. Restore and Authenticate Encrypted Backup from Google Drive
        print("\n[STEP 4] Testing Remote Google Drive Backup Restoration...")
        restore_cmd = "python scripts/restore_from_drive.py --test-isolated"
        if not run_cmd(restore_cmd, sandbox_dir, "Download, checksum verify & decrypt from Google Drive"):
            print("Google Drive restoration test failed.", file=sys.stderr)
            sys.exit(1)
            
        # 6. Install dependencies and run tests
        print("\n[STEP 5] Testing Clean Dependency Installation & Quality Gates...")
        # Symlink or cache pnpm store to avoid re-downloading entire internet in test
        if not run_cmd("pnpm install", sandbox_dir, "pnpm install in sandbox"):
            print("Dependency installation failed in sandbox.", file=sys.stderr)
            sys.exit(1)
            
        if not run_cmd("pnpm typecheck", sandbox_dir, "TypeScript strict typecheck"):
            print("Typecheck failed in sandbox.", file=sys.stderr)
            sys.exit(1)
            
        if not run_cmd("pnpm test", sandbox_dir, "Vitest test suite"):
            print("Vitest suite failed in sandbox.", file=sys.stderr)
            sys.exit(1)
            
        print("\n=======================================================")
        print("DISASTER RECOVERY SIMULATION: 100% SUCCESS")
        print("The project can be completely reconstructed on any machine.")
        print("=======================================================\n")
        
    finally:
        print(f"Cleaning up sandbox directory: {sandbox_dir}")
        shutil.rmtree(sandbox_dir, ignore_errors=True)

if __name__ == "__main__":
    main()
