# Deployment Guide for ValuationAI

## Step 1: Deploy Backend to Render

1. **Push your code to GitHub** (if you haven't already)
   ```bash
   git add .
   git commit -m "Add deployment configs"
   git push origin main
   ```

2. **Go to Render**
   - Visit [dashboard.render.com](https://dashboard.render.com)
   - Click **"New +"** → **"Web Service"**

3. **Connect GitHub**
   - Click **"Connect GitHub"**
   - Select your **ValuationAI** repository
   - Click **"Connect"**

4. **Configure Service**
   Render will auto-detect your `render.yaml`. Just verify:
   - **Name**: `valuationai-backend` (or choose your own)
   - **Branch**: `main`
   - Click **"Create Web Service"**

5. **Wait for deployment** (~2-3 minutes)
   - Once complete, copy your backend URL
   - Example: `https://valuationai-backend.onrender.com`

---

## Step 2: Deploy Frontend to Netlify

1. **Build the frontend**
   ```bash
   cd frontend
   npm run build
   ```
   This creates a `frontend/dist` folder.

2. **Go to Netlify**
   - Visit [app.netlify.com](https://app.netlify.com)
   - Click **"Add new site"** → **"Deploy manually"**

3. **Upload your site**
   - Drag and drop the **`frontend/dist`** folder
   - Wait for deployment (~30 seconds)

4. **Configure Environment Variable**
   - Go to **Site settings** → **Environment variables**
   - Click **"Add a variable"**
   - **Key**: `VITE_API_URL`
   - **Value**: Your Render backend URL (from Step 1)
     - Example: `https://valuationai-backend.onrender.com`
   - Click **"Save"**

5. **Redeploy** (to apply environment variable)
   - Go to **Deploys** tab
   - Click **"Trigger deploy"** → **"Clear cache and deploy site"**

---

## Step 3: Test Your Deployed App

1. Visit your Netlify URL (e.g., `https://your-site.netlify.app`)
2. Enter some test values and click **"Calculate Valuation"**
3. If it works, you're done! 🎉

---

## Troubleshooting

### "Failed to calculate" error
- **Check CORS**: Make sure your backend's `backend/main.py` has:
  ```python
  app.add_middleware(
      CORSMiddleware,
      allow_origins=["*"],  # In production, replace with your Netlify URL
      ...
  )
  ```
- **Verify API URL**: Check Netlify environment variable is correct

### Backend is slow
- Render's free tier "spins down" after inactivity. First request might take 30-60 seconds.

### Need to update code?
1. Make changes locally
2. Push to GitHub:
   ```bash
   git add .
   git commit -m "Your update message"
   git push origin main
   ```
3. Render auto-deploys backend
4. Rebuild frontend and redeploy to Netlify

---

## Alternative: Auto-Deploy Frontend (Advanced)

Instead of manual uploads, connect Netlify to GitHub:

1. Netlify → **"Add new site"** → **"Import an existing project"**
2. Connect GitHub → Select **ValuationAI** repo
3. **Build settings**:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/dist`
4. Add environment variable `VITE_API_URL`
5. Deploy!

Now every push to GitHub auto-deploys both backend and frontend.
