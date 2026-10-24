# Choose Bed + PG Saathi AI

_Simplifying PG operations with practical property management tools and multilingual voice assistance._

[![Framework: Next.js 15](https://img.shields.io/badge/Framework-Next.js%2015-black?logo=next.js)](https://nextjs.org/)
[![Runtime: React 19](https://img.shields.io/badge/Runtime-React%2019-blue?logo=react)](https://react.dev/)
[![Language: TypeScript 5](https://img.shields.io/badge/Language-TypeScript%205.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Database: PostgreSQL + Prisma](https://img.shields.io/badge/Database-PostgreSQL%20%7C%20Prisma%205.22-2D3748?logo=prisma)](https://www.prisma.io/)
[![CI: GitHub Actions](https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?logo=githubactions)](.github/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 📖 Introduction

Managing Paying Guest (PG) accommodations, student hostels, and co-living facilities across Indian cities involves constant operational friction. Most property owners rely on paper registers, fragmented WhatsApp chats, and disconnected spreadsheets to track room occupancy, collect monthly rent, and calculate tenant dues.

When owners need quick operational answers—such as _"Room 102 mein kitne beds khali hain?"_ or _"Kiska rent baki hai?"_—they often have to navigate complex software menus or flip through manual notebooks.

**Choose Bed** (choosebed.com) is a full-stack property management platform tailored specifically for Indian PG and hostel operators. Embedded directly within the platform is **PG Saathi AI**, an Indic voice copilot that allows caretakers and property owners to check room vacancies, bed availability, rent rates, and resident pending dues using natural speech in **Hindi, Roman Hindi (Hinglish), Gujarati, and English**.

---

## 🎯 Problem and Solution

| Operational Challenge               | How Choose Bed & PG Saathi AI Solves It                                                                                                             | Status          |
| :---------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------- |
| **Manual Room & Bed Tracking**      | Atomic inventory generation for Single, Double, Triple, and Four-sharing rooms with real-time status (`AVAILABLE`, `OCCUPIED`, `MAINTENANCE`).      | **Implemented** |
| **Resident Admission & Invariants** | Digital resident records with identity verification, room allocation, and automated bed status locking to eliminate double bookings.                | **Implemented** |
| **Rent Collection & Dues**          | Monthly billing cycle generation (`YYYY-MM`), partial payment recording, unique receipt identifiers (`RCP-YYYYMM-XXXXXX`), and deposit segregation. | **Implemented** |
| **Multi-Property Governance**       | Consolidated multi-branch dashboard for owners with portfolio-wide occupancy rollups and branch switching.                                          | **Implemented** |
| **Language & Software Barriers**    | **PG Saathi AI** allows owners to speak queries naturally in Indic languages, resolving 95%+ of queries with zero token cost.                       | **Implemented** |
| **Tenant Payment Reminders**        | Automated WhatsApp and SMS notification triggers for pending rent obligations.                                                                      | _Planned_       |

---

## 🖼️ Product Preview

```text
+-----------------------------------------------------------------------------------+
|  Choose Bed - PG Operations Dashboard                                  [Demo PG]  |
+-----------------------------------------------------------------------------------+
|  [Total Beds: 24]    [Occupied: 18]    [Vacant: 6]    [Pending Dues: ₹14,500]     |
|                                                                                   |
|  Rooms & Beds Inventory                   Live Resident Ledger                    |
|  * Room 101 (Triple, AC)     - 1 Bed Free  * Rahul Sharma  - Room 101 - Due: ₹0   |
|  * Room 102 (Double, Non-AC) - 2 Beds Free * Amit Patel    - Room 103 - Due: ₹5K  |
+-----------------------------------------------------------------------------------+
|  🎙️ PG Saathi AI Voice Assistant                                                  |
|  Owner: "Room 101 mein kitne beds khali hain?"                                    |
|  Saathi: "Room 101 (Triple, AC) mein 1 bed khali hai (Bed #3). Rent: ₹6,500/mo." |
+-----------------------------------------------------------------------------------+
```

> **UI Screenshot Note:** Authentic UI screenshots of the Owner Dashboard (`/user`), Room Matrix (`/user/rooms`), and the PG Saathi AI Voice Assistant modal can be found in [`docs/architecture/overview.md`](docs/architecture/overview.md) or placed directly in `public/images/dashboard/` for visual documentation.

---

## 🚀 Key Implemented Features

### 🏢 1. Property & Room Inventory (`/user/rooms`)

- **Configurable Sharing Types**: Create rooms configured as `SINGLE`, `DOUBLE`, `TRIPLE`, or `FOUR_SHARING`.
- **Atomic Bed Management**: Beds are generated automatically upon room creation with independent lifecycles (`AVAILABLE`, `OCCUPIED`, `MAINTENANCE`).
- **Feature Flags**: AC vs Non-AC tags, custom floor numbers, and individual room monthly rent configurations.
- **Multi-Tenant Scoping**: All room, bed, and property data is strictly bounded to the authenticated owner's `ownerId`.

### 👥 2. Resident Management & Onboarding (`/user/residents`)

- **Digital Registration**: Capture resident names, contact phone numbers, emergency contact details, and admission dates.
- **Atomic Allocation Lock**: Allocating a resident to an available bed marks the bed as `OCCUPIED` in an atomic database transaction.
- **Check-Out & Restoration**: Resident checkout automatically restores the allocated bed to `AVAILABLE` status for re-assignment.

### 💰 3. Financial Ledger & Rent Collection (`/user/billing`)

- **Billing Period Obligations**: Generate monthly rent charges tagged with billing periods (`YYYY-MM`).
- **Payment Receipts**: Record full or partial payments with auto-generated receipt serial numbers (`RCP-YYYYMM-XXXXXX`).
- **Deposit Segregation**: Separate tracking for refundable security deposits versus monthly operational rent.
- **Live Outstanding Calculations**: Dynamic balance calculation comparing total charges against logged payment receipts per resident.

### 🎙️ 4. PG Saathi AI Voice Copilot

- **Multilingual Indic Understanding**: Spoken audio and typed input support for Hindi (Devanagari), Roman Hindi (Hinglish), Gujarati, and Indian English.
- **3-Layer Hybrid Query Engine**:
  - **Layer A (Deterministic Regex NLU)**: Resolves vacancies, bed counts, AC/non-AC checks, rent rates, resident room lookups, and pending dues in **0ms** without calling an LLM.
  - **Layer B (Pre-computation Cache)**: Aggregates real-time database counts per authenticated property.
  - **Layer C (Groq Cloud LLM)**: Employs `qwen/qwen3.8-27b` via Groq for conversational and ambiguous edge cases.
- **Strict Read-Only Safety**: Voice assistant never mutates or writes data to the database. Creation or admission queries deliver structured guidance linking directly to verified dashboard screens.
- **Voice Activity Detection (VAD)**: Real-time audio waveform visualizer with automatic silence submission (1.4s) and ambient idle noise cancellation (4.0s).

### 🛡️ 5. Super Admin Cockpit (`/admin`)

- **Owner Directory**: Search, inspect, and monitor registered business accounts with status toggles (`ACTIVE`, `SUSPENDED`).
- **Property Governance**: Track verified property counts, active room capacities, and aggregate platform occupancy.
- **Security Audit Logging**: Record critical administrative actions with actor identity, action type, IP address, and timestamp.

---

## 🎙️ PG Saathi AI — Voice Intelligence Architecture

PG Saathi AI is designed around a **cost-optimized, low-latency 3-layer architecture** that guarantees instant responses for standard queries while maintaining strict database security:

```mermaid
flowchart TD
    UserAudio([User Spoken Voice / Microphone]) --> VAD[Voice Activity Detection\nWeb Audio API]
    VAD --> STT[Speech-to-Text API\nGnani Prisma ASR]
    STT --> Transcript[Normalized Indic Transcript\nHindi / Hinglish / Gujarati / English]

    UserText([User Typed Input]) --> Transcript

    Transcript --> LayerA{Layer A: Indic Regex NLU\nDeterministic Pattern Matcher}

    LayerA -- "Standard Query (95%+)" --> GroundedDB[(PostgreSQL Database\nScoped by ownerId + propertyId)]
    LayerA -- "Action Request (Add Room / Admit)" --> SafetyGuard[Read-Only Guidance Guard\nSafe Redirect to UI]
    LayerA -- "Complex / Ambiguous Query" --> LayerC[Layer C: Groq Cloud LLM\nqwen/qwen3.8-27b]

    LayerC --> GroundedDB

    GroundedDB --> ResponseFormatter[Bilingual Response Builder\nHindi + English UI Cards]
    SafetyGuard --> ResponseFormatter

    ResponseFormatter --> TTS[Text-to-Speech API\nGnani Timbre Neural Synthesis]
    ResponseFormatter --> UI[Web Assistant Modal\nAudio Playback + Visual Cards]
    TTS --> UI
```

### Supported & Verified Voice Queries

| Category                 | Example Spoken Input                                                  | System Action                                                 |
| :----------------------- | :-------------------------------------------------------------------- | :------------------------------------------------------------ |
| **Vacant Rooms**         | _"Kaunse room khali hain?"_ / _"कौन से रूम खाली हैं?"_                | Returns all rooms with at least one `AVAILABLE` bed.          |
| **Total Bed Count**      | _"Total kitne beds khali hain?"_ / _"મારા PG માં કેટલા બેડ ખાली છે?"_ | Computes aggregate vacant beds in active property.            |
| **AC / Non-AC Filters**  | _"Koi AC wala room khali hai?"_ / _"Non-AC room kitne hain?"_         | Strictly filters inventory by AC classification.              |
| **Specific Room Focus**  | _"Room 102 status"_ / _"Room 1 mein kitne beds hain?"_                | Returns exact bed numbers and occupancy for that room.        |
| **Sharing & Rent Rates** | _"Double sharing ka rent kya hai?"_                                   | Returns the monthly tariff for double-sharing rooms.          |
| **Resident Room Lookup** | _"Rahul kaunse room mein rehta hai?"_                                 | Finds active resident by name and returns room/bed number.    |
| **Pending Rent Dues**    | _"Kiska payment baki hai?"_ / _"किसका किराया बाकी है?"_               | Queries ledger and calculates outstanding balance per tenant. |
| **Creation Guidance**    | _"Ek new AC room add kar do"_                                         | Identifies action intent and directs owner to `/user/rooms`.  |
| **Admission Guidance**   | _"Rahul name ka resident add kar lo"_                                 | Verifies bed vacancy and directs owner to `/user/residents`.  |

### Voice Boundaries & Safety Policy

1. **Zero Direct Mutations**: Voice commands cannot insert, delete, or update database records. This completely neutralizes prompt-injection and acoustic misrecognition write corruption.
2. **Multi-Tenant Ownership Scoping**: Every database lookup explicitly includes `where: { propertyId: activePropertyId, property: { ownerId: session.user.id } }`. An owner can never query another owner's property.
3. **Offline & Graceful Fallback**: If speech API credentials are not configured, the assistant automatically falls back to typed input and text-based responses with zero application crashes.

---

## 🛠️ Technology Stack

| Layer                | Technology                                    | Version   | Purpose                                               |
| :------------------- | :-------------------------------------------- | :-------- | :---------------------------------------------------- |
| **Framework**        | [Next.js (App Router)](https://nextjs.org/)   | `15.2.4`  | Server-rendered pages, API routes, layout groups      |
| **Frontend Runtime** | [React](https://react.dev/)                   | `19.0.0`  | User interface and concurrent client state            |
| **Language**         | [TypeScript](https://www.typescriptlang.org/) | `5.3.3`   | End-to-end static typing and interface contracts      |
| **Styling**          | [Tailwind CSS](https://tailwindcss.com/)      | `3.4.4`   | Utility-first responsive design and dark mode tokens  |
| **Database ORM**     | [Prisma ORM](https://www.prisma.io/)          | `5.22.0`  | Type-safe schema definition, relations, migrations    |
| **Database Engine**  | [PostgreSQL](https://www.postgresql.org/)     | `14+`     | Relational storage hosted via Supabase / Neon / Local |
| **Authentication**   | [NextAuth.js](https://next-auth.js.org/)      | `4.24.5`  | Edge session handling, JWT tokens, RBAC routing       |
| **Speech-to-Text**   | [Gnani Prisma STT](https://gnani.ai/)         | Cloud API | Indic acoustic recognition (Hindi, Gujarati, English) |
| **Text-to-Speech**   | [Gnani Timbre TTS](https://gnani.ai/)         | Cloud API | Low-latency neural Indian voice audio synthesis       |
| **LLM Inference**    | [Groq Cloud](https://groq.com/)               | Cloud API | `qwen/qwen3.8-27b` inference for ambiguous queries    |
| **Data Validation**  | [Zod](https://zod.dev/)                       | `3.23.8`  | Runtime schema validation at API boundaries           |

---

## 📁 Repository Structure

```text
choosebed/
├── .github/
│   ├── workflows/ci.yml         # GitHub Actions CI (typecheck, lint, test, build)
│   ├── ISSUE_TEMPLATE/          # Standard bug report and feature request templates
│   └── pull_request_template.md # Pull request submission checklist
├── docs/
│   ├── architecture/overview.md # Architectural deep-dive & Mermaid diagrams
│   ├── development/setup.md     # Detailed local setup and troubleshooting
│   ├── testing/strategy.md      # Automated testing matrix & regression guide
│   └── security/overview.md     # Security controls, RBAC, and threat models
├── prisma/
│   ├── schema.prisma            # Authoritative database models (User, Property, Room, Bed, Resident, Ledger)
│   └── seed.ts                  # Optional local seed script
├── public/
│   ├── favicon.svg              # Brand vector mark
│   └── images/                  # Vector illustrations and brand logos
├── src/
│   ├── __tests__/               # Automated test suites (8 suites, 158 test assertions)
│   │   ├── admin_security.test.ts
│   │   ├── notifications.test.ts
│   │   ├── owner_onboarding.test.ts
│   │   ├── rent_dues.test.ts
│   │   ├── residents.test.ts
│   │   ├── rooms_beds.test.ts
│   │   ├── security.test.ts
│   │   ├── voice_room_queries.test.ts
│   │   └── run_all_tests.ts     # Master test execution runner
│   ├── app/
│   │   ├── (site)/              # Next.js route groups
│   │   │   ├── admin/           # Super Admin portal (/admin/owners, /admin/properties)
│   │   │   ├── auth/            # Authentication screens (signin, signup, forgot-password)
│   │   │   ├── user/            # Owner portal (/user/rooms, /user/residents, /user/billing)
│   │   │   └── page.tsx         # Public marketing landing page
│   │   └── api/                 # Backend API Route Handlers
│   │       ├── admin/           # Admin security & owner status APIs
│   │       ├── auth/            # NextAuth session handlers
│   │       └── user/voice/      # PG Saathi AI endpoints (transcribe, query, tts)
│   ├── components/              # Modular UI components (Admin, Common, User, Voice)
│   ├── libs/                    # Core infrastructure services
│   │   ├── auth.ts              # NextAuth configuration and role callbacks
│   │   ├── prismaDb.ts          # Singleton Prisma client instance
│   │   └── voice/               # Voice pipeline (NLU parser, Gnani client, Groq client, DB queries)
│   ├── types/                   # Shared TypeScript interfaces
│   └── middleware.ts            # Edge authentication and RBAC routing middleware
├── .env.example                 # Sanitized environment template
├── .gitignore                   # Git ignore patterns for build & local files
├── CHANGELOG.md                 # Semantic version history and release notes
├── CONTRIBUTING.md              # Contributor conventions and PR instructions
├── LICENSE                      # MIT Open Source License
├── package.json                 # Project dependencies and npm scripts
├── README.md                    # Main repository documentation
├── SECURITY.md                  # Vulnerability disclosure policy
└── tsconfig.json                # TypeScript compiler configuration
```

---

## 🏁 Local Installation & Setup

### Prerequisites

- **Node.js**: `v20.x` or newer (`node -v`)
- **Package Manager**: `npm` (`npm -v`)
- **Database**: PostgreSQL (v14 or higher). A hosted PostgreSQL instance (e.g. [Supabase](https://supabase.com/) or [Neon](https://neon.tech/)) or a local PostgreSQL server is required. _Note: SQLite is not supported._

### 1. Clone the Repository

```bash
git clone https://github.com/chooseroom/chooseroom-web.git
cd chooseroom-web
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment template:

```bash
cp .env.example .env
```

Open `.env` in your editor and configure the necessary variables:

```env
# Database Connection (PostgreSQL required)
DATABASE_URL="postgresql://postgres:password@localhost:5432/choosebed?schema=public"
DIRECT_URL="postgresql://postgres:password@localhost:5432/choosebed"

# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secure-random-32-character-secret"
SECRET="your-secure-random-32-character-secret"

# Optional: Voice & LLM Integration (System works in local/mock mode without these)
GNANI_API_KEY=""
GNANI_TTS_TOKEN=""
GROQ_API_KEY=""
GROQ_MODEL="qwen/qwen3.8-27b"
```

### 4. Initialize Database Schema

Push the Prisma schema to your PostgreSQL database:

```bash
npx prisma generate
npx prisma db push
```

### 5. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🔑 Environment Variables Reference

| Variable          | Description                                                | Required? | Default / Notes                                  |
| :---------------- | :--------------------------------------------------------- | :-------: | :----------------------------------------------- |
| `DATABASE_URL`    | PostgreSQL connection string (supports pooled connection)  |  **Yes**  | Standard connection URL                          |
| `DIRECT_URL`      | Direct PostgreSQL connection string for Prisma migrations  |  **Yes**  | Direct connection URL                            |
| `NEXTAUTH_URL`    | Canonical URL of the application                           |  **Yes**  | `http://localhost:3000`                          |
| `NEXTAUTH_SECRET` | 32+ character random string for encrypting session cookies |  **Yes**  | Generate via `openssl rand -base64 32`           |
| `SECRET`          | Redundant secret key fallback for NextAuth compatibility   |  **Yes**  | Same as `NEXTAUTH_SECRET`                        |
| `GNANI_API_KEY`   | API Access Key for Gnani Prisma Speech-to-Text             | Optional  | Mock STT used if blank                           |
| `GNANI_TTS_TOKEN` | Bearer Token for Gnani Timbre Text-to-Speech               | Optional  | Browser speech synthesis used if blank           |
| `GROQ_API_KEY`    | API Key for Groq Cloud fast LLM inference                  | Optional  | Layer A deterministic regex handles 95%+ queries |
| `GROQ_MODEL`      | Fast inference model identifier                            | Optional  | `qwen/qwen3.8-27b`                               |

> **How to obtain Gnani AI credentials:** Register on the [Gnani.ai Portal](https://gnani.ai/) to obtain credentials for Prisma Speech-to-Text (`asr_general` / `asr_hindi`) and Timbre Speech Synthesis.

---

## 🧪 Testing & Code Quality

Choose Bed is backed by an automated test suite containing **8 test suites and 158 verified test assertions**.

### Available Verification Scripts

```bash
# Run all 8 test suites sequentially
npm run test:all

# Run PG Saathi AI Voice Intelligence tests (93 assertions)
npm test

# Check TypeScript static types without emit
npm run typecheck

# Check code against ESLint style rules
npm run check-lint

# Full verification pipeline (format check, lint, and production build)
npm run test-build
```

### Actual Executed Test Results

```text
=================================================================
Choose Bed + PG Saathi AI — Master Test Suite Verification
=================================================================

▶ Running: Admin Security & Privilege Escalation (admin_security.test.ts)... ✅ PASS (6.2s)
▶ Running: Notifications Endpoint Security (notifications.test.ts)... ✅ PASS (3.1s)
▶ Running: Owner Onboarding & Multi-Tenant Boundary (owner_onboarding.test.ts)... ✅ PASS (10.7s)
▶ Running: Rent Charges, Dues & Receipts (rent_dues.test.ts)... ✅ PASS (9.9s)
▶ Running: Resident Allocation & Bed Invariant Locks (residents.test.ts)... ✅ PASS (7.7s)
▶ Running: Rooms & Beds Atomic Inventory (rooms_beds.test.ts)... ✅ PASS (9.6s)
▶ Running: Authentication & Session Security Regressions (security.test.ts)... ✅ PASS (2.2s)
▶ Running: PG Saathi AI Voice Intelligence & Regression Suite (voice_room_queries.test.ts)... ✅ PASS (1.9s)

=================================================================
MASTER TEST SUMMARY
=================================================================
✅ [1/8] Admin Security & Privilege Escalation                (6.2s)
✅ [2/8] Notifications Endpoint Security                      (3.1s)
✅ [3/8] Owner Onboarding & Multi-Tenant Boundary             (10.7s)
✅ [4/8] Rent Charges, Dues & Receipts                        (9.9s)
✅ [5/8] Resident Allocation & Bed Invariant Locks            (7.7s)
✅ [6/8] Rooms & Beds Atomic Inventory                        (9.6s)
✅ [7/8] Authentication & Session Security Regressions        (2.1s)
✅ [8/8] PG Saathi AI Voice Intelligence & Regression Suite   (1.9s)
-----------------------------------------------------------------
Total Suites: 8 | Passed: 8 | Failed: 0 | Total Time: 51.3s
=================================================================
```

---

## 🔒 Security & Tenant Privacy

1. **Role-Based Access Control (RBAC)**: Users are assigned explicit roles (`ADMIN`, `BUSINESS_OWNER`, `USER`). The Edge middleware (`src/middleware.ts`) blocks unauthorized route access before route execution.
2. **Tenant Isolation**: Every database operation executed via API routes or PG Saathi AI scopes records strictly by the owner's session ID (`ownerId: session.user.id`).
3. **Password Security**: Credentials authentication utilizes `bcrypt` with automated salt round generation.
4. **Voice Safety Guarantee**: PG Saathi AI operates on a strictly **read-only database policy**, preventing any accidental or malicious data modification through voice.
5. **Vulnerability Disclosure**: Read our complete security response policy in [SECURITY.md](SECURITY.md).

---

## ⚖️ Implementation Status & Known Limitations

To provide complete transparency for evaluators and contributors, the current implementation status is categorized below:

### ✅ Fully Implemented

- Multi-property owner dashboard with active branch filtering.
- Atomic room and bed inventory generation (`SINGLE`, `DOUBLE`, `TRIPLE`, `FOUR_SHARING`).
- Resident registration, phone tracking, bed allocation, and checkout workflows.
- Financial billing periods (`YYYY-MM`), rent charges, partial payments, and digital receipts (`RCP-YYYYMM-XXXXXX`).
- PG Saathi AI Indic NLU with 0-token cost regex engine (vacancies, bed counts, AC status, sharing rent, resident lookup, pending dues).
- Real-time Web Audio VAD with 1.4-second auto-submission and 4.0-second noise cancellation.
- Super Admin management dashboard and tamper-evident audit logging.
- 8 automated test suites passing 158 assertions.

### 🟡 Partially Implemented / Graceful Fallback

- **Live Cloud Voice APIs**: Full integration with Gnani Prisma STT and Timbre TTS is implemented; in local environments without API keys, the application gracefully falls back to browser-native speech synthesis and typed chat input.
- **LLM Reasoning**: Layer C Groq fallback is configured for complex edge cases; standard operational queries are resolved directly via Layer A deterministic rules.

### 📋 Planned (Future Roadmap)

- [ ] **Automated WhatsApp Reminders**: Direct WhatsApp Cloud API integration to send rent receipts and pending balance reminders to tenants.
- [ ] **Resident Self-Service Portal**: Dedicated mobile-responsive portal for residents to view payment history and download receipts.
- [ ] **Dynamic UPI QR Codes**: Auto-generated dynamic UPI payment QR codes on digital rent receipts.

---

## 🏆 Great Indian AI Internship Challenge Context

This repository was developed as part of the **Great Indian AI Internship Challenge**.

### Project Motivation

India is home to millions of micro-entrepreneurs and property managers who operate student hostels and paying guest facilities. Most modern SaaS software is built primarily in English with complex nested dashboards, creating an accessibility barrier for non-English speaking operators.

**Choose Bed + PG Saathi AI** demonstrates how combining robust full-stack web architecture with localized **Indic Voice Intelligence** can solve authentic operational friction. By grounding spoken Indian-language queries directly into a relational database with zero-token deterministic resolution, the platform delivers high utility while maintaining ultra-low operational inference costs.

---

## 🤝 Contributing, License & Acknowledgements

### Contributing

Contributions and feature suggestions are welcome! Please review [CONTRIBUTING.md](CONTRIBUTING.md) for branch naming standards, commit conventions, and pull request guidelines.

### Version History

For a comprehensive log of updates and release milestones, consult [CHANGELOG.md](CHANGELOG.md).

### License

This project is open-source software licensed under the [MIT License](LICENSE).

### Acknowledgements

- [Gnani.ai](https://gnani.ai/) for Indic speech-to-text and neural voice synthesis capabilities.
- [Groq Cloud](https://groq.com/) for fast LPU inference engines.
- [Next.js](https://nextjs.org/) and [Prisma ORM](https://www.prisma.io/) for modern full-stack web foundations.
