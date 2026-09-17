# Code Sentinel — Disaster Recovery & Environment Portability Runbook

This document defines the exact, verified procedure for reconstructing the entire Code Sentinel project on a completely new machine if the original machine is lost or destroyed.

---

## 1. System Architecture & Component Separation

Code Sentinel strictly separates source code, credentials, and encrypted external backups:

```
                      ┌──────────────────────────────────────────────┐
                      │          PRIVATE GITHUB REPOSITORY           │
                      │         pankajcseaiml/Code-Sentinel          │
                      │                                              │
                      │ • Next.js 15 & Hono Application Source       │
                      │ • Database Migrations & Schemas              │
                      │ • Safe .env.example & Configuration          │
                      │ • Automated Setup, Backup & Restore Scripts  │
                      └──────────────────────┬───────────────────────┘
                                             │
                                       git clone
                                             │
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │              NEW LOCAL MACHINE               │
                      │                                              │
                      │ • Node.js (>=20.12), pnpm, Python 3          │
                      │ • Docker Engine (PostgreSQL 16)              │
                      │ • Isolated Local Storage Directory           │
                      └───────────────┬──────────────┬───────────────┘
                                      │              │
                   ┌──────────────────┘              └──────────────────┐
                   ▼                                                    ▼
   ┌───────────────────────────────┐                    ┌───────────────────────────────┐
   │       SECURE SECRET VAULT     │                    │     ENCRYPTED GOOGLE DRIVE    │
   │                               │                    │                               │
   │ KeePassXC (.kdbx)             │                    │ rclone (gdrive:CodeSentinel)  │
   │ • DATABASE_URL                │                    │ • database/postgres_backup.enc│
   │ • JWT_SECRET                  │                    │ • opencode-data/opencode.enc  │
   │ • JWT_EXPIRES_IN              │                    │ • checksums/SHA256SUMS        │
   │ • NEXT_PUBLIC_API_URL         │                    │ • metadata/manifest.json      │
   │ • Backup Passphrase           │                    │ (AES-256-GCM Encrypted)       │
   └───────────────────────────────┘                    └───────────────────────────────┘
```

---

## 2. Complete New-Machine Reconstruction Procedure

If your machine is destroyed, follow these steps in order on your new machine:

### Step 1: Install System Prerequisites
1. **Git**: `git --version`
2. **Node.js 20.12+**: `node --version`
3. **pnpm**: `corepack enable` or `npm install -g pnpm`
4. **Python 3 (with `cryptography`)**: `pip install cryptography`
5. **rclone**: `winget install Rclone.Rclone` or package manager
6. **KeePassXC**: `winget install KeePassXCTeam.KeePassXC` (optional GUI and CLI)
7. **Docker Desktop**: Optional, for running local PostgreSQL container

### Step 2: Clone Private Repository
```bash
git clone https://github.com/pankajcseaiml/Code-Sentinel.git
cd Code-Sentinel
```

### Step 3: Configure Google Drive Access
Configure rclone with your Google Drive:
```bash
rclone config
# Name: gdrive, Type: drive
# Verify access:
rclone lsd gdrive:
```

### Step 4: Restore Secrets from KeePassXC Vault (or Configure .env)
If you backed up your `code-sentinel-vault.kdbx` file:
```bash
# Place your vault into secrets/code-sentinel-vault.kdbx
python scripts/vault_manager.py export-env
```
Or create `.env` manually from template:
```bash
cp .env.example .env
# Edit .env with your credentials
```

### Step 5: Restore Encrypted Database & OpenCode Sessions
Download and decrypt the latest archives from Google Drive:
```bash
python scripts/restore_from_drive.py
```
This automatically:
- Downloads `postgres_backup_latest.enc` and `opencode_backup_latest.enc`
- Verifies SHA-256 integrity hashes against Google Drive manifest
- Authenticates and decrypts archives with AES-256-GCM
- Restores OpenCode SQLite database and session files to `~/.local/share/opencode/`

### Step 6: Start Database (PostgreSQL)
```bash
# Boot PostgreSQL in Docker
pnpm db:up

# Verify admin user
node scripts/create-admin.cjs
```

### Step 7: Automated Setup & Quality Verification
```bash
# Run automated setup
python scripts/setup.py

# Run quality verification gates
python scripts/verify_system.py
```

### Step 8: Start the Application
```bash
pnpm dev
```
Open http://localhost:3400 in your browser.

---

## 3. Daily Operations & Automation Commands

| Task | Command | Description |
| :--- | :--- | :--- |
| **Run Full Verification** | `python scripts/verify_system.py` | Runs env checks, TypeScript typecheck, Vitest, and Biome lint |
| **Create Encrypted Backup** | `python scripts/backup_to_drive.py` | Snapshots PostgreSQL + OpenCode, encrypts AES-256, uploads to Google Drive |
| **Restore from Google Drive** | `python scripts/restore_from_drive.py` | Downloads, verifies SHA-256, decrypts, and restores data |
| **Test Clean Restore (Sandbox)** | `python scripts/disaster_recovery.py` | Performs simulated recovery in an isolated sandbox |
| **Export .env from Vault** | `python scripts/vault_manager.py export-env` | Generates `.env` securely without displaying secrets |
| **Import .env to Vault** | `python scripts/vault_manager.py import-env` | Stores `.env` keys into encrypted `.kdbx` vault |
