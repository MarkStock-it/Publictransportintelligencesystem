# LarGo Backend Deployment (Render + GitHub Pages)

## What this does
- Hosts Express backend publicly on Render
- Connects GitHub Pages frontend to that backend using `VITE_API_BASE_URL`

## 1) Deploy backend to Render
1. Go to Render dashboard -> New -> Blueprint
2. Select this repository (uses `render.yaml`)
3. Create service
4. In backend service environment vars, set:
   - `CLIENT_ORIGIN=https://markstock-it.github.io`
   - Keep generated `JWT_SECRET`
5. Deploy and copy your backend URL (example: `https://largo-backend.onrender.com`)

Health check:
- Open `https://<your-backend>/api/health`
- Should return JSON with `ok: true`

## 2) Point frontend build to backend
GitHub Pages build needs `VITE_API_BASE_URL` during build.

If building locally then deploying `docs/`:
1. Export env var in shell:
   - `export VITE_API_BASE_URL=https://<your-backend-domain>`
2. Run:
   - `npm run deploy:pages`
3. Commit and push `docs/`

## 3) Verify in production
1. Open your site
2. Go to login page
3. Login with demo user
4. If login fails, check browser Network tab for `/api/auth/login` target domain and CORS response

## Notes
- Local dev still works unchanged with `npm run dev:full` because no `VITE_API_BASE_URL` is required locally.
- Render free tier may sleep; first API call can be slow after idle.
