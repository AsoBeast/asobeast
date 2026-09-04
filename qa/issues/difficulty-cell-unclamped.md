## Summary
The keyword table converts difficulty to its 0-100 display scale by multiplying by 10 in the
web app, without the clamp the API applies in its own `toDifficulty100` helper. Any stored
difficulty above 10 renders above 100 with a progress bar drawn past its track.

## Severity
P3 cosmetic
Impact: not reachable through the normal scoring path, so no user should hit this today.
`computeDifficulty` clamps to 0-10 before writing (`clamp` defaults to `lo = 0, hi = 10`),
so stored values are always in domain. This is a robustness and consistency defect: the
presentation rule is duplicated in the web app and the copy dropped the bound.

## Environment
- Commit: 08225c3c60912d52521d849d2e01855e62e4da1a on claude/asobeast-regression-testing-f0udcj
- Stack: `next build` + `next start`, API on Nest, PostgreSQL 16
- Browser: Chromium 1194, viewport 1600x1000
- Account: owner, data state: QA seed with difficulty values written directly to
  `KeywordMetric`, deliberately out of the 0-10 domain, to exercise the boundary

## Steps to reproduce
1. Write a `KeywordMetric` row with `difficulty = 48.2` and another with `difficulty = 100`
   (values outside the 0-10 domain the scorer produces)
2. Open `/apps/<id>/keywords`
3. Read the DIFFICULTY cells
Reproducibility: 5/5 attempts.

## Expected result
Displayed difficulty stays within 0-100 for any stored value, matching the API's own
conversion `toDifficulty100 = clamp(difficulty * 10, 0, 100)`
(`apps/api/src/scoring/formulas.ts:196`), the way `volume` already behaves: the API's
`toVolume = clamp(traffic * 10, 0, 100)` correctly clamped the same seeded traffic of 62.5
down to `volume: 100`, and the TRAFFIC column rendered 100.

## Actual result
DOM cells read from the table:

```
HEADERS: ["","KEYWORD","SOURCE","POSITION","TRAFFIC","DIFFICULTY","OPPORTUNITY","Δ7D","VOLATILITY",""]
ROW    : ["","geography quiz","Manual",">200","100","482","67","—","—",""]
ROW    : ["","zażółć gęślą jaźń","Manual","200","100","1000","61","—","—",""]
ROW    : ["","map game","Manual","7","0","0","54","0","—",""]
```

The API returned `difficulty: 48.2` and `difficulty: 100` for those two keywords, so the
cells show 482 and 1000. The difficulty progress bar is drawn full and overshoots.

## Evidence
- Screenshot: `qa/evidence/ui/keywords-table-wide.png`
- API for the same rows: `{"text":"geography quiz","traffic":62.5,"difficulty":48.2,"volume":100,"opportunity":67}`
  and `{"text":"zażółć gęślą jaźń","traffic":100,"difficulty":100,"volume":100,"opportunity":61}`
- Database: `KeywordMetric` holds exactly 48.2 and 100, so nothing is transformed server side

## Suspected cause
Hypothesis, not fixed here. `apps/web/src/components/keywords/keyword-cells.tsx:31`:
```ts
case "difficulty":
  return keyword.difficulty === null ? null : keyword.difficulty * 10;
```
The neighbouring `case "traffic"` reads `keyword.volume`, which the API already clamped.
Difficulty has no pre-clamped counterpart in the payload, so the web app recomputes it and
loses the bound.

## Related
TC-UI-015. See `qa/report-2026-09-04.md`.
