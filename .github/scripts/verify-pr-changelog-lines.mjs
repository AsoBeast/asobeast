#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const { REPO, PR_NUMBER, PR_TITLE, PR_BODY = "" } = process.env;
const SQUASH_SUBJECT = /^((\w+)(?:\([\w-]+\))?!?: .+) \(#(\d+)\)$/;
const OVERRIDE_BLOCK = /BEGIN_COMMIT_OVERRIDE([\s\S]*?)END_COMMIT_OVERRIDE/;

const { "changelog-sections": sections } = JSON.parse(
  readFileSync(resolve(root, "release-please-config.json"), "utf8"),
);
const changelogTypes = sections
  .filter((section) => !section.hidden)
  .map((section) => section.type);

function commitSubjects() {
  return execFileSync(
    "gh",
    [
      "api",
      `repos/${REPO}/pulls/${PR_NUMBER}/commits`,
      "--paginate",
      "--jq",
      '.[].commit.message | split("\\n")[0]',
    ],
    { encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean);
}

const carried = commitSubjects()
  .map((subject) => SQUASH_SUBJECT.exec(subject))
  .filter((match) => match !== null)
  .map(([, line, type, number]) => ({ line, type, number }))
  .filter(({ type }) => changelogTypes.includes(type))
  .filter(({ number }) => number !== PR_NUMBER)
  .map(({ line }) => line);

const declared = OVERRIDE_BLOCK.exec(PR_BODY)?.[1] ?? "";
const missing = [PR_TITLE, ...carried].filter(
  (line) => carried.length > 0 && !declared.includes(line),
);

if (missing.length > 0) {
  console.error(
    `Pull request #${PR_NUMBER} carries squash merged pull requests, and the squash keeps only its title as a changelog line.`,
  );
  console.error(
    "Add this block to the description, each line its own paragraph:",
  );
  console.error("");
  console.error("BEGIN_COMMIT_OVERRIDE");
  console.error([PR_TITLE, ...carried].join("\n\n"));
  console.error("END_COMMIT_OVERRIDE");
  process.exit(1);
}

console.log(
  `Pull request #${PR_NUMBER} lists every changelog line it carries.`,
);
