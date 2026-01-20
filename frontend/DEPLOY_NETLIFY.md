# Deploying LedgerX Frontend to Netlify

This guide will walk you through deploying the LedgerX Next.js frontend to Netlify.

## Prerequisites

1. A GitHub account with your LedgerX repository pushed
2. A Netlify account (sign up at https://netlify.com)
3. Your backend deployed on Render (or another hosting service)

## Step 1: Prepare Your Frontend

### 1.1 Install Netlify Next.js Plugin (Optional but Recommended)

The `netlify.toml` file is already configured with the Netlify Next.js plugin. If you want to install it locally:

```bash
cd frontend
npm install --save-dev @netlify/plugin-nextjs
```

**Note:** Netlify will automatically install this plugin during build, so this step is optional.

### 1.2 Environment Variables

You'll need to set the following environment variable in Netlify:

- `NEXT_PUBLIC_API_URL`: Your Render backend URL (e.g., `https://ledgerx-1-qr1h.onrender.com/api`)

## Step 2: Deploy to Netlify

### Option A: Deploy via Netlify Dashboard (Recommended)

1. **Go to Netlify Dashboard**
   - Visit https://app.netlify.com
   - Sign in or create an account

2. **Add New Site**
   - Click **"Add new site"** → **"Import an existing project"**
   - Choose **"Deploy with GitHub"**

3. **Connect GitHub Repository**
   - Authorize Netlify to access your GitHub account
   - Select the `Ancel-duke/LedgerX` repository
   - Choose the `main` branch

4. **Configure Build Settings**
   - **Base directory**: `frontend`
   - **Build command**: `npm run build` (or leave default)
   - **Publish directory**: `.next` (Netlify Next.js plugin handles this automatically)

5. **Set Environment Variables**
   - Click **"Show advanced"** → **"New variable"**
   - Add:
     - **Key**: `NEXT_PUBLIC_API_URL`
     - **Value**: `https://ledgerx-1-qr1h.onrender.com/api` (your Render backend URL)
   - Click **"Deploy site"**

6. **Wait for Deployment**
   - Netlify will clone your repo, install dependencies, and build
   - The build process typically takes 2-5 minutes
   - You'll see build logs in real-time

7. **Get Your Site URL**
   - Once deployed, Netlify will provide a URL like: `https://your-site-name.netlify.app`
   - You can customize the domain name in **Site settings** → **Domain management**

### Option B: Deploy via Netlify CLI

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login to Netlify**
   ```bash
   netlify login
   ```

3. **Navigate to Frontend Directory**
   ```bash
   cd frontend
   ```

4. **Initialize Netlify Site**
   ```bash
   netlify init
   ```
   - Follow the prompts to connect to your Git repository
   - Choose "Create & configure a new site"
   - Select your team (or create one)

5. **Set Environment Variables**
   ```bash
   netlify env:set NEXT_PUBLIC_API_URL "https://ledgerx-1-qr1h.onrender.com/api"
   ```

6. **Deploy**
   ```bash
   netlify deploy --prod
   ```

## Step 3: Configure CORS on Backend (If Needed)

If you encounter CORS errors, make sure your Render backend allows requests from your Netlify domain:

1. Go to your Render backend service
2. Check the CORS configuration in `backend/src/main.ts`
3. Add your Netlify domain to the allowed origins:
   ```typescript
   app.enableCors({
     origin: [
       'http://localhost:3001',
       'https://your-site-name.netlify.app',
       // Add your Netlify URL here
     ],
     credentials: true,
   });
   ```

## Step 4: Verify Deployment

1. **Visit Your Netlify Site**
   - Open the URL provided by Netlify
   - Test the login/register functionality
   - Verify API calls are working

2. **Check Browser Console**
   - Open browser DevTools (F12)
   - Check for any CORS errors or API connection issues
   - Verify the API URL is correct

3. **Test Features**
   - Login/Register
   - Create invoices
   - Create payments
   - View analytics
   - Check activity logs

## Troubleshooting

### Build Fails

**Error: "Module not found"**
- Ensure all dependencies are in `package.json`
- Run `npm install` locally to verify

**Error: "Build command failed"**
- Check build logs in Netlify dashboard
- Verify Node.js version (should be 20+)
- Ensure `netlify.toml` is correct

### API Connection Issues

**Error: "Network Error" or CORS errors**
- Verify `NEXT_PUBLIC_API_URL` is set correctly in Netlify
- Check backend CORS configuration
- Ensure backend is running and accessible

**Error: "401 Unauthorized"**
- Check if authentication tokens are being stored in cookies
- Verify JWT_SECRET matches between frontend and backend
- Check browser console for token issues

### Environment Variables Not Working

- Ensure variable name starts with `NEXT_PUBLIC_` for client-side access
- Redeploy after adding/changing environment variables
- Clear browser cache and hard refresh

## Custom Domain (Optional)

1. Go to **Site settings** → **Domain management**
2. Click **"Add custom domain"**
3. Follow Netlify's DNS configuration instructions
4. Update your backend CORS settings to include the custom domain

## Continuous Deployment

Netlify automatically deploys when you push to your `main` branch:
- Every push triggers a new build
- You can enable branch previews for pull requests
- Configure build hooks for manual deployments

## Next Steps

- Set up custom domain
- Configure SSL (automatic with Netlify)
- Set up form handling (if needed)
- Configure redirects and rewrites
- Set up analytics (optional)

## Support

- Netlify Docs: https://docs.netlify.com
- Next.js on Netlify: https://docs.netlify.com/integrations/frameworks/nextjs/
- Netlify Community: https://answers.netlify.com
