# Job Board API

A RESTful backend API for a job board platform built with Node.js, Express, and PostgreSQL. Supports two user roles — **employers** who post jobs and **job seekers** who apply with tailored CVs.

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express
- **Database:** PostgreSQL (via `pg`)
- **Authentication:** JWT (jsonwebtoken)
- **Password Hashing:** bcryptjs
- **Email:** Nodemailer + Gmail
- **Environment Variables:** dotenv

## Features

- Role-based registration (employer / seeker)
- JWT-protected routes with role authorization
- Full password reset flow via real email
- Job posting with filtering and pagination
- CV creation with a 3-CV limit per seeker
- Job applications linking seeker + CV to a job
- Ownership checks on edit/delete operations

## Project Structure

```
board/
└── backend/
    ├── db/
    │   └── index.js         # PostgreSQL connection pool
    ├── middleware/
    │   └── auth.js          # authenticate + authorizeRole middleware
    ├── routes/
    │   ├── auth.js          # Auth routes
    │   └── jobs.js          # Jobs, applications, and CV routes
    ├── .env                 # Environment variables (not committed)
    ├── package.json
    └── server.js
```

## Getting Started

### Prerequisites

- Node.js
- PostgreSQL

### Installation

```bash
git clone https://github.com/Xylem56/Jobs-board-api.git
cd Jobs-board-api/backend
npm install
```

### Environment Variables

Create a `.env` file in the `backend` directory:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=jobboard
DB_USER=your_db_user
DB_PASSWORD=your_db_password
JWT_SECRET=your_jwt_secret
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password
```

### Database Setup

```sql
CREATE DATABASE jobboard;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(100),
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(10) CHECK (role IN ('seeker', 'employer')) NOT NULL,
  reset_token VARCHAR(255),
  reset_token_expiry TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  location VARCHAR(100),
  salary VARCHAR(50),
  job_type VARCHAR(20) CHECK (job_type IN ('full-time', 'part-time', 'remote')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cvs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(100),
  email VARCHAR(100),
  phone VARCHAR(20),
  education TEXT,
  experience TEXT,
  skills TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE applications (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  cv_id INTEGER REFERENCES cvs(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Run the Server

```bash
npm run dev / nodemon server.js
```

---

## API Endpoints

### Auth

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/auth/register` | Public | Register as employer or seeker |
| POST | `/auth/login` | Public | Login and receive JWT |
| POST | `/auth/forgot-password` | Public | Send password reset email |
| POST | `/auth/reset-password/:token` | Public | Reset password using token |

#### Register — Seeker
```json
POST /auth/register
{
  "full_name": "John Doe",
  "email": "youremail@.com",
  "password": "password123",
  "role": "seeker"
}
```

#### Register — Employer
```json
POST /auth/register
{
  "company_name": "Tech Corp",
  "email": "yourcompany@.com",
  "password": "password123",
  "role": "employer"
}
```

#### Login
```json
POST /auth/login
{
  "email": "youremail@.com",
  "password": "password123"
}
```

---

### Jobs

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/jobs` | Employer | Post a new job |
| GET | `/jobs` | Public | Get all jobs (filter + pagination) |
| GET | `/jobs/:id` | Public | Get a single job |
| PUT | `/jobs/:id` | Employer (owner) | Update a job |
| DELETE | `/jobs/:id` | Employer (owner) | Delete a job |

#### Post a Job
```json
POST /jobs
Authorization: Bearer <token>
{
  "title": "Backend Developer",
  "description": "We need a Node.js developer",
  "location": "Remote",
  "salary": "2000",
  "job_type": "full-time"
}
```

#### Get All Jobs (with optional filters)
```
GET /jobs
GET /jobs?location=Remote
GET /jobs?job_type=full-time
GET /jobs?page=1&limit=10
```

---

### CVs

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/jobs/apply/cv-creation` | Seeker | Create a CV (max 3) |
| GET | `/cvs/mine` | Seeker | View all your CVs |
| DELETE | `/cvs/:id` | Seeker (owner) | Delete a CV |

#### Create a CV
```json
POST /jobs/apply/cv-creation
Authorization: Bearer <token>
{
  "full_name": "John Doe",
  "email": "youremail@.com",
  "phone": "08012345678",
  "education": "BSc Computer Science, 2022",
  "experience": "2 years Node.js backend development",
  "skills": "Node.js, Express, PostgreSQL, JWT"
}
```

> Each seeker can have a maximum of 3 CVs at a time. Delete an existing CV to create a new one. Different CVs allow seekers to tailor applications to different roles and industries.

---

### Applications

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/jobs/:id/apply` | Seeker | Apply to a job with a CV |
| GET | `/jobs/applications/mine` | Seeker | View your applications |
| GET | `/jobs/:id/applications` | Employer (owner) | View applicants for a job |

#### Apply to a Job
```json
POST /jobs/3/apply
Authorization: Bearer <token>
{
  "cv_id": 2
}
```

---

## Authentication

Protected routes require a Bearer token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

Tokens are returned on register and login. Employer tokens grant access to job management routes. Seeker tokens grant access to application and CV routes.

---

## Notes

- Employers can only edit or delete jobs they own
- Seekers can only delete CVs they own
- CV limit is 3 per seeker — tailored CVs for different job types are encouraged
- Password reset tokens expire after 1 hour
- Job listings support filtering by `location` and `job_type`, and pagination via `page` and `limit` query params
