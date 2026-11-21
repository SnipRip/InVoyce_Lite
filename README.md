# InVoyce Lite

Billing, payments, inventory, GST and accounts for growing businesses in
India. The lite edition of InVoyce. Domestic sales only: there are no export
invoices, shipments, LUT register or overseas parties.

| Folder      | What it is                                  | Stack                              |
| ----------- | ------------------------------------------- | ---------------------------------- |
| `frontend/` | The web app staff sign in to                | Next.js 16, React 19, Tailwind CSS |
| `backend/`  | The REST API and database access            | NestJS 12, Prisma 7, PostgreSQL 17 |

The browser only ever talks to the frontend. Requests to `/api/*` are forwarded
by Next.js to the backend, so the session cookie stays same-origin.

## What works today

- Sales: quotations, delivery challans, GST tax invoices (CGST + SGST in our
  state, IGST for other states, or a bill of supply when we charge no GST),
  credit notes, and the IRN, lorry challan and e-way bill kept on each invoice
- Payments: receipts from customers, payments to vendors, advances, refunds,
  what is owed and ageing, and the MSME 45-day rule
- Purchases: purchase orders, vendor bills with input credit and reverse
  charge, debit notes, expenses, and freight landed on item cost
- Stock: items, godowns, transfers and adjustments, drawn oldest first
- Accounts: journals, loans, trial balance, Profit & Loss, balance sheet,
  actual profit by invoice, customer and item, and reports
- Masters: customers, vendors, transporters, vehicles, HSN / SAC codes,
  company & GST setup, number series, bank & cash, ledgers
- Sign-in with lockout, user settings, signed-in devices and roles

The WhatsApp screen and parts of the Users screen still show **sample data**
(each says so on screen).

## Run it locally

Needs Node.js 24+ and Docker.

```bash
docker compose up -d
```

Backend, in `backend/`:

```bash
cp .env.example .env
```

Fill in `WEBSITE_API_KEY` (32+ random characters) and the `SEED_ADMIN_*`
values in `.env`, then:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run start:dev
```

Frontend, in `frontend/`:

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000 and sign in with the seeded administrator.

## Checks

| Where       | Command                                              |
| ----------- | ---------------------------------------------------- |
| `backend/`  | `npm run build`, `npm test`, `npm run lint`          |
| `frontend/` | `npm run build`, `npm run lint`, `npm run typecheck` |

## Folder guide

```
backend/
  prisma/            schema.prisma (data model), seed.ts (first admin)
  src/
    config/          environment variable validation
    database/        Prisma client as a NestJS service
    common/          guards, decorators and types shared by all modules
    auth/            login, sessions, password hashing and policy
    users/           the signed-in user's own profile and password
    whatsapp-optins/ consent records sent by the public website
    health/          GET /api/health

frontend/src/
  app/               routes: (auth)/login and everything under (app)/
  components/ui/     small reusable pieces: button, text field, glass card
  components/layout/ app shell, sidebar, top bar
  config/            navigation list, auth constants, security headers
  features/<name>/   everything belonging to one screen or module
  lib/               API client, formatting, server-side session lookup
  types/             shapes shared with the backend
```
