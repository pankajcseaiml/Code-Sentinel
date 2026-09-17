#!/usr/bin/env python3
"""
Code Sentinel - Automated Encrypted Google Drive Backup System
Preserves PostgreSQL, SQLite opencode data, and project state.
Uses AES-256-GCM authenticated encryption + rclone Google Drive synchronization.
Zero secrets are exposed in logs, commands, or storage metadata.
"""

import os
import sys
import json
import shutil
import hashlib
import sqlite3
import tarfile
import argparse
import subprocess
from datetime import datetime
from pathlib import Path
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

ROOT_DIR = Path(__file__).resolve().parent.parent
LOCAL_BACKUP_DIR = ROOT_DIR / "backups"
GDRIVE_REMOTE_BASE = "gdrive:CodeSentinel-Backups"
OPENCODE_DIR = Path(os.path.expanduser("~/.local/share/opencode"))

MAGIC_HEADER = b"CSENC"  # Code Sentinel Encrypted Archive identifier

def derive_key(passphrase: str, salt: bytes) -> bytes:
    """Derive 256-bit encryption key using PBKDF2-HMAC-SHA256."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100_000,
    )
    return kdf.derive(passphrase.encode("utf-8"))

def encrypt_file(source_path: Path, dest_path: Path, passphrase: str):
    """Encrypt a file using AES-256-GCM with authenticated metadata."""
    salt = os.urandom(16)
    nonce = os.urandom(12)
    key = derive_key(passphrase, salt)
    
    with open(source_path, "rb") as f:
        data = f.read()
        
    aesgcm = AESGCM(key)
    # Authenticated Additional Data binds archive to project name
    ciphertext = aesgcm.encrypt(nonce, data, associated_data=b"CodeSentinelBackupArchive")
    
    with open(dest_path, "wb") as f:
        f.write(MAGIC_HEADER)
        f.write(salt)
        f.write(nonce)
        f.write(ciphertext)

def decrypt_file(source_path: Path, dest_path: Path, passphrase: str):
    """Decrypt and authenticate an AES-256-GCM encrypted file."""
    with open(source_path, "rb") as f:
        header = f.read(len(MAGIC_HEADER))
        if header != MAGIC_HEADER:
            raise ValueError(f"Invalid file format or corrupted header in {source_path}")
        salt = f.read(16)
        nonce = f.read(12)
        ciphertext = f.read()
        
    key = derive_key(passphrase, salt)
    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(nonce, ciphertext, associated_data=b"CodeSentinelBackupArchive")
    
    with open(dest_path, "wb") as f:
        f.write(plaintext)

def calculate_sha256(filepath: Path) -> str:
    """Calculate SHA-256 hash of a file."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            hasher.update(chunk)
    return hasher.hexdigest()

def backup_opencode_data(temp_dir: Path) -> Path:
    """Create a consistent snapshot of OpenCode SQLite DB and storage."""
    staging = temp_dir / "opencode"
    staging.mkdir(parents=True, exist_ok=True)
    
    db_file = OPENCODE_DIR / "opencode.db"
    if db_file.exists():
        backup_db = staging / "opencode.db"
        src_conn = sqlite3.connect(str(db_file))
        dst_conn = sqlite3.connect(str(backup_db))
        with dst_conn:
            src_conn.backup(dst_conn)
        dst_conn.close()
        src_conn.close()
        print("  [OK] OpenCode SQLite database backed up via online backup API")
        
    storage_dir = OPENCODE_DIR / "storage"
    if storage_dir.exists():
        shutil.copytree(storage_dir, staging / "storage", dirs_exist_ok=True)
        print("  [OK] OpenCode session and diff storage copied")
        
    archive_path = temp_dir / "opencode_data.tar.gz"
    with tarfile.open(archive_path, "w:gz") as tar:
        tar.add(staging, arcname="opencode")
        
    return archive_path

