# College Grievance Management System (CGMS)

CGMS is a college project for submitting, routing and tracking student grievances. It uses a React/Vite client, an Express REST API and PostgreSQL accessed through Prisma. The API owns authorization and validates status transitions; students only see their own records, officers see assigned records, and department administrators see their department.

## Features

- Student registration, sign-in, profile editing, grievance submission and reference number, attachments, search/filter, timeline, comments, notifications, reopen and feedback.
- Officer assigned-work queue and status/remarks/resolution actions.
- Department administrator and super administrator dashboards, assignment API, staff/category/department administration, reports and audit logs.
- Password hashing, JWT authentication, Zod input validation, role checks, protected downloads, rate limiting, Helmet and CORS.
- Responsive landing page and role-aware workspace. PostgreSQL persistence with a relational Prisma schema.

## Requirements and PostgreSQL setup

Install Node.js 20 or later and PostgreSQL 14 or later. Create a PostgreSQL database named `cgms` (for example, with `createdb cgms` or pgAdmin). Ensure the PostgreSQL service is running and note the local database username/password. This workspace does not include PostgreSQL itself.

Copy `server/.env.example` to `server/.env`, set `DATABASE_URL` for your local database and replace `JWT_SECRET` with a long random value. `PORT` defaults to 4000 and `CLIENT_URL` defaults to `http://localhost:5173`. Copy `client/.env.example` to `client/.env` only when your API has a different URL. Do not commit environment files.

Email is optional in development. To enable SMTP delivery, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `MAIL_FROM` in `server/.env`. The example file contains placeholders only. For Gmail, use `smtp.gmail.com`, port `587`, secure `false`, your sender email, and a Google App Password (not your normal Gmail password). Keep these settings server-side. When SMTP is not configured, CGMS logs `SMTP not configured; email skipped.` and continues with the grievance operation and in-app notifications. A Super Admin can check safe SMTP status via `GET /api/email/diagnostics`; it reports configuration booleans and connection state but never credentials.

CGMS sends email on student submission to all active Super Admin accounts, on staff assignment to assigned staff and responsible department administrators, and when a grievance transitions into `RESOLVED` to its student. Email links use `CLIENT_URL` and require sign-in; API role and grievance ownership checks still apply. SMTP delivery itself requires working provider credentials and can be verified from the authorized diagnostics endpoint.

The active routing departments seeded for new installations are `CSE`, `IT`, `CSBS`, `EEE`, `ECE`, `AGRI`, `MBA`, and `AIDS`. Seeding no longer creates or changes demo user accounts. To create an initial Super Admin on a new database, optionally set `SEED_SUPER_ADMIN_EMAIL`, `SEED_SUPER_ADMIN_PASSWORD`, and `SEED_SUPER_ADMIN_NAME` in your private `server/.env` before seeding. It creates that account only if the email does not already exist and never resets its password.

Example local URL (replace the placeholder password):

```env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/cgms?schema=public"
JWT_SECRET="a-long-random-secret-of-your-own"
PORT=4000
CLIENT_URL="http://localhost:5173"
```

## Install and run

From the project root:

```bash
npm install
npm install --prefix server
npm install --prefix client
npm run db:generate
npm run db:migrate --prefix server
npm run db:seed
npm run dev
```

For an existing installation, apply checked-in additive migrations with `npm exec --prefix server prisma migrate deploy`. Never use `prisma migrate reset` on a database containing project data.

The root dev command starts the API and Vite client together. Alternatively use `npm run dev --prefix server` and `npm run dev --prefix client` in separate terminals. API health is at `http://localhost:4000/api/health`; frontend at `http://localhost:5173`.

If PostgreSQL is unavailable, install/start PostgreSQL, create `cgms`, configure `server/.env`, then run generate, migrate and seed. Prisma schema validation and frontend build can run without a live database; database workflows cannot.

Public registration only creates student accounts. Super Admins create Officer, Department Admin, and Student accounts; Department Admins can create Officers and Students within their own department. Account setup emails are sent to the new user's database email when SMTP is configured; otherwise the account is created and the administrator is informed that email was skipped. Users can change their own password from their profile, and authorized administrators can reset managed accounts' passwords. Super Admins cannot create another Super Admin through normal user management.

## Project structure

```text
client/                 React/Vite application
  src/components/       Shared interface components
  src/context/          AuthContext
  src/layouts/          Role-aware workspace shell
  src/pages/            Landing, auth, dashboard and feature pages
  src/routes/           Protected route handling
  src/services/         Axios API client
server/                 Express application
  prisma/               PostgreSQL schema and development seed
  src/config/           Prisma client
  src/middleware/       Authentication, role checks and errors
  src/routes/           REST route/controllers
  src/services/         Audit and notification helpers
docs/                   Architecture, schema, API and report notes
```

## API overview

All API paths start with `/api`. Authentication: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`. Users: `GET /users`, `POST /users`, `PATCH /users/:id`, `PATCH /users/:id/password`, `PATCH /users/me`, `PATCH /users/me/password`. Departments/categories: `GET`, `POST`, `PATCH /departments` and `/categories`. Grievances: `GET/POST /grievances`, `GET /grievances/:id`, `PATCH /grievances/:id/status`, `POST /grievances/:id/assign`, `/comments`, `/reopen`, `/feedback`, `GET /grievances/:id/history`. Attachments: `GET /attachments/:id`. Notifications: `GET /notifications`, `PATCH /notifications/:id/read`. Dashboards/reports: `GET /dashboard`, `/reports/summary`, `/reports/status`, `/reports/category`, `/reports/department`. Audit: `GET /audit-logs`. Send JWT as `Authorization: Bearer <token>`.

Student grievance creation requires a `departmentId` from the active department list. Super Admin assignment accepts a department and optional `departmentAdminId` and `officerId`; a selected user must be active and assigned to that department. Reports support weekly, monthly, and yearly periods. Officers see only currently assigned grievances, Department Admins see only their department, and Super Admins can filter system-wide data by department. Report CSV exports inherit the same API-enforced scope and filters.

## Checks

The client build and Prisma schema validation should be run after installing dependencies. Live API/database workflows require configured PostgreSQL. No test suite is currently included.
