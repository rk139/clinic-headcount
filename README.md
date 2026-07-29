# Clinic Attendance Management System

A full-stack web application built to streamline attendance management for youth tennis clinics. The system replaces manual attendance tracking with a centralized platform for administrators, coaches, and parents.

The application is actively being expanded and tested through real clinic sessions, with features added based on user feedback.

---

## Features

### Admin

- Create and manage clinic sessions
- Generate registration and response links
- View attendance and registration status
- Edit and delete sessions
- Export attendance data to CSV
- Manage coach access
- Authentication and role-based authorization

### Coaches

- View assigned clinic sessions
- Check in players
- Record attendance
- View walk-in registrations

### Parents

- Register players online
- Submit attendance responses
- Register walk-in participants from an iPad kiosk

---

## Tech Stack

### Frontend

- Next.js (App Router)
- React
- TypeScript

### Backend

- Next.js API Routes
- Prisma ORM
- PostgreSQL

### Authentication

- JWT Authentication
- Role-Based Authorization

### Deployment

- Vercel
- Neon PostgreSQL

---

## Project Highlights

- Designed a relational database to manage clinic sessions, registrations, attendance records, users, and check-ins.
- Built responsive dashboards for administrators and coaches.
- Implemented secure authentication and protected API routes.
- Developed registration workflows and attendance tracking.
- Added CSV export functionality for attendance reporting.
- Continuously refined the application based on feedback from live clinic sessions.

---

## Future Improvements

- QR code check-in
- Enhanced reporting and analytics
- Improved mobile experience
- Additional coach management tools

---

## Screenshots

*Add screenshots here.*

Examples:

- Admin Dashboard
- Coach Dashboard
- Registration Page
- Attendance View
- Walk-In Registration

---

## Installation

Clone the repository

```bash
git clone <repository-url>
```

Install dependencies

```bash
npm install
```

Create an environment file

```env
DATABASE_URL=
JWT_SECRET=
```

Run the development server

```bash
npm run dev
```

Open:

```
http://localhost:3000
```

---

## Purpose

This project was developed to replace manual attendance tracking for youth tennis clinics with a modern web application. It serves as an ongoing full-stack software engineering project and continues to evolve with new functionality and production use.

---

## Author

Raj Kumar

Computer Science, University of Akron
