const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(url && key);
export const supabaseScope = url;

export async function rpc(name: string, body: unknown) {
  if (!url || !key) throw new Error("A Supabase nincs beállítva.");
  const response = await fetch(url + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "omit",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Supabase RPC " + response.status);
  return response;
}
