# YES Elevate HR – Backend API

REST API for the YES Elevate staff portal and admin portal. It replaces the
frontend's `localStorage` store (`src/lib/hr-store.ts`, `admin-store.ts`,
`payslips.ts`, …) with a real database, hashed passwords, JWT sessions and
files on disk. The frontend code is untouched.

**Stack:** Node 22.13+ (works on 24 and 26), Express, TypeScript, Knex, Zod. SQLite by default, using the SQLite built into Node, so nothing needs compiling (no Visual Studio needed on Windows);
MySQL or PostgreSQL by changing two env vars.

## Quick start

```bash
cd backend
npm install
cp .env.example .env      # then set JWT_SECRET
npm run dev               # http://localhost:4000/api
```

The server migrates and seeds itself on start. Default logins:

| Role  | Login (username / email / staff ID)       | Password   |
|-------|-------------------------------------------|------------|
| Admin | `admin` / `admin@yesempire.com` / `EMP001` | `admin123` |
| Staff | `aina` / `aina@yesempire.com` / `EMP023`   | `staff123` |

Change them with `SEED_ADMIN_PASSWORD` / `SEED_STAFF_PASSWORD` before the first run.

| Script            | What it does                              |
|-------------------|-------------------------------------------|
| `npm run dev`     | Dev server with auto-reload               |
| `npm run build`   | Compile to `dist/`                         |
| `npm start`       | Run the compiled server                   |
| `npm test`        | 22 end-to-end API tests (temp database)   |
| `npm run seed`    | Migrate + seed only                       |
| `npm run db:reset`| Drop everything, migrate, seed again      |

### Using MySQL or PostgreSQL

```env
DB_CLIENT=mysql      # or pg
DATABASE_URL=mysql://root:password@localhost:3306/yeselevate
```

## How it works

- **Auth:** `POST /api/auth/login` returns `{ token, session }`. Send the token as
  `Authorization: Bearer <token>`. The user is re-checked on every request, so
  deactivating someone or removing admin rights takes effect immediately.
- **Responses:** success is `{ ok: true, ... }`, errors are
  `{ ok: false, error: "readable message", code: "SOME_CODE" }` with a proper HTTP status.
  Error messages match the ones the frontend already shows.
- **Shapes match the frontend types** in `src/lib/hr-types.ts` (`UserProfile`,
  `LeaveApplication`, `ClaimRecord`, `HrNotification`, …). `GET /api/me` returns the
  same bundle as the frontend's `HrSession`.
- **Files** (selfies, leave documents, payslips) are stored in `UPLOAD_DIR` and
  returned as URLs instead of base64. PDF/JPG/PNG only, max 5 MB, real file
  type checked by its bytes. For `<img src>` or download links, append
  `?token=<jwt>` to the file URL, since those can't send headers.
- **Business rules carried over:** clock-in after 08:15 (Malaysia time) is Late,
  one clock-in per day, Medical leave needs a document, leave balance is deducted
  on approval and restored if the decision changes, DOPE test valid 182 days with
  a 14-day reminder, password policy (8+ chars, upper, lower, number), reset links
  expire after 30 minutes and work once.
- **DOPE test** is scored on the server, so results can't be faked from the browser.
- **Notifications** use the same titles and messages as `notification-store.ts`.
  Admin notifications go to every admin with their own read state.

## API reference

All paths start with `/api`. 🔒 = needs login, 🛡️ = admin only.

