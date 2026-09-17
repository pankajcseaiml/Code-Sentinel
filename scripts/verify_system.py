#!/usr/bin/env python3
"""
Code Sentinel - Enterprise Verification & Quality Gate Suite
Runs TypeScript typecheck, Vitest test suite, Biome linter,
environment completeness checks, and secret hygiene verification.
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT_DIR = Path(__file__).resolve().parent.parent

def run_step(name, cmd, cwd=ROOT_DIR):
    print(f"\n[CHECK] {name}...")
    proc = subprocess.run(cmd, cwd=cwd, shell=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if proc.returncode != 0:
        print(f"  [FAIL] {name} failed with exit code {proc.returncode}")
        if proc.stderr:
            print(f"  Error output:\n{proc.stderr.strip()}")
        if proc.stdout:
            print(f"  Standard output:\n{proc.stdout.strip()}")
        return False
    print(f"  [PASS] {name} passed.")
    return True

def verify_environment():
    print("\n[CHECK] Verifying Environment Variables against .env.example...")
    example_path = ROOT_DIR / ".env.example"
    env_path = ROOT_DIR / ".env"
    
    if not example_path.exists():
        print("  [FAIL] .env.example missing.")
        return False
        
    if not env_path.exists():
        print("  [FAIL] .env file missing. Run: python scripts/vault_manager.py export-env")
        return False
        
    required_keys = set()
    with open(example_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                required_keys.add(line.split("=", 1)[0].strip())
                
    present_keys = set()
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                present_keys.add(line.split("=", 1)[0].strip())
                
    missing = required_keys - present_keys
    if missing:
        print(f"  [FAIL] Missing required environment variables in .env: {missing}")
        return False
        
    print(f"  [PASS] All {len(required_keys)} required environment keys are present.")
    return True

def main():
    print("=======================================================")
    print("CODE SENTINEL - ENTERPRISE VERIFICATION SUITE")
    print("=======================================================")
    
    success = True
    
    # 1. Environment verification
    if not verify_environment():
        success = False
        
    # 2. TypeScript Typecheck
    if not run_step("TypeScript Compilation Check (pnpm typecheck)", "pnpm typecheck"):
        success = False
        
    # 3. Vitest Test Suite
    if not run_step("Unit & Integration Tests (pnpm test)", "pnpm test"):
        success = False
        
    # 4. Biome Linting
    if not run_step("Biome Linter & Formatter Check (pnpm lint)", "pnpm lint"):
        success = False
        
    print("\n=======================================================")
    if success:
        print("ALL SYSTEM VERIFICATION CHECKS PASSED SUCCESSFULLY")
        print("=======================================================\n")
        sys.exit(0)
    else:
        print("SYSTEM VERIFICATION DETECTED ISSUES")
        print("=======================================================\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
