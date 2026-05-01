# LebConnect API — Postman quick test

Requires **MySQL / MariaDB** (e.g. XAMPP): create database and tables by importing `database/schema.sql`, then configure `DB_*` variables in `.env`.

**Base URL:** `http://localhost:5000`

Set an environment variable `token` from the login response (`token` field). For protected routes add header:

`Authorization: Bearer {{token}}`

---

### 1. Register candidate

`POST /api/auth/register/candidate`

Body (JSON):

```json
{
  "fullName": "Sara Haddad",
  "email": "sara@example.com",
  "password": "password123",
  "specialization": "Computer Science"
}
```

---

### 2. Register company

`POST /api/auth/register/company`

```json
{
  "companyName": "TechBeirut",
  "email": "hr@techbeirut.com",
  "password": "password123",
  "industry": "Technology",
  "location": "Beirut"
}
```

---

### 3. Login

`POST /api/auth/login`

```json
{
  "email": "admin@lebconnect.com",
  "password": "admin123"
}
```

Copy `token` from the response for the next requests.

---

### 4. Create job (company token)

`POST /api/jobs`

Headers: `Authorization: Bearer <company_token>`

```json
{
  "title": "Senior React Developer",
  "description": "Build modern UIs with React.",
  "location": "Beirut",
  "type": "Full-time",
  "salary": "$2,500 – $3,500/mo",
  "requirements": ["React", "3+ years experience"]
}
```

Note the returned job `_id` for applying.

---

### 5. Apply to job (candidate token)

`POST /api/applications`

Headers: `Authorization: Bearer <candidate_token>`

```json
{
  "jobId": "PASTE_JOB_ID_HERE"
}
```

Note the returned application `_id`.

---

### 6. Accept / reject application (company token)

`PUT /api/applications/:id/status`

```json
{
  "status": "accepted"
}
```

or `"rejected"`. The candidate receives a notification.

---

### 7. Create post (candidate or company token)

`POST /api/posts`

```json
{
  "content": "Excited to join the LebConnect community!",
  "image": ""
}
```

---

### 8. Like post

`PUT /api/posts/:postId/like`

No body. Toggles like for the current user.

---

### 9. Comment on post

`POST /api/posts/:postId/comments`

```json
{
  "text": "Great post!"
}
```

---

### 10. Get notifications (same user who should receive them)

`GET /api/notifications`

Headers: `Authorization: Bearer <candidate_token>` (after application status change).

---

### Useful public / low-auth endpoints

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/jobs/latest` | Latest active jobs (home) |
| GET | `/api/users/home/stats` | Aggregate stats |
| GET | `/api/users/companies/top` | Companies by open roles |
| GET | `/api/jobs?keyword=react&location=Beirut` | Filter jobs |

---

### Seeded admin (after first server start)

If no admin exists in the DB, one is created using `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`, or defaults:

- Email: `admin@lebconnect.com`
- Password: `admin123`
