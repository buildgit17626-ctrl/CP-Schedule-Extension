# Private admin profiles

Version 1.4.0 adds optional, explicit first-use consent for users to share their own public programming handles. A short initial choice opens the handle form only when requested. Existing installs also see this choice once. Declining changes no core features and sends nothing. Settings → Privacy & profile sharing allows later changes and withdrawal.

## Deployment

Deploy the updated backend with MongoDB connected. Set `PROFILE_SHARING_ENABLED=true` and set `PROFILE_ADMIN_KEY` to a cryptographically random private key (at least 43 URL-safe characters; 32 random bytes encoded as hex gives 64). Keep it in the hosting service's secret settings. Never put it in the extension, repository, Vite variables or support messages. For example, generate it locally with Node's `crypto.randomBytes(32).toString('hex')` and copy it directly to the service's secret manager.

Open `https://YOUR_BACKEND/admin` and enter the private key. The key authenticates every admin API request, stays in that tab's memory and clears on sign-out/reload. No admin button or key exists in the extension. Public access to the login page grants no profile access. Rotate the server key when access changes. This is a single-team bearer-key login, not named-user accounts, SSO, MFA or an audit log. Use HTTPS and your deployment's ingress access controls. Changing the server key invalidates future requests with the old key. Profile endpoints return no-store responses; the dashboard renders server values as text and opens only fixed platform profile URLs.

The feature defaults to disabled, and registration/admin access fails closed when MongoDB is unavailable. Withdrawal remains allowed if sharing is disabled but MongoDB is online. Before enabling production sharing, update the public privacy policy, configure support contact information and test a real registration and withdrawal.

## Data and performance

The server stores only supplied handles, a hashed random installation management token, consent version/time, timestamps and minimal public-statistics snapshots. No emails, real names, private platform sessions, source, notes or integration tokens are gathered. Handles are supplied by users; ownership is not independently verified. Keep the management token local so the same installation can update/delete only its record. If registration's response is lost, the local token still allows deletion. Changes stay pinned to the backend that accepted consent even if the contest backend setting later changes.

The admin list is paginated at 20. Statistics refresh only when requested and are cached for 24 hours per record. Refreshes for one record deduplicate and a process admits at most ten concurrent profile refreshes. Codeforces API requests are globally paced per process and the submission scan stops at the latest 1,000; if the limit is reached, the solved count is a lower bound shown with ≥. LeetCode supplies contest rating and accepted problem totals. AtCoder supplies available algorithm rating/maximum rating; solved count is unavailable from its public profile. CodeChef supplies rating and solved count when the current public HTML exposes them. CSES supplies a public profile link, with unavailable rating/solved totals; private green-tick sheets are not accessed by admins. Upstream restrictions or markup changes show unavailable values rather than invented totals. No automatic daily bulk crawler is installed.

MongoDB expires server records after one year from consent. Expired records are excluded before asynchronous TTL deletion. New consent renews retention. Successful withdrawal deletes the record. A refresh updates only the existing matching consent generation, so deletion/handle changes cannot be undone by an in-flight refresh. Failed withdrawal retains the local secret and retries with backoff while Chrome runs. Uninstalling alone does not delete the server profile.

## Endpoints

| Endpoint | Authorization | Purpose |
|---|---|---|
| PUT `/api/v1/profile-sharing` | Per-installation bearer token | Explicit current consent and 1–5 validated handles |
| DELETE `/api/v1/profile-sharing` | Same per-installation token | Delete only that installation's record |
| GET `/api/v1/admin/profiles` | Server admin key | Paginated consenting profile list |
| POST `/api/v1/admin/profiles/:id/refresh` | Server admin key | Fetch/cache available public statistics |

These credentials are distinct. A valid user management token cannot read the admin list. Backend configuration and signed-in public-platform availability still require production verification.
