# AsoBeast skills for Claude Code

Forty ASO and app marketing skills that answer with your own AsoBeast data: audits, keyword research, metadata, competitors, top charts, reviews, localization, Apple Search Ads, monetization and more.

## Install

1. Connect the AsoBeast MCP server to Claude Code, see [Connect an agent](https://docs.asobeast.com/mcp/setup).
2. Add the marketplace and install the plugin:

```bash
claude plugin marketplace add AsoBeast/asobeast
claude plugin install asobeast@asobeast
```

3. Ask, for example, "run an ASO audit of my app" or "what did my competitors change this week". `/asobeast:aso-router` picks the right skill when you are not sure.

A read only token runs every skill. Inspecting a keyword, tracking keywords or adding competitors from a skill needs a token with write access.

## Credits

Adapted from [ASO Skills](https://github.com/appeeky/aso-skills) by Appeeky under the MIT License. See `NOTICE.md` and `LICENSE`.
