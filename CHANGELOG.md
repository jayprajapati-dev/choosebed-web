# Changelog

All notable changes to the **Choose Bed** and **PG Saathi AI** platform are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.6.2] - 2026-10-24

### Added

- **PG Saathi AI Conversational Engine**:
  - Deterministic Indic and English natural language parser (Hindi, Gujarati, Roman Hindi / Hinglish, English).
  - Central Capability Registry enforcing verified query contracts, strict data boundaries, and safe fallbacks.
  - Multi-turn conversational context memory (room follow-up tracking, TTL expiry, intent resets).
  - Grounded database queries for resident pending rent dues (`PAYMENT_HISTORY_OR_DUES`), room inquiries, and occupant data.
  - Personalized resident booking and room creation guidance (`BOOKING_OR_ADMISSION`, `ROOM_CREATION_GUIDANCE`).
- **Voice Pipeline Integration**:
  - Voice Activity Detection (VAD) with live audio soundwave activity visualizer in UI.
  - Intelligent silence detection (1.4s post-speech auto-submit, 4s idle noise auto-cancellation).
  - Extended utterance window from 10s to 30s for natural sentence delivery.
  - Audio caching layer for Gnani Timbre TTS to eliminate redundant external synthesis calls.
- **Repository Automation & Documentation**:
  - Master automated test runner (`src/__tests__/run_all_tests.ts`) executing 8 test suites.
  - Comprehensive documentation suite under `docs/` (`architecture/overview.md`, `development/setup.md`, `testing/strategy.md`, `security/overview.md`).
  - GitHub Actions CI workflow, PR templates, and issue templates.
  - Standardized `SECURITY.md`, `CONTRIBUTING.md`, `LICENSE`, and `package.json` scripts.

### Fixed

- **Voice Assistant Bug Regressions**:
  - Fixed AC/Non-AC filtering: prevented AC vacancy checks from returning `NON_AC` rooms.
  - Fixed resident admission requests ("ऐड कर लो राहुल नेम का") being erroneously treated as vacancy checks.
  - Fixed room creation requests ("एक न्यू एसी रूम एड कर दो") being misclassified as AC availability checks.
  - Fixed result card persistence: isolated room cards to relevant latest turns and suppressed cards on guidance intents.
  - Replaced internal milestone label `(Phase E)` on Dashboard Add Property button with clean production copy.

### Security

- Verified strict multi-tenant boundary checks across all owner property, room, resident, and ledger queries.
- Ensured voice assistant operates 100% read-only with zero database mutation surface.
- Hardened Edge middleware (`src/middleware.ts`) against account suspension and role tampering.

---

## [1.6.0] - 2026-10-15

### Added

- Phase F: Financial ledger, rent charge generation, and partial payment recording.
- Multi-building property portfolio support for verified owners.
- Digital resident check-ins, bed inventory allocation, and check-out workflows.
- Super Admin Cockpit: PG Owners directory, real-time property oversight, and security audit log.
- Role-based session access controls segregating `ADMIN` and `BUSINESS_OWNER` portals.
