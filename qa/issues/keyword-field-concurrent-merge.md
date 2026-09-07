## Summary
If the App Store keyword field is saved from two places at almost the same moment, the saved
field sometimes ends up containing the keywords from both saves rather than the one saved
last. The user is left with a keyword field they never typed, and it can be pushed well past
the 100 character budget Apple allows.

## Severity
P2 minor
Impact: anyone editing the keyword field in two tabs, or double-submitting the form, on the
one field submitted verbatim to the App Store. Intermittent; workaround is to reload and save
again once noticed. The wrong state is silent: both callers get a 200.

## Environment
- Commit: 08225c3c60912d52521d849d2e01855e62e4da1a on claude/asobeast-regression-testing-f0udcj
- Stack: API `node dist/main`, PostgreSQL 16.13, Redis 7.0.15, run natively
- Account: owner, data state: QA seed, App Store app

## Steps to reproduce
1. `PUT /apps/<id>/keyword-field` `{"text":"reset"}` for a known baseline
2. Fire two saves concurrently: `{"text":"aaa,bbb,ccc"}` and `{"text":"xxx,yyy,zzz"}`
3. `GET /apps/<id>/keyword-field`
Reproducibility: 3/9 attempts merged (intermittent).

## Expected result
Last write wins, as the sequential control shows:
PUT alpha,bravo,charlie -> ['alpha','bravo','charlie']; PUT delta,echo,foxtrot -> ['delta','echo','foxtrot']

## Actual result
['alpha','bravo','charlie','delta','echo','foxtrot'] — both sets retained. Two concurrent
saves of nine keywords each produced charactersUsed=197 against charactersLimit=100.

## Evidence
Sequential control replaces correctly; 9 clean-state concurrent attempts, 3 merged. Over-limit
case reported 197/100. All calls returned 200 with no conflict surfaced.

## Suspected cause
Hypothesis, not fixed. `setKeywordField` (apps/api/src/keywords/keywords.service.ts:312) reads
the current field outside the transaction that writes it, so two interleaved readers each
compute a stale-set that misses the other's keywords.

## Related
TC-CONC-001. Filed as #57. The equivalent race on plain keyword adds is safe (10 concurrent
identical POSTs produced exactly one row).
