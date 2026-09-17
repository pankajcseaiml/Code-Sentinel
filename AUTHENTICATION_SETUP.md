# Authentication System Setup Guide

This guide explains how to set up and use the authentication system in Code Sentinel.

## Overview

Code Sentinel now includes a complete authentication system with:
- User registration (signup) and login
- JWT-based session management
- PostgreSQL database for user data
- Protected routes requiring authentication
- Admin dashboard for user management
- Role-based access control (Admin/User)

## Prerequisites

- Docker installed and running
- Node.js 20.12+ installed
- pnpm package manager

## Quick Start

### 1. Start PostgreSQL Database

The project includes a Docker Compose configuration for PostgreSQL:

```bash
# Start the database container
pnpm db:up

# Or manually with docker compose
sudo docker compose up -d
```

This will:
- Create a PostgreSQL 16 container
- Initialize the database schema automatically
- Create tables for users and sessions
- Expose PostgreSQL on port 5432

### 2. Create Admin User

After the database is running, create the default admin user:

```bash
pnpm db:create-admin
```

This creates an admin account with:
- **Email:** `admin@codesentinel.com`
- **Password:** `admin123`

⚠️ **Security Note:** Change the admin password after first login in a production environment.

### 3. Configure Environment Variables

The `.env` file is already configured with default values:

```env
DATABASE_URL=postgresql://codesentinel:codesentinel_secure_password@localhost:5432/codesentinel
JWT_SECRET=super-secret-jwt-key-for-code-sentinel-development-only
JWT_EXPIRES_IN=7d
NEXT_PUBLIC_API_URL=http://localhost:3400
```

For production, update these values:
- Generate a strong `JWT_SECRET`
- Use a secure database password
- Update `NEXT_PUBLIC_API_URL` to your production domain

### 4. Start the Application

```bash
pnpm dev
```

The application will be available at http://localhost:3400

## Features

### User Authentication

#### Sign Up
- Navigate to the home page
- Click "Sign Up" button
- Enter your full name, email, and password (min. 6 characters)
- Account is created and you're automatically logged in

#### Login
- Click "Login" button
- Enter your email and password
- Session is stored securely in HTTP-only cookies

#### Logout
- Click on your avatar in the top-right corner
- Select "Logout" from the dropdown menu

### Protected Routes

The following features require authentication:

1. **Project List** (`/projects`)
   - Must be logged in to view projects
   - Shows "Authentication Required" message if not logged in

2. **Create Project**
   - "Create New Project" button shows error toast if not authenticated
   - Only logged-in users can create projects

3. **Admin Dashboard** (`/admin`)
   - Only accessible to users with admin role
   - Redirects non-admin users to projects page

### Admin Dashboard

Admins have access to a comprehensive dashboard at `/admin`:

**Statistics:**
- Total registered users
- Weekly signups (last 7 days)
- Recent user activity

**User Management:**
- View all registered users
- See recent signups in the last 7 days
- User details: ID, name, email, role, join date
- Visual role badges (Admin/User)

## Database Schema

### Users Table
```sql
- id: SERIAL PRIMARY KEY
- email: VARCHAR(255) UNIQUE NOT NULL
- password_hash: VARCHAR(255) NOT NULL
- full_name: VARCHAR(255) NOT NULL
- is_admin: BOOLEAN DEFAULT FALSE
- created_at: TIMESTAMP WITH TIME ZONE
- updated_at: TIMESTAMP WITH TIME ZONE
```

### User Sessions Table
```sql
- id: SERIAL PRIMARY KEY
- user_id: INTEGER (FK to users)
- token: VARCHAR(500) UNIQUE NOT NULL
- expires_at: TIMESTAMP WITH TIME ZONE
- created_at: TIMESTAMP WITH TIME ZONE
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Login with credentials
- `POST /api/auth/logout` - Logout and clear session
- `GET /api/auth/me` - Get current user (requires auth)

### Admin
- `GET /api/admin/users` - Get all users (requires admin)
- `GET /api/admin/stats` - Get user statistics (requires admin)

### Projects
- `GET /api/projects` - Get user projects (requires auth)
- `POST /api/projects` - Create new project (requires auth)

## Security Features

1. **Password Hashing**
   - Passwords are hashed using bcrypt with salt rounds of 10
   - Plain text passwords are never stored

2. **JWT Tokens**
   - Secure JWT tokens for session management
   - 7-day expiration by default
   - Stored in HTTP-only cookies

3. **HTTP-only Cookies**
   - Session tokens stored in HTTP-only cookies
   - Prevents XSS attacks
   - Automatic CSRF protection with SameSite attribute

4. **Role-Based Access Control**
   - Admin routes protected with `requireAdmin` middleware
   - User routes protected with `requireAuth` middleware

## Development Commands

```bash
# Start database
pnpm db:up

# Stop database
pnpm db:down

# Create admin user
pnpm db:create-admin

# Start development server
pnpm dev

# Run type checking
pnpm typecheck

# Run linter
pnpm lint
```

## Troubleshooting

### Database Connection Issues

If you see database connection errors:

1. Check if PostgreSQL container is running:
```bash
sudo docker ps | grep code-sentinel-db
```

2. Check container logs:
```bash
sudo docker logs code-sentinel-db
```

3. Verify database is accessible:
```bash
sudo docker exec -it code-sentinel-db psql -U codesentinel -d codesentinel
```

### Authentication Not Working

1. Clear browser cookies
2. Check if JWT_SECRET is set in `.env`
3. Verify database has user_sessions table
4. Check browser console for errors

### Can't Access Admin Dashboard

1. Verify your user has `is_admin = true` in database:
```sql
SELECT * FROM users WHERE email = 'your@email.com';
```

2. Update user to admin if needed:
```sql
UPDATE users SET is_admin = true WHERE email = 'your@email.com';
```

## Production Deployment

For production:

1. **Update Environment Variables**
   - Use strong, unique JWT_SECRET
   - Use secure database credentials
   - Enable HTTPS for secure cookies

2. **Database**
   - Use managed PostgreSQL service (AWS RDS, Digital Ocean, etc.)
   - Enable SSL connections
   - Regular backups

3. **Security**
   - Change default admin password immediately
   - Enable rate limiting for auth endpoints
   - Monitor failed login attempts
   - Regular security audits

## Additional Notes

- Sessions expire after 7 days
- Multiple sessions per user are supported
- Old sessions are automatically cleaned up
- User data includes creation and update timestamps
- Email addresses must be unique
