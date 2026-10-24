# Contributing to Choose Bed & PG Saathi AI

Thank you for your interest in contributing to **Choose Bed** and **PG Saathi AI**! Whether you are submitting a bug fix, improving documentation, or proposing an architectural enhancement, we welcome your collaboration.

---

## 🧭 Code of Conduct

We expect all contributors to maintain a respectful, constructive, and inclusive environment. Harassment, condescending language, and disruptive behavior will not be tolerated.

---

## 🚀 Getting Started

### 1. Prerequisites

- **Node.js**: `v20.x` or newer (LTS recommended)
- **Package Manager**: `npm`
- **Database**: PostgreSQL (v14+ recommended; local instance or cloud hosted via Supabase / Neon)
- **Git**: Installed and configured with your name and email

### 2. Fork & Clone

```bash
git clone https://github.com/<your-username>/chooseroom-web.git
cd chooseroom-web
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Setup Environment

```bash
cp .env.example .env
# Fill in your local DATABASE_URL and NEXTAUTH_SECRET
```

### 5. Initialize Database

```bash
npx prisma generate
npx prisma db push
```

---

## 🌿 Branching Strategy

We follow a simple, feature-branch workflow:

- `main`: Production-ready, stable codebase. Direct commits to `main` are restricted.
- Feature branches: `feat/<short-description>` (e.g., `feat/whatsapp-rent-reminders`)
- Bugfix branches: `fix/<short-description>` (e.g., `fix/ac-voice-filtering`)
- Documentation: `docs/<short-description>` (e.g., `docs/architecture-update`)
- Refactoring / Chores: `refactor/<short-description>` or `chore/<short-description>`

---

## 📝 Commit Conventions

Commit messages should be concise and follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat(voice): support Hindi Gujarati Devanagari room availability queries
fix(security): prevent public registration tampering with admin roles
docs(readme): add PG Saathi AI architecture and setup guide
test(dues): add overpayment and duplicate charge regression tests
```

---

## 🧪 Quality Standards & Verification

Before submitting a Pull Request, you must verify your changes with the project's quality checks:

```bash
# 1. Type Checking
npx tsc --noEmit

# 2. Linting
npm run check-lint

# 3. Master Automated Test Suite (All 8 Suites)
npx tsx src/__tests__/run_all_tests.ts

# 4. Production Build Verification
npm run build
```

---

## 🔒 Security Guidelines

1. **Never Commit Secrets**: Do not commit real `.env` files, API keys, or production database strings.
2. **Multi-Tenant Boundaries**: Every database query affecting owner properties or residents must explicitly filter by `ownerId` or `propertyId: { in: ownerPropertyIds }`.
3. **Voice Safety**: The PG Saathi AI voice pipeline is strictly **read-only**. Never introduce database mutations through voice queries.
4. **LLM Cost Safeguards**: Standard room and bed queries must remain deterministic with zero token cost.

---

## 📬 Pull Request Process

1. Ensure all tests, linter, and build checks pass cleanly.
2. Reference any related GitHub issue in your PR description.
3. Keep PRs focused on a single logical change rather than combining unrelated features.
4. Maintainers will review your PR and provide constructive feedback.
