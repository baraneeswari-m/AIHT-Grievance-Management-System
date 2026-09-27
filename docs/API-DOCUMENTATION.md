# API documentation

Base URL: `http://localhost:4000/api`. Protected endpoints require `Authorization: Bearer <JWT>`. JSON is used except grievance submission, which accepts multipart form data with up to four `attachments` files. Errors return `{ "error": "..." }`; validation errors may include field details.

| Method | Path | Access |
|---|---|---|
| GET | `/health` | Public |
| POST | `/auth/register` | Public student registration |
| POST | `/auth/login` | Public |
| POST | `/auth/logout` | Signed-in |
| GET | `/auth/me` | Signed-in |
| GET | `/departments`, `/categories` | Signed-in/public list |
| POST/PATCH | `/departments`, `/departments/:id` | Super Admin |
| POST/PATCH | `/categories`, `/categories/:id` | Super Admin |
| GET/POST | `/users` | Super Admin |
| PATCH | `/users/:id` | Super Admin |
| PATCH | `/users/me` | Signed-in self-profile |
| GET/POST | `/grievances` | Signed-in list; Student create (requires active `categoryId` and `departmentId`) |
| GET | `/grievances/:id` | Owner, assigned officer, department admin or Super Admin |
| PATCH | `/grievances/:id/status` | Authorized staff, valid transitions only |
| POST | `/grievances/:id/assign` | Department Admin or Super Admin; accepts `departmentId`, optional `departmentAdminId`, optional `officerId` |
| POST | `/grievances/:id/comments` | Authorized grievance participants |
| POST | `/grievances/:id/reopen` | Owning student, resolved/closed cases |
| POST | `/grievances/:id/feedback` | Owning student, resolved/closed cases |
| GET | `/grievances/:id/history` | Authorized grievance participants |
| GET | `/attachments/:id` | Authorized grievance participants |
| GET/PATCH | `/notifications`, `/notifications/:id/read` | Own inbox |
| GET | `/dashboard` | Signed-in role-scoped summary |
| GET | `/reports/summary`, `/reports/status`, `/reports/category`, `/reports/department` | Officer, Department Admin or Super Admin; server applies role scope |
| GET | `/email/diagnostics` | Super Admin; safe SMTP connection status only |
| GET | `/audit-logs` | Super Admin |

Status API payload example: `{ "status": "IN_PROGRESS", "note": "Review started" }`. Resolution requires `resolutionDetails`. Assignment payload example: `{ "departmentId": "...", "departmentAdminId": "...", "officerId": "..." }`; department-only, officer-only, Department Admin-only, and combined assignments are supported. Selected users must be active and belong to the selected department. Feedback payload: `{ "rating": 5, "comment": "..." }`.

Reports accept optional query filters: `period=weekly|monthly|yearly`, `year`, `month` (1–12), `date` (week anchor as `YYYY-MM-DD`), `departmentId`, `status`, `categoryId`, and `priority`. Department Admin reports always use their own department; Officer reports always require an active assignment; only Super Admin can use `departmentId`. The summary response contains status/category/department/priority totals, time buckets, summary metrics, and up to 5,000 scoped rows for CSV export. Student report requests are rejected.

Login requires the selected account role in addition to email and password. The API checks the selected role against the user record before issuing a JWT. The public registration route only creates Students.
