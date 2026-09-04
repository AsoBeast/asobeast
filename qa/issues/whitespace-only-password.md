## Summary
Registration accepts a password made only of whitespace. Ten space characters satisfies the
ten character minimum, the account is created, and the same ten spaces then log the user in.

## Severity
P3 cosmetic
Impact: the owner of a self-hosted instance can only do this to their own account, and it
does not let anyone else in, so the blast radius is small. It is a missing hardening step:
the minimum length check counts characters the user cannot see and probably did not intend.

## Environment
- Commit: 08225c3c60912d52521d849d2e01855e62e4da1a on claude/asobeast-regression-testing-f0udcj
- Stack: API on Nest, PostgreSQL 16, Redis
- Account: none yet; this is the first-run owner registration

## Steps to reproduce
1. Start with an empty database so `GET /auth/status` reports `setupRequired: true`
2. `POST /auth/register` with `{"email":"a@b.com","password":"          "}` (ten spaces)
3. `POST /auth/login` with the same email and the same ten spaces
Reproducibility: 5/5 attempts.

## Expected result
The password is trimmed before validation and rejected as empty, the way the keyword input
already does: `normalizeKeyword` refuses `"     "` with "Keyword must not be empty".

## Actual result
Step 2 returns 201 and creates the owner:
```
{"id":"cmtncj88b0000c97dmp35hf3i","email":"a@b.com","emailVerified":false,"name":null,
 "role":"owner","plan":"free","entitled":true,"platformOperator":true}
```
Step 3 returns 200 and signs in. Registration then closes with this account as the owner.

For contrast, a nine character password is correctly refused with
`"password must be longer than or equal to 10 characters"`.

## Suspected cause
Hypothesis, not fixed here. `apps/api/src/auth/dto/register.dto.ts` validates the password
with `@MinLength(10) @MaxLength(128)` and no trimming or content rule.
`ChangePasswordDto` carries the same pair, so changing a password to whitespace is likely to
behave the same way; that path was not exercised in this run.

## Related
TC-AUTH-005. See `qa/report-2026-09-04.md`.
