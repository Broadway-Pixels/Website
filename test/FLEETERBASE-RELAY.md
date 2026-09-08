# Fleeterbase verification relay

This service-binding endpoint is a dependency of the separate Fleeterbase app, not an embedded app or website page. Preserve it when deploying Broadway Pixels.

- Route: POST `/api/internal/fleeterbase-verification`.
- Existing secrets: `FLEETERBASE_EMAIL_RELAY_SECRET` and `RESEND_API_KEY`.
- Allowed verification origin/path: `https://fleeterbase.com/api/auth/verify`.
- Sender uses the existing verified `support@broadwaypixels.com` domain.
- Tests: `node --test test/fleeterbase-email.test.mjs`.
- September 8 restoration deployed as `c6f04b8f-b683-4517-a17b-5343a9adbb2a`; website assets unchanged. Actual inbox delivery remains a separate verification gate.
