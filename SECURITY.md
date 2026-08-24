# Security Policy

## Supported versions

Only the latest published asobeast release receives security updates.

## Reporting a vulnerability

Report suspected vulnerabilities through [GitHub private security advisories](https://github.com/AsoBeast/asobeast/security/advisories/new). Never disclose a vulnerability in a public issue, pull request, discussion, or other public channel.

You can expect an acknowledgement within 72 hours and an initial assessment within seven days. Please include the affected version, deployment model, reproduction steps, impact, and any proposed mitigation. Maintainers will coordinate validation, remediation, and disclosure with you through the private advisory.

## Known advisories

Advisories that are open against the dependency tree and cannot be closed by an
upgrade are recorded in [SECURITY-ADVISORIES.md](SECURITY-ADVISORIES.md), with
the path that reaches each one and why it is not exploitable here. That file is
regenerated at every release.

## In scope

- Authentication and session handling
- The entitlement guard
- The API token surface
- The Next.js proxy route
- Webhook signing
- Alert delivery
- Unsafe parsing of remote store responses
- Dependency vulnerabilities
- Any path that lets an unauthenticated request reach application data

## Out of scope

- Rate limits imposed by Apple or Google
- Results from running the stack with the API port deliberately published
- Reports that require the operator's own database credentials
