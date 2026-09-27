# Project report notes

## Introduction

The College Grievance Management System (CGMS) provides a web portal for students to submit concerns and follow their handling through a defined workflow.

## Problem statement

When grievance intake and progress updates rely on scattered or manual communication, students can have difficulty finding the current owner, status and resolution history of a concern. Staff also need a consistent record for assignment and follow-up.

## Objectives

- Provide a student-facing grievance submission and tracking flow.
- Route cases to a department and responsible officer.
- Record remarks and status events in a timeline.
- Enforce role-based access to private grievance data.
- Provide administrative summaries and audit records.

## Existing system

The project addresses the common limitations of informal paper, email or verbal intake: limited centralized tracking and inconsistent visibility. This is a project motivation, not a claim about any specific college's current process.

## Proposed system

CGMS is a browser-based client connected to an Express REST API and PostgreSQL. Users authenticate with JWT; passwords are hashed. Prisma models account, department, category, grievance, assignment, timeline, comment, notification, feedback and audit data.

## Functional requirements

Student registration/login, profile editing, grievance submission with attachments, scoped search, detail/timeline, remarks, notifications, eligible reopening and feedback. Officers view assigned cases and advance permitted workflow statuses. Department administrators assign work and review department reports. Super administrators manage users, departments and categories and review system-wide data and audit logs.

## Non-functional requirements

Role and ownership checks are enforced by the API. Inputs are validated; uploaded file extensions/types and sizes are restricted. The UI is responsive and API errors are centralized. PostgreSQL provides persistent relational storage.

## Modules

Authentication and access control; grievance intake and file attachments; assignment and status workflow; comments and timeline; notification inbox; student feedback; administration; reporting and audit.

## Technology used

JavaScript, React, Vite, React Router, Axios, Tailwind CSS, Node.js, Express, PostgreSQL, Prisma, JWT, bcrypt, Zod, Multer, Helmet and express-rate-limit.

## Database overview

See [DATABASE-DESIGN.md](DATABASE-DESIGN.md). Relational foreign keys and unique constraints connect accounts, departments, categories and grievance events.

## System architecture

See [ARCHITECTURE.md](ARCHITECTURE.md). A browser client calls a single Express API, which authorizes each request and uses Prisma to read/write PostgreSQL. Attachments are stored locally for this academic implementation.

## Future enhancements

Email/SMS notifications, configurable departmental routing, pagination, richer charting, configurable service targets, deployment automation, automated integration tests, durable object storage and accessibility/usability evaluation with student participants.
