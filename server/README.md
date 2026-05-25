# Gala Printing — Backend Server

Node.js/Express REST API + Socket.io server for the Gala Printing web application.  
Database: MySQL 8.0.46 via XAMPP.

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20 LTS |
| npm | 10+ (bundled with Node 20) |
| XAMPP | Latest (for MySQL 8.0.46) |

---

## 1. XAMPP MySQL Setup

1. Download and install [XAMPP](https://www.apachefriends.org/).
2. Open the **XAMPP Control Panel** and start the **MySQL** module.
3. Open **HeidiSQL** (bundled with XAMPP) or any MySQL client and connect to:
   - Host: `localhost`
   - Port: `3306`
   - User: `root`
   - Password: *(empty by default)*
4. Create the database:
   ```sql
   CREATE DATABASE IF NOT EXISTS gala_printing
     CHARACTER SET utf8mb4
     COLLATE utf8mb4_unicode_ci;
   ```
5. Leave HeidiSQL open — you can use it to inspect tables after running migrations.

---

## 2. Clone and Install

```bash
# From the project root
cd server
npm install
```

---

## 3. Environment Configuration

Copy the example file and fill in your local values:

```bash
cp .env.example .env
```

Open `server/.env` and set the following variables:

| Variable | Description | Default |
|---|---|---|
| `NODE_ENV` | `development` or `production` | `development` |
| `PORT` | Port the Express server listens on | `3001` |
| `DB_HOST` | MySQL host | `localhost` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_NAME` | Database name | `gala_printing` |
| `DB_USER` | MySQL username | `root` |
| `DB_PASSWORD` | MySQL password | *(empty)* |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens — **change in production** | — |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens — **change in production** | — |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifetime (e.g. `15m`) | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime (e.g. `7d`) | `7d` |
| `UPLOAD_DIR` | Directory for uploaded files | `./uploads` |
| `CLIENT_ORIGIN` | Frontend origin for CORS | `http://localhost:5173` |
| `BCRYPT_ROUNDS` | bcrypt work factor | `12` |

> **Security note:** Never commit `server/.env` to version control. It is listed in `server/.gitignore`.  
> For production, generate strong secrets with:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

---

## 4. Run Database Migrations

Migrations are idempotent (`CREATE TABLE IF NOT EXISTS`) and safe to run multiple times.

```bash
# From the server/ directory
npm run migrate
```

This executes all 13 SQL files in `src/db/migrations/` in order, creating the full schema.  
Verify in HeidiSQL that the following tables exist in `gala_printing`:

`users`, `categories`, `products`, `orders`, `order_items`, `order_history`,  
`cart_items`, `conversations`, `messages`, `reviews`,  
`analytics_visits`, `analytics_product_views`, `refresh_tokens`

---

## 5. Start the Server

### Development (with auto-reload via nodemon)

```bash
npm run dev
```

The server starts on `http://localhost:3001` with:
- Verbose request logging (`morgan dev`)
- Detailed error responses including stack traces

### Production

```bash
npm start
```

Set `NODE_ENV=production` in your `.env` (or as an environment variable) before starting.  
In production mode:
- Stack traces are suppressed from API error responses
- HTTP security headers are enforced via `helmet`
- Request logging is disabled

---

## 6. Run Tests

Property-based tests use [fast-check](https://fast-check.dev/) and run via [Vitest](https://vitest.dev/).

```bash
npm test
```

Tests are located in `src/tests/`. Each test file covers a specific correctness property:

| File | Property |
|---|---|
| `auth.property.test.js` | Token family invalidation |
| `roleGuard.property.test.js` | Role-based access control |
| `orderTransition.property.test.js` | Order status transition enforcement |
| `cartIsolation.property.test.js` | Cart isolation between customers |
| `fileUpload.property.test.js` | File size rejection |
| `socketAuth.property.test.js` | Socket.io auth rejection |
| `pagination.property.test.js` | Pagination correctness |
| `ratingValidation.property.test.js` | Review rating validation |

---

## 7. Project Structure

```
server/
├── src/
│   ├── app.js              # Express app factory
│   ├── server.js           # HTTP + Socket.io entry point
│   ├── config/env.js       # Validated environment config
│   ├── db/
│   │   ├── connection.js   # mysql2 connection pool
│   │   ├── migrate.js      # Migration runner
│   │   └── migrations/     # SQL migration files (001–013)
│   ├── middleware/         # auth, requireRole, upload, errorHandler
│   ├── routes/             # Express routers
│   ├── controllers/        # Request handlers
│   ├── services/           # Business logic
│   ├── socket/             # Socket.io setup and event handlers
│   ├── tests/              # Property-based tests
│   └── utils/              # jwt, hash, storage helpers
├── uploads/                # Uploaded files (gitignored)
│   ├── designs/
│   ├── payments/
│   └── chat/
├── .env                    # Local environment variables (gitignored)
├── .env.example            # Template for .env
├── package.json
└── README.md
```

---

## 8. Available Scripts

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `nodemon src/server.js` | Start with auto-reload (development) |
| `npm start` | `node src/server.js` | Start server (production) |
| `npm run migrate` | `node src/db/migrate.js` | Run database migrations |
| `npm test` | `vitest run` | Run all property-based tests |