def backup_postgres_database(temp_dir: Path) -> Path:
    """Export PostgreSQL database from Docker if running, or package init schema and seeds."""
    staging = temp_dir / "postgres"
    staging.mkdir(parents=True, exist_ok=True)
    
    dump_success = False
    try:
        # Check if code-sentinel-db container is running
        check = subprocess.run(
            ["docker", "ps", "--filter", "name=code-sentinel-db", "--format", "{{.Names}}"],
            capture_output=True, text=True, timeout=5
        )
        if "code-sentinel-db" in check.stdout:
            dump_file = staging / "postgres_dump.sql"
            with open(dump_file, "w", encoding="utf-8") as out:
                # Use environment-based docker exec without exposing passwords
                proc = subprocess.run(
                    ["docker", "exec", "code-sentinel-db", "pg_dump", "-U", "codesentinel", "codesentinel"],
                    stdout=out, stderr=subprocess.PIPE, text=True, timeout=30
                )
                if proc.returncode == 0 and dump_file.stat().st_size > 0:
                    dump_success = True
                    print(f"  [OK] PostgreSQL active dump created ({dump_file.stat().st_size} bytes)")
    except Exception as e:
        print(f"  [INFO] Docker pg_dump check: {e}")
        
    if not dump_success:
        print("  [INFO] Packaging database DDL schemas, triggers, and initialization scripts")
        init_sql = ROOT_DIR / "scripts" / "init-db.sql"
        if init_sql.exists():
            shutil.copy(init_sql, staging / "init-db.sql")
        create_admin = ROOT_DIR / "scripts" / "create-admin.cjs"
        if create_admin.exists():
            shutil.copy(create_admin, staging / "create-admin.cjs")
            
    archive_path = temp_dir / "postgres_backup.tar.gz"
    with tarfile.open(archive_path, "w:gz") as tar:
        tar.add(staging, arcname="postgres")
        
    return archive_path

def get_backup_passphrase() -> str:
    """Get encryption passphrase from env var or secure prompt."""
    pwd = os.environ.get("BACKUP_ENCRYPTION_PASSPHRASE") or os.environ.get("KEEPASS_MASTER_PASSWORD")
    if pwd:
        return pwd
    
    import getpass
    pwd = getpass.getpass("Enter Backup Encryption Passphrase: ")
    if not pwd:
        print("Error: Passphrase cannot be empty.", file=sys.stderr)
        sys.exit(1)
    return pwd

