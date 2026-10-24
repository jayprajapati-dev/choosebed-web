# Security Controls & Architecture Overview

Choose Ghar and PG Saathi AI are engineered with defense-in-depth security principles. This document outlines the technical security controls, data isolation boundaries, and voice assistant safeguards implemented across the platform.

---

## 🔒 1. Threat Model & Security Invariants

| Risk / Threat | Technical Control & Mitigation | Automated Test Verification |
| :--- | :--- | :--- |
| **Privilege Escalation** (e.g. user claiming `ADMIN` role via registration payload) | Server-side registration strictly overrides client payload, enforcing `role: "BUSINESS_OWNER"`. Client cannot tamper with database role. | `admin_security.test.ts` (Test 5)<br/>`owner_onboarding.test.ts` (Test 1) |
| **Cross-Tenant Data Leakage** (Owner A inspecting Owner B's rooms, residents, or payments) | Every query strictly filters by `ownerId` or `propertyId: { in: ownerPropertyIds }`. Direct queries against foreign properties return `null`. | `owner_onboarding.test.ts` (Test 9)<br/>`rent_dues.test.ts` (Test 7)<br/>`residents.test.ts` (Test 6) |
| **Suspended Account Access** | Edge Middleware and API routes verify `status: "SUSPENDED"`. Suspended sessions are redirected to error screens immediately. | `middleware.ts`<br/>`owner_onboarding.test.ts` (Test 5) |
| **Double Bed Allocation & Overbooking** | Atomic Prisma database transactions and partial unique constraints prevent assigning occupied or maintenance beds. | `residents.test.ts` (Tests 3, 4, 5) |
| **Financial Overpayment & Duplicate Invoicing** | Database `@@unique([residentId, billingPeriod])` prevents duplicate rent generation. Transaction validates `amount <= remainingBalance`. | `rent_dues.test.ts` (Tests 1, 5, 6) |
| **Voice AI Database Mutation Exposure** | The voice assistant pipeline is strictly **100% read-only**. No voice command can insert, update, or delete database records. | `voice_room_queries.test.ts` |
| **PII / Credit Card Leakage to Third-Party LLMs** | Standard queries execute locally via deterministic Regex (Layer A). When Layer B (Groq) is invoked, input is stripped of phone numbers and capped to 250 characters. | `groqClient.ts`<br/>`voice_room_queries.test.ts` |

---

## 🛡️ 2. Role-Based Access Control (RBAC) Matrix

| Endpoint / Capability | Public (`ANONYMOUS`) | Standard (`USER`) | Business Owner (`BUSINESS_OWNER`) | Platform Admin (`ADMIN`) |
| :--- | :---: | :---: | :---: | :---: |
| **Landing & Marketing Pages** | ✅ Full Access | ✅ Full Access | ✅ Full Access | ✅ Full Access |
| **Sign In / Sign Up / Password Reset** | ✅ Full Access | 🔄 Redirect | 🔄 Redirect | 🔄 Redirect |
| **Owner First-Time Setup Wizard (`/user/setup`)** | ❌ 307 Redirect | ❌ 307 Redirect | ✅ (If incomplete) | 🔄 Redirect to `/admin` |
| **Owner Operations Portal (`/user/*`)** | ❌ 307 Redirect | ❌ 403 / Redirect | ✅ Full Access | 🔄 Redirect to `/admin` |
| **PG Saathi Voice Assistant (`/api/user/voice/*`)** | ❌ 401 Unauthorized | ❌ 403 Forbidden | ✅ Authenticated Scope | ❌ 403 Forbidden |
| **Admin Cockpit & Audit Trail (`/admin/*`)** | ❌ 307 Redirect | ❌ 307 Redirect | ❌ 307 Redirect | ✅ Full Access |
| **Owner Suspension & Verification APIs** | ❌ 401 Unauthorized | ❌ 403 Forbidden | ❌ 403 Forbidden | ✅ Full Access |

---

## 🎙️ 3. PG Saathi AI: Voice Intelligence Security

### 1. Read-Only Policy
PG Saathi AI is architected as an informative copilot, not a write operator.
- Action queries like *"एक न्यू एसी रूम एड कर दो"* or *"राहुल को ऐड कर लो"* resolve to guidance intents (`ROOM_CREATION_GUIDANCE`, `BOOKING_OR_ADMISSION`).
- The assistant directs owners to authenticated dashboard sections (`/user/rooms`, `/user/residents`), completely eliminating the risk of voice-prompt injection mutations.

### 2. Multi-Tenant Scoping
Every voice query requires an authenticated NextAuth session:
```typescript
const owner = await prisma.user.findUnique({
  where: { id: session.user.id },
  select: { id: true, status: true },
});
```
The query resolution strictly binds to properties owned by `session.user.id`. Even if an owner asks about a room number that exists in another owner's building, the database query strictly isolates records by `propertyId: { in: activeOwnerPropertyIds }`.

### 3. Credit & Quota Protection
- **VAD Silence Detection**: Microphone stops automatically after 1.4 seconds of silence following speech.
- **Idle Noise Timeout**: Microphone cancels after 4 seconds of ambient noise without speech, preventing wasted STT credits.
- **Audio Size Validation**: Rejects audio uploads larger than 10MB or smaller than 1KB.
- **Server-Side TTS Cache**: Generated speech responses are cached in memory on the client to prevent duplicate synthesis calls when re-rendering or replaying.

---

## 🔑 4. Secrets Management & Environment Hygiene

- Server secrets (`DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `GNANI_API_KEY`, `GROQ_API_KEY`) are never exposed to the client.
- Only variables prefixed with `NEXT_PUBLIC_` are bundled in client-side JavaScript.
- All secret files (`.env`, `.env*.local`) are ignored in `.gitignore`.
- `.env.example` contains only variable names and safe placeholder strings.