### Public
| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/public/companies` | Active companies for the register form |
| GET | `/public/departments?companyId=` | Active departments |
| GET | `/public/settings` | Company name |

### Auth
| Method | Path | Body |
|---|---|---|
| POST | `/auth/login` | `{ identifier, password }` |
| POST | `/auth/register` | `{ name, username, role?, password, email?, companyId, departmentId }` |
| GET 🔒 | `/auth/me` | Session bundle |
| POST 🔒 | `/auth/change-password` | `{ currentPassword, newPassword }` |
| POST | `/auth/forgot-password` | `{ identifier }`. Outside production the response includes `resetUrl` (no email service yet) |
| GET | `/auth/reset-password/:token` | `{ valid }` |
| POST | `/auth/reset-password` | `{ token, newPassword }` |

### Staff self-service 🔒 (always scoped to the logged-in user)
| Method | Path | Notes |
|---|---|---|
| GET | `/me` | Full session bundle (profile, dope, attendance, leave, claims, evaluations, status) |
| GET | `/me/profile` | |
| GET / POST | `/me/dope` | POST `{ answers: [{questionId, optionId}], declarationsAccepted: true }` |
| GET | `/me/attendance` | `{ today, records }` |
| POST | `/me/attendance/clock-in` · `/clock-out` | `{ location, selfie: "data:image/jpeg;base64,..." }` |
| GET | `/me/attendance/:id/selfie/:in\|out` | Image |
| GET | `/me/leave` | `{ balance, applications }` |
| POST | `/me/leave` | multipart: `type, from, to, reason, attachment?` |
| DELETE | `/me/leave/:id` | Withdraw a Pending application |
| GET | `/me/leave/:id/attachment` | |
| GET / POST | `/me/claims` | POST `{ type, amount, date, desc }` |
| GET | `/me/evaluations` | |
| GET | `/me/payslips` · `/me/payslips/:id/file` | Active payslips only |

### Notifications 🔒
| Method | Path |
|---|---|
| GET | `/notifications?unread=1&category=` |
| GET | `/notifications/unread-count` |
| PATCH | `/notifications/:id/read` |
| POST | `/notifications/read-all` |
| DELETE | `/notifications/:id` |

### Admin 🛡️ (`/api/admin/...`)
| Area | Endpoints |
|---|---|
| Dashboard | `GET /dashboard` |
| Reports | `GET /reports?from=&to=` |
| Settings | `GET /settings`, `PUT /settings` `{ companyName?, defaultLeave? }` |
| Employees | `GET /employees?search=&status=&role=&companyId=&departmentId=`, `GET /employees/:username`, `PATCH /employees/:username`, `POST /employees/:username/deactivate\|reactivate` |
| Evaluations | `POST /employees/:username/evaluations`, `DELETE /evaluations/:id` |
| Leave | `GET /leave?status=&type=&username=&from=&to=&departmentId=`, `PATCH /leave/:id/status` `{ status, rejectionReason? }`, `GET /leave/:id/attachment`, `GET /leave-calendar?month=YYYY-MM&includePending=1` |
| Claims | `GET /claims?status=&type=&username=`, `PATCH /claims/:id/status` |
| Attendance | `GET /attendance?date=&status=`, `GET /attendance/records?from=&to=&username=`, `GET /attendance/employee/:username`, `GET /attendance/:id/selfie/in\|out` |
| Payslips | `GET /payslips?status=active\|removed\|all&username=&year=&month=`, `GET /payslips/employees`, `POST /payslips` (multipart `username, month, year, note?, file`), `PUT /payslips/:id/file`, `DELETE /payslips/:id`, `GET /payslips/:id/file` |
| Companies | `GET/POST /companies`, `PUT /companies/:id`, `POST /companies/:id/deactivate\|reactivate`, `DELETE /companies/:id` |
| Departments | `GET/POST /departments`, `PUT /departments/:id`, `POST /departments/:id/deactivate\|reactivate`, `DELETE /departments/:id` |
| Admin accounts | `GET/POST /admins`, `PATCH /admins/:username`, `POST /admins/:username/reset-password`, `POST /admins/:username/deactivate\|reactivate`, `POST /users/:username/role` `{ role }` |
| Audit log | `GET /audit-log?limit=` |

Safety rules: you can't deactivate yourself, the last active admin, or the parent
company; companies and departments with people in them can't be deleted.

## Use it as a phone app (PWA)

The website is an installable app: it has an icon, opens full screen and
works on Android, iPhone and laptops. Phones need an **https://** address, so
the backend also serves the built website from the same address as the API.

**1. Build the website and start everything (one command, in `backend`):**

```bash
npm run app
```

Then open http://localhost:4000 on the laptop. Everything (website + API) is
on port 4000 now; the separate `npm run dev` on 8080 is only for editing.

**2. Give phones a secure link (free, while the laptop is on):**

Install Cloudflare's tunnel tool once, in PowerShell:

```bash
winget install --id Cloudflare.cloudflared
```

Close and reopen PowerShell, then (with `npm run app` still running):

```bash
cloudflared tunnel --url http://localhost:4000
```

It prints a link like `https://something-random.trycloudflare.com`. Open it on
a phone and log in.

**3. Install on the phone:**

- **Android (Chrome):** menu (three dots) > *Add to Home screen* / *Install app*.
- **iPhone (Safari):** Share button > *Add to Home Screen*.

