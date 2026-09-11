import { build } from 'esbuild';
import { mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
const output=new URL('../dist-accounts/',import.meta.url);
await rm(output,{recursive:true,force:true});await mkdir(new URL('account/',output),{recursive:true});
for(const file of ['account.html','account.css'])await copyFile(new URL('../'+file,import.meta.url),new URL(file,output));
await copyFile(new URL('../account-privacy.html',import.meta.url),new URL('account/privacy.html',output));
await copyFile(new URL('../assets/broadway-pixels-logo-v2.png',import.meta.url),new URL('account-logo.png',output));
await build({entryPoints:[new URL('../account/client.mjs',import.meta.url).pathname],outfile:new URL('account.js',output).pathname,bundle:true,format:'esm',minify:true,define:{ACCOUNT_EMULATOR:'false'}});
await writeFile(new URL('_headers',output),`/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com; base-uri 'none'; form-action 'self'; frame-ancestors 'none'
  Cache-Control: no-store
  X-Robots-Tag: noindex, nofollow
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  Permissions-Policy: camera=(), microphone=(), geolocation=()
`);
console.log('Built account portal.');
