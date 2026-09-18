#!/usr/bin/env python3
"""
Code Sentinel - Enterprise KeePassXC Secret Vault Manager
Safely manage project secrets in an encrypted KeePassXC database (.kdbx).
Enforces zero secret exposure in logs, terminals, or Git repositories.
"""

import os
import sys
import shutil
import getpass
import argparse
import subprocess
from pathlib import Path

DEFAULT_VAULT_PATH = Path(__file__).resolve().parent.parent / "secrets" / "code-sentinel-vault.kdbx"
DEFAULT_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
DEFAULT_EXAMPLE_PATH = Path(__file__).resolve().parent.parent / ".env.example"

def find_keepassxc_cli():
    """Find keepassxc-cli executable across platforms."""
    cli = shutil.which("keepassxc-cli") or shutil.which("keepassxc-cli.exe")
    if cli:
        return cli
    
    candidates = [
        r"C:\Program Files\KeePassXC\keepassxc-cli.exe",
        r"C:\Program Files (x86)\KeePassXC\keepassxc-cli.exe",
        "/usr/bin/keepassxc-cli",
        "/usr/local/bin/keepassxc-cli",
        "/Applications/KeePassXC.app/Contents/MacOS/keepassxc-cli"
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None

def get_master_password(confirm=False):
    """Retrieve master password from env var or prompt user securely."""
    pwd = os.environ.get("KEEPASS_MASTER_PASSWORD")
    if pwd:
        return pwd
    
    prompt = "Enter KeePassXC Master Password: "
    pwd = getpass.getpass(prompt)
    if confirm:
        pwd_confirm = getpass.getpass("Confirm KeePassXC Master Password: ")
        if pwd != pwd_confirm:
            print("Error: Passwords do not match.", file=sys.stderr)
            sys.exit(1)
    if not pwd:
        print("Error: Master password cannot be empty.", file=sys.stderr)
        sys.exit(1)
    return pwd

def run_keepassxc(cli, args, input_data=""):
    """Execute keepassxc-cli with input piped to stdin."""
    proc = subprocess.run(
        [cli] + args,
        input=input_data,
        text=True,
        capture_output=True
    )
    return proc

def init_vault(cli, vault_path, password, force=False):
    """Initialize a new KeePassXC database."""
    vault_path = Path(vault_path)
    vault_path.parent.mkdir(parents=True, exist_ok=True)
    if vault_path.exists():
        if force:
            print(f"Removing old vault at {vault_path} to reset...")
            vault_path.unlink()
        else:
            print(f"Vault already exists at {vault_path}")
            return
    
    input_data = f"{password}\n{password}\n"
    proc = run_keepassxc(cli, ["db-create", "-p", str(vault_path)], input_data)
    if proc.returncode != 0:
        print(f"Error creating vault: {proc.stderr}", file=sys.stderr)
        sys.exit(1)
    print(f"Successfully initialized KeePassXC vault: {vault_path}")

def add_entry(cli, vault_path, password, key, value):
    """Add or overwrite an entry in the vault."""
    # Check if entry exists by attempting to remove it first
    run_keepassxc(cli, ["rm", str(vault_path), key], f"{password}\n")
    
    input_data = f"{password}\n{value}\n{value}\n"
    proc = run_keepassxc(
        cli,
        ["add", "-p", "-u", key, str(vault_path), key],
        input_data
    )
    if proc.returncode != 0:
        print(f"Error adding key '{key}': {proc.stderr}", file=sys.stderr)
        return False
    return True

def get_entry(cli, vault_path, password, key):
    """Retrieve secret value for an entry without printing."""
    input_data = f"{password}\n"
    proc = run_keepassxc(
        cli,
        ["show", "-s", "-a", "Password", str(vault_path), key],
        input_data
    )
    if proc.returncode == 0:
        return proc.stdout.strip()
    return None

def list_entries(cli, vault_path, password):
    """List entry keys stored in the database."""
    input_data = f"{password}\n"
    proc = run_keepassxc(cli, ["ls", str(vault_path)], input_data)
    if proc.returncode != 0:
        print(f"Error listing vault entries: {proc.stderr}", file=sys.stderr)
        return []
    lines = [line.strip().lstrip("/") for line in proc.stdout.splitlines() if line.strip()]
    return lines

def import_from_env(cli, vault_path, env_path, password, force=False):
    """Import secrets from existing local .env file."""
    env_path = Path(env_path)
    if not env_path.exists():
        print(f"Source env file not found at {env_path}", file=sys.stderr)
        sys.exit(1)
        
    init_vault(cli, vault_path, password, force=force)
    
    count = 0
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip().strip("'\"")
            if add_entry(cli, vault_path, password, key, val):
                print(f"  [STORED] Key: {key}")
                count += 1
                
    print(f"\nSuccessfully stored {count} secrets into KeePassXC vault.")

def export_to_env(cli, vault_path, env_path, password):
    """Export secrets from KeePassXC vault to local .env file."""
    vault_path = Path(vault_path)
    env_path = Path(env_path)
    if not vault_path.exists():
        print(f"Vault not found at {vault_path}", file=sys.stderr)
        sys.exit(1)
        
    entries = list_entries(cli, vault_path, password)
    if not entries:
        print("Vault is empty or password incorrect.", file=sys.stderr)
        sys.exit(1)
        
    lines = ["# Auto-generated from KeePassXC Vault - DO NOT COMMIT TO GIT\n"]
    for key in entries:
        val = get_entry(cli, vault_path, password, key)
        if val is not None:
            lines.append(f"{key}={val}\n")
            print(f"  [EXTRACTED] Key: {key}")
            
    with open(env_path, "w", encoding="utf-8") as f:
        f.writelines(lines)
        
    print(f"\nSuccessfully generated {env_path} from KeePassXC vault.")

def main():
    parser = argparse.ArgumentParser(description="Code Sentinel KeePassXC Vault Manager")
    parser.add_argument("command", choices=["init", "import-env", "export-env", "list-keys", "verify"],
                        help="Action to perform")
    parser.add_argument("--vault", default=str(DEFAULT_VAULT_PATH), help="Path to .kdbx file")
    parser.add_argument("--env", default=str(DEFAULT_ENV_PATH), help="Path to .env file")
    parser.add_argument("-f", "--force", action="store_true", help="Force overwrite existing vault (reset password)")
    args = parser.parse_args()
    
    cli = find_keepassxc_cli()
    if not cli:
        print("Error: keepassxc-cli could not be found. Please ensure KeePassXC is installed.", file=sys.stderr)
        sys.exit(1)
        
    if args.command == "init":
        pwd = get_master_password(confirm=True)
        init_vault(cli, args.vault, pwd, force=args.force)
    elif args.command == "import-env":
        pwd = get_master_password(confirm=True if (args.force or not Path(args.vault).exists()) else False)
        import_from_env(cli, args.vault, args.env, pwd, force=args.force)
    elif args.command == "export-env":
        pwd = get_master_password(confirm=False)
        export_to_env(cli, args.vault, args.env, pwd)
    elif args.command == "list-keys":
        pwd = get_master_password(confirm=False)
        entries = list_entries(cli, args.vault, pwd)
        print("\nStored Secret Keys:")
        for k in entries:
            print(f"  - {k}")
    elif args.command == "verify":
        pwd = get_master_password(confirm=False)
        entries = set(list_entries(cli, args.vault, pwd))
        # Read required keys from .env.example
        example_keys = set()
        if DEFAULT_EXAMPLE_PATH.exists():
            with open(DEFAULT_EXAMPLE_PATH, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        example_keys.add(line.split("=", 1)[0].strip())
        missing = example_keys - entries
        if missing:
            print(f"Missing keys in vault: {missing}", file=sys.stderr)
            sys.exit(1)
        else:
            print("Vault verification SUCCESSFUL: All required keys are present.")

if __name__ == "__main__":
    main()
