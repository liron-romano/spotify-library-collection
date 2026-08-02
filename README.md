# Deploying the "owned albums" sync backend

The app works fully without this — "mark as in library" is saved to
`localStorage` on whichever device/browser you're using. This backend is
only needed if you want those marks to follow you across devices.

It's a single Cloudflare Worker (free tier is plenty for one user) backed
by Workers KV, a tiny key-value store. No database to manage, no server to
patch, no monthly bill for personal use.

## 1. Prerequisites

- A free Cloudflare account (https://dash.cloudflare.com/sign-up)
- Node.js installed locally
- The two files in this folder: `worker.js` and `wrangler.toml`

## 2. Install the CLI and log in

```bash
npm install -g wrangler
wrangler login
```

## 3. Create the KV namespace

```bash
cd sync-worker
wrangler kv namespace create OWNED_KV
```

This prints an `id`. Copy it into `wrangler.toml`, replacing
`REPLACE_WITH_YOUR_KV_NAMESPACE_ID`.

## 4. Set your secret sync key

Pick any long random string — this is the "Sync Key" you'll paste into the
app's Sync settings modal later. Don't reuse a password.

```bash
wrangler secret put SYNC_TOKEN
# paste your chosen secret when prompted
```

## 5. Deploy

```bash
wrangler deploy
```

Wrangler prints a URL like `https://mu-owned-sync.<your-subdomain>.workers.dev`.
That's your **Sync URL**.

## 6. Connect the app

In the app, click **🔗 Sync**, and enter:
- **Sync URL**: the workers.dev URL from step 5
- **Sync Key**: the secret you set in step 4

Click "Save & sync now". From then on, marking an album as owned on one
device will show up on any other device/browser where you've entered the
same Sync URL and Key while logged into the same Spotify account.

## Notes & tradeoffs

- **Security model**: this is a shared-secret bearer token, not per-user
  login. Anyone with the Sync URL *and* the key can read/write the store.
  Fine for a personal tool only you and your devices use; don't publish
  the key. For stricter security you'd want per-user OAuth instead of a
  static secret — more setup than is worth it for a single-user app.
- **CORS**: `worker.js` currently allows any origin (`Access-Control-Allow-Origin: "*"`).
  Once you know the final URL you're hosting `index.html` at, change
  `ALLOWED_ORIGIN` in `worker.js` to that exact origin and redeploy, so only
  your copy of the page can talk to your worker.
- **Free tier limits**: Workers free plan allows 100,000 requests/day and
  KV free tier allows 100,000 reads + 1,000 writes/day — orders of
  magnitude more than a personal collection page will ever use.
- **Alternative if you'd rather avoid writing/deploying any server code**:
  Supabase (https://supabase.com) gives you a hosted Postgres database with
  a REST API out of the box. You'd create one table (`owned_albums` with
  columns `user_id`, `data jsonb`, `updated_at`), enable row-level security
  scoped to `user_id`, and call it directly from the browser with the
  Supabase anon key — no worker.js needed at all, just SQL run once in
  their dashboard. Firebase Firestore is a similar no-server option.
