# Hostinger Deployment Guide for Gala Printing

This guide will help you deploy your Gala Printing project to Hostinger with proper backend and database connectivity.

## Architecture Overview

**Single Domain Setup** (Frontend + Backend on same domain):
- Frontend (React): Serves from root path (`https://your-domain.com`)
- Backend API: Serves from `/api` path (`https://your-domain.com/api`)
- Backend runs on Node.js port 3001, proxied through Apache/Nginx

## Prerequisites

- Hostinger hosting account with MySQL database
- Access to Hostinger hPanel
- Git repository with your project code

## Step 1: Get Hostinger Database Credentials

1. Log in to Hostinger hPanel
2. Go to **Databases** > **MySQL Databases**
3. Create a new database or use existing one:
   - **Database Name**: e.g., `u123456789_gala_printing`
   - **Username**: e.g., `u123456789_admin`
   - **Password**: Generate a strong password
4. Note down these values:
   - **Host**: Usually `localhost` or a specific hostname provided by Hostinger
   - **Port**: Usually `3306`
   - **Database Name**: The full database name
   - **Username**: The full username
   - **Password**: The password you set

## Step 2: Set Up Database Using phpMyAdmin

1. In Hostinger hPanel, go to **Databases** > **phpMyAdmin**
2. Select your database from the left sidebar
3. You need to run the SQL migration files to create the database schema

### Option A: Run Migrations via phpMyAdmin Interface

1. Open each migration file from `server/src/db/migrations/` in order (001 to 029)
2. Copy the SQL content
3. In phpMyAdmin, go to the **SQL** tab
4. Paste the SQL and click **Go**
5. Repeat for all migration files in order

### Option B: Import All Migrations at Once

1. Combine all migration files into one SQL file:
   ```bash
   # On your local machine
   cd server/src/db/migrations
   cat *.sql > all_migrations.sql
   ```
2. In phpMyAdmin, go to **Import** tab
3. Upload the `all_migrations.sql` file
4. Click **Go**

## Step 3: Configure Backend Environment Variables

1. Open `server/.env.production` file
2. Replace the placeholder values with your Hostinger database credentials:

```env
# Database Configuration
DB_HOST=localhost                    # or specific Hostinger MySQL host
DB_PORT=3306
DB_NAME=u123456789_gala_printing     # Your actual database name
DB_USER=u123456789_admin             # Your actual username
DB_PASSWORD=your_actual_password     # Your actual password

# JWT Secrets (IMPORTANT: Generate strong secrets)
JWT_ACCESS_SECRET=your_strong_secret_here
JWT_REFRESH_SECRET=another_strong_secret_here

# CORS Configuration
CLIENT_ORIGIN=https://your-domain.com  # Replace with your actual domain
```

3. Generate strong JWT secrets using this command (local terminal):
   ```bash
   openssl rand -hex 64
   ```
   Run this twice to get two different secrets for access and refresh tokens.

4. Rename the file to `.env` for production:
   ```bash
   mv server/.env.production server/.env
   ```

## Step 4: Deploy Backend to Hostinger

### Option A: Using Hostinger File Manager

1. In Hostinger hPanel, go to **Files** > **File Manager**
2. Navigate to `public_html` (or create a subdirectory for backend)
3. Upload the `server` folder contents:
   - Compress the server folder locally: `zip -r server.zip server/`
   - Upload `server.zip` to File Manager
   - Extract it on the server
4. Ensure the `.env` file is uploaded (not in .gitignore)

### Option B: Using Git (Recommended)

1. In Hostinger hPanel, go to **Git** > **Create Git Repository**
2. Clone your repository to the server
3. Navigate to the server directory and install dependencies:
   ```bash
   cd server
   npm install --production
   ```

### Configure Node.js on Hostinger

1. In Hostinger hPanel, go to **Setup** > **Node.js**
2. Create a new Node.js application:
   - **Project folder**: `server` (or your backend directory)
   - **Application URL**: Choose your domain (this will be used for both frontend and backend)
   - **Application startup file**: `src/server.js`
   - **Application mode**: `Production`
3. Click **Create**

4. After creation, you'll see:
   - **Application root**: Path to your application
   - **Environment variables**: Add your `.env` variables here (copy from server/.env)
   - **Run script**: `npm start`

