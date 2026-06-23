# Anath Shiksha Foundation — NGO Website

A complete, professional, dynamic NGO website with admin panel and Razorpay payment integration.

## Quick Start

```bash
cd anath-shiksha-foundation
npm install
cp .env.example .env       # edit with your real keys
node setup-admin.js        # creates admin account
npm start                  # starts at http://localhost:3000
```

## Default Admin Credentials
- **URL:** http://localhost:3000/admin
- **Username:** `admin`
- **Password:** `Admin@2024`
- **⚠️ Change password immediately after first login!**

## Razorpay Setup
1. Sign up at [razorpay.com](https://razorpay.com)
2. Get Test API Keys from Dashboard → Settings → API Keys
3. Add to `.env`:
   ```
   RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXX
   RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXXXX
   ```
4. The site works in **demo mode** without real keys (for testing)

## Features

### Public Website
- **Animated Hero** with particle canvas, counter animations, scroll effects
- **Running ticker** with program highlights
- **About section** with vision/mission/stats
- **4 Program cards** (Education, Meals, Mentorship, Marriage Support)
- **Impact strip** showing donation value
- **Events section** with category-colored date columns
- **Testimonials** auto-sliding carousel
- **Gallery** grid
- **Top 10 Donors Hall of Fame** with podium (Top 3) + ranked list
- **Donate form** with amount selector + Razorpay integration
- **Contact form** with social links
- **Responsive** on all devices

### Admin Panel (`/admin`)
- **Dashboard:** Total donors, total raised, event count, top donation
- **Edit Content:** Change hero, about, contact, social links — live
- **Events CRUD:** Add / edit / delete upcoming events
- **Donors table:** Full donor list with amounts and details
- **Change password** securely

## File Structure
```
anath-shiksha-foundation/
├── server.js              # Express backend
├── setup-admin.js         # One-time admin setup
├── package.json
├── .env                   # Config (edit this!)
├── data/
│   ├── content.json       # Site content (editable via admin)
│   ├── events.json        # Events data
│   ├── donors.json        # Donor records
│   └── admin.json         # Admin credentials
└── public/
    ├── index.html         # Main website
    ├── admin.html         # Admin panel
    ├── css/
    │   ├── style.css      # Main website styles
    │   └── admin.css      # Admin panel styles
    ├── js/
    │   ├── main.js        # Main website JS
    │   └── admin.js       # Admin panel JS
    └── uploads/           # Image uploads directory
```

## Customization
- All text content editable via admin panel at `/admin`
- Colors: edit CSS variables in `public/css/style.css` (`:root` block)
- Programs: edit `data/content.json` → `programs` array
- Add real images to `public/images/` and update paths in content.json
