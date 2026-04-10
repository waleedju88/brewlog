# BrewLog ☕

A elegant PWA coffee tracker with accounts, lifetime cup budget countdown, full history with timestamps, streaks, and badges.
Built with React + Vite + Supabase, deployed on GitHub Pages.

---

## What the app does

- **Lifetime cup budget** — set a total number of cups (e.g. 50). Every cup you log counts down from that number
- **Timestamped logs** — every cup is recorded with the exact date and time
- **Today's log** — see all cups you drank today with their times on the home screen
- **History** — browse every cup ever logged, grouped by day, expandable to show exact times
- **Stats** — total cups, days tracked, average per day, peak drinking hour, current & longest streaks
- **Badges** — 9 unlockable badges based on your progress
- **New budget** — when you reach 0, set a fresh budget and start over
- **PWA** — installable on iPhone/Android via "Add to Home Screen"

---

## Setup from scratch (A to Z)

### Step 1 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up
2. Click **New project**
3. Name it `brewlog`, set a database password, choose a region
4. Wait ~1 minute for it to provision

### Step 2 — Run the database schema

1. In Supabase → **SQL Editor** → **New query**
2. Open `schema.sql` from this project, copy everything inside
3. Paste into the editor and click **Run**
4. Click **Run this query** if a warning appears (it's safe)

### Step 3 — Copy your Supabase keys

1. Supabase → **Project Settings** → **API**
2. Copy and save:
   - **Project URL** — `https://xxxx.supabase.co`
   - **anon public key** — long string starting with `eyJ…`

### Step 4 — Create a GitHub repository

1. Go to [github.com](https://github.com) and sign in
2. Click **+** → **New repository**
3. Name: `brewlog` — set to **Public**
4. Click **Create repository**

### Step 5 — Add Supabase keys as GitHub Secrets

1. Repo → **Settings** → **Secrets and variables** → **Actions**
2. Add two secrets:
   - `VITE_SUPABASE_URL` → your Project URL
   - `VITE_SUPABASE_ANON_KEY` → your anon key

### Step 6 — Set workflow permissions

1. Repo → **Settings** → **Actions** → **General**
2. Scroll to **Workflow permissions**
3. Select **Read and write permissions**
4. Click **Save**

### Step 7 — Upload project files

1. Extract the zip — you'll see a `brewlog` folder
2. In your GitHub repo → **Add file** → **Upload files**
3. Select all files and folders inside the `brewlog` folder and upload them
4. Commit the changes

### Step 8 — Create the deploy workflow

1. In your repo → **Add file** → **Create new file**
2. Type the filename: `.github/workflows/deploy.yml`
3. Paste the following:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm install

      - name: Build
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

4. Click **Commit changes**

### Step 9 — Wait for the build

1. Click the **Actions** tab
2. Wait for the workflow to show a green ✓ (~1–2 minutes)
3. If it fails, check the logs for the error

### Step 10 — Enable GitHub Pages

1. Repo → **Settings** → **Pages**
2. Under **Source** → **Deploy from a branch**
3. Branch: `gh-pages` / folder: `/ (root)`
4. Click **Save**

Your app will be live at: `https://YOUR-USERNAME.github.io/brewlog/`

### Step 11 — Allow your URL in Supabase Auth

1. Supabase → **Authentication** → **URL Configuration**
2. Set **Site URL** to `https://YOUR-USERNAME.github.io/brewlog/`
3. Add the same URL under **Redirect URLs**
4. Click **Save**

---

## Updating files on GitHub (easiest method from iPad/browser)

For each file you want to update:

1. Navigate to the file in your repo
2. Click the **pencil icon ✏️** (top right of the file view)
3. Select all, delete, paste the new content
4. Click **Commit changes**

---

## Install as PWA on iPhone

1. Open `https://YOUR-USERNAME.github.io/brewlog/` in Safari
2. Tap the **Share** button → **Add to Home Screen**
3. Tap **Add** — the BrewLog icon will appear on your home screen

---

## Project structure

```
brewlog/
├── public/
│   ├── favicon.svg           # Browser tab icon
│   ├── pwa-192.png           # PWA icon (small)
│   ├── pwa-512.png           # PWA icon (large)
│   └── apple-touch-icon.png  # iPhone home screen icon
├── src/
│   ├── components/
│   │   ├── Layout.jsx        # Bottom nav with SVG icons
│   │   └── Layout.module.css
│   ├── lib/
│   │   └── supabase.js       # Supabase client
│   ├── pages/
│   │   ├── AuthPage          # Sign in / Create account
│   │   ├── TrackerPage       # Main countdown screen
│   │   ├── HistoryPage       # All cups grouped by day
│   │   ├── StatsPage         # Stats + badges
│   │   └── SettingsPage      # Budget + sign out
│   ├── App.jsx               # Routing + auth state
│   ├── main.jsx              # Entry point
│   └── index.css             # Global styles + CSS variables
├── index.html
├── vite.config.js            # Vite + PWA config
├── package.json
└── schema.sql                # Supabase database setup
```

---

## Database schema (Supabase)

**`profiles`** — one row per user
| Column | Type | Description |
|---|---|---|
| id | uuid | References auth.users |
| cup_budget | integer | User's total cup budget |
| created_at | timestamptz | Account creation time |

**`cup_logs`** — one row per cup logged
| Column | Type | Description |
|---|---|---|
| id | uuid | Unique ID |
| user_id | uuid | References auth.users |
| logged_at | timestamptz | Exact date & time of the cup |

---

## Tech stack

- **React 18** + **Vite 5**
- **Supabase** — Auth + PostgreSQL database
- **React Router v6** — client-side routing
- **vite-plugin-pwa** — PWA manifest + service worker
- **GitHub Pages** — free hosting via gh-pages branch
- **GitHub Actions** — automatic build + deploy on push
