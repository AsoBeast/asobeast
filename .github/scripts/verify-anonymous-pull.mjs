#!/usr/bin/env node
const MANIFEST_MEDIA_TYPES = [
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.oci.image.manifest.v1+json",
  "application/vnd.docker.distribution.manifest.list.v2+json",
  "application/vnd.docker.distribution.manifest.v2+json",
].join(", ");

const LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+)(:\d+)?$/;
const REQUEST_TIMEOUT_MS = 30_000;

function parseReference(reference) {
  const match = /^([^/]+)\/([^:@]+):([^:/]+)$/.exec(reference);
  if (!match) {
    throw new Error(`"${reference}" is not in registry/name:tag form`);
  }
  const [, host, repository, tag] = match;
  const scheme = LOCAL_HOST.test(host) ? "http" : "https";
  return `${scheme}://${host}/v2/${repository}/manifests/${tag}`;
}

function parseChallenge(header) {
  if (!/^Bearer\s/i.test(header)) return null;
  const params = Object.fromEntries(
    [...header.matchAll(/(\w+)="([^"]*)"/g)].map(([, key, value]) => [
      key,
      value,
    ]),
  );
  if (!params.realm) return null;
  const url = new URL(params.realm);
  if (params.service) url.searchParams.set("service", params.service);
  if (params.scope) url.searchParams.set("scope", params.scope);
  return url;
}

function request(url, init = {}) {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

function headManifest(url, token) {
  const headers = { Accept: MANIFEST_MEDIA_TYPES };
  if (token) headers.Authorization = `Bearer ${token}`;
  return request(url, { method: "HEAD", headers });
}

async function probe(reference) {
  const manifestUrl = parseReference(reference);
  let response = await headManifest(manifestUrl);

  if (response.status === 401) {
    const tokenUrl = parseChallenge(
      response.headers.get("www-authenticate") ?? "",
    );
    if (!tokenUrl) {
      return "the registry demanded credentials without offering an anonymous token";
    }
    const tokenResponse = await request(tokenUrl);
    if (!tokenResponse.ok) {
      return `the registry refused an anonymous pull token with ${tokenResponse.status}, which means the package is private`;
    }
    const { token, access_token: accessToken } = await tokenResponse.json();
    if (!token && !accessToken) {
      return "the registry answered the token request without a token";
    }
    response = await headManifest(manifestUrl, token ?? accessToken);
  }

  if (response.status === 404) {
    return "the tag does not exist in a package the registry lets anyone read";
  }
  if (!response.ok) return `the manifest request answered ${response.status}`;
  return null;
}

const references = process.argv.slice(2);

if (references.length === 0) {
  console.error("Usage: verify-anonymous-pull.mjs <registry/name:tag>...");
  process.exit(2);
}

const failures = [];

for (const reference of references) {
  const failure = await probe(reference).catch((error) => error.message);
  if (failure) {
    failures.push(reference);
    console.error(`FAIL ${reference}: ${failure}`);
  } else {
    console.log(`ok   ${reference} pulls without credentials`);
  }
}

if (failures.length > 0) {
  console.error("");
  console.error(
    `${failures.length} of ${references.length} images cannot be pulled anonymously.`,
  );
  console.error(
    "GitHub creates every new container package as private, and no API can change that.",
  );
  console.error(
    "A package admin opens the package settings and sets its visibility to public:",
  );
  console.error(
    "  https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility",
  );
  process.exit(1);
}
