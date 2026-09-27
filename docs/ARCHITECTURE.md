# Architecture

CGMS is a small single-deployment web application. The React client uses React Router and Axios. It sends JSON or multipart requests to an Express REST API. Express route handlers validate inputs, authenticate JWTs, enforce the user's role and record business events. Prisma maps those operations to PostgreSQL. Uploads are stored on the API host under `server/uploads` and attachment downloads pass through the API's authorization check.

```text
Browser (React/Vite)
        │ Axios + JWT
        ▼
Express REST API ── middleware (auth, validation, errors)
        │ Prisma
        ├──────────── PostgreSQL
        └──────────── Local attachment directory
```

The database and API are the source of truth for ownership and workflow. A student is scoped to their own grievances, an officer to active assignments, a department administrator to their department, and a super administrator to the whole system. Status updates are checked against a server-side transition map and saved in status history. Audit logs are written for administrative changes.

The deployment remains intentionally simple: one client, one API process, one relational database and local development uploads. For production, use TLS, managed secrets, backups and durable object storage.
