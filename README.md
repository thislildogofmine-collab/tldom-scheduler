# 🐾 TLDOM Scheduler

Scheduling engine for This Lil Dog of Mine pet care company.

## Features
- CSV import from Time To Pet (schedule + time off)
- Geo-matching by zip code (15-mile radius)
- 3-tier staffing: Regular → PRN → Escalate
- One-tap Telegram outreach to PRN team
- Marketing task fill for open windows

## Deploy
Hosted on Vercel. Push to GitHub main branch to auto-deploy.

## Update PRN Telegram handles
Edit `src/App.jsx` → `PRN_ROSTER` array at the top of the file.
