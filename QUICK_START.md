# Quick Start Guide - Code Sentinel with Authentication

## Prerequisites
- Docker installed
- Node.js 20.12+
- pnpm package manager

## Setup (First Time)

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Start PostgreSQL Database
```bash
pnpm db:up
```

This will:
- Create PostgreSQL container
- Initialize database schema automatically
- Start database on port 5432

### 3. Create Admin User
```bash
pnpm db:create-admin
```

**Default Admin Credentials:**
- Email: `admin@codesentinel.com`
- Password: `admin123`

⚠️ Change this password in production!

### 4. Start Development Server
```bash
pnpm dev
```

Open http://localhost:3400

## Daily Usage

### Start Everything
```bash
# If database is not running
pnpm db:up

# Start dev server
pnpm dev
```

### Stop Everything
```bash
# Stop dev server: Ctrl+C

# Stop database
pnpm db:down
```

## First Login

1. Go to http://localhost:3400
2. Click **"Login"**
3. Use admin credentials:
   - Email: `admin@codesentinel.com`
   - Password: `admin123`
4. Access admin dashboard: Click avatar → "Admin Dashboard"

## Create New User

1. Click **"Sign Up"** on home page
2. Fill in:
   - Full Name
   - Email
   - Password (min 6 characters)
   - Confirm Password
3. Submit to create account
4. Auto-logged in after signup

## Features

### For All Users
- ✅ View and manage projects
- ✅ Create new projects
- ✅ View session history
- ✅ Access code editor

### For Admins
- ✅ Access admin dashboard (`/admin`)
- ✅ View all users
- ✅ See weekly signup statistics
- ✅ Monitor user activity

## Common Commands

```bash
# Database
pnpm db:up              # Start PostgreSQL
pnpm db:down            # Stop PostgreSQL  
pnpm db:create-admin    # Create admin user

# Development
pnpm dev                # Start dev server
pnpm build              # Build production
pnpm start              # Run production build

# Code Quality
pnpm typecheck          # Run TypeScript checks
pnpm lint               # Run linter
pnpm fix                # Auto-fix lint issues
pnpm test               # Run tests
```

## Troubleshooting

### Can't connect to database
```bash
# Check if container is running
sudo docker ps | grep code-sentinel-db

# View container logs
sudo docker logs code-sentinel-db

# Restart container
pnpm db:down
pnpm db:up
```

### Forgot admin password
```bash
# Connect to database
sudo docker exec -it code-sentinel-db psql -U codesentinel -d codesentinel

# Reset password (will hash 'newpassword123')
# Then update manually or use create-admin script
```

### Authentication not working
1. Clear browser cookies
2. Check `.env` file exists
3. Restart dev server
4. Check browser console for errors

### Port already in use
```bash
# Find process using port 3400
lsof -i :3400

# Kill process if needed
kill -9 <PID>
```

## Environment Variables

Located in `.env` file:

```env
# Database connection
DATABASE_URL=postgresql://codesentinel:codesentinel_secure_password@localhost:5432/codesentinel

# JWT configuration
JWT_SECRET=super-secret-jwt-key-for-code-sentinel-development-only
JWT_EXPIRES_IN=7d

# Application URL
NEXT_PUBLIC_API_URL=http://localhost:3400
```

## Project Structure

```
Code-Sentinel/
├── src/
│   ├── app/              # Next.js pages
│   │   ├── admin/        # Admin dashboard
│   │   └── projects/     # Project management
│   ├── components/       # Reusable UI components
│   ├── hooks/            # React hooks (including useAuth)
│   ├── lib/              # Utilities and API clients
│   └── server/           # Backend API
│       ├── db/           # Database config and types
│       ├── hono/         # API routes and middleware
│       └── service/      # Business logic (auth, projects)
├── scripts/              # Utility scripts
├── public/               # Static assets
└── docker-compose.yml    # Database container config
```

## Next Steps

### For Developers
1. Read `AUTHENTICATION_SETUP.md` for detailed auth docs
2. Read `IMPLEMENTATION_SUMMARY_AUTH.md` for technical details
3. Check `AGENTS.md` for coding guidelines

### For Users
1. Create your account
2. Create your first project
3. Explore the admin dashboard (if admin)
4. Start coding with AI assistance

## Getting Help

- Check `AUTHENTICATION_SETUP.md` for auth-specific help
- Review `README.md` for general project info
- Check GitHub issues for known problems
- Read inline code documentation

## Security Notes

🔐 **Development:**
- Default credentials are for development only
- SQLite sessions stored locally
- HTTP-only cookies used for security

⚠️ **Production:**
- Change all default passwords
- Use strong JWT_SECRET
- Enable HTTPS
- Use managed PostgreSQL service
- Set up regular backups

## Quick Commands Reference

| Command | Purpose |
|---------|---------|
| `pnpm db:up` | Start database |
| `pnpm db:down` | Stop database |
| `pnpm dev` | Start dev server |
| `pnpm build` | Build for production |
| `pnpm typecheck` | Check types |
| `pnpm lint` | Lint code |
| `pnpm fix` | Fix lint issues |

---

**Ready to code?** Run `pnpm dev` and visit http://localhost:3400! 🚀
