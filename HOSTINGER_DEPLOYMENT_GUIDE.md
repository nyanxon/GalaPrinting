# Hostinger Deployment Guide for Gala Printing

This guide will help you deploy your Gala Printing project to Hostinger with proper backend and database connectivity.

## Architecture Overview

**Single Domain Setup** (Frontend + Backend on same domain):
- Frontend (React): Served by Express backend from root path (`https://your-domain.com`)
- Backend API: Serves from `/api` path (`https://your-domain.com/api`)
- Backend runs on Node.js port (assigned by Hostinger), serves both frontend and API
- The Express backend serves static files and handles API routes in a single Node.js app

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

### Option A: Using Git with GitHub Push (Recommended)

This is the easiest method if you're using GitHub:

1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "Deploy to Hostinger"
   git push origin main
   ```

2. **In Hostinger hPanel, go to Git**:
   - Click **Create Git Repository**
   - Choose **Clone from GitHub**
   - Enter your GitHub repository URL
   - Select the branch (usually `main`)
   - Choose the destination directory (e.g., `public_html`)
   - Click **Create**

3. **After cloning, install dependencies**:
   ```bash
   cd server
   npm install --production
   ```

4. **For future updates**, simply:
   ```bash
   git push origin main
   ```
   Then in Hostinger hPanel > Git, click **Pull** to update your deployment.

### Option B: Using Hostinger File Manager

1. In Hostinger hPanel, go to **Files** > **File Manager**
2. Navigate to your project root (e.g., `public_html` or a subdirectory)
3. Upload the following structure:
   ```
   public_html/
   ├── server/              # Backend directory
   │   ├── src/
   │   ├── package.json
   │   ├── .env
   │   └── node_modules/   (will be created after npm install)
   └── dist/               # Frontend build (from Step 5)
       ├── index.html
       └── assets/
   ```
4. Upload the `server` folder contents:
   - Compress the server folder locally: `zip -r server.zip server/`
   - Upload `server.zip` to File Manager
   - Extract it on the server
5. Ensure the `.env` file is uploaded (not in .gitignore)

### Option C: Using Git (Manual Clone)

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
   - **Project folder**: `server` (the backend directory)
   - **Application URL**: Choose your domain
   - **Application startup file**: `src/server.js`
   - **Application mode**: `Production`
3. Click **Create**

4. After creation, configure:
   - **Application root**: Should point to your `server` directory
   - **Environment variables**: Add your `.env` variables here (copy from server/.env)
   - **Run script**: `npm start`

**Important for Single-Domain Setup**:
- The Node.js app will run on a port assigned by Hostinger (check in Node.js setup)
- The Express backend serves BOTH the frontend static files AND the API routes
- Frontend is served from the root path `/` via Express static middleware
- Backend API is accessible at `/api` via Express routes
- No Apache/Nginx proxy configuration needed - Express handles everything

## Step 5: Deploy Frontend to Hostinger

### Build the Frontend

1. On your local machine, build the React app:
   ```bash
   npm run build
   ```
2. This creates a `dist` folder with production-ready files

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

### Upload to Hostinger

1. In Hostinger File Manager, navigate to your project root (same level as `server` directory)
2. Upload the `dist` folder contents:
   - Compress: `zip -r dist.zip dist/`
   - Upload and extract
3. The final structure should be:
   ```
   public_html/
   ├── server/              # Backend directory
   │   ├── src/
   │   ├── package.json
   │   ├── .env
   │   └── node_modules/
   └── dist/               # Frontend build
       ├── index.html
       └── assets/
   ```

**Critical**: The `dist` folder must be at the same level as the `server` folder, so the backend can find it at `../../dist` relative to `server/src/app.js`.

## Step 6: Configure Uploads Directory

1. In Hostinger File Manager, create an `uploads` directory:
   - Path: `server/uploads` (within the backend directory)
2. Set proper permissions (755):
   - Right-click the folder > **Permissions**
   - Set to `755` (read/write/execute for owner, read/execute for others)

## Step 7: Configure PORT on Hostinger

1. In Hostinger hPanel, go to **Setup** > **Node.js**
2. Find your application and note the **assigned port**
3. Update your `server/.env` file to use the Hostinger-assigned port:
   ```env
   PORT=<hostinger_assigned_port>
   ```
4. Or leave it empty and Hostinger will set it automatically via environment variable

## Step 8: Restart the Node.js Application

1. In Hostinger hPanel, go to **Setup** > **Node.js**
2. Find your application
3. Click **Restart** to apply the changes
4. Check the application logs to ensure it started successfully:
   - Look for: `[server] Starting backend server...`
   - Look for: `[db] Connected to MySQL`
   - Look for: `[app] Serving frontend from: ...`
   - Look for: `[server] ✓ Server running on port ...`

## Step 9: Test the Deployment

1. **Test Database Connection**:
   - Check Hostinger Node.js logs for connection errors
   - Look for: `[db] Connected to MySQL` message

2. **Test Backend API**:
   - Access: `https://your-domain.com/api/products`
   - Access: `https://your-domain.com/api/categories`
   - Access: `https://your-domain.com/api/auth/login` (POST with credentials)
   - All should return JSON responses (not 404)

3. **Test Frontend**:
   - Access: `https://your-domain.com`
   - Try logging in and using the application
   - Verify that API calls go to `https://your-domain.com/api/*`

## Troubleshooting

### API Routes Return 404

**Symptoms**: All `/api/*` requests return 404

**Solutions**:
1. Check Hostinger Node.js logs to see if the server is running:
   - Look for: `[server] ✓ Server running on port ...`
   - If not present, the server failed to start

2. Verify the application startup file is correct:
   - Should be: `src/server.js` (not `server.js`)

3. Check if the dist folder is in the correct location:
   - Must be at the same level as the `server` folder
   - Structure: `public_html/server/` and `public_html/dist/`

4. Verify PORT configuration:
   - Check Hostinger Node.js setup for the assigned port
   - Update `server/.env` with: `PORT=<assigned_port>`

5. Restart the Node.js application after making changes

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
- Check that `.env` file exists in the `server` directory
- Verify all required environment variables are set

### Frontend Loads But API Doesn't Work

**Symptoms**: Frontend loads but API requests fail

**Solutions**:
1. Check browser console for error messages
2. Verify frontend `.env` has `VITE_API_URL=` (empty)
3. Check that frontend was rebuilt after updating `.env`
4. Verify backend is running and accessible
5. Check Hostinger Node.js logs for errors

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
- [ ] Backend deployed to Hostinger (server directory)
- [ ] Frontend built and uploaded (dist directory at same level as server)
- [ ] Frontend `.env` configured with `VITE_API_URL=` (empty)
- [ ] Node.js application created in Hostinger with correct startup file (`src/server.js`)
- [ ] PORT configured in `.env` (using Hostinger-assigned port)
- [ ] Uploads directory created with proper permissions (server/uploads)
- [ ] HTTPS enabled for domain
- [ ] CORS configured correctly (`CLIENT_ORIGIN` set to your domain)
- [ ] Node.js application restarted
- [ ] Tested database connection (check logs for `[db] Connected to MySQL`)
- [ ] Tested API endpoints (`/api/products`, `/api/categories`, `/api/auth/login`)
- [ ] Tested frontend functionality

## Support

If you encounter issues:
1. Check Hostinger Node.js application logs for startup errors
2. Verify database credentials in phpMyAdmin
3. Test database connection manually using phpMyAdmin
4. Review Hostinger documentation for Node.js deployment
5. Check that the `dist` folder is at the correct location relative to `server/src/app.js`
6. Ensure the Node.js application startup file is set to `src/server.js`
