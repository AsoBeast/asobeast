# Evidence

Curated from the 2026-09-04 regression pass. The full run produced 45 screenshots across
every route at three viewports; the routine "this page loaded and looked normal" captures
were pruned and what remains is the evidence the report and the filed issues actually cite.

| File | Supports |
| --- | --- |
| `docker-pull-blocked.log` | The Docker blocker in report §1: the 403 on Docker Hub's blob CDN |
| `environment.txt` | Commit, branch, versions |
| `unit-tests-summary.log` | TC-REPO-001: 186 suites, 1969 tests passing |
| `ui/findings.json` | The raw UI sweep record: per-route load status, console errors, page errors, failed requests, overflow measurements, XSS checks |
| `ui/keywords-table-wide.png` | Issues #50 (icon alt text overlapping the app name) and #52 (difficulty 482 / 1000) |
| `ui/backend-down-keywords.png` | TC-UI-013: the error state with a Try again button while the API is stopped |
| `ui/desktop-app-keywords.png` | Baseline at 1440x900 |
| `ui/mobile-app-keywords.png` | TC-UI-004: no horizontal overflow at 375px |
| `ui/dark-app-keywords.png` | TC-UI-005: dark mode |
| `ui/session-expiry.png` | TC-UI-002: redirect to /login after the session cookie is dropped |

Server logs from the run (`_api.log`, build logs) were not kept; they were 700 KB of routine
request logging with nothing a finding depends on.