**Important for Single-Domain Setup**:
- The Node.js app will run on a specific port (e.g., 3001)
- Hostinger will automatically configure Apache/Nginx to proxy `/api` requests to your Node.js app
- Your frontend (React) will serve from the root path `/` via Apache/Nginx
- Your backend API will be accessible at `/api` via the proxy
- The backend only serves API routes; it does NOT serve the frontend in production

## Step 5: Deploy Frontend to Hostinger

### Build the Frontend

1. On your local machine, build the React app:
   ```bash
   npm run build
   ```
2. This creates a `dist` folder with production-ready files

### Upload to Hostinger

1. In Hostinger File Manager, navigate to `public_html`
2. Upload the contents of the `dist` folder:
   - Compress: `zip -r dist.zip dist/`
   - Upload and extract
3. Ensure `index.html` and other assets are in the root of `public_html`

### Configure Frontend Environment

1. The frontend `.env` file needs to be configured for production
2. Update the `.env` file in your project root:
   ```env
   VITE_USE_BACKEND=true
   VITE_API_URL=
   ```
3. Rebuild the frontend after updating `.env`:
   ```bash
   npm run build
   ```

**Important**: For single-domain setup, `VITE_API_URL` must be empty. The frontend will use relative paths (`/api`) which automatically point to your same domain. Do NOT set it to a full URL with `/api` suffix as this will cause duplicated paths like `/api/api/...`.

## Step 6: Configure Uploads Directory

1. In Hostinger File Manager, create an `uploads` directory:
   - Path: `public_html/uploads` (or within your backend directory)
2. Set proper permissions (755):
   - Right-click the folder > **Permissions**
   - Set to `755` (read/write/execute for owner, read/execute for others)

## Step 7: Test the Deployment

1. **Test Database Connection**:
   - Check Hostinger Node.js logs for connection errors
   - Look for: `[db] Connected to MySQL` message

2. **Test Backend API**:
   - Access: `https://your-domain.com/api/health` (if you have a health endpoint)
   - Or test authentication endpoints at `https://your-domain.com/api/auth/login`

3. **Test Frontend**:
   - Access: `https://your-domain.com`
   - Try logging in and using the application
   - Verify that API calls go to `https://your-domain.com/api/*`

## Troubleshooting

### Database Connection Issues

- **Error**: "Access denied for user"
  - Verify database credentials in `.env`
  - Check user has proper permissions in Hostinger MySQL Databases

- **Error**: "Can't connect to MySQL server"
  - Verify `DB_HOST` is correct (usually `localhost` for Hostinger)
  - Check if MySQL database is active in hPanel

### Backend Not Starting

- Check Node.js application logs in Hostinger hPanel
- Ensure all dependencies are installed: `npm install --production`
- Verify the startup file path: `src/server.js`

### CORS Errors

- Ensure `CLIENT_ORIGIN` in backend `.env` matches your domain (e.g., `https://your-domain.com`)
- For single-domain setup, both frontend and backend share the same origin, so CORS should work automatically
- If you still get CORS errors, verify that the backend is properly configured to accept requests from your domain

### File Upload Issues

- Verify `UPLOAD_DIR` has proper permissions (755)
- Check that the directory exists and is writable
- Ensure the path is correct (absolute path recommended for production)

## Important Security Notes

1. **Never commit `.env` files to Git** - they contain sensitive credentials
2. **Use strong JWT secrets** - generate with `openssl rand -hex 64`
3. **Keep dependencies updated** - run `npm audit` regularly
4. **Enable HTTPS** - Hostinger provides free SSL certificates
5. **Regular backups** - Use Hostinger backup features for database and files

## Production Checklist

- [V] Database created in Hostinger
- [ ] All 29 migration files executed successfully
- [ ] Backend `.env` configured with correct database credentials
- [ ] Strong JWT secrets generated and configured
- [ ] Backend deployed and running on Hostinger Node.js
- [ ] Frontend built and uploaded to public_html
- [ ] Frontend `.env` configured with correct backend URL
- [ ] Uploads directory created with proper permissions
- [ ] HTTPS enabled for domain
- [ ] CORS configured correctly
- [ ] Tested database connection
- [ ] Tested API endpoints
- [ ] Tested frontend functionality

## Support

If you encounter issues:
1. Check Hostinger Node.js application logs
2. Verify database credentials in phpMyAdmin
3. Test database connection manually using phpMyAdmin
4. Review Hostinger documentation for Node.js deployment
