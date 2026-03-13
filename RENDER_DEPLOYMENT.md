# Render Deployment Guide for Super Agent

## Prerequisites

1. **Create a Render account** at https://render.com
2. **Push your code to GitHub** - Render deploys directly from GitHub
3. **Set up MySQL** - Either use Render's MySQL service or external database (e.g., AWS RDS, PlanetScale)

## Deployment Steps

### Option 1: Using render.yaml (Recommended)

1. Connect your GitHub repository to Render
2. Create a new "Blueprint" service
3. Point to the `render.yaml` file in your repo
4. Configure environment variables (see below)
5. Deploy!

**Blueprint Services Deployed:**
- `super-agent-api` - Node.js backend (serves API + dashboard)
- Environment variables configured automatically

### Option 2: Manual Setup

If not using `render.yaml`, create these services manually:

#### Service 1: Web Service (Backend + API)
- **Name:** super-agent-api
- **Runtime:** Node
- **Repository:** Your GitHub repo
- **Branch:** main (or your production branch)
- **Build Command:** `npm run build:all`
- **Start Command:** `npm start`
- **Plan:** Standard or higher (recommended)

#### Environment Variables (Add in Render Dashboard)

```env
NODE_ENV=production
PORT=3001
WEBHOOK_MODE=true
WEBHOOK_PORT=3001

# GitHub OAuth
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
WEBHOOK_SECRET=your-webhook-secret

# Security
SESSION_SECRET=your-secure-random-string-min-32-chars
ENCRYPTION_KEY=your-64-char-hex-string

# EmailJS (Optional - for notifications)
EMAILJS_SERVICE_ID=your-service-id
EMAILJS_TEMPLATE_ID=your-template-id
EMAILJS_PUBLIC_KEY=your-public-key
EMAILJS_PRIVATE_KEY=your-private-key

# MySQL Database
MYSQL_HOST=your-mysql-host.com
MYSQL_PORT=3306
MYSQL_USER=your-mysql-user
MYSQL_PASSWORD=your-mysql-password
MYSQL_DATABASE=super_agent_db

# Dashboard URL
DASHBOARD_URL=https://your-render-app.onrender.com
```

## Database Setup

### Option A: External MySQL (Recommended for Production)

Use services like:
- **PlanetScale** (MySQL-compatible, free tier available)
- **AWS RDS**
- **DigitalOcean Managed Database**
- **Your own MySQL server**

1. Create a MySQL database
2. Add connection details to environment variables
3. The migration will run automatically on app startup

### Option B: Render MySQL Add-on

Render doesn't have a built-in MySQL service, so use an external provider.

## Post-Deployment

1. **Verify the app is running:**
   ```
   https://your-render-app.onrender.com/health
   ```

2. **Check logs:**
   - Go to Render Dashboard → your service → Logs

3. **Configure GitHub OAuth:**
   - Update your GitHub App settings to point to: `https://your-render-app.onrender.com/auth/callback`

4. **Set up webhooks (Optional):**
   - Add webhook URL to GitHub repositories: `https://your-render-app.onrender.com/webhook`

## Important Notes

- **Free tier:** Apps go to sleep after 15 minutes of inactivity. Use Paid tier for 24/7 uptime.
- **Build time:** First deploy takes 5-10 minutes. Subsequent deploys are faster.
- **Disk space:** Render services have ephemeral storage. Don't store persistent data locally.
- **Cold starts:** Free tier has slower cold starts (30s+). Upgrade to prevent this.

## Monitoring & Health Checks

Render automatically performs health checks on the `/health` endpoint. The app logs all requests for debugging.

## Troubleshooting

- **Build fails:** Check the build logs in Render dashboard
- **App crashes on startup:** Review environment variables and MySQL connection
- **Dashboard not loading:** Ensure `DASHBOARD_URL` is set correctly
- **API calls failing:** Check CORS settings and environment variables

## Rollback

If a deployment breaks:
1. Go to Render Dashboard → your service → Deployments
2. Select the previous working deployment
3. Click "Redeploy"
