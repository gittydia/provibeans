import "./env.mjs";
import { raw, run } from "./pg.mjs";
import { randomBytes } from "node:crypto";

const base = process.env.SMOKE_BASE ?? "http://localhost:3000";

const results = [];
const record = (label, ok, detail = "") => results.push({ label, ok, detail });

const users = await raw("select id, name, email from users where email = any($1)", [
  ["admin@provibeans.ph", "staff@provibeans.ph"],
]);
const admin = users.find((u) => u.email === "admin@provibeans.ph");
const staff = users.find((u) => u.email === "staff@provibeans.ph");

if (!admin || !staff) {
  console.error("Seeded users missing. Run `npm run db:seed` first.");
  process.exit(1);
}

const token = randomBytes(32).toString("hex");
await run("insert into sessions (token, user_id, expires_at) values ($1, $2, $3)", [
  token,
  admin.id,
  new Date(Date.now() + 7 * 86_400_000).toISOString(),
]);

const cookieHeader = `provi_session=${token}`;
const anon = (path) => fetch(`${base}${path}`, { redirect: "manual" });
const authed = (path) =>
  fetch(`${base}${path}`, { headers: { cookie: cookieHeader }, redirect: "manual" });

for (const path of ["/dashboard", "/lots", "/issue", "/catalog", "/reports", "/requests"]) {
  const response = await anon(path);
  const location = response.headers.get("location") ?? "";
  const guarded =
    (response.status === 307 || response.status === 302) && location.includes("/login");
  record(`anonymous ${path} is redirected to login`, guarded, `status=${response.status} loc=${location}`);
}

for (const path of ["/dashboard", "/lots", "/issue", "/catalog", "/reports", "/requests"]) {
  const response = await authed(path);
  const body = await response.text();
  record(`authenticated ${path} renders`, response.status === 200 && body.length > 2000, `status=${response.status} bytes=${body.length}`);
}

const requestsBody = await (await authed("/requests")).text();
record("requests screen lists order requests", requestsBody.includes("Order requests"));

const dashboard = await (await authed("/dashboard")).text();
record("dashboard shows inventory value", dashboard.includes("Inventory value"));
record("dashboard lists the real SKUs", dashboard.includes("PB-HN-250") && dashboard.includes("PB-SGN-250"));
record("dashboard surfaces the FEFO watchlist", dashboard.includes("FEFO watchlist"));
record("dashboard shows an alert panel", dashboard.includes("Alerts"));

const lots = await (await authed("/lots")).text();
record("lots screen shows dated lots", lots.includes("HN-2601-A") && lots.includes("Best before"));
record("lots screen shows quarantine controls", lots.includes("Quarantine"));

const issue = await (await authed("/issue")).text();
record("issue screen recommends FEFO", issue.includes("FEFO recommendation"));
record("issue screen offers movements", issue.includes("Reserve") && issue.includes("Physical count"));

const reports = await (await authed("/reports")).text();
record("reports screen lists the audit log", reports.includes("Activity log"));
record("reports offers CSV export", reports.includes("Export CSV"));

const login = await anon("/login");
const loginBody = await login.text();
record("login page renders for anonymous users", login.status === 200 && loginBody.includes("Sign in"));

const withBadToken = await fetch(`${base}/dashboard`, {
  headers: { cookie: "provi_session=not-a-real-token" },
  redirect: "manual",
});
record(
  "forged session cookie is rejected",
  withBadToken.status === 307 || withBadToken.status === 302,
  `status=${withBadToken.status}`,
);

const csv = await fetch(`${base}/reports/export`, { headers: { cookie: cookieHeader } });
const csvBody = await csv.text();
record(
  "CSV export returns ledger rows",
  csv.status === 200 && csvBody.includes("lot") && csvBody.split("\n").length > 3,
  `status=${csv.status} lines=${csvBody.split("\n").length}`,
);

const csvAnon = await anon("/reports/export");
record("CSV export rejects anonymous requests", csvAnon.status === 403, `status=${csvAnon.status}`);

// End-to-end sign-in through the real form. The injected session above proves
// the guard works; this proves a human can actually get a session, and that the
// cookie issued is one a browser will send back on this connection.
const loginPage = await (await fetch(`${base}/login`)).text();
const hidden = {};
for (const match of loginPage.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
  const tag = match[0];
  const name = tag.match(/name="([^"]+)"/)?.[1];
  const value = tag.match(/value="([^"]*)"/)?.[1] ?? "";
  if (name) hidden[name] = value.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

const signIn = new FormData();
for (const [key, value] of Object.entries(hidden)) signIn.append(key, value);
signIn.append("email", "admin@provibeans.ph");
signIn.append("password", "ProviBeans2026");

const signInResponse = await fetch(`${base}/login`, {
  method: "POST",
  body: signIn,
  redirect: "manual",
});

record(
  "posting real credentials redirects to the dashboard",
  signInResponse.status === 303 && (signInResponse.headers.get("location") ?? "").includes("/dashboard"),
  `status=${signInResponse.status} loc=${signInResponse.headers.get("location")}`,
);

const issued = signInResponse.headers.get("set-cookie") ?? "";
record("sign-in issues a session cookie", issued.includes("provi_session="), issued.slice(0, 60));
record(
  "session cookie is not Secure over plain http",
  !/\bSecure\b/i.test(issued),
  "a Secure cookie is dropped by the browser on http, so login would appear to do nothing",
);

const issuedToken = issued.match(/provi_session=([^;]+)/)?.[1];
if (issuedToken) {
  const followed = await fetch(`${base}/dashboard`, {
    headers: { cookie: `provi_session=${issuedToken}` },
    redirect: "manual",
  });
  const followedBody = await followed.text();
  record(
    "the issued cookie reaches the dashboard",
    followed.status === 200 && followedBody.includes("Inventory value"),
    `status=${followed.status}`,
  );
  await run("delete from sessions where token = $1", [issuedToken]);
} else {
  record("the issued cookie reaches the dashboard", false, "no session token was issued");
}

const wrongPassword = new FormData();
for (const [key, value] of Object.entries(hidden)) wrongPassword.append(key, value);
wrongPassword.append("email", "admin@provibeans.ph");
wrongPassword.append("password", "definitely-wrong");

const wrongResponse = await fetch(`${base}/login`, {
  method: "POST",
  body: wrongPassword,
  redirect: "manual",
});
const wrongBody = await wrongResponse.text();
record(
  "a wrong password is refused",
  !wrongResponse.headers.get("set-cookie")?.includes("provi_session=") &&
    wrongBody.includes("not recognised"),
  `status=${wrongResponse.status}`,
);

await run("delete from sessions where token = $1", [token]);

console.log("Provi Beans - HTTP smoke test");
console.log("==============================");
for (const result of results) {
  const verdict = result.ok ? "PASS" : "FAIL";
  const suffix = result.ok || !result.detail ? "" : `  (${result.detail})`;
  console.log(`  [${verdict}] ${result.label}${suffix}`);
}
const failed = results.filter((result) => !result.ok);
console.log("==============================");
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);