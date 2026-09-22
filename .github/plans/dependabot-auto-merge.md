# Dependabot auto merge: research and implementation plan

Status: phases 0, 1 and 2 are implemented on the `ci/dependabot-auto-merge` branch, 2026-09-22. Phase 3 is a settings checklist for the maintainer, phase 4 happens after the first Monday run, and phase 5 stays optional.

## Summary

Auto merging Dependabot pull requests is safe for this repository when four conditions hold, and every one of them is checkable rather than a matter of trust:

1. The merge is performed by GitHub's native auto merge, so the five required status checks on `main` gate it. Nothing merges on a red or missing check.
2. Only patch and minor updates are eligible. A grouped pull request is judged by its worst member, and a pull request that turns major after a rebase loses auto merge again.
3. A cooldown keeps freshly published versions out of pull requests for seven days, which is the window in which the 2025 and 2026 npm account compromises were detected and pulled.
4. The workflow never checks out or executes pull request code, never interpolates untrusted text into a shell, and only acts on pull requests that `dependabot/fetch-metadata` has verified as Dependabot authored with Dependabot only commits.

The reference implementation in [MrAdex77/google-play-scraper#122](https://github.com/MrAdex77/google-play-scraper/pull/122) already follows this shape. This plan adapts it to a pnpm workspace, Release Please and the CI that this repository actually runs, and it names two blockers that would make auto merge inert or harmful if the workflow were added today.

## What the repository looks like today

Everything below was read from the live repository, its settings, its pull request history and its CI logs on 2026-09-22.

### Repository settings

| Setting                      | Value                    | Meaning for auto merge                                                                        |
| ---------------------------- | ------------------------ | --------------------------------------------------------------------------------------------- |
| Allow auto merge             | enabled                  | `gh pr merge --auto` works without a settings change                                          |
| Allow squash merging         | enabled                  | squash is available as the merge method                                                       |
| Squash commit title          | commit title or PR title | a one commit pull request keeps Dependabot's conventional subject                             |
| Squash commit message        | commit messages          | the pull request body, which carries upstream release notes, never enters the commit          |
| Merge commit message         | PR title                 | this is why Release Please already sees `Merge pull request` commits as conventional          |
| Automatically delete head    | disabled                 | Dependabot deletes its own branches, so this is cosmetic                                      |
| Always suggest update branch | disabled                 | suggests the strict "branches must be up to date" rule is off, which is what auto merge needs |

### Branch protection on `main`

Required status checks, enforced for everyone: `checks`, `e2e`, `web-e2e`, `compose-smoke`, `isolation`. There is no ruleset. Not required today: `openapi-drift`, `upgrade-drill`, `shutdown-drill`, `pipeline-benchmark`, `backup-drill` and CodeQL `analyze`.

Two settings are not visible through the public API and must be confirmed in the branch protection screen before rollout: whether "Require branches to be up to date before merging" is on, and whether an approving review is required. See the checklist in phase 3.

### How Dependabot pull requests have actually gone

Dependabot has opened 24 pull requests since 2026-08-24. None was merged as opened. The maintainer closed them and landed the same upgrades by hand in four commits on 2026-09-12 (`chore(deps): raise the production dependencies` and siblings). Seven Dependabot pull requests are open right now, opened on 2026-09-21. This is the same situation the reference pull request set out to fix.

### Blocker 1: npm pull requests have been red since the move to pnpm 12

Every npm pull request opened after 2026-09-12 changes `package.json` files only. Pull request #116 touches one file, #117 touches five, and neither touches `pnpm-lock.yaml`. CI therefore fails in the first step of every job:

```
ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because pnpm-lock.yaml is not up to date with package.json.
```

Pull requests from before that date, for example #4, #55 and #58, did carry lockfile changes, so the multi directory configuration is not the cause. The cause is the commit `build(repo): move the workspace to pnpm 12` on 2026-09-12. pnpm 12 writes `pnpm-lock.yaml` as a YAML stream of two documents. In this repository the first document holds `packageManagerDependencies` for pnpm itself and the second holds the project graph. Dependabot's parser reads only the first document, concludes the project has no locked dependencies, and falls back to manifest only edits. This is tracked as [dependabot/dependabot-core#15904](https://github.com/dependabot/dependabot-core/issues/15904), open, assigned, reproduced on 2026-08-13. The related pnpm 11 support issue [#14794](https://github.com/dependabot/dependabot-core/issues/14794) closed on 2026-09-15, so the parser is being worked on, but the pull requests of 2026-09-21 show it was not fixed for this repository yet.

Consequence: adding the auto merge workflow today would be harmless for npm, because the required checks would keep every npm pull request unmerged, but it would also achieve nothing for npm until the parser fix lands or a workaround is applied. The workaround reported in the issue thread is a pnpm setting that restores the single document lockfile. It needs to be validated locally by confirming that `pnpm install` rewrites `pnpm-lock.yaml` with a single `lockfileVersion` line before relying on it. The dependable path is to watch the issue and confirm on the next Monday run that a Dependabot pull request again contains `pnpm-lock.yaml`.

### Blocker 2: CodeQL breaks when `init` and `analyze` are bumped separately

Dependabot opens one pull request per `uses:` reference, so `github/codeql-action/init` and `github/codeql-action/analyze` arrive as two pull requests (#111 and #112 this week). On #111 the `analyze` job fails with:

```
Loaded a configuration file for version '4.38.1', but running version '4.37.9'
```

CodeQL is not a required check, so auto merge would land #111 alone and leave CodeQL red on `main` until #112 follows. Grouping the GitHub Actions ecosystem fixes this, because both references then move in one pull request.

### Release Please and the merge method

Release Please parses every commit on `main`. Because the merge commit message setting is "PR title", a merge commit for a Dependabot pull request would read `chore(deps): bump ...` and so would the Dependabot commit inside it. For `chore` and `ci` that is invisible, because both sections are hidden in `release-please-config.json`. For the Docker ecosystem the prefix is `build`, which is a visible section, so a merge commit would list the same base image bump twice.

Squash merging avoids that. Dependabot pull requests carry exactly one commit, the squash settings above take that commit's title and message, and the pull request body with upstream release notes stays out of the commit. That last point matters: Release Please treats a `BREAKING CHANGE:` footer as a major bump, and upstream release notes routinely contain that phrase. The current squash settings make that impossible, and the plan records them as a setting that must not change.

## Research findings

### Native auto merge is the gate, not the workflow

`gh pr merge --auto` only asks GitHub to merge once every requirement of the base branch is satisfied. On a branch with required status checks it waits for them, and a red check keeps it waiting indefinitely. On a branch without required checks it merges immediately, which is why GitHub's own guide and every write up list required checks as a prerequisite rather than an option. This repository already has five.

Two properties follow. A required check whose workflow is skipped by a `paths:` filter never reports, and a pull request that needs it can never merge. `docs.yml` is path filtered and must stay out of the required set. A job that is skipped through `needs:` or an `if:` does report, as `skipped`, which GitHub counts as passing; `compose-smoke` behaves this way when `checks` fails, and that is fine because `checks` is itself required.

### Scope: patch and minor only, judged by the worst member

`dependabot/fetch-metadata` exposes `update-type`, and for a grouped pull request it is the highest semver change in the group. A group holding one major update is therefore held for review even if the other 17 members are patches, which is exactly what happens to #116 today, where `@nestjs/*` moves from 11 to 12 alongside a dozen patches.

Dependabot groups accept `update-types`, so the production and development groups can each be split into a minor and patch group that qualifies for auto merge and a major group that never does. Majors then arrive in their own pull request, and the routine bumps stop being hostage to them.

One more edge exists. Dependabot rebases and force pushes an open group as members change, and GitHub does not re-evaluate an enabled auto merge. A group that was patch only when opened could gain a major later and still merge. The fix, taken from [aletheia-works/.github#60](https://github.com/aletheia-works/.github/pull/60), is to run the workflow on `synchronize` as well and call `gh pr merge --disable-auto` when `update-type` is no longer eligible on a pull request that already has auto merge enabled.

### Cooldown: seven days

GitHub added `cooldown` to `dependabot.yml` and, from July 2026, applies a default of three days to version updates without any configuration. The reference pull request uses seven, and that is the value this plan adopts. The reasoning is the incident record: the September 2025 compromise of a prolific npm maintainer's account and the 2026 CHAINDROP campaign both shipped malware as ordinary patch or minor releases, and both were identified and unpublished within days. Tests do not catch these, because the payloads activate outside the test environment. A seven day wait gives the ecosystem time to notice before Dependabot even opens the pull request. GitHub's Well Architected guidance recommends a minimum of 24 hours, and Renovate's equivalent `minimumReleaseAge` guidance settles on seven days for the same reason.

Cooldown applies to version updates only. Security updates ignore it by design, so a fix for a published advisory is not delayed. The `semver-*-days` keys are supported for npm but not for `github-actions` or `docker`, which take `default-days` only.

### Token and trigger: the built in token on `pull_request` is enough

Workflows that Dependabot triggers through `pull_request` run with a read only token and no repository secrets, and since October 2021 they honour the workflow's `permissions:` key. Declaring `contents: write` and `pull-requests: write` is therefore sufficient for `gh pr merge --auto`. No personal access token, no GitHub App and no secret is needed for the basic workflow.

`pull_request` is preferred over `pull_request_target`. The workflow does not check out code, so it gains nothing from the base branch context, and `pull_request_target` is the trigger behind the documented "pwn request" class of Dependabot attacks. The job condition uses `github.event.pull_request.user.login`, not `github.actor`, because a maintainer re running the workflow becomes the actor and would otherwise trip the guard. `fetch-metadata` independently fails the job unless the pull request was opened by Dependabot and contains only Dependabot commits.

### Known limitation: merges armed with the built in token do not start push workflows

GitHub does not create workflow runs for events caused by `GITHUB_TOKEN`. Several projects have documented that an auto merge armed with that token lands on `main` without triggering `on: push` workflows: [Shurtug4l/sec-recon-agent#221](https://github.com/Shurtug4l/sec-recon-agent/pull/221) compared five commits and found zero push runs after Dependabot merges against a full set after owner merges, and [owfeed/owfeed-packages#41](https://github.com/owfeed/owfeed-packages/issues/41) and [rmartz/bot-automerge#8](https://github.com/rmartz/bot-automerge/issues/8) hit the same wall with Release Please.

For this repository the affected workflows are `release.yml`, `ci.yml` and `codeql.yml` on `push` to `main`. The consequences are bounded:

- Release Please picks up the missed commits on the next human push. `chore` and `ci` commits are hidden and do not create a release on their own, so nothing ships late.
- The exact state of `main` after a Dependabot merge is untested until the next push. Every merged pull request was green on its own head, and with the strict "up to date" rule off that head may be slightly behind `main`, so a semantic conflict between two independently green pull requests is possible in theory. Container images are built only from published releases, which go through a release pull request and a full CI run, so nothing untested is published.
- CodeQL on `main` lags until the next push. Pull request scans still run.

If this is not acceptable, phase 5 replaces the token with a short lived GitHub App installation token. Merges then count as an ordinary actor and start push workflows. That costs an app, two Dependabot secrets and a second pinned action.

### Strict "up to date" rule and the Monday burst

With "Require branches to be up to date before merging" on, every merge invalidates the remaining Dependabot pull requests, Dependabot rebases each one, and CI runs again. With `n` open pull requests that is `(n² + n) / 2` CI runs on a weekly Monday burst of seven. The repository setting that suggests updating branches is off, which normally goes with the strict rule being off, but this must be confirmed. Keeping it off is the recommendation, and the residual risk is the one described in the previous section.

### Verified versions to pin

| Action                                           | Version | Commit                                     |
| ------------------------------------------------ | ------- | ------------------------------------------ |
| `dependabot/fetch-metadata`                      | v3.1.0  | `25dd0e34f4fe68f24cc83900b1fe3fe149efef98` |
| `actions/create-github-app-token` (phase 5 only) | v3.2.0  | `bcd2ba49218906704ab6c1aa796996da409d3eb1` |

Both were read from the tag pages on 2026-09-22 and match the repository's rule of pinning actions to a full commit with a version comment.

## Implementation plan

### Phase 0: unblock Dependabot

1. Close or leave the seven open Dependabot pull requests untouched. They cannot pass CI and will be recreated by the next run.
2. Watch dependabot-core #15904. On the first Monday after it closes, confirm that an npm pull request again modifies `pnpm-lock.yaml` and that `checks` goes green. Until then, npm upgrades continue by hand as on 2026-09-12.
3. Applied: `pmOnFail: ignore` in `pnpm-workspace.yaml`, which is the pnpm 12 replacement for `managePackageManagerVersions: false`, stops pnpm from recording its own version and with it the leading lockfile document. The lockfile was reduced to its dependency document, `pnpm install --frozen-lockfile` passes and leaves it unchanged, and the file parses as one YAML document. Without the setting pnpm re-adds the leading document on the next install, which was confirmed on a scratch copy.

Phases 1 and 2 can be merged before phase 0 completes. They are safe on their own, and the GitHub Actions and Docker ecosystems benefit immediately.

### Phase 1: `.github/dependabot.yml`

Changes, keeping everything else as it is:

- Add `cooldown: { default-days: 7 }` to all three ecosystems.
- Split each npm group by `update-types` so majors travel alone.
- Group all GitHub Actions updates so `codeql-action/init` and `codeql-action/analyze` move together, split the same way.

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directories:
      - /
      - /apps/api
      - /apps/web
      - /apps/mcp
      - /packages/shared
      - /packages/mcp-tools
      - /packages/typescript-config
    schedule:
      interval: weekly
      day: monday
    cooldown:
      default-days: 7
    open-pull-requests-limit: 10
    commit-message:
      prefix: chore
      include: scope
    labels:
      - dependencies
    groups:
      production-dependencies:
        dependency-type: production
        update-types: [minor, patch]
      production-majors:
        dependency-type: production
        update-types: [major]
      development-dependencies:
        dependency-type: development
        update-types: [minor, patch]
      development-majors:
        dependency-type: development
        update-types: [major]
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
      day: monday
    cooldown:
      default-days: 7
    commit-message:
      prefix: ci
      include: scope
    labels:
      - dependencies
      - github-actions
    groups:
      github-actions:
        patterns: ["*"]
        update-types: [minor, patch]
      github-actions-majors:
        patterns: ["*"]
        update-types: [major]
  - package-ecosystem: docker
    directories:
      - /apps/api
      - /apps/web
    schedule:
      interval: weekly
      day: monday
    cooldown:
      default-days: 7
    commit-message:
      prefix: build
      include: scope
    labels:
      - dependencies
      - docker
    ignore:
      - dependency-name: node
        update-types: ["version-update:semver-major"]
```

Notes:

- A `0.x` package treats a minor bump as potentially breaking under semver, and `fetch-metadata` still reports it as `semver-minor`. This repository has few such direct dependencies (`argon2`, `class-validator`, `class-transformer`, `next-themes`, `reflect-metadata`, `source-map-support`, `class-variance-authority`). If that is a concern, add them to the major groups by name with `patterns`, or exclude them from the auto merge group with `exclude-patterns`.
- Dependabot's own weekly commit subjects exceed 72 characters (`bump the production-dependencies group across 1 directory with 18 updates`). commitlint runs only in the local `commit-msg` hook, so this does not fail anything, but it is a known deviation from the convention.

### Phase 2: `.github/workflows/dependabot-auto-merge.yml`

```yaml
name: Dependabot auto merge

on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

permissions: {}

jobs:
  auto-merge:
    if: github.event.pull_request.user.login == 'dependabot[bot]'
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - name: Read the update metadata
        id: metadata
        uses: dependabot/fetch-metadata@25dd0e34f4fe68f24cc83900b1fe3fe149efef98 # v3.1.0

      - name: Decide whether this update qualifies
        id: decide
        env:
          UPDATE_TYPE: ${{ steps.metadata.outputs.update-type }}
        run: |
          case "$UPDATE_TYPE" in
            version-update:semver-patch|version-update:semver-minor) echo "eligible=true" >>"$GITHUB_OUTPUT" ;;
            *) echo "eligible=false" >>"$GITHUB_OUTPUT" ;;
          esac
          echo "update-type=$UPDATE_TYPE" >>"$GITHUB_STEP_SUMMARY"

      - name: Enable auto merge
        if: steps.decide.outputs.eligible == 'true' && github.event.pull_request.auto_merge == null
        env:
          GH_TOKEN: ${{ github.token }}
          PR_URL: ${{ github.event.pull_request.html_url }}
        run: gh pr merge --auto --squash "$PR_URL"

      - name: Withdraw auto merge from an update that is no longer eligible
        if: steps.decide.outputs.eligible != 'true' && github.event.pull_request.auto_merge != null
        env:
          GH_TOKEN: ${{ github.token }}
          PR_URL: ${{ github.event.pull_request.html_url }}
        run: gh pr merge --disable-auto "$PR_URL"
```

Design decisions, each traceable to a finding above:

- The same patch and minor rule applies to npm, GitHub Actions and Docker. The reference pull request auto merges every GitHub Actions update including majors. This plan does not, because a major bump of an action can change defaults such as `persist-credentials` or `fetch-depth` without any test noticing, and majors are rare enough that a manual look costs little. Dropping the distinction is a one line change if the maintainer prefers the reference behaviour.
- `--squash` for the reasons in the Release Please section. Human pull requests keep using merge commits; the repository allows both.
- No checkout, no interpolation of pull request text into `run:`. The only pull request derived value that reaches a shell is the pull request URL, passed through `env`.
- Running on `synchronize` makes the workflow idempotent across Dependabot rebases, and the `auto_merge == null` guard prevents a second enable call. The withdraw step handles a group that turned major.
- If the required checks have already passed by the time the workflow runs, `gh` merges immediately instead of enabling auto merge. The gate is the same either way.
- The `if:` on the job means the workflow is a no op on human pull requests and costs a few seconds of runner time on those.

### Phase 3: settings checklist, done in the GitHub UI

Verify, and record the answers in the pull request that adds the workflow:

1. Branch protection on `main`: "Require branches to be up to date before merging" is off. If it is on, either turn it off and accept the residual risk described above, or accept the CI cost of the Monday burst.
2. Branch protection on `main`: "Require a pull request before merging" with required approvals is off, or the required approval count is zero. If an approval is required, auto merge will wait forever, and the workflow would need an approving review step with a token that is not the built in one, because GitHub does not count an approval from `github-actions[bot]` towards the requirement on a pull request the same token merges. That changes the design and should be decided explicitly rather than worked around.
3. Squash merge settings stay "commit title or PR title" and "commit messages". Any change to "PR title and description" reopens the `BREAKING CHANGE:` footer risk.
4. Consider adding `openapi-drift`, `shutdown-drill`, `upgrade-drill` and `backup-drill` to the required checks. They exercise Prisma, BullMQ and the API boot path, which is exactly where a dependency bump bites, and they already pass on every green pull request. `pipeline-benchmark` should stay optional because it measures wall clock time. CodeQL `analyze` can be required once phase 1 has landed and the mixed version failure is gone. Note that required checks apply to human pull requests as well.
5. Do not make `docs-checks` required. It is path filtered.

### Phase 4: rollout and verification

1. Merge phases 1 and 2 through the normal pull request flow. CI on that pull request validates the YAML.
2. First Monday: expect one GitHub Actions pull request and up to two Docker pull requests. Confirm the workflow ran on each, that the step summary shows the `update-type`, that auto merge is shown on the pull request, and that the pull request merged on its own once the five required checks passed.
3. Confirm the merge commit on `main` is a single squashed commit with Dependabot's conventional subject.
4. Confirm the next Release Please pull request lists no duplicated dependency lines.
5. Confirm that the npm ecosystem stays parked until phase 0 completes, then repeat steps 2 to 4 for the first green npm pull request.
6. Rollback is deleting the workflow file or pressing "Disable auto merge" on a pull request. No state is left behind.

### Phase 5, optional: GitHub App token so merges start push workflows

Only if the missed `push` runs on `main` turn out to matter.

1. Create a GitHub App owned by the AsoBeast organization with repository permissions `contents: write` and `pull-requests: write`, installed on this repository only.
2. Store the app id and private key as Dependabot secrets, not Actions secrets. Workflows triggered by Dependabot only see Dependabot secrets.
3. Add a token minting step before the merge step and pass its output as `GH_TOKEN`:

```yaml
- name: Mint a merge token
  id: app-token
  uses: actions/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1 # v3.2.0
  with:
    app-id: ${{ secrets.DEPENDABOT_MERGE_APP_ID }}
    private-key: ${{ secrets.DEPENDABOT_MERGE_APP_PRIVATE_KEY }}
    permission-contents: write
    permission-pull-requests: write
```

The token lives for the job and is revoked in the action's post step. Merges then appear as the app, and `release.yml`, `ci.yml` and `codeql.yml` run on the resulting push.

### Documentation to update in the same pull request

- `CONTRIBUTING.md`, the paragraph beginning "Dependabot monitors the application Dockerfiles": add that patch and minor updates merge on their own once the required checks pass, and that majors wait for a person.
- `AGENTS.md`, the bullet about `MINT_VERSION` and hand bumped pins: add the same sentence and name the workflow file.

## Risk register

| Risk                                                                 | Likelihood    | Mitigation in this plan                                                          |
| -------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------- |
| A compromised patch release merges before it is discovered           | low           | seven day cooldown; patch and minor only; every required check must pass         |
| A grouped pull request gains a major after auto merge is enabled     | low           | `synchronize` trigger plus the withdraw step                                     |
| `main` breaks because two independently green pull requests conflict | low           | strict rule stays off by choice; images ship only from release pull requests     |
| Release Please misreads a merged Dependabot commit                   | very low      | squash with current settings; body never enters the commit                       |
| Workflow acts on a pull request that is not Dependabot's             | very low      | `user.login` guard plus `fetch-metadata` verification of author and every commit |
| Push workflows on `main` do not run after a merge                    | certain       | documented and bounded; phase 5 removes it if it matters                         |
| npm pull requests never merge                                        | certain today | phase 0; the gate keeps them unmerged, so this is inert rather than harmful      |

## Open questions for the maintainer

1. Is "Require branches to be up to date before merging" on for `main`?
2. Is an approving review required on `main`?
3. Should GitHub Actions majors auto merge as in the reference pull request, or wait for a person as proposed here?
4. Is the missed `push` run on `main` acceptable, or should phase 5 be part of the first rollout?

## Sources

Repository evidence: pull requests #4, #55, #58, #74, #101, #111, #116 and #117 and their check runs and job logs; commits `e99f30d` (pnpm 12), `564caac`, `c0ec307`, `20dc0ca`, `95eeb21` (manual upgrades); `.github/workflows/ci.yml`, `release-please-config.json`, `commitlint.config.mjs`; the public repository and branch protection API responses.

- Reference implementation: <https://github.com/MrAdex77/google-play-scraper/pull/122> and the resulting `auto-merge-dependabot.yml` and `dependabot.yml` on its `main` branch.
- GitHub docs, automating Dependabot with Actions (source in github/docs): <https://github.com/github/docs/blob/main/content/code-security/tutorials/secure-your-dependencies/automate-dependabot-with-actions.md>
- GitHub docs, Dependabot options reference including `cooldown` and `groups.update-types`: <https://github.com/github/docs/blob/main/content/code-security/reference/supply-chain-security/dependabot-options-reference.md>
- GitHub docs, triggering a workflow, events from `GITHUB_TOKEN` do not create runs: <https://github.com/github/docs/blob/main/content/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow.md>
- GitHub changelog, Dependabot triggered workflows respect the `permissions` key: <https://github.blog/changelog/2021-10-06-github-actions-workflows-triggered-by-dependabot-prs-will-respect-permissions-key-in-workflows/>
- GitHub changelog, default three day cooldown: <https://github.blog/changelog/2026-07-14-dependabot-version-updates-introduce-default-package-cooldown/>
- `dependabot/fetch-metadata` README, tags and v3.1.0 release: <https://github.com/dependabot/fetch-metadata>
- pnpm 12 lockfile parsing: <https://github.com/dependabot/dependabot-core/issues/15904> and <https://github.com/dependabot/dependabot-core/issues/14794>
- Group turning major after enable: <https://github.com/aletheia-works/.github/pull/60>
- Built in token merges do not start push workflows: <https://github.com/Shurtug4l/sec-recon-agent/pull/221>, <https://github.com/owfeed/owfeed-packages/issues/41>, <https://github.com/rmartz/bot-automerge/issues/8>
- Auto merge merges immediately without required checks: <https://github.com/synaptiai/synapti-marketplace/issues/170>, <https://github.com/alrayyes/hush-hush-cli/issues/57>
- Path filtered required checks never report: <https://github.com/orgs/community/discussions/44490>
- Strict up to date rule and Dependabot rebases: <https://github.com/dependabot/dependabot-core/issues/3782>
- Supply chain incidents and cooldown reasoning: <https://wellarchitected.github.com/library/application-security/recommendations/managing-dependency-threats/>, <https://blog.gitguardian.com/renovate-dependabot-the-new-malware-delivery-system/>, <https://arxiv.org/html/2609.16605v1>
- Release Please and squash merging: <https://github.com/googleapis/release-please>
- `actions/create-github-app-token` v3.2.0: <https://github.com/actions/create-github-app-token/releases/tag/v3.2.0>
- pnpm 12 release notes: <https://pnpm.io/blog/releases/12.0>
