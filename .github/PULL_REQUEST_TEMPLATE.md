<!-- Keep this to one screen: about 250 words outside <details>. Write for a teammate who has not read the issue. Say what a person notices first and how it works second. Delete every comment before you open the pull request, because the title becomes the changelog line and the description becomes the squash commit body on main. Delete the Closes line when no issue applies. -->

Closes #

## What changes

<!-- One to three sentences. What can someone do now that they could not before, or what no longer breaks. Name the screen. -->

## Screenshot

<!-- Required when anything in the web app looks or behaves differently. One "after" shot of the main state is enough; a fix adds "before". A flow one picture cannot show adds a short video. Never show real customer data, a token or a console key. Reference the file here and attach it with gh 2.99 or later:
     ![Discovered tab in the light theme](./after.png)
     gh pr create --body-file body.md --attach './after.png#Discovered tab in the light theme'
     gh pr edit <number> --attach './after.png#Discovered tab in the light theme'
     gh uploads only for accounts with write access. From a fork, upload it against your fork as CONTRIBUTING.md shows, or drag the file into this box in the browser.
     With no visible change, write "No visible change." -->

## Worth a look

<!-- Up to three bullets, one line each: a decision a reviewer might question, or the spot that carries the risk. Skip the section when there is nothing. -->

-

**Compatibility:** <!-- additive, or no contract change. A breaking change to the HTTP contract, the @asobeast/shared contract types or the MCP tools needs the next major version and a BREAKING CHANGE: footer; nothing else takes the footer. -->

## How it was checked

<!-- Two or three sentences: what you checked by hand, where (stack, browsers, widths, themes), what failed and was fixed, and what you did not check. CI reports the suites, so do not copy pass counts. Put the full QA table in a <details> block. -->

<details>
<summary>Checklist</summary>

- [ ] Code review (`agent-skills`) and `/open-code-review:review` ran on the final diff, findings fixed
- [ ] Manual QA covered the plan and its edge cases
- [ ] A screenshot is attached, or nothing visible changed
- [ ] New behaviour has unit tests, and contract changes have e2e tests
- [ ] A `fix` has a regression test that failed before the fix
- [ ] Nothing on the HTTP contract, `@asobeast/shared` contract types or MCP tools is removed, renamed or narrowed
- [ ] A visible `feat` has its What's New line
- [ ] `/docs`, `README.md` and `AGENTS.md` updated where behaviour, configuration or the API changed
- [ ] No comments in changed code, no `any` outside the provider boundary

</details>

<!-- Release Please reads the end of the description. An extra feat: or fix: changelog line goes here as its own paragraph, and a BREAKING CHANGE: footer comes last. -->
