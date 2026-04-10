# BrewLog ☕

A PWA coffee tracker with accounts, history, streaks, and badges.
Built with React + Vite + Supabase, deployable to GitHub Pages.

---

## Step 1 — Create a Supabase project

1. Go to https://supabase.com and sign in
2. Click **New project**
3. Give it a name (e.g. `brewlog`), set a database password, choose a region
4. Wait ~1 min for it to provision

---

## Step 2 — Run the database schema

1. In your Supabase project, go to **SQL Editor** → **New query**
2. Open the file `schema.sql` from this project
3. Copy the entire contents and paste into the editor
4. Click **Run**

You should see: `profiles` and `coffee_logs` tables created, with RLS policies.

---

## Step 3 — Get your Supabase keys

1. Go to **Project Settings** → **API**
2. Copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon public** key (long string under "Project API keys")

---

## Step 4 — Create a GitHub repository

1. Go to https://github.com and create a new **public** repository named `brewlog`
2. Do NOT initialize with a README (you'll upload files manually)

---

## Step 5 — Add your environment variables as GitHub Secrets

1. In your GitHub repo, go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** and add:
   - Name: `VITE_SUPABASE_URL` → Value: your Project URL
   - Name: `VITE_SUPABASE_ANON_KEY` → Value: your anon key

---

## Step 6 — Add the GitHub Actions deploy workflow

Create this file in your repo at the path: `.github/workflows/deploy.yml`

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

---

## Step 7 — Upload all project files to GitHub

Upload these files/folders to your repo via the GitHub web interface
(drag and drop into the repo file browser):

```
index.html
package.json
vite.config.js
schema.sql
src/
  main.jsx
  App.jsx
  index.css
  lib/
    supabase.js
  pages/
    AuthPage.jsx
    AuthPage.module.css
    TrackerPage.jsx
    TrackerPage.module.css
    HistoryPage.jsx
    HistoryPage.module.css
    StatsPage.jsx
    StatsPage.module.css
    SettingsPage.jsx
    SettingsPage.module.css
  components/
    Layout.jsx
    Layout.module.css
```

Once pushed to `main`, GitHub Actions will build and deploy automatically.

---

## Step 8 — Enable GitHub Pages

1. Go to repo **Settings** → **Pages**
2. Under **Source**, select **Deploy from a branch**
3. Branch: `gh-pages` / folder: `/ (root)`
4. Click **Save**

Your app will be live at:
`https://YOUR-USERNAME.github.io/brewlog/`

---

## Step 9 — Allow your GitHub Pages URL in Supabase Auth

1. In Supabase → **Authentication** → **URL Configuration**
2. Add to **Redirect URLs**:
   `https://YOUR-USERNAME.github.io/brewlog/`
3. Set **Site URL** to the same

---

## Features

- ☕ Today's cup countdown with visual cup grid
- ↩ Undo last cup
- 📅 60-day history log
- 📊 Stats: total cups, avg/day, current & longest streak
- 🏆 9 unlockable badges
- ⚙️ Per-account daily limit saved to Supabase
- 🔐 Email + password auth
- 📱 Installable PWA (Add to Home Screen)
