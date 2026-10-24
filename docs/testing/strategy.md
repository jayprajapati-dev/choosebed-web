# Testing Strategy & Verification Matrix

Choose Bed and PG Saathi AI maintain a rigorous automated test suite designed to ensure multi-tenant data safety, financial ledger consistency, role-based security, and conversational AI reliability.

---

## 🎯 Testing Philosophy

1. **Zero External Credit Waste in CI**: External AI APIs (Gnani STT/TTS, Groq Cloud) are unit-mocked in automated tests to prevent quota consumption and flaky external network failures.
2. **Deterministic Availability Truth**: Vacancies are computed strictly from real database status (`Bed.status === "AVAILABLE"`). Maintenance beds (`MAINTENANCE`) and occupied beds (`OCCUPIED`) are never reported as free.
3. **Multi-Tenant Scoping Isolation**: Every domain operation verifies that Tenant A cannot read, query, or mutate Tenant B's properties, rooms, beds, residents, or payments.
4. **Regression Guarding**: Real conversation edge cases (e.g. AC queries returning Non-AC rooms, resident admissions confused with vacancy checks) are permanently captured as automated assertions.

---

## 📊 Test Suite Matrix (158 Passing Tests)

The project includes 8 dedicated test suites located under `src/__tests__/`:

| Test Suite                | File                         | Scope & Invariants Tested                                                                                                                                                                  | Assertions | Status        |
| :------------------------ | :--------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :------------ |
| **1. Admin Security**     | `admin_security.test.ts`     | Super Admin route guards, unauthenticated API 401/307 rejection, public registration role tampering prevention (`role: ADMIN` stripped).                                                   | 5          | ✅ PASS       |
| **2. Notifications**      | `notifications.test.ts`      | Notifications API authentication requirements, unauthenticated 401 enforcement.                                                                                                            | 1          | ✅ PASS       |
| **3. Owner Onboarding**   | `owner_onboarding.test.ts`   | Mobile number & email login, bcrypt password hashing, suspension enforcement, setup wizard locking, property tenant isolation.                                                             | 25         | ✅ PASS       |
| **4. Rent Dues & Ledger** | `rent_dues.test.ts`          | Duplicate monthly billing prevention, partial payment calculation, settlement precedence, overpayment blocking, deposit segregation, receipt uniqueness.                                   | 11         | ✅ PASS       |
| **5. Residents & Beds**   | `residents.test.ts`          | Atomic check-in transactions, OCCUPIED/MAINTENANCE bed allocation blocks, partial unique index locks, checkout bed restoration, occupancy rates.                                           | 10         | ✅ PASS       |
| **6. Rooms & Beds**       | `rooms_beds.test.ts`         | Atomic bed generation across sharing tiers (1–4), unique room number constraint per property, cross-property room reuse, cascade deletion.                                                 | 7          | ✅ PASS       |
| **7. Auth Regressions**   | `security.test.ts`           | Session provider tampering prevention, JWT update callback database refetching, query log suppression in production, impersonation passwords.                                              | 6          | ✅ PASS       |
| **8. PG Saathi Voice AI** | `voice_room_queries.test.ts` | Capability Registry validation, multilingual intent parsing (Hindi, Gujarati, English, Indic numerals), conversational follow-up context TTL, AC room filter isolation, live dues queries. | 93         | ✅ PASS       |
| **Total**                 |                              | **8 Comprehensive Automated Test Suites**                                                                                                                                                  | **158**    | **100% PASS** |

---

## 🚀 Running the Tests

### Master Test Runner (Runs All 8 Suites)

```bash
npx tsx src/__tests__/run_all_tests.ts
```

Output:

```text
=================================================================
Choose Bed + PG Saathi AI — Master Test Suite Verification
=================================================================
▶ Running: Admin Security & Privilege Escalation (admin_security.test.ts)... ✅ PASS (8.1s)
▶ Running: Notifications Endpoint Security (notifications.test.ts)... ✅ PASS (3.0s)
▶ Running: Owner Onboarding & Multi-Tenant Boundary (owner_onboarding.test.ts)... ✅ PASS (9.4s)
▶ Running: Rent Charges, Dues & Receipts (rent_dues.test.ts)... ✅ PASS (10.1s)
▶ Running: Resident Allocation & Bed Invariant Locks (residents.test.ts)... ✅ PASS (8.4s)
▶ Running: Rooms & Beds Atomic Inventory (rooms_beds.test.ts)... ✅ PASS (9.9s)
▶ Running: Authentication & Session Security Regressions (security.test.ts)... ✅ PASS (2.1s)
▶ Running: PG Saathi AI Voice Intelligence & Regression Suite (voice_room_queries.test.ts)... ✅ PASS (2.4s)
-----------------------------------------------------------------
Total Suites: 8 | Passed: 8 | Failed: 0 | Total Time: 53.4s
=================================================================
```

### Running Specific Suites

```bash
# Voice AI Intent & Conversational Engine Tests
npx tsx src/__tests__/voice_room_queries.test.ts

# Financial Rent & Dues Ledger Tests
npx tsx src/__tests__/rent_dues.test.ts

# Security & Multi-Tenant Isolation Tests
npx tsx src/__tests__/admin_security.test.ts
```

---

## 🛡️ Mocking Strategy

To guarantee reproducible tests and avoid live API rate-limits:

- **Groq Client**: Unit tests verify graceful degradation when `GROQ_API_KEY` is omitted and test token/latency metric counters without hitting external LLM endpoints.
- **Gnani STT / TTS**: Safeguard tests verify that missing keys trigger clean `GNANI_CONFIG_ERROR` exceptions, test text emoji stripping, and validate indicated digit normalization (`૧૦૨` -> `102`) completely in memory.
