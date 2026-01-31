# Deploying LedgerX Backend to Render

This guide will walk you through deploying the LedgerX NestJS backend to Render.

## Prerequisites

1. A GitHub account with your LedgerX repository pushed
2. A Render account (sign up at https://render.com)
3. MongoDB Atlas account (for MongoDB) or use Render's MongoDB service
4. PostgreSQL database (Render provides this)

## Step 1: Create PostgreSQL Database on Render

1. Go to your Render dashboard: https://dashboard.render.com
2. Click **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name**: `ledgerx-db` (or your preferred name)
   - **Database**: `ledgerx`
   - **User**: (auto-generated)
   - **Region**: Choose closest to your users
   - **PostgreSQL Version**: 14 or higher
   - **Plan**: Free tier available (with limitations)
4. Click **"Create Database"**
5. **Save the Internal Database URL** - you'll need this later
6. Note: The database will take a few minutes to provision

## Step 2: Set Up MongoDB (MongoDB Atlas)

Since Render doesn't provide MongoDB, use MongoDB Atlas:

1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free cluster (M0)
3. Configure network access (allow all IPs: `0.0.0.0/0` for development)
4. Create a database user
5. Get your connection string (format: `mongodb+srv://username:password@cluster.mongodb.net/ledgerx`)

## Step 3: Deploy Backend Service

1. In Render dashboard, click **"New +"** → **"Web Service"**
2. Connect your GitHub repository:
   - Click **"Connect GitHub"** if not already connected
   - Authorize Render to access your repositories
   - Select the `Ancel-duke/LedgerX` repository
3. Configure the service:

### Basic Settings
- **Name**: `ledgerx-backend` (or your preferred name)
- **Region**: Same as your PostgreSQL database
- **Branch**: `main`
- **Root Directory**: `backend` (important!)
- **Runtime**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start:prod`

### Environment Variables

Add the following environment variables in Render:

```env
# Database
DATABASE_URL=<Your PostgreSQL Internal Database URL from Step 1>
MONGODB_URI=<Your MongoDB Atlas connection string from Step 2>

# JWT Configuration
JWT_SECRET=<Generate a strong random secret key>
JWT_EXPIRATION=1d
JWT_REFRESH_SECRET=<Generate another strong random secret key>
JWT_REFRESH_EXPIRATION=7d

# Application
NODE_ENV=production
PORT=10000
```

**Important Notes:**
- Use the **Internal Database URL** for PostgreSQL (not the external one)
- Generate strong JWT secrets (you can use: `openssl rand -base64 32`)
- Render automatically sets `PORT` environment variable, but we'll use 10000 as fallback

### Advanced Settings (Optional)

- **Auto-Deploy**: `Yes` (deploys on every push to main branch)
- **Health Check Path**: `/api/health` (if you add a health endpoint)

4. Click **"Create Web Service"**

## Step 4: Update Backend Code for Render

### Update `backend/src/main.ts`

Make sure your main.ts uses the PORT from environment:

```typescript
const port = process.env.PORT || 3000;
await app.listen(port);
```

### Create `backend/render.yaml` (Optional)

Create a `render.yaml` file in the `backend` directory for infrastructure as code:

```yaml
services:
  - type: web
    name: ledgerx-backend
    env: node
    plan: free
    buildCommand: npm install && npm run build
    startCommand: npm run start:prod
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: ledgerx-db
          property: connectionString
      - key: MONGODB_URI
        sync: false
      - key: JWT_SECRET
        generateValue: true
      - key: JWT_REFRESH_SECRET
        generateValue: true
      - key: JWT_EXPIRATION
        value: 1d
      - key: JWT_REFRESH_EXPIRATION
        value: 7d

databases:
  - name: ledgerx-db
    plan: free
    databaseName: ledgerx
    user: ledgerx
```

## Step 5: Run Database Migrations

After deployment, you need to run Prisma migrations:

### Option 1: Using Render Shell

1. Go to your service in Render dashboard
2. Click **"Shell"** tab
3. Run:
```bash
npx prisma migrate deploy
npx prisma generate
```

### Option 2: Add to Build Command

Update your build command in Render to:
```bash
npm install && npx prisma generate && npm run build
```

And add a post-deploy script in `package.json`:
```json
"scripts": {
  "postdeploy": "npx prisma migrate deploy"
}
```

## Step 6: Update CORS Settings

Update `backend/src/main.ts` to allow your frontend domain:

```typescript
app.enableCors({
  origin: [
    'http://localhost:3001',
    'https://your-frontend-domain.onrender.com',
    // Add your production frontend URL
  ],
  credentials: true,
});
```

## Step 7: Verify Deployment

1. Check the **"Logs"** tab in Render dashboard
2. Look for: `Nest application successfully started`
3. Test the API: `https://your-service-name.onrender.com/api`
4. Test health endpoint (if added): `https://your-service-name.onrender.com/api/health`

## Step 8: Update Frontend Environment

Update your frontend `.env.local` or production environment:

```env
NEXT_PUBLIC_API_URL=https://your-backend-service.onrender.com/api
```

## Troubleshooting

### Build Fails

- Check logs for specific errors
- Ensure `backend` is set as root directory
- Verify all dependencies are in `package.json`

### Database Connection Errors

- Verify `DATABASE_URL` uses Internal Database URL
- Check database is fully provisioned (can take 5-10 minutes)
- Ensure database name matches in connection string

### MongoDB Connection Errors

- Verify MongoDB Atlas network access allows Render IPs
- Check connection string format
- Ensure database user credentials are correct

### Application Crashes

- Check logs for error messages
- Verify all environment variables are set
- Ensure Prisma migrations have run
- Check if port is correctly configured

### Slow Cold Starts

- Render free tier has cold starts (15-30 seconds)
- Upgrade to paid plan for faster response times
- Consider adding a health check endpoint

## Render Free Tier Limitations

- **Sleeps after 15 minutes of inactivity** (wakes on next request)
- **512 MB RAM**
- **0.1 CPU share**
- **750 hours/month** (enough for always-on if single service)

## Production Recommendations

1. **Upgrade to paid plan** for always-on service
2. **Use environment groups** for shared variables
3. **Set up monitoring** and alerts
4. **Enable auto-scaling** if needed
5. **Use Render's managed PostgreSQL** (better than external)
6. **Set up CI/CD** with GitHub Actions
7. **Add health check endpoint** for monitoring

## Health Check Endpoint (Optional)

Add to `backend/src/app.module.ts` or create a health controller:

```typescript
@Get('health')
health() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
}
```

## Next Steps

1. Deploy frontend to Vercel/Netlify/Render
2. Update frontend API URL to point to Render backend
3. Set up custom domain (optional)
4. Configure SSL certificates (automatic on Render)
5. Set up monitoring and logging

---

**Your backend will be available at:** `https://your-service-name.onrender.com/api`
