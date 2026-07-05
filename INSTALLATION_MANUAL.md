# 🚀 ChatCorner System - Installation Manual

Welcome! This manual will guide you through setting up the complete infrastructure for your new ChatCorner system, including the database, frontend website, backend proxy, and the Android APK.

## 📋 Prerequisites
- A free account on [Supabase](https://supabase.com/) (Database & Authentication)
- A free account on [Cloudflare](https://cloudflare.com/) (Website & Proxy Hosting)
- A code editor like [VS Code](https://code.visualstudio.com/)
- [Node.js](https://nodejs.org/) installed (for deploying to Cloudflare)

---

## 1. Database Setup (Supabase)

ChatCorner relies on Supabase for real-time messages, user accounts, and data storage.

1. **Create a Project:** Go to Supabase and create a new project. Save your `Project URL` and `anon public API key` (found in Project Settings -> API).
2. **Initialize the Database:** Go to the **SQL Editor** in your Supabase dashboard. Open the SQL files included in this package and run them in this specific order:
    1. `schema.sql`
    2. `schema-updates.sql`
    3. `cowatch-migration.sql`
3. **Configure Authentication:** Go to **Authentication -> Providers** and enable **Email** (you can disable "Confirm email" for easier onboarding).
4. **Add Initial Admin Settings:** Go to the **Table Editor**, open the `app_settings` table, and add a new row:
    - `key`: `proxy_base_url`
    - `value`: `https://YOUR_CLOUDFLARE_PAGES_DOMAIN.pages.dev` *(You will get this in Phase 3)*

---

## 2. Connecting the Code & Environment Variables

You need to connect the frontend and backend files to your new Supabase project.

1. **Frontend Connection:** Open `js/chat-v3.js` in your code editor. Search for the Supabase configuration near the top of the file. Replace the `SUPABASE_URL` and `SUPABASE_ANON_KEY` with the credentials you saved in Phase 1. Do the same in `js/auth.js` and `admin.html`.
2. **Backend/Proxy Connection (.env):** 
    - Open the `.env.example` file included in the root folder.
    - Rename it to `.env`.
    - Paste your Supabase URL and Key inside. This allows the local server and Cloudflare Edge functions to read the database securely.

---

## 3. Web & Proxy Deployment (Cloudflare Pages)

ChatCorner uses Cloudflare Pages to host the website and run the built-in Proxy that bypasses iframe restrictions.

1. **Install Wrangler:** Open your terminal and run: `npm install -g wrangler`
2. **Login to Cloudflare:** Run `wrangler login` in your terminal and authorize via the browser.
3. **Deploy the Project:** Open your terminal in the ChatCorner project folder and run:
    `npx wrangler pages deploy .`
    Select "Create a new project" and name it. Wrangler will upload your files and give you a live URL.
4. **Update the Proxy Setting:** Take the URL Cloudflare just gave you and put it into your Supabase `app_settings` table (under `proxy_base_url`) from Phase 1.

---

## 4. Android App Integration

Included in your package is the `chatcorner-updated.apk` which serves as the Android wrapper for the web system.

1. **Setup Capacitor:** The project uses [Capacitor](https://capacitorjs.com/). You will need Android Studio installed.
2. **Update Domain:** Modify `capacitor.config.json` to point to your new Cloudflare domain or update the assets in the `www` folder.
3. **Build APK:** Run `npx cap sync android`, then open the `android` folder in Android Studio and click **Build -> Build Bundle(s) / APK(s) -> Build APK(s)**.

---

## 5. Admin Dashboard Access

1. Once your site is live, register a normal account via `login.html`.
2. Go to your Supabase **Table Editor**, open the `profiles` table.
3. Find your user row and change your `role` to `admin` or `owner`.
4. You can now log into `admin.html` or `mypanel.html` on your live site to manage users and oversee the system!

🎉 **Success! You're all set!**
