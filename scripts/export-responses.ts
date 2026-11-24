import { mkdir, open, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { SURVEY_SLUG } from "../src/content/survey.ts";

const slug = process.argv[2];
if (!slug || !SURVEY_SLUG.test(slug) || process.argv.length !== 3) {
  throw new Error("Usage: npm run export -- <survey_slug>");
}
const configuredUrl = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!configuredUrl || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your local shell.");
const url = new URL("/rest/v1/rpc/export_survey_responses", configuredUrl);
if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) {
  throw new Error("Use HTTPS for a remote SUPABASE_URL.");
}
const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
if (key.startsWith("eyJ")) headers.Authorization = "Bearer " + key;

const dir = resolve("exports");
await mkdir(dir, { recursive: true, mode: 0o700 });
const stamp = new Date().toISOString().replaceAll(":", "-");
const filename = resolve(dir, `${slug}-${stamp}.response.json`);
const temp = filename + ".tmp";
const file = await open(temp, "wx", 0o600);
let count = 0;
try {
  await file.writeFile("[\n");
  let after: string | null = null;
  const pageSize = 200;
  for (;;) {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ slug, after_receipt: after, page_size: pageSize }),
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error("Response export failed (HTTP " + response.status + ").");
    const rows = await response.json() as { receipt_hash: string; received_at: string; payload: unknown }[];
    if (!Array.isArray(rows) || rows.some((row) => !/^[0-9a-f]{64}$/.test(row.receipt_hash))) {
      throw new Error("Unexpected response export format.");
    }
    for (const row of rows) {
      await file.writeFile((count++ ? ",\n" : "") + JSON.stringify(row));
    }
    if (rows.length === 0) break;
    const last = rows.at(-1)!.receipt_hash;
    if (after !== null && last <= after) throw new Error("The response export cursor stopped advancing.");
    after = last;
  }
  await file.writeFile("\n]\n");
  await file.close();
  await rename(temp, filename);
} catch (error) {
  await file.close();
  await rm(temp, { force: true });
  throw error;
}
console.log(`Exported ${count} responses to ${filename}`);
