# Automatic private admin profiles — version 1.5.0

At first use, users choose whether CP Sync may automatically discover their signed-in accounts on LeetCode, Codeforces, AtCoder, CodeChef and CSES. There is no manual handle form. Declining leaves existing features available and makes no account-status request.

After consent, a small top-frame content script reads only account-navigation links, or LeetCode's same-site signed-in status/username response. It ignores ordinary public-profile links. Detection checks only visible supported pages once a minute; LeetCode session lookup runs at most once per five minutes. Some account changes may therefore take several minutes to appear. The latest account per platform is retained.

Reports are deduplicated, persisted locally and uploaded one platform per worker tick with retry backoff. The backend queues public-statistics refreshes and processes up to five profiles per scheduled minute, without overlapping its own scheduled runs. Codeforces requests are paced. Statistics are refreshed after 24 hours; queue backlog can add delay. Private source, notes, passwords, emails, browsing history, cookies and integration tokens are excluded.

Prior manual-sharing consent (profiles-v1) does not authorize discovery. Current profiles-v2 consent must be granted. Sharing still expires one year after consent. Withdrawal stops detection/reporting and deletes the remote record once the server confirms; failed deletion retries. Uninstalling alone does not delete a server record.

## Deployment and admin access

Deploy the backend from the updated codex/profile-sharing-deployment branch. Connect MongoDB, set PROFILE_SHARING_ENABLED=true and keep a random 64-character hex PROFILE_ADMIN_KEY in Render's private environment settings. No admin credential belongs in the extension, Vite variables, repository or chat.

Open https://YOUR_BACKEND/admin and sign in with that key. It is a single-team bearer-key login, not SSO, MFA or separate administrator accounts. Keys remain in tab memory and clear on logout/reload. Each data request authenticates on the server. Use HTTPS and rotate the key when team access changes.

GET /api/v1/profile-sharing/status must report data.available=true. PUT /api/v1/profile-sharing records explicit consent with no manually supplied handles. PATCH on that path records one automatically detected account, with an existing current per-installation consent token. DELETE withdraws only that installation. Admin list/refresh endpoints require the distinct server admin key.

## Coverage and limits

LeetCode and Codeforces provide available ratings and solved counts. Codeforces scans the latest 1,000 submissions and labels capped counts as a lower bound. AtCoder provides available algorithm ratings; CodeChef public markup may provide rating/solved counts but was unavailable in the last live check. CSES provides a profile link without reading its private solved sheet. Missing statistics remain blank.

Signed-in navigation selectors and LeetCode's account-status query require real logged-in Chrome verification. A changed or unavailable platform UI should prevent detection rather than fall back to somebody else's public-profile link. Ownership is inferred from the signed-in account UI, not independently verified through platform OAuth.

The protected deployment and MongoDB/admin-key configuration remain required. The GitHub PR and local extension build alone do not activate an older Render service. See PROFILE_DEPLOYMENT.md.