def main():
    parser = argparse.ArgumentParser(description="Code Sentinel Encrypted Google Drive Backup")
    parser.add_argument("--remote", default=GDRIVE_REMOTE_BASE, help="rclone remote path")
    parser.add_argument("--skip-upload", action="store_true", help="Create encrypted local backups only")
    args = parser.parse_args()
    
    passphrase = get_backup_passphrase()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    date_tag = datetime.now().strftime("%Y%m%d")
    
    run_dir = LOCAL_BACKUP_DIR / f"run_{timestamp}"
    temp_dir = run_dir / "temp"
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    print("\n=======================================================")
    print("CODE SENTINEL - ENTERPRISE BACKUP & ENCRYPTION PIPELINE")
    print("=======================================================")
    print(f"Timestamp: {timestamp}")
    print(f"Target Google Drive Remote: {args.remote}")
    
    # 1. Backup PostgreSQL
    print("\n[STEP 1] Backing up PostgreSQL Database...")
    pg_archive = backup_postgres_database(temp_dir)
    pg_enc = run_dir / f"postgres_backup_{date_tag}.enc"
    encrypt_file(pg_archive, pg_enc, passphrase)
    pg_hash = calculate_sha256(pg_enc)
    print(f"  [ENCRYPTED] {pg_enc.name} ({pg_enc.stat().st_size} bytes, SHA256: {pg_hash[:16]}...)")
    
    # 2. Backup OpenCode SQLite & Storage
    print("\n[STEP 2] Backing up OpenCode Sessions & SQLite Database...")
    opencode_archive = backup_opencode_data(temp_dir)
    opencode_enc = run_dir / f"opencode_backup_{date_tag}.enc"
    encrypt_file(opencode_archive, opencode_enc, passphrase)
    opencode_hash = calculate_sha256(opencode_enc)
    print(f"  [ENCRYPTED] {opencode_enc.name} ({opencode_enc.stat().st_size} bytes, SHA256: {opencode_hash[:16]}...)")
    
    # 3. Clean unencrypted temp files
    shutil.rmtree(temp_dir)
    
    # 4. Generate Checksums and Manifest
    print("\n[STEP 3] Generating SHA-256 Checksums and Manifest...")
    checksum_file = run_dir / f"SHA256SUMS_{date_tag}.txt"
    with open(checksum_file, "w", encoding="utf-8") as f:
        f.write(f"{pg_hash}  {pg_enc.name}\n")
        f.write(f"{opencode_hash}  {opencode_enc.name}\n")
        
    manifest = {
        "project": "Code-Sentinel",
        "timestamp": timestamp,
        "date_tag": date_tag,
        "encryption": "AES-256-GCM (PBKDF2-HMAC-SHA256, 100000 iterations)",
        "backups": {
            "postgres": {
                "filename": pg_enc.name,
                "size_bytes": pg_enc.stat().st_size,
                "sha256": pg_hash
            },
            "opencode": {
                "filename": opencode_enc.name,
                "size_bytes": opencode_enc.stat().st_size,
                "sha256": opencode_hash
            }
        }
    }
    manifest_file = run_dir / f"manifest_{date_tag}.json"
    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"  [OK] Created {checksum_file.name} and {manifest_file.name}")
    
    # 5. Upload to Google Drive via rclone
    if args.skip_upload:
        print("\n[STEP 4] Skipping Google Drive upload (--skip-upload specified).")
    else:
        print("\n[STEP 4] Uploading Encrypted Backups to Google Drive via rclone...")
        rclone_bin = shutil.which("rclone") or shutil.which("rclone.exe")
        if not rclone_bin:
            print("Error: rclone executable not found on PATH.", file=sys.stderr)
            sys.exit(1)
            
        # Target remote subfolders
        remote_db = f"{args.remote}/database"
        remote_opencode = f"{args.remote}/opencode-data"
        remote_meta = f"{args.remote}/metadata"
        remote_sums = f"{args.remote}/checksums"
        
        # Upload database backup (both dated and latest)
        subprocess.run([rclone_bin, "copyto", str(pg_enc), f"{remote_db}/{pg_enc.name}"], check=True)
        subprocess.run([rclone_bin, "copyto", str(pg_enc), f"{remote_db}/postgres_backup_latest.enc"], check=True)
        print(f"  [UPLOADED] {pg_enc.name} -> {remote_db}/")
        
        # Upload opencode backup (both dated and latest)
        subprocess.run([rclone_bin, "copyto", str(opencode_enc), f"{remote_opencode}/{opencode_enc.name}"], check=True)
        subprocess.run([rclone_bin, "copyto", str(opencode_enc), f"{remote_opencode}/opencode_backup_latest.enc"], check=True)
        print(f"  [UPLOADED] {opencode_enc.name} -> {remote_opencode}/")
        
        # Upload checksums and manifest
        subprocess.run([rclone_bin, "copyto", str(checksum_file), f"{remote_sums}/{checksum_file.name}"], check=True)
        subprocess.run([rclone_bin, "copyto", str(checksum_file), f"{remote_sums}/SHA256SUMS_latest.txt"], check=True)
        subprocess.run([rclone_bin, "copyto", str(manifest_file), f"{remote_meta}/{manifest_file.name}"], check=True)
        subprocess.run([rclone_bin, "copyto", str(manifest_file), f"{remote_meta}/manifest_latest.json"], check=True)
        print(f"  [UPLOADED] Checksums & Manifest -> {args.remote}/")
        
        # 6. Verify Remote Files
        print("\n[STEP 5] Verifying Remote Google Drive Files...")
        proc = subprocess.run([rclone_bin, "lsf", "-R", args.remote], capture_output=True, text=True, check=True)
        remote_files = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
        print("Remote Files Confirmed on Google Drive:")
        for rf in remote_files:
            print(f"  [OK] {rf}")
            
    print("\n=======================================================")
    print("BACKUP PIPELINE COMPLETED SUCCESSFULLY")
    print("=======================================================\n")

if __name__ == "__main__":
    main()
