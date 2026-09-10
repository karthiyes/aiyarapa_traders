# AYYARAPA TRADERS — Shop Management App

A mobile-friendly inventory and shop management web app, backed by a real Supabase
database so the same data stays in sync across your 2 phones and 1 laptop.

## What's included

- Dashboard, Products/Stock, Stock Conversion, Purchases, Sales, Customers,
  Suppliers, Expenses, Stock Adjustments, and Reports (with CSV export)
- Supabase login (email/password) — only people you create accounts for can get in
- Live sync: when stock/sales/purchases/payments/expenses change on one device,
  every other open device updates automatically (Supabase Realtime)
- All amounts shown in ₹ (Indian Rupee format)

## 1. Create your Supabase project (free tier is enough)

1. Go to https://supabase.com → sign up / log in → **New project**.
2. Pick a name (e.g. `ayyarapa-traders`), a database password (save it somewhere
   safe), and a region close to Tamil Nadu (e.g. Singapore).
3. Wait ~2 minutes for the project to finish setting up.

## 2. Create the database tables

1. In your Supabase project, open **SQL Editor** → **New query**.
2. Open the file `supabase/schema.sql` from this project, copy everything, paste
   it into the SQL editor, and click **Run**.
3. This creates all tables (products, sales, purchases, customers, suppliers,
   expenses, stock adjustments, payments), sets up automatic stock/pending-amount
   updates, and turns on Row Level Security so only logged-in users can see data.

## 3. Turn on email login and create your user(s)

1. Go to **Authentication → Providers** and make sure **Email** is enabled
   (it is by default).
2. Go to **Authentication → Users → Add user** and create a login for yourself
   (email + password). Repeat for anyone else who should have access (e.g. staff
   on the second phone).
3. You do not need "sign up" in the app — accounts are created here by you, the
   owner, which keeps the shop data private.

## 4. Connect the app to your Supabase project

1. In Supabase, go to **Settings → API**. Copy the **Project URL** and the
   **anon public** key.
2. In this project folder, copy `.env.example` to a new file named `.env`:
   ```
   cp .env.example .env
   ```
3. Open `.env` and paste your values:
   ```
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
   The anon key is safe to use in a browser app — Row Level Security (set up in
   step 2) is what actually protects your data, not the secrecy of this key.

## 5. Run it locally to test

```
npm install
npm run dev
```

Open the printed local address (usually `http://localhost:5173`) and log in with
the user you created in step 3.

## 6. Put it online so your phones and laptop can all reach it

The easiest free option is **Vercel** or **Netlify**:

1. Push this project folder to a GitHub repository.
2. On vercel.com (or netlify.com), click **New project**, import the repo.
3. When asked for environment variables, add the same two from your `.env` file
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
4. Deploy. You'll get a URL like `https://ayyarapa-traders.vercel.app`.
5. Open that URL on both phones and the laptop, log in on each, and add it to
   your phone's home screen (Share → Add to Home Screen) so it feels like an app.

Because all data lives in Supabase (not on any one device), every device shows
the same live numbers — add a sale on one phone and the laptop's dashboard
updates within a second or two, automatically.

## Notes on how the numbers work

- **Stock is always stored in KG internally.** When you record a purchase, sale,
  or stock adjustment in Pack or Ton, the app converts it using the conversion
  rates you set per product (in Products → Edit → "1 Pack = ? KG" and
  "1 Ton = ? KG"). This is what the Stock Conversion page's rates are used for.
- **Pending amounts update automatically.** Sales and purchases record what was
  paid at the time; the Customers/Suppliers detail pages let you collect or pay
  the remaining balance later, which reduces the pending amount live.
- **Profit estimate** in Reports is revenue minus (quantity sold × current
  buying price of that product) — a running estimate, not a full accounting
  P&L, since buying prices can change over time.
- **Deleting a product** hides it (keeps your sales/purchase history intact)
  rather than permanently erasing it.

## Project structure

```
supabase/schema.sql   → run once in Supabase SQL Editor
src/pages/            → one file per screen
src/components/       → shared buttons, inputs, cards, layout/nav
src/lib/               → currency formatting, unit conversion, CSV export
```
