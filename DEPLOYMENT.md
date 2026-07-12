# IntelliAsset - Deployment Guide

Your project is now **production-ready** and can be deployed to any cloud platform (Vercel, AWS, Azure, DigitalOcean, Docker, etc.).

## What's Been Done

### Security Hardening
- **CORS**: Configurable per environment (not wide open)
- **Password Hashing**: PBKDF2-HMAC-SHA256 with 260k iterations (was: single-round SHA-256)
- **Demo Mode Gating**: Reset codes only returned in development (`DEMO_MODE=true`)
- **No Secrets in Code**: All URLs, keys, and flags moved to environment variables
- **Database Out of Git**: `.gitignore` added, `intelliasset.db` untracked

### Environment Configuration
Every component now respects environment variables:

#### Frontend (`frontend/.env` or `.env.development.local`)
```bash
VITE_API_URL=https://api.yourdomain.com  # Defaults to http://localhost:8001
```

#### Backend (`backend/.env`)
```bash
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com  # CORS allowlist
DEMO_MODE=false  # Set to false in production to hide reset codes
GEMINI_API_KEY=your-key-here  # Already supported, just needed in env
```

#### Agent (`export INTELLIASSET_BACKEND_URL`)
```bash
INTELLIASSET_BACKEND_URL=https://api.yourdomain.com  # Defaults to http://localhost:8001
```

## Deployment Scenarios

### 1. Vercel (Recommended for Frontend)

**Frontend** (Next.js/Vite on Vercel):
```bash
# In Vercel dashboard → Settings → Environment Variables:
VITE_API_URL=https://api.yourdomain.com
```

**Backend** (Python/FastAPI on AWS Lambda, Cloud Run, or VPS):
Deploy separately, then set frontend's `VITE_API_URL` to its public URL.

### 2. Docker (All-in-One)

```dockerfile
FROM python:3.11
WORKDIR /app
COPY . .
RUN pip install -r backend/requirements.txt
RUN npm --prefix frontend install && npm --prefix frontend run build
ENV ALLOWED_ORIGINS=*
ENV DEMO_MODE=false
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8001"]
```

### 3. AWS Setup (Typical)

- **Backend**: EC2 or Lambda + RDS (for intelliasset.db)
  ```bash
  export ALLOWED_ORIGINS=https://yourdomain.com
  export DEMO_MODE=false
  uvicorn backend.main:app --host 0.0.0.0 --port 8001
  ```

- **Frontend**: S3 + CloudFront
  ```bash
  VITE_API_URL=https://api.yourdomain.com npm run build
  # Deploy dist/ to S3
  ```

- **Agent**: EC2 instances
  ```bash
  export INTELLIASSET_BACKEND_URL=https://api.yourdomain.com
  python agent/main.py
  ```

## Local Development (Unchanged)

The defaults work for local development:

```bash
# Terminal 1: Backend
cd backend
python -m uvicorn main:app --reload

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: Agent (optional, tests WebSocket streaming)
cd agent
python main.py
```

No environment files needed unless you want to override defaults.

## Database Migration

If migrating from development to production:

1. **On development machine:**
   ```bash
   sqlite3 backend/intelliasset.db ".dump" > backup.sql
   ```

2. **On production:**
   ```bash
   # Using RDS PostgreSQL? Update backend/main.py:
   # DATABASE_URL=postgresql://user:pass@rds-endpoint.amazonaws.com/intelliasset
   # Otherwise, copy the file:
   cp backup.sql backend/intelliasset.db
   python backend/main.py  # Creates schema on first run
   ```

## Pre-Deployment Checklist

- [ ] Set `ALLOWED_ORIGINS` to your actual domain(s)
- [ ] Set `DEMO_MODE=false` for production
- [ ] Set `VITE_API_URL` in frontend env
- [ ] Set `INTELLIASSET_BACKEND_URL` in agent config
- [ ] Add `GEMINI_API_KEY` if using chatbot
- [ ] Test login with a non-seeded user (uses new PBKDF2 hash)
- [ ] Existing seeded users can still log in (backwards-compat with old SHA-256)
- [ ] CORS errors? Check `ALLOWED_ORIGINS` includes your frontend origin

## Monitoring & Logs

- **Backend**: Check `uvicorn` logs for 500 errors, WebSocket drops
- **Frontend**: Browser console for fetch/WebSocket errors (will show if API_URL is wrong)
- **Agent**: Agent logs show "Connected to [backend URL]" on startup, "Streaming telemetry..." every 2 seconds

## Support

Deployment stuck? Check:
1. Is the backend running and accessible from your frontend's origin?
2. Are environment variables set correctly? (`echo $VITE_API_URL` in shell, check dashboard in Vercel/AWS)
3. Are CORS origins whitelisted? (If you see "CORS policy" error, add your domain to `ALLOWED_ORIGINS`)
4. Is the database initialized? (Backend creates schema on first run)

---

**Status**: ✅ Production-Ready. Deploy with confidence.
