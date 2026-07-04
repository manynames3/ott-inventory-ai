const frontendUrl = (process.env.FRONTEND_URL || "https://otokistocksense.pages.dev").replace(/\/+$/, "");
const expectedApiBaseUrl = process.env.EXPECTED_API_BASE_URL || "";
const expectedAuthMode = process.env.EXPECTED_AUTH_MODE || "";

async function fetchText(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return response.text();
}

const html = await fetchText(frontendUrl);
const scriptUrls = [...html.matchAll(/src="([^"]+\.js)"/g)].map((match) => new URL(match[1], frontendUrl).href);

if (scriptUrls.length === 0) {
  throw new Error(`No JavaScript bundles found at ${frontendUrl}`);
}

const bundleText = (await Promise.all(scriptUrls.map((url) => fetchText(url).catch(() => "")))).join("\n");

const checks = [
  {
    name: "expected API base URL",
    ok: expectedApiBaseUrl ? bundleText.includes(expectedApiBaseUrl) : true,
  },
  {
    name: "expected Cognito auth mode",
    ok: expectedAuthMode === "cognito" ? bundleText.includes("cognito") : true,
  },
  {
    name: "client login guard",
    ok: bundleText.includes("Login required") || bundleText.includes('startsWith("/login")'),
  },
];

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  throw new Error(`Frontend verification failed: ${failed.map((check) => check.name).join(", ")}`);
}

console.log(
  JSON.stringify(
    {
      frontendUrl,
      scriptsChecked: scriptUrls.length,
      expectedApiBaseUrl: Boolean(expectedApiBaseUrl),
      expectedAuthMode: expectedAuthMode || "not asserted",
      ok: true,
    },
    null,
    2,
  ),
);