The link changes each time you restart `cloudflared`, and stops working when
the laptop sleeps. For a permanent address, host the backend on a server
(e.g. Railway or Render) with a persistent disk for `data/` and `uploads/`.

**Updating:** after code changes run `npm run app` again. The app checks for
a new version each time it opens. If a phone shows an old version, close the
app fully and reopen it. HR data (`/api`) is never cached on the phone.

## Hooking up the frontend

The frontend still reads `localStorage` today. To switch a module over, replace its
store call with a `fetch` to the matching endpoint, for example:

```ts
const API = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

const res = await fetch(`${API}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identifier, password }),
});
const data = await res.json();
if (!data.ok) setError(data.error);
else localStorage.setItem("token", data.token);
```

Add the frontend's URL to `CORS_ORIGIN` in `.env` (defaults cover Vite on 8080 and 5173).

## Put it online free (Render + Neon, no card)

The free setup used for YES HR: **Render** runs the app and **Neon** holds the
database, including uploaded files (`FILE_STORAGE=db`, because Render's free
plan has no permanent disk). Neither asks for a card. `render.yaml` in the
main folder pre-fills Render's settings.

Trade-offs of the free plans:
- Render's free app sleeps after 15 minutes without visitors; the next visit
  takes about a minute to wake it.
- Neon's free database is 1 GB. Records are tiny; selfies and payslips use
  most of the space.
- Health checks use `/api/ping`, which doesn't touch the database, so Neon can
  pause when idle and its free monthly hours last.

**1. Neon (database)**
1. Sign up at https://neon.com (no card). Create a project, region
   **Asia Pacific (Singapore)**.
2. On the dashboard click **Connect** and copy the connection string
   (starts with `postgresql://` and ends with `sslmode=require`). Keep it private.

**2. GitHub (Render deploys from a GitHub repository)**
1. Sign up at https://github.com (free).
2. Create a **new private repository** called `yes-hr` (leave it empty).
3. Install Git once in PowerShell: `winget install --id Git.Git -e`, then
   reopen PowerShell. In the main project folder:

```bash
git init
git add .
git commit -m "YES HR"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/yes-hr.git
git push -u origin main
```

A browser window asks you to sign in to GitHub the first time.
`.gitignore` keeps `node_modules`, `.env`, the local database and uploads out.

**3. Render (the app)**
1. Sign up at https://render.com with your GitHub account (no card).
2. **New > Blueprint**, pick the `yes-hr` repository.
3. Render reads `render.yaml` and asks for two values:
   - `DATABASE_URL`: the Neon connection string
   - `SEED_ADMIN_PASSWORD`: your admin password
4. Click **Apply**. The first build takes 5 to 10 minutes. Your link is
   `https://yes-hr-xxxx.onrender.com` (shown at the top of the service page).

**Updating later:** commit and push (`git add .`, `git commit -m "update"`,
`git push`). Render rebuilds automatically. Data in Neon is kept.

## Put it online 24/7 (Railway)

The project folder has a `Dockerfile` and `railway.json`, so Railway builds
the website and server together. Cost: Railway Hobby plan, US$5/month
(includes US$5 of usage). Run these in PowerShell from the **main project
folder** (`yeselevatesystem`, not `backend`):

```bash
npm i -g @railway/cli
railway login
railway init
railway up
```

Then in the Railway dashboard (railway.com), open the service and:

1. **Variables** tab, add:
   - `JWT_SECRET` = a long random string (e.g. 40+ random letters and numbers)
   - `SEED_ADMIN_PASSWORD` = your admin password (8+ chars, upper, lower, number)
   - `APP_TIMEZONE` = `Asia/Kuala_Lumpur`
2. **Volume**: right-click the service (or Command palette) > *Add Volume*,
   mount path **`/data`**. This keeps the database and uploads safe.
3. **Settings > Networking > Generate Domain** to get your
   `https://....up.railway.app` link.

Railway redeploys after each change. Log in with `admin` and your
`SEED_ADMIN_PASSWORD`. The demo `aina` account is not created online.

**Updating later:** after code changes, run `railway up` again from the main
folder. Data in `/data` is kept.

## Before going live

- The server refuses to start in production without a real `JWT_SECRET` and your own `SEED_ADMIN_PASSWORD`.
- The demo staff account is only created outside production (or with `SEED_DEMO_STAFF=true`).
- Plug in an email service in `POST /auth/forgot-password` (marked TODO). In production the reset link is not returned in the response.
- Back up the database and `uploads/` folder.
