# ✦ Brilliance Coaching Academy

A comprehensive, production-grade coaching institute management portal and student information system built with **Node.js, Express, TypeScript, Nunjucks, and Supabase PostgreSQL**.

Brilliance Coaching Academy streamlines day-to-day academy operations across three role-based portals (**Students, Teachers, Administrators**) — featuring automated attendance tracking with in-browser QR camera scanning, digital student ID generation, lecture timetables, class-specific study materials, doubt resolution, and an end-to-end student fee ledger with printable A4 receipts and CSV reporting.

---

## 📑 Table of Contents

- [Architectural Overview](#-architectural-overview)
- [Key Features & Role Workflows](#-key-features--role-workflows)
  - [Student Portal](#1-student-portal)
  - [Teacher Portal](#2-teacher-portal)
  - [Administrator Portal](#3-administrator-portal)
  - [Public & Admissions Flow](#4-public--admissions-flow)
- [Technology Stack](#-technology-stack)
- [Database Schema (Supabase PostgreSQL)](#-database-schema-supabase-postgresql)
- [Authentication & Security](#-authentication--security)
- [Payment Functionality & Status](#-payment-functionality--status)
- [Project Directory Tree](#-project-directory-tree)
- [Local Setup & Environment Configuration](#-local-setup--environment-configuration)
- [Build, Verification & Deployment](#-build-verification--deployment)
- [Future Roadmap](#-future-roadmap)

---

## 🏛 Architectural Overview

The application is structured as a full-stack monolithic TypeScript service running on Express:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Client Web Browser                            │
│  (Responsive HTML5 / CSS3 / Vanilla JS / WebRTC Camera QR Scanner)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / HTTPS (Session Cookie)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Express Application (server.ts)                    │
│  ├── Cookie-Session Authentication & Role Guards (Admin / Teacher / Student)
│  ├── JinjaCompatLoader + Nunjucks Template Engine (32 HTML views)      │
│  ├── Multer File Handlers (Notes & Student Photos)                     │
│  ├── Built-in Reed-Solomon QR Code SVG Generator (qrCodeSvg.ts)        │
│  └── REST / JSON Endpoints (QR Attendance & Verification APIs)         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Atomics + SharedArrayBuffer
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Synchronous Worker Thread Bridge (src/db.ts)             │
│  Dispatches database actions synchronously to isolated worker thread   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Node.js Worker MessagePort
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Worker Thread (src/supabaseWorker.ts)                │
│  Executes asynchronous PostgREST queries via @supabase/supabase-js     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ SSL / TLS
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Supabase PostgreSQL Database                       │
│  (Relational Tables, Foreign Keys, Sequences, and Indexes)             │
└────────────────────────────────────────────────────────────────────────┘
```

### Worker Thread Synchronization Pattern
To maintain synchronous-like flow control in Express handlers while leveraging modern asynchronous database drivers, the database layer (`src/db.ts`) delegates tasks to `src/supabaseWorker.ts` using Node.js `worker_threads`, communicating via `SharedArrayBuffer` and `Atomics.wait` / `Atomics.notify`. This ensures database operations execute in an isolated thread context without unhandled promise rejections on the main server loop.

---

## 🎯 Key Features & Role Workflows

### 1. Student Portal
- **Authentication:** Mobile number and bcrypt-hashed password login; self-registration for classes 6 through 12.
- **Student Dashboard (`/student_dashboard`):** Real-time greeting, class information, latest institute announcements banner, and fast navigation cards.
- **Dynamic Digital ID Card (`/student_id_card`):** Custom SVG QR code generated on the fly encoding the student's unique ID (`BCA-2026-XXXX`), student portrait photo, class, academic session (`2026-27`), and registered mobile number. Includes one-click print and PDF export.
- **Class Timetable (`/view_timetable`):** View weekly schedule filtered by day, subject, lecture timing, room number, and teacher.
- **Attendance Ledger (`/view_attendance`):** Month-by-month attendance filter with cumulative summary statistics (Total Sessions, Present, Absent, Attendance Percentage).
- **Study Materials (`/my_courses`):** Browse and download notes, documents, and syllabus uploaded by subject teachers for their class.
- **Ask a Doubt (`/ask_doubt`):** Submit subject-specific doubts to teachers and review teacher answers with timestamps.
- **Student Fee Portal (`/my_fees`):** Live fee status cards (**Total Course Fee**, **Paid Amount**, **Pending Balance**, and **Status Badge**: `Paid`, `Partial`, `Pending`, `Not Set`) and an itemized payment ledger with links to official printable receipts.
- **Scoped Fee Receipts (`/fee_receipt/:payment_id`):** Access to view and print official receipts, cryptographically constrained so students can only view receipts belonging to their own account.

### 2. Teacher Portal
- **Authentication:** Dedicated teacher login (`/teacher_login`) with credentials provisioned by administrators.
- **Teacher Dashboard (`/teacher_dashboard`):** Overview of assigned classes, next lecture details, and quick action shortcuts.
- **Assigned Student Roster (`/my_students`):** View registered students enrolled in the teacher's assigned classes.
- **Manual Attendance Marking (`/mark_attendance`):** Select class and date to bulk-mark Present/Absent with duplicate submission protection.
- **Live QR Scanner Attendance (`/scan_attendance`):** In-browser camera QR code scanner using HTML5 video and canvas decoding. Teachers can scan student ID cards in real time to automatically log attendance (`Present` or `Late`) with audio-visual feedback and instant duplicate detection.
- **Attendance Correction API (`/api/attendance/correct`):** Allows teachers to explicitly update existing attendance statuses with teacher attribution.
- **Study Material Uploads (`/upload_notes`):** Upload class-specific course materials (PDF, DOC, DOCX, PPT, PPTX, images) with chapter labeling.
- **Broadcast Notices (`/add_notice`):** Post institute announcements that immediately render on student portals.
- **Doubt Resolution (`/teacher_doubts`, `/answer_doubt/:id`):** Review student questions filtered by the teacher's subject and assigned classes, with inline answer publishing.

### 3. Administrator Portal
- **Authentication:** Protected admin login (`/admin_login`) with session-based route guards (`loginRequired('admin')`).
- **Admin Dashboard (`/admin_dashboard`):**
  - **Institute KPI Cards:** Real-time counts for Total Students, Total Teachers, and Admissions Enquiries.
  - **Fee Collection Overview:** Live financial metrics (Total Expected Fees, Total Collected, Pending Amount, and student counts for `Paid`, `Partial`, `Pending`, and `Not Set`).
  - **Enquiry Management:** Review incoming prospective student inquiries with one-click deletion.
- **Student Lifecycle Management (`/students_section`, `/students`):**
  - Search students across names, unique BCA IDs, and mobile numbers.
  - Register new students with portrait photo upload (memory-buffered with MIME & size validation).
  - Edit student details (`/edit_student/:id`) and remove student profiles (`/delete_student/:id`).
- **Student Fee Management (`/admin/student_fees/:id`):**
  - Configure or update total course fee per student.
  - Record manual payments across payment modes (`Cash`, `UPI`, `Bank Transfer`) with optional remarks.
  - Automatic validation preventing zero/negative payments or payments exceeding pending balances.
  - Generates official receipts with sequential numbering (`BCA-RCPT-2026-XXXX`).
- **Fee Reports & Analytics (`/admin/fee_reports`):**
  - Filterable by multi-parameter search, class (6–12), and payment status (`Paid`, `Partial`, `Pending`, `Not Set`).
  - Real-time aggregated financial summaries for filtered subsets.
  - Detailed payment transaction history table with links to individual receipts.
  - **Safe CSV Export (`/admin/fee_reports?export=csv`):** Downloads filtered reports formatted with RFC 4180 escaping and spreadsheet formula injection protection.
- **Faculty Management (`/manage_teachers`, `/edit_teacher/:id`, `/delete_teacher/:id`):** Provision teacher accounts with designated subjects and assigned classes.
- **Timetable Scheduling (`/manage_timetable`, `/delete_timetable/:id`):** Create and delete weekly lecture slots by class, day, time, room, and assigned instructor.
- **Credential Management (`/change_password`):** Authenticated password update interface with current password verification.

### 4. Public & Admissions Flow
- **Landing Page (`/`):** Academy highlights, courses offered, faculty credentials, and student testimonials.
- **About Us (`/about`):** Academy mission, teaching methodologies, and history.
- **Contact & Admissions Enquiry (`/contact`, `/enquiry`):** Prospective student enquiry form capturing student name, contact number, and message, dispatched directly to the admin dashboard.

---

## 🛠 Technology Stack

| Layer | Technology | Details / Purpose |
|---|---|---|
| **Runtime Environment** | Node.js (v20+) | High-performance asynchronous JavaScript runtime |
| **Server Framework** | Express 4.19 | HTTP routing, JSON APIs, and middleware pipelines |
| **Language** | TypeScript 5.4 | Strict type safety, interfaces, and compile-time verification |
| **Execution Engine** | `tsx` | Direct TypeScript execution for development and production |
| **Database** | Supabase (PostgreSQL) | Managed relational database with relational constraints and sequences |
| **Database Client** | `@supabase/supabase-js` | PostgREST client executed inside Node.js worker threads |
| **Concurrency Bridge** | `worker_threads` + `Atomics` | Synchronous request execution bridge using `SharedArrayBuffer` |
| **Template Engine** | Nunjucks 3.2 | Server-side templating with custom `JinjaCompatLoader` |
| **Authentication** | `cookie-session` + `bcryptjs` | HTTP-only session cookies and 10-round bcrypt password hashing |
| **File Uploads** | `multer` | Disk storage for notes and memory storage for student portraits |
| **Image Hosting** | Cloudinary API (Optional) | Direct signed image upload helper for cloud-hosted student portraits |
| **QR Code Engine** | Pure TypeScript (`qrCodeSvg.ts`) | ISO/IEC 18004 Version 2-M QR Code SVG generator with Reed-Solomon EC |
| **Stylesheets & UI** | Vanilla CSS3 | Custom responsive designs with CSS variables and print media queries |
| **Deployment Target** | Vercel / Node.js Container | Serverless or containerized deployment (`vercel.json` included) |

---

## 🗄 Database Schema (Supabase PostgreSQL)

The database schema consists of 10 relational tables and 1 sequence:

### Schema Overview

```sql
-- 1. Students Table
CREATE TABLE public.students (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE, -- Stores student registered mobile number
    password TEXT NOT NULL,     -- Bcrypt password hash
    class_name TEXT NOT NULL,   -- e.g. "6", "10", "12"
    photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Users Table (Administrators and Teachers)
CREATE TABLE public.users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,     -- Bcrypt password hash
    role TEXT NOT NULL CHECK (role IN ('admin', 'teacher')),
    subject TEXT,               -- For teachers (e.g. "Mathematics")
    assigned_classes TEXT,      -- For teachers (e.g. "9,10,11")
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Attendance Records
CREATE TABLE public.attendance (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    date TEXT NOT NULL,         -- Format: YYYY-MM-DD (IST)
    status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Late')),
    marked_by TEXT,             -- Username of teacher or 'QR Scanner'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Class Timetables
CREATE TABLE public.timetables (
    id BIGSERIAL PRIMARY KEY,
    class_name TEXT NOT NULL,
    day TEXT NOT NULL,          -- e.g. "Monday", "Tuesday"
    subject TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    room TEXT NOT NULL,
    teacher_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Broadcast Notices
CREATE TABLE public.notices (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    class_name TEXT,            -- Null for institute-wide, or specific class
    posted_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Student Doubts & Q&A
CREATE TABLE public.doubts (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    class_name TEXT NOT NULL,
    subject TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT,
    answered_by TEXT,           -- Username of answering teacher
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Study Notes & Syllabus Uploads
CREATE TABLE public.notes (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    class_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    uploaded_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Admissions Enquiries
CREATE TABLE public.enquiries (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    contact TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Student Total Fees Ledger (1 row per student)
CREATE TABLE public.student_fees (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL UNIQUE REFERENCES public.students(id) ON DELETE RESTRICT,
    total_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (total_fee >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Fee Receipt Sequence
CREATE SEQUENCE IF NOT EXISTS public.fee_receipt_seq START WITH 1 INCREMENT BY 1;

-- 11. Fee Payments Transactions Ledger
CREATE TABLE public.fee_payments (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    payment_date TEXT NOT NULL, -- Format: YYYY-MM-DD (IST)
    payment_mode TEXT NOT NULL DEFAULT 'Cash', -- 'Cash', 'UPI', 'Bank Transfer', 'Razorpay'
    remarks TEXT,
    receipt_no TEXT NOT NULL UNIQUE DEFAULT ('BCA-RCPT-2026-' || LPAD(nextval('public.fee_receipt_seq')::TEXT, 4, '0')),
    collected_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_payments_razorpay_payment_id_unique
    ON public.fee_payments (razorpay_payment_id)
    WHERE razorpay_payment_id IS NOT NULL;
```

---

## 🔒 Authentication & Security

1. **Password Hashing:** Passwords for students, teachers, and administrators are hashed using `bcryptjs` with a work factor of 10 salt rounds. Plaintext passwords are never stored or logged.
2. **Session Integrity:** Express session cookies are managed via `cookie-session` with `httpOnly: true`, `sameSite: 'lax'`, and signed with `SECRET_KEY`.
3. **Role-Based Access Control (RBAC):**
   - `loginRequired('admin')`: Restricts access to administrator features (Fee management, teacher provisioning, student edits, timetable scheduling).
   - `loginRequired('teacher')`: Restricts access to teacher features (Attendance marking, QR scanner, notes upload, notice publishing, doubt answering).
   - `req.session.student_id` validation: Guards student-only endpoints (`/student_dashboard`, `/my_fees`, `/my_courses`, `/ask_doubt`).
4. **Data Scoping & Ownership Enforcement:**
   - On `/fee_receipt/:payment_id`, the system checks whether the authenticated caller is an admin or the student owner. Non-admin students are prevented from viewing receipts belonging to other students (`payment.student_id !== session.student_id`).
5. **CSV Formula Injection Sanitization:**
   - The fee reports exporter inspects every exported cell. If a string starts with spreadsheet formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`), it is safely escaped with a leading single quote (`'`) to neutralize remote code execution / CSV injection attacks in Microsoft Excel or Google Sheets.
6. **File Upload Restrictions & Cloud Storage:**
   - Student portrait uploads are capped at 2MB with explicit MIME-type whitelisting (`image/jpeg`, `image/png`, `image/webp`, `image/gif`) and uploaded directly to Cloudinary.
   - Course notes and study documents (PDF, Word, PowerPoint, images) are capped at 10MB with strict type whitelisting, streamed via memory storage directly to Cloudinary raw storage without saving to local disk.

---

## 💳 Payment Functionality & Status

To maintain transparent architectural documentation, the current status of payment features is categorized below:

### ✅ Implemented & Fully Functional (Verified)
- **Fee Configuration:** Administrators can set and update total course fees per student (`setStudentTotalFee`).
- **Manual Payment Recording:** Administrators can record installments via **Cash**, **UPI**, or **Bank Transfer** with collection timestamps and remarks.
- **Validation Engine:** Strict server-side verification ensuring payment amounts are positive numbers that do not exceed the student's pending balance.
- **Automated Receipt Generation:** Every recorded payment automatically receives a collision-proof sequence-generated receipt number (`BCA-RCPT-2026-XXXX`).
- **Printable Official Receipts:** Dedicated `/fee_receipt/:payment_id` template formatted for A4 portrait printing with browser print dialog integration, academy branding, authorized signatory blocks, and print CSS hiding navigation sidebars.
- **Student Fee Dashboard:** Logged-in students can view their cumulative fee ledger, paid amounts, remaining balance, status badges, and past receipts.
- **Fee Analytics & CSV Reporting:** Admin-level Fee Collection Overview dashboard widget and comprehensive `/admin/fee_reports` page with multi-filter search and formula-safe CSV export.
- **Database Schema Foundation for Razorpay:** The `fee_payments` table, TypeScript `FeePayment` interface, and database repository layer include nullable `razorpay_order_id` and `razorpay_payment_id` columns, along with the `getFeePaymentByRazorpayPaymentId` lookup method.

### ⏳ Planned in Roadmap (Not Functional Yet)
- **Razorpay Online Gateway Integration:** Client-side Razorpay Checkout modal, server-side Order creation (`/api/fees/razorpay/create-order`), cryptographic HMAC-SHA256 signature verification endpoint (`/api/fees/razorpay/verify`), and automated webhook listener (`/api/webhooks/razorpay`). *Online payments must not be used until these endpoints are implemented and activated.*

---

## 📁 Project Directory Tree

```
brilliance-coaching-academy/
├── .env.example                    # Template for environment variables
├── metadata.json                   # AI Studio applet manifest & capabilities
├── package.json                    # Project dependencies and npm scripts
├── README.md                       # Comprehensive documentation (this file)
├── server.ts                       # Main Express application & route handlers
├── tsconfig.json                   # TypeScript compiler configuration
├── vercel.json                     # Vercel serverless deployment routing
├── src/
│   ├── db.ts                       # Database service, interfaces, & sync worker bridge
│   ├── migrateStudent3Password.ts  # One-time migration helper for legacy student records
│   ├── qrCodeSvg.ts                # Pure TypeScript ISO/IEC 18004 QR code SVG generator
│   └── supabaseWorker.ts           # PostgREST database worker thread handler
├── static/
│   ├── css/
│   │   ├── admin.css               # Admin layout styles
│   │   ├── admin_dashboard.css     # Admin dashboard & fee reporting styles
│   │   ├── student_dashboard.css   # Student portal & ID card styles
│   │   ├── style.css               # Public website styles
│   │   └── teacher_dashboard.css   # Teacher portal & attendance scanner styles
│   ├── js/
│   │   └── main.js                 # Theme toggler & client-side interactions
└── templates/
    ├── about.html                  # Public About Us page
    ├── add_notice.html             # Teacher notice creation form
    ├── admin.html                  # Admin management overview
    ├── admin_dashboard.html        # Admin KPI dashboard & fee overview
    ├── admin_fee_reports.html      # Searchable fee reports with CSV export
    ├── admin_login.html            # Administrator login portal
    ├── admin_student_fees.html     # Student fee ledger & payment recording
    ├── ask_doubt.html              # Student doubt submission & replies
    ├── change_password.html        # Authenticated password reset page
    ├── contact.html                # Public Contact page
    ├── edit_student.html           # Admin student edit form
    ├── edit_teacher.html           # Admin teacher edit form
    ├── enquiry.html                # Public admissions enquiry form
    ├── fee_receipt.html            # Printable A4 official fee receipt
    ├── index.html                  # Public homepage
    ├── login.html                  # Student login portal
    ├── manage_teachers.html        # Admin faculty management list
    ├── manage_timetable.html       # Admin timetable scheduling manager
    ├── mark_attendance.html        # Teacher manual attendance checklist
    ├── my_courses.html             # Student study notes download view
    ├── my_students.html            # Teacher assigned student roster
    ├── register.html               # Student self-registration form
    ├── scan_attendance.html        # Teacher live camera QR attendance scanner
    ├── student_dashboard.html      # Student portal home & digital ID card
    ├── student_fees.html           # Student personal fee status & receipts
    ├── student_id_card.html        # Dedicated printable student ID card view
    ├── students.html               # Admin student directory & search
    ├── teacher_dashboard.html      # Teacher dashboard & next lecture info
    ├── teacher_doubts.html         # Teacher student doubt answer panel
    ├── teacher_login.html          # Teacher login portal
    ├── upload_notes.html           # Teacher course material upload form
    ├── view_attendance.html        # Student monthly attendance ledger
    └── view_timetable.html         # Student class timetable view
```

---

## 🚀 Local Setup & Environment Configuration

### Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v9.x` or higher (or `bun` / `pnpm`)
- **Supabase Account**: An active PostgreSQL database project

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/mohitshaw2406-pro/Brilliance-Coaching-Academy.git
cd Brilliance-Coaching-Academy
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Populate `.env` with your actual credentials:
```ini
# Session Cookie Signing Key (Required)
SECRET_KEY=your_secure_random_secret_string

# Supabase PostgreSQL Configuration (Required)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your_supabase_anon_or_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Cloudinary Storage Configuration (Optional, for remote student photo hosting)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Server Port (Optional, defaults to 3000)
PORT=3000
```

> **Security Note:** Never commit your `.env` file to version control. Keep `SUPABASE_SERVICE_ROLE_KEY` confidential to prevent unauthorized access.

### 3. Initialize Supabase Database
Execute the SQL DDL statements listed in the [Database Schema](#-database-schema-supabase-postgresql) section in your **Supabase Project SQL Editor**. Ensure tables and sequences are granted usage to the API roles:
```sql
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
```

### 4. Start the Application
- **Development Mode (with auto-restart via tsx):**
  ```bash
  npm run dev
  ```
- **Production Mode:**
  ```bash
  npm run start
  ```

Open your browser at `http://localhost:3000`.

---

## 🧪 Build, Verification & Deployment

### TypeScript Type-Checking & Verification
The project uses `tsc --noEmit` to validate all TypeScript code, interfaces, and Express route handlers:
```bash
npm run build
```
A successful verification exits with code `0` and outputs zero compilation errors.

### Vercel Deployment
The repository includes a preconfigured `vercel.json` file routing all incoming traffic to `server.ts` via `@vercel/node`.

1. Install the Vercel CLI: `npm i -g vercel`
2. Run `vercel` from the project root.
3. Configure the environment variables (`SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDINARY_*`) in the Vercel Project Dashboard.
4. Deploy to production: `vercel --prod`

---

## 🔮 Future Roadmap

The following enhancements are planned for upcoming releases:

- [ ] **Full Razorpay Online Checkout Integration:** Complete client-side modal checkout on `/my_fees` allowing students or parents to pay pending balances via Credit/Debit Cards, NetBanking, and UPI directly, with automated server-side verification and receipt generation.
- [ ] **Automated Razorpay Webhooks (`/api/webhooks/razorpay`):** Server-side raw body signature verification for asynchronous event reconciliation (`payment.captured`, `order.paid`).
- [ ] **Automated SMS & WhatsApp Alerts:** Automated notifications to parents when an attendance status is marked `Absent` or when fees are due.
- [ ] **Exam & Marks Management System:** Report card generation, periodic test score tracking, and performance analytics for students and teachers.

---

## 👨‍💻 Maintainer & Author

- **Lead Engineer:** Mohit Kumar Shaw ([@mohitshaw2406-pro](https://github.com/mohitshaw2406-pro))
- **Organization:** Brilliance Coaching Academy
- **License:** Private / Proprietary — All Rights Reserved
