# Broadway Pixels player accounts

The account portal at https://broadwaypixels.com/account uses the same Firebase project and player UID as Fishadise. Email login can be linked to an existing Apple or Game Center identity inside the game without copying or merging economies. The browser reads only its authenticated player's cloud-save timestamp and edits the Firebase Auth profile. Firestore owner rules remain authoritative.

`npm run build:accounts` builds a standalone static account portal. `npm run deploy:accounts` publishes the `/account*` routes, the Projects page (`/projects`, `/projects/`, `/projects.html`), and its Fishadise logo on Broadway Pixels, preserving the rest of the existing live website. The Projects page uses the existing main-site styles, scripts, and other artwork. Fishadise.com links to this portal. The general website build also includes the account entry point for its next full-site deployment.

Local account integration checks use Auth and Firestore emulators with the demo project `demo-fishadise-accounts`. Run the command in `.github/workflows/validate.yml`; no production user is created by these tests. Never compile `ACCOUNT_EMULATOR=true` for production.

Validation on September 11, 2026: browser sign-up, player-name update, sign-out and sign-in preserved the same local test account; integration checks passed for shared identity, cross-player read/delete denial, password reauthentication and deletion. The live portal loads and initializes authentication. Real-device Game Center authentication and actual email delivery require device/inbox testing.
