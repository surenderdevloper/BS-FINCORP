# BS FINCORP — Loan Management System

A cloud-ready, mobile-first loan management web app for the BS FINCORP microfinance
business. Built with **Next.js 16 (App Router)**, **React 19**, **TypeScript**,
**Tailwind CSS v4**, and **MongoDB (Mongoose)**.

## Features delivered (Milestone 1)

- **Auth** — JWT session (httpOnly cookie) login/logout, route protection via Next.js Proxy.
- **Dashboard** — 9 live metric cards (customers, loans, pending/overdue EMIs, collections,
  disbursed, pending amount) plus **Overdue EMIs** (with days-late + computed penalty) and
  **Today's Collections** tables.
- **New Loan** — multi-section form (Customer / Vehicle / Financial / Guarantor), existing-customer
  search, live **EMI Calculator** (flat or reducing-balance), EMI day scheduling, automatic
  loan-number generation, and transactional-ish creation of customer + loan + EMI schedule.
- **Core calculations** — flat / reducing-balance EMI, per-day late-fee penalty engine with
  configurable grace days, and penalty cap.

Later milestones (sidebar already includes stubs): All Customers + Excel export, Edit Customer,
EMI Pay (receipts), Close Loan, NOC Reprint, Reports, and Settings (company + penalty rules).

## Getting started

### Quick demo (zero setup — in-memory MongoDB)

```bash
npm install
npm run demo
# → http://localhost:3010   (login: admin@bsfincorp.com / admin123)
```

`npm run demo` boots an ephemeral MongoDB (via `mongodb-memory-server`), seeds sample data,
and starts the dev server. Data is lost on exit.

### Real MongoDB (Atlas or local)

1. Copy `.env.example` to `.env` and set `MONGODB_URI` (e.g. the Atlas connection string) and a
   strong random `AUTH_SECRET`.
2. Seed the database:
   ```bash
   npm run seed
   ```
3. Run the app:
   ```bash
   npm run dev
   ```

Login: `admin@bsfincorp.com` / `admin123` (overridable via `SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD`).

> Mongo Atlas free tiers (M0/M2/M5) do not support multi-document transactions, so writes use
> manual compensation rollback. Upgrade to a dedicated cluster for stronger atomicity.

## Project structure

```
src/
  app/                    Routes (App Router)
    (app)/                Authenticated area: shell layout + pages
    api/                  Route handlers (auth, customers, loans)
    login/                Login page
  components/             UI: app-shell, sidebar, topbar, loan-form, primitives
  lib/                    db, auth, emi/penalty math, dashboard queries, validators
  models/                 Mongoose schemas: Customer, Loan, Emi, Payment, User, settings
  proxy.ts                Auth guard (Next 16 middleware replacement)
scripts/
  seed.ts                 Resets DB and seeds demo data
  dev-demo.mjs            In-memory MongoDB + seed + dev server
```

## Commands

| Command                | Purpose                                  |
| ---------------------- | ---------------------------------------- |
| `npm run dev`          | Start the dev server (your Mongo needed) |
| `npm run demo`         | Self-contained demo (in-memory Mongo)    |
| `npm run seed`         | Reset + seed the database                |
| `npm run build`        | Production build                         |
| `npm run lint`         | ESLint                                   |
| `npm run typecheck`    | TypeScript checks                        |