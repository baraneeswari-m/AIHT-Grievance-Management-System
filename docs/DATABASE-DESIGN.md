# Database design

Prisma schema: `server/prisma/schema.prisma`. IDs use Prisma-generated string identifiers; business grievance numbers are separately unique (`GRV-year-sequence`).

| Model | Purpose and relationships |
|---|---|
| User | Account, hashed password, role and optional department. Student ID and email are unique. |
| GrievanceCounter | Atomic per-year counter used to allocate non-colliding grievance reference numbers. |
| Department | Organization unit; users and grievances can belong to it. |
| GrievanceCategory | Managed category for student submissions. |
| Grievance | Student-owned case with unique reference, category, optional department, priority, current status and resolution. |
| GrievanceAttachment | Safe metadata for locally stored files, linked to a grievance. |
| GrievanceAssignment | Assignment history with optional Officer and Department Admin links. The active row represents current staff assignments; the grievance department can also be routed independently. |
| GrievanceStatusHistory | Append-only workflow events with old/new status, actor, note and timestamp. |
| GrievanceComment | Authored remarks; internal comments are hidden from students. |
| Notification | User-scoped read/unread update, optionally linked to a grievance. |
| Feedback | One feedback record per grievance, with rating and optional comment. |
| AuditLog | Administrative action, actor and related entity metadata. |

Foreign keys preserve relationship integrity. Unique constraints protect emails, optional student IDs, department/category names, grievance references and one-feedback-per-case. Indexes support role/department lookup, assignment scope, grievance status/priority, student history, chronological timelines and notification inboxes. Migration `20260926190000_department_admin_assignment` adds the Department Admin assignment relation and makes the officer link optional without changing existing officer assignment rows. `Grievance.departmentId` already existed and remains nullable for old rows; new submissions validate and store an active department.
