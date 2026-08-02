/**
 * Tiny sync backend for the "owned /mu/ albums" feature.
 *
 * Stores one JSON blob per Spotify user ID in a Cloudflare KV namespace.
 * Auth is a single shared secret (the "Sync Key" you paste into the app's
 * Sync settings modal) checked as a Bearer token — good enough for a
 * personal single-user tool, not meant for multi-tenant public use.
 *
 * Routes:
 *   GET  /owned?user=<spotify_user_id>   -> 200 { ...ownedBlob }  (or {} if none saved yet)
 *   PUT  /owned?user=<spotify_user_id>   -> body: JSON blob, stores it verbatim
 *   OPTIONS *                            -> CORS preflight
 *
 * Deploy: see ../README.md in this folder for step-by-step instructions.
 */

const ALLOWED_ORIGIN = "*"; // tighten to your app's exact origin once deployed, e.g. "https://you.github.io"

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (url.pathname !== "/owned") {
      return json({ error: "not found" }, 404);
    }

    const auth = request.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!env.SYNC_TOKEN || token !== env.SYNC_TOKEN) {
      return json({ error: "unauthorized" }, 401);
    }

    const user = url.searchParams.get("user");
    if (!user) return json({ error: "missing ?user=" }, 400);
    const key = `owned:${user}`;

    if (request.method === "GET") {
      const stored = await env.OWNED_KV.get(key);
      return json(stored ? JSON.parse(stored) : {});
    }

    if (request.method === "PUT") {
      let body;
      try {
        body = await request.text();
        JSON.parse(body); // validate
      } catch (e) {
        return json({ error: "invalid JSON body" }, 400);
      }
      await env.OWNED_KV.put(key, body);
      return json({ ok: true });
    }

    return json({ error: "method not allowed" }, 405);
  },
};
