# Security Policy

Choose Bed and PG Saathi AI take security, tenant data isolation, and responsible disclosure seriously. This document outlines our vulnerability disclosure process, threat model, and core security controls.

---

## 🛡️ Supported Versions

Only the latest version on the `main` branch receives active security updates and vulnerability patches.

| Version | Supported          |
| ------- | ------------------ |
| 1.6.x   | :white_check_mark: |
| < 1.6.0 | :x:                |

---

## 🔐 Core Security Architecture

Choose Bed enforces strict multi-tenant and role-based architectural boundaries:

1. **Role-Based Access Control (RBAC)**:
   - `ADMIN`: High-level platform health, owner lifecycle (`ACTIVE`, `SUSPENDED`), property verification, and tamper-evident audit trails. Cannot access owner operations.
   - `BUSINESS_OWNER`: Isolated property management (rooms, beds, resident onboarding, rent ledgers, PG Saathi voice queries). Strictly scoped to properties owned by their `ownerId`.
   - `USER`: Read-only portal or resident capabilities.

2. **Edge Route Protection (`src/middleware.ts`)**:
   - Enforces NextAuth JWT token verification at the network boundary.
   - Blocks `SUSPENDED` accounts immediately with redirect to error screen.
   - Prevents `ADMIN` accounts from entering `/user` routes and non-admins from entering `/admin`.
   - Enforces first-time onboarding wizard `/user/setup` completion before granting dashboard access.

3. **Multi-Tenant Data Scoping**:
   - Every database operation queries `Property` and child models (`Room`, `Bed`, `Resident`, `RentCharge`) with explicit `propertyId: { in: ownerPropertyIds }` or `ownerId: session.user.id`.
   - Cross-tenant data access attempts return `null` or HTTP 403 / 404.

4. **PG Saathi AI Voice Pipeline Safeguards**:
   - **100% Read-Only**: The voice assistant performs zero database mutations. Actions like adding rooms, creating residents, or recording payments provide contextual guidance to dashboard URLs (`/user/rooms`, `/user/residents`).
   - **Zero PII Leakage to LLMs**: Standard queries execute deterministically via Layer A regex with zero LLM API calls. For Layer B fallbacks, queries are sanitized and truncated (max 250 characters) with no phone numbers, passwords, or emails passed.
   - **Token & Credit Quota Guards**: Hard recording timeouts, Voice Activity Detection (VAD) silence auto-stop, client audio size validation, and server-side character length checks prevent API quota drain.

5. **Secrets & Credential Hygiene**:
   - Environment variables are divided between client-safe (`NEXT_PUBLIC_*`) and server-only (`DATABASE_URL`, `NEXTAUTH_SECRET`, `GNANI_API_KEY`, `GROQ_API_KEY`).
   - `.env` files are strictly excluded via `.gitignore`.
   - Passwords use industry-standard `bcrypt` hashing with salt rounds.

---

## 🚨 Reporting a Vulnerability

If you discover a security vulnerability, please **DO NOT** open a public issue on GitHub. Public disclosure before a fix is available puts user and tenant data at risk.

### Responsible Disclosure Process:

1. **Email Details**: Send a detailed vulnerability report to:
   - **Email**: `security@choosebed.com` (or repository maintainer contact)
2. **Include in Report**:
   - Type of vulnerability (e.g., IDOR, privilege escalation, credential leakage, SSRF).
   - Step-by-step reproduction instructions or proof-of-concept (PoC).
   - Affected URLs, endpoints, or file paths.
   - Estimated impact on owners, residents, or platform governance.
3. **Response Timeline**:
   - **Initial Acknowledgement**: Within 24–48 hours.
   - **Triage & Assessment**: Within 5 business days.
   - **Patch Release**: Deployed to `main` as an expedited hotfix.

---

## 🚫 Out of Scope

The following issues are generally considered out of scope:

- Rate-limiting reports on public marketing static assets without service impact.
- Vulnerabilities requiring physical access to a user's unlocked device.
- Known development banners or local environment mocks without server exposure.
