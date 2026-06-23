# 🚀 How to Publish Anath Shiksha Foundation Website — FREE

## Best Free Option: Render.com
- ✅ Free Node.js hosting
- ✅ Automatic HTTPS (https://yoursite.onrender.com)
- ✅ Free custom subdomain
- ✅ Auto-deploys when you push to GitHub
- ✅ No credit card required

---

## STEP 1 — Push code to GitHub (free)

1. Go to https://github.com and sign up (free)
2. Click **"New repository"** → Name it `anath-shiksha-foundation` → **Create**
3. Copy the repo URL (looks like: `https://github.com/YOURNAME/anath-shiksha-foundation.git`)
4. Run these commands in Terminal:

```bash
cd /Users/I771045/anath-shiksha-foundation
git remote add origin https://github.com/YOURNAME/anath-shiksha-foundation.git
git push -u origin main
```

---

## STEP 2 — Deploy on Render.com (free)

1. Go to https://render.com → Sign up with GitHub
2. Click **"New +"** → **"Web Service"**
3. Click **"Connect"** next to your `anath-shiksha-foundation` repo
4. Fill in these settings:

| Field | Value |
|---|---|
| **Name** | anath-shiksha-foundation |
| **Region** | Singapore (closest to India) |
| **Branch** | main |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |
| **Plan** | **Free** |

5. Click **"Add Environment Variable"** and add:

| Key | Value |
|---|---|
| `NODE_ENV` | production |
| `JWT_SECRET` | (any long random string, e.g. `ASF_2024_XYZ_secret_key`) |
| `RAZORPAY_KEY_ID` | your Razorpay key |
| `RAZORPAY_KEY_SECRET` | your Razorpay secret |
| `UPI_ID` | your UPI ID |
| `EMAIL_USER` | your Gmail address |
| `EMAIL_PASS` | your Gmail App Password |

6. Click **"Create Web Service"**
7. Wait ~3 minutes for deploy
8. Your site is live at: **https://anath-shiksha-foundation.onrender.com**

---

## STEP 3 (Optional) — Get a FREE custom domain

### Option A: Free .in domain via Freenom (limited)
- https://www.freenom.com → search `anathshiksha`

### Option B: Buy cheap domain (~₹500/year)
- https://www.namecheap.com or https://domains.google.com
- Search: `anathshiksha.org` or `anathshiksha.in`
- In Render dashboard → Settings → Custom Domain → add your domain

---

## ⚠️ Important Notes for Free Plan

| Limitation | Impact |
|---|---|
| **Spins down after 15 min inactivity** | First visitor waits ~30 sec to wake up |
| **512 MB RAM** | Fine for this site |
| **Uploads reset on redeploy** | Gallery photos are lost on new deploy (see below) |

### Fix for uploaded photos (gallery, donor photos):
Free Render doesn't have persistent storage. To keep uploads:
1. Sign up free at https://cloudinary.com (free 25GB)
2. OR keep the site on paid plan (₹700/month)
3. OR use Render's free disk (750 hours/month) — it IS persistent between restarts

---

## STEP 4 — Keep site awake (free trick)

Use https://uptimerobot.com (free) to ping your site every 14 minutes:
1. Sign up → Add Monitor → HTTP(s)
2. URL: `https://anath-shiksha-foundation.onrender.com`
3. Interval: 14 minutes
→ Site stays awake 24/7!

---

## Quick Reference After Deploy

| URL | Purpose |
|---|---|
| `https://yoursite.onrender.com` | Public website |
| `https://yoursite.onrender.com/admin` | Admin panel |
| Admin login | username: `admin` password: `Admin@2024` |

**Change password immediately after first login → Admin → Settings → Change Password**
