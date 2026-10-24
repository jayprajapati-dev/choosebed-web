# Local Development Setup Guide

This document provides complete instructions for setting up and running **Choose Ghar** and **PG Saathi AI** locally on your development machine.

---

## 💻 Prerequisites

Ensure you have the following installed on your machine:

- **Node.js**: `v20.x` or newer (`node -v`)
- **Package Manager**: `npm` (`npm -v`)
- **Database**: PostgreSQL (v14 or higher; local instance or hosted on [Supabase](https://supabase.com/) / [Neon](https://neon.tech/))
- **Git**: Installed and configured

---

## 🛠️ Step-by-Step Installation

### 1. Clone Repository

```bash
git clone https://github.com/chooseroom/chooseroom-web.git
cd chooseroom-web
```

### 2. Install Node Dependencies

```bash
npm install
```

### 3. Environment Variables Configuration

Copy the example environment template:

```bash
cp .env.example .env
```

Open `.env` and configure the core variables:

```env
# 1. PostgreSQL Database Connection (Required)
DATABASE_URL="postgresql://postgres:password@localhost:5432/chooseghar?schema=public"
DIRECT_URL="postgresql://postgres:password@localhost:5432/chooseghar"

# 2. NextAuth Authentication (Required)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-random-32-char-secret-key-here"
SECRET="generate-a-random-32-char-secret-key-here"

# 3. Optional Voice & LLM Integrations (Voice Assistant PG Saathi)
# Note: Standard room and bed queries work 100% locally WITHOUT these keys!
GNANI_API_KEY=""
GNANI_BASE_URL="https://api.vachana.ai"

GROQ_API_KEY=""
GROQ_MODEL="qwen/qwen3.8-27b"
```

> [!NOTE]
> **PG Saathi AI operates gracefully without third-party API keys!**
> - If `GNANI_API_KEY` is not provided, you can test all queries by typing in the chat input.
> - If `GROQ_API_KEY` is not provided, the deterministic Indic parser (Layer A) resolves 95%+ of standard PG management queries with zero tokens.

### 4. Initialize Database Schema

Generate the Prisma Client and sync your schema with the PostgreSQL database:

```bash
# Generate the TypeScript Prisma client
npx prisma generate

# Push models directly to your PostgreSQL database
npx prisma db push
```

### 5. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Verifying the Installation

To verify that your local environment, database connection, and security controls are working properly, run the test suites:

```bash
# Run Master Test Suite (all 8 suites: 158 tests)
npx tsx src/__tests__/run_all_tests.ts

# Run Voice Assistant regression test suite (93 tests)
npx tsx src/__tests__/voice_room_queries.test.ts

# Verify TypeScript compilation
npx tsc --noEmit

# Verify ESLint code style
npm run check-lint
```

---

## 🔧 Useful Development Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts local Next.js development server on port 3000 |
| `npm run build` | Generates Prisma client and compiles production build |
| `npm run start` | Starts compiled production server |
| `npm run check-lint` | Validates codebase against ESLint rules |
| `npm run fix-lint` | Automatically formats and fixes auto-fixable lint issues |
| `npm run check-format` | Checks code formatting with Prettier |
| `npm run fix-format` | Formats all project files with Prettier |
| `npx prisma studio` | Opens Prisma Web GUI to inspect and edit database records |
| `npx prisma db push` | Synchronizes `schema.prisma` changes with database |

---

## ❓ Troubleshooting Common Issues

### 1. `EPERM: rename query_engine-windows.dll.node`
- **Cause**: Windows file lock when `npm run dev` and `npm run build` are executed simultaneously while Prisma client is in memory.
- **Solution**: Stop the active `npm run dev` process before running `npm run build`, or run `npx next build` directly.

### 2. Microphone permission denied in browser
- **Cause**: Browser security policy blocks microphone on non-HTTPS origins (except `localhost`).
- **Solution**: Ensure you are accessing the app via `http://localhost:3000` (not a remote IP), or enable microphone permissions in your browser's site settings.

### 3. Database connection timeout
- **Cause**: Database instance is paused or connection string is incorrect.
- **Solution**: Verify database credentials in `.env`, test with `npx prisma db pull` or ensure your Supabase/Neon project is active.
