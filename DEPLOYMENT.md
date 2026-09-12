# Deployment Guide — Fennel Games

This guide covers the two independent deployments needed for online multiplayer in Lowball:

1. **Static PWA** → GitHub Pages (the game itself)
2. **WebSocket relay** → Cloudflare Workers + Durable Objects (the multiplayer backend)

Deployment is **configure-once, push-to-deploy** — GitHub Actions handles the static site automatically on every push to `main`; the Worker only needs to be redeployed when `workers/lowball-relay/src/` changes.

---

## Free-Tier Limits

### GitHub Pages
- **Cost:** Free for public repositories.
- **Bandwidth:** 100 GB/month soft limit. A typical session downloads ~500 KB (PWA shell + content packs). You'd need ~200,000 game loads/month to hit the limit.
- **Build minutes:** 2,000 Actions minutes/month free tier.

### Cloudflare Workers (Free plan)
- **Requests:** 100,000/day free (each WebSocket connection = 1 request; each incoming WS message = ~1/20 request due to billing ratio).
- **Compute duration:** 13,000 GB-s/day free.
- **Practical headroom:** A simultaneous 4-player game sends ~8 WS messages/player across 2 sweeps = ~32 messages per game = ~2 billing requests. At 100k free requests/day that's ~50,000 concurrent games/day — far above any realistic casual usage.
- **Cost above free tier:** $0.15/million requests. At 1M games/month that's ~$3/month.
- **Storage:** $0 — the relay uses in-memory state only (no Durable Object Storage API calls).

---

## Step 1: Push to GitHub and enable Pages

1. Create a new GitHub repository (public, so Pages is free):
   ```
   gh repo create fennel-games --public --source=. --remote=origin --push
   ```
   If you already have a remote, skip `--source` and just push:
   ```
   git remote add origin https://github.com/<yourname>/fennel-games.git
   git push -u origin main
   ```

2. In your GitHub repo, go to **Settings → Pages**.
3. Under **Source**, select **GitHub Actions** (not "Deploy from a branch").
4. The `deploy-pages.yml` workflow will run automatically on every push to `main`.

Your app will be available at: `https://<yourname>.github.io/fennel-games/`

---

## Step 2: Deploy the Cloudflare Workers relay

### Prerequisites

```bash
# Install wrangler CLI globally (or use npx)
npm install -g wrangler@3

# Authenticate with your Cloudflare account (free tier works)
wrangler login
```

### First deploy

```bash
cd workers/lowball-relay

# Install the worker's dependencies
npm install

# Deploy to Cloudflare
wrangler deploy
```

On success, wrangler prints a URL like:
```
https://lowball-relay.<your-account>.workers.dev
```

Note this URL — you need it in Step 3.

### Local development (no Cloudflare account needed)

```bash
cd workers/lowball-relay
npm install
wrangler dev
```

This starts the relay at `ws://127.0.0.1:8787`. The default `RELAY_BASE_URL` in
`src/games/lowball/plugin.ts` already points there, so `npm run dev` in the main
project connects to it automatically.

---

## Step 3: Wire the relay URL into the PWA build

The relay WebSocket URL is injected at build time via the `VITE_RELAY_URL` environment variable.

### For local builds:

```bash
VITE_RELAY_URL=wss://lowball-relay.<your-account>.workers.dev npm run build
```

### For the GitHub Actions workflow (recommended):

1. In your GitHub repo, go to **Settings → Secrets and variables → Actions**.
2. Click **New repository secret**.
3. Name: `VITE_RELAY_URL`
4. Value: `wss://lowball-relay.<your-account>.workers.dev`
5. Click **Add secret**.

The `.github/workflows/deploy-pages.yml` workflow already reads this secret:
```yaml
env:
  VITE_RELAY_URL: ${{ secrets.VITE_RELAY_URL }}
```

After adding the secret, push any change to `main` to trigger a rebuild that includes the correct relay URL.

---

## Step 4: Verify

1. Open `https://<yourname>.github.io/fennel-games/` in a browser.
2. Navigate to Lowball.
3. Click **Multiplayer** → **Create Room**.
4. Copy the invite link and open it in a second browser tab or device.
5. Once 2+ players are in the lobby, click **Start Game**.

---

## Redeployments

| What changed | What to redeploy |
|---|---|
| Game content / UI / rules | Push to `main` → GitHub Actions deploys automatically |
| Relay logic (`workers/lowball-relay/src/`) | `cd workers/lowball-relay && wrangler deploy` |
| Content pack (`public/lowball.json`) | Push to `main` (GitHub Actions) AND `wrangler deploy` (so DO uses latest pack) |
| Relay URL | Update `VITE_RELAY_URL` secret → push to `main` |

---

## Secrets and credentials checklist

- [ ] No `wrangler.toml` contains account IDs or API keys (it does not — those come from `wrangler login`)
- [ ] `VITE_RELAY_URL` is set as a GitHub Actions secret (not committed to the repo)
- [ ] `wrangler login` token is only on your local machine / CI environment

---

## Troubleshooting

**"Cannot connect to relay"** — Check that the Worker is deployed and `VITE_RELAY_URL` matches the `wrangler deploy` output URL exactly (no trailing slash).

**"ROOM_NOT_FOUND"** — The room code expired (DO evicted after inactivity) or was mistyped. Create a new room.

**"DO eviction mid-round loses state"** — The relay uses in-memory-only state (REQ-056). If the DO is evicted during a game (Cloudflare infrastructure maintenance, extremely rare), the game ends. Players must create a new room. This is documented as RISK-001 — the tradeoff for $0 storage cost.

**Invite links on iOS native app** — In the Capacitor iOS app, invite links open in the device browser (not the app) in v1. Players can also join by typing the room code in the Multiplayer lobby. Native deep-link support (Universal Links) is out of scope for v1.
