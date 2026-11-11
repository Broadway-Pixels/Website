import { build } from 'esbuild';
import { copyFile, mkdir, readdir, rm, writeFile, cp } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { legacyPages } from "../lib/routes.mjs";

const root = new URL("../", import.meta.url);
const output = new URL("../dist/", import.meta.url);
const files = [
  "account.html", "account.css", "account-navigation.css",
  "label.html", "label.css",
  "index.html", "music.html", "projects.html", "support.html", "faq.html", "dashboard.html",
  "privacy.html", "delete-account.html", "delete-account.js", "fishadise.html", "fishadise.css", "styles.css", "script.js", "reels.js", "theme.js", "support.js", "dashboard.js", "favicon.ico", "app-ads.txt",
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await build({ entryPoints: [fileURLToPath(new URL('../account/client.mjs', import.meta.url))], bundle: true,
  outfile: fileURLToPath(new URL('account.js', output)), format: 'esm', minify: true,
  define: { ACCOUNT_EMULATOR: 'false' } });
await cp(new URL('account/avatars/',root),new URL('account/avatars/',output),{recursive:true});
await build({entryPoints:[fileURLToPath(new URL('account/navigation.mjs',root))],outfile:fileURLToPath(new URL('account-navigation.js',output)),bundle:true,format:'esm',minify:true});
await Promise.all(files.map((file) => copyFile(new URL(file, root), new URL(file, output))));
await copyFile(new URL('account.js', output), new URL('account.js', root));
await copyFile(new URL('account-navigation.js', output), new URL('account-navigation.js', root));
await mkdir(new URL('account/', output), {recursive:true});
await copyFile(new URL('account-privacy.html', root), new URL('account/privacy.html', output));
await copyFile(new URL('assets/broadway-pixels-logo-v2.png', root), new URL('account-logo.png', output));
await copyFile(new URL("content.html", root), new URL("videos.html", output));
await mkdir(new URL("fishadise/", output), { recursive: true });
await copyFile(new URL("tanktopia-privacy.html", root), new URL("fishadise/privacy.html", output));
await copyFile(new URL("tanktopia-eula.html", root), new URL("fishadise/eula.html", output));
await mkdir(new URL("steady/", output), { recursive: true });
await copyFile(new URL("steady-privacy.html", root), new URL("steady/privacy.html", output));
await copyFile(new URL("steady-terms.html", root), new URL("steady/terms.html", output));
await mkdir(new URL("match-mania/", output), { recursive: true });
await copyFile(new URL("match-mania-privacy.html", root), new URL("match-mania/privacy.html", output));
await mkdir(new URL("assets/", output), { recursive: true });
const assets = await readdir(new URL("assets/", root), { withFileTypes: true });
await Promise.all(assets.filter((entry) => entry.isFile()).map((entry) => (
  copyFile(new URL(`assets/${entry.name}`, root), new URL(`assets/${entry.name}`, output))
)));

await writeFile(new URL("_headers", output), `/*
  Content-Security-Policy: default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com; base-uri 'self'; form-action 'self' mailto:; frame-ancestors 'none'
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY

/account
  Cache-Control: no-store
  X-Robots-Tag: noindex, nofollow

/dashboard
  Cache-Control: no-store
  X-Robots-Tag: noindex, nofollow

https://:version.:subdomain.workers.dev/*
  X-Robots-Tag: noindex
`, "utf8");

await writeFile(new URL("_redirects", output), [
  "/content /videos 308", "/videos.html /videos 308",
  "/steady-privacy /steady/privacy 308", "/steady-terms /steady/terms 308",
  ...[...legacyPages].map(([from, to]) => `${from} ${to} 308`),
].join("\n") + "\n", "utf8");

console.log(`Built Broadway Pixels static assets in ${join(output.pathname)}`);
