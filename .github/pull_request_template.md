## Description

<!--- Describe your changes in detail -->

## Motivation & Context

<!--- Why is this change required? What problem does it solve? -->
<!--- If it fixes an open issue, please link to the issue here. -->

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring / Performance improvement

## Quality Checklist

- [ ] My code follows the code style and formatting conventions of this project (`npm run fix-style`).
- [ ] I have verified TypeScript compilation with `npx tsc --noEmit`.
- [ ] I have verified linting with `npm run check-lint`.
- [ ] I have executed the automated tests (`npx tsx src/__tests__/run_all_tests.ts` or relevant suites).
- [ ] I have not committed any real secrets, `.env` files, or production credentials.
- [ ] If changing database schema, I have explained the migration impact.
- [ ] If changing voice assistant behavior, I have confirmed zero database mutation side-effects.
