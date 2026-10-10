# Make profile sharing operational on Render

Verified October 10, 2026: the existing service responds at `/health`, but `/admin` and `/api/v1/profile-sharing` return 404. The source for profile sharing had not been deployed. The updated extension checks backend availability before creating a new registration credential and explains missing routes without exposing an HTML/JSON parsing error.

Existing service: https://dashboard.render.com/web/srv-dakku8942hec73aunca0/deploys

## Deploy the prepared backend

The `codex/profile-sharing-deployment` branch contains the complete tested backend needed by version 1.5.0, including the admin page, profile routes, MongoDB model, public-statistics adapters and readiness diagnostics. It does not include `.env`, node_modules, user data or credentials.

In the existing Render service's Settings, deploy that branch (or merge the reviewed backend PR and deploy `main`). Keep Root Directory set to `backend`, Build Command `npm ci`, Start Command `npm start`, and Health Check Path `/health`. Preserve the existing service plan and unrelated environment variables.

In Environment, set:

| Variable | Value |
|---|---|
| `PROFILE_SHARING_ENABLED` | `true` |
| `MONGODB_URI` | Your private, reachable MongoDB connection URI; preserve the existing value if it works |
| `PROFILE_ADMIN_KEY` | A private, random 64-character hex key generated locally and saved only in Render |

Do not paste either credential into chat or commit it. Generate the admin key locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, save it in your password manager and enter it in Render. This key will be used to sign into the admin page. MongoDB network access must permit the service to connect. No new paid hosting resources are provisioned by this update.

Choose Manual Deploy → Deploy latest commit, or use Render's environment save/redeploy flow. Then verify:

1. https://cp-schedule-extension.onrender.com/api/v1/profile-sharing/status returns JSON with `data.available: true`. `not_enabled`, `database_unavailable` or `admin_not_configured` identifies the remaining configuration step.
2. https://cp-schedule-extension.onrender.com/admin shows the login page, and the private key gives access to the list. No login grants no access to profile records.
3. Reload the rebuilt extension and consent with your own public handle. Confirm the record appears, refresh its public statistics, then withdraw in Settings and confirm it disappears.

If browser control is unavailable, these service-specific steps must be performed in your Render dashboard. The feature cannot be made live by rebuilding the extension alone.

