import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicPages = ["index.html", "music.html", "content.html", "projects.html", "support.html", "faq.html", "privacy.html", "delete-account.html", "tanktopia-eula.html", "steady-privacy.html", "steady-terms.html"];

test("Broadway Pixels does not promote the legacy Steady legal pages", async () => {
  const privacy = await readFile(new URL("../privacy.html", import.meta.url), "utf8");
  assert.doesNotMatch(privacy, /href="\/steady\/(?:privacy|terms)"/);
  for (const file of publicPages) {
    const page = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    const footer = page.split('<footer class="site-footer">')[1] ?? '';
    assert.doesNotMatch(footer, /href="\/steady\/(?:privacy|terms)"/);
  }
});

test("homepage uses the Broadway Pixels creator and developer SEO title", async () => {
  const homepage = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(homepage, /<title>Broadway Pixels - Content Creator and Developer<\/title>/);
  assert.match(homepage, /property="og:title" content="Broadway Pixels - Content Creator and Developer"/);
});

test("every public page uses the search-optimized Broadway Pixels favicon", async () => {
  const pages = await Promise.all(publicPages.map((file) => readFile(new URL(`../${file}`, import.meta.url), "utf8")));
  pages.forEach((page) => {
    assert.match(page, /rel="icon" type="image\/png" sizes="48x48" href="\/assets\/broadway-pixels-favicon-48\.png\?v=20260902-1"/);
    assert.match(page, /rel="shortcut icon" href="\/favicon\.ico\?v=20260902-1"/);
    assert.match(page, /rel="apple-touch-icon" href="\/assets\/broadway-pixels-favicon\.png/);
  });
});

test("every public page loads the early theme and offers a theme control", async () => {
  const pages = await Promise.all(publicPages.map((file) => readFile(new URL(`../${file}`, import.meta.url), "utf8")));
  pages.forEach((page) => {
    assert.match(page, /<script src="\/theme\.js\?v=20260722-2"><\/script>/);
    assert.match(page, /data-theme-toggle/);
    assert.match(page, /script\.js\?v=20260724-1/);
  });
});

test("every public page links to the Broadway Pixels Discord", async () => {
  const pages = await Promise.all(publicPages.map((file) => readFile(new URL(`../${file}`, import.meta.url), "utf8")));
  pages.forEach((page) => {
    assert.match(page, /href="https:\/\/discord\.gg\/KCVFeUZux"/);
    assert.match(page, /src="\/?assets\/icon-discord\.svg"/);
  });
});

test("projects intro keeps its title without the removed subtitle", async () => {
  const projects = await readFile(new URL("../projects.html", import.meta.url), "utf8");
  const intro = projects.match(/<header class="projects-hero reveal">([\s\S]*?)<\/header>/)?.[1];
  assert.ok(intro);
  assert.match(projects, /<body class="projects-page">/);
  assert.match(intro, /<h1>My Projects<\/h1>/);
  assert.doesNotMatch(intro, /<p\b|Apps, games, and software I’ve been working on\./);
});

test("Videos and Projects use the compact Label intro spacing", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /--page-intro-bottom: 32px;/);
  assert.match(css, /@media \(width <= 700px\)\s*{\s*:root\s*{[^}]*--page-intro-bottom: 24px;/);
  for (const selector of [".projects-page .projects-hero", ".content-page .content-hero"]) {
    const rule = css.slice(css.indexOf(`${selector} {`)).split("}")[0];
    assert.match(rule, /padding-block-end: var\(--page-intro-bottom\)/);
  }
  assert.match(css, /\.projects-hero\s*{[^}]*padding-block-end: 56px;/);
  assert.match(css, /\.content-hero div > p:last-child\s*{[^}]*margin-top: 16px;/);
  assert.match(css, /\.content-page \.video-release-section, \.content-page \.shorts-section\s*{[^}]*padding-block: var\(--page-intro-bottom\) clamp\(64px, 8vw, 104px\)/);
  const descriptionRule = css.match(/\.content-hero div > p:last-child\s*{([^}]*)}/)?.[1];
  assert.doesNotMatch(descriptionRule, /max-width:/);
});

test("label roster includes Social Impaired using approved artwork and its artist website", async () => {
  const page = await readFile(new URL("../label.html", import.meta.url), "utf8");
  const card = page.match(/<article class="label-artist" id="social-impaired">[\s\S]*?<\/article>/)?.[0] || "";
  assert.match(card, /<h3>Social Impaired<\/h3>/);
  assert.match(card, /href="https:\/\/socialimpaired\.com\/"/);
  assert.match(card, /src="\/assets\/social-impaired-profile\.png"/);
  assert.match(card, /Raw thoughts\. Real feelings\. Music for the ones who feel out of place\./);
  assert.doesNotMatch(card, /shattered-revised-master|secret_token|Out now/i);
  assert.equal((page.match(/class="label-artist"/g) || []).length, 4);
  const image = await readFile(new URL("../assets/social-impaired-profile.png", import.meta.url));
  assert.equal(image.readUInt32BE(16), 1254);
  assert.equal(image.readUInt32BE(20), 1254);
});

test("projects page includes the Pixelated Discord bot", async () => {
  const projects = await readFile(new URL("../projects.html", import.meta.url), "utf8");
  assert.match(projects, /id="pixelated"/);
  assert.match(projects, /<h2>Pixelated<\/h2>/);
  assert.match(projects, /A Discord bot for moderation logs, community commands, XP, and custom rank cards\./);
});

test("projects page leads with Match Mania and keeps Autoclicker between Vidioza and Steady", async () => {
  const projects = await readFile(new URL("../projects.html", import.meta.url), "utf8");
  assert.match(projects, /id="fleeterbase"/);
  assert.match(projects, /<h2>Fleeterbase<\/h2>/);
  assert.match(projects, /href="https:\/\/fleeterbase\.com\/"/);
  assert.match(projects, /cloud-synced rental operations workspace for independent hosts/);
  assert.match(projects, /assets\/fleeterbase-preview\.svg/);
  const fleeterbaseCard = projects.match(/<article id="fleeterbase"[\s\S]*?<\/article>/)?.[0] || "";
  assert.doesNotMatch(fleeterbaseCard, /<strong>/);
  assert.match(projects, /id="autoclicker"/);
  assert.match(projects, /<h2>Autoclicker<\/h2>/);
  assert.match(projects, /records and replays complete mouse paths, clicks, timing, and repeatable sequences/);
  assert.match(projects, /macOS, Windows, and Linux/);
  assert.doesNotMatch(projects, /Toontown players/);
  assert.match(projects, /assets\/autoclicker-app-icon\.png/);
  const projectOrder = [...projects.matchAll(/<(?:article|a) id="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(projectOrder.slice(0, 6), ["doggy-match-mania", "kitty-match-mania", "fleeterbase", "vidioza", "autoclicker", "steady"]);
});

test("projects page includes the Steady fitness app", async () => {
  const projects = await readFile(new URL("../projects.html", import.meta.url), "utf8");
  assert.match(projects, /href="https:\/\/steadyhealthy\.com\/"/);
  assert.match(projects, /id="steady"/);
  assert.match(projects, /<h2>Steady<\/h2>/);
  assert.match(projects, /mobile fitness and weight-management coach/);
  assert.match(projects, /assets\/steady-app-icon\.png/);
  assert.match(projects, /Steady fitness and weight-management app icon/);
});

test("projects page includes Electric Buddy with its existing artwork and live app", async () => {
  const projects = await readFile(new URL("../projects.html", import.meta.url), "utf8");
  const card = projects.match(/<article id="electric-buddy"[\s\S]*?<\/article>/)?.[0] || "";
  assert.match(card, /<h2>Electric Buddy<\/h2>/);
  assert.match(card, /Find nearby EV charging stations/);
  assert.match(card, /assets\/electric-buddy-icon\.svg/);
  assert.doesNotMatch(card, /In development/);
  assert.match(card, /href="https:\/\/electricbuddy\.org\/"/);
  assert.doesNotMatch(projects, /class="project-links"|>Open app<|>Website</);
  const icon = await readFile(new URL("../assets/electric-buddy-icon.svg", import.meta.url), "utf8");
  assert.match(icon, /<svg/);
});

test("FAQ page answers common music and AI questions", async () => {
  const faq = await readFile(new URL("../faq.html", import.meta.url), "utf8");
  const support = await readFile(new URL("../support.html", import.meta.url), "utf8");
  assert.match(faq, /<h1>Questions, answered\.<\/h1>/);
  assert.match(faq, /Is any of your music made with AI\?/);
  assert.match(faq, /Every release is written, arranged, produced, and finished by myself\./);
  assert.doesNotMatch(faq, /Every Broadway Pixels release/);
  assert.match(faq, /AI is used in some software projects and video workflows, but never to make the songs\./);
  assert.match(faq, /"@type": "FAQPage"/);
  assert.doesNotMatch(support, /<section class="faq-section"/);
});

test("every public page offers Contact and FAQ under Support", async () => {
  const pages = await Promise.all(publicPages.map((file) => readFile(new URL(`../${file}`, import.meta.url), "utf8")));
  pages.forEach((page) => {
    assert.match(page, /<details class="nav-group">/);
    assert.match(page, /href="\/support"[^>]*>Contact<\/a>/);
    assert.match(page, /href="\/faq"[^>]*>FAQ<\/a>/);
    assert.ok(page.indexOf('href="/faq"') < page.indexOf('href="/support"'));
  });
});

test("game account deletion uses a dedicated form for current and future games", async () => {
  const page = await readFile(new URL("../delete-account.html", import.meta.url), "utf8");
  assert.match(page, /rel="canonical" href="https:\/\/broadwaypixels\.com\/delete-account"/);
  assert.match(page, /<form[^>]+action="\/api\/deletion-requests"/);
  assert.match(page, /<label[^>]+for="deletion-acknowledged">\s*<input[^>]+id="deletion-acknowledged"[^>]+name="acknowledged"[^>]+type="checkbox"[^>]+required/);
  assert.match(page, /I understand that deleting my account is permanent and all data associated with it will be lost\./);
  assert.match(page, /<button[^>]+type="submit"[^>]*>Submit<\/button>/);
  for (const game of ["Kitty Match Mania", "Doggy Match Mania", "Other game"]) {
    assert.ok(page.includes(`>${game}</option>`));
  }
  assert.doesNotMatch(page, /\/support\?project=|What happens next|Broadway Pixels Games/);
  const referringPages = ["support.html", "match-mania-privacy.html"];
  for (const file of referringPages) {
    const referringPage = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(referringPage, /href="\/delete-account"/);
  }
});

test("Tanktopia legal pages disclose optional mobile services and user data routes", async () => {
  const privacy = await readFile(new URL("../tanktopia-privacy.html", import.meta.url), "utf8");
  const eula = await readFile(new URL("../tanktopia-eula.html", import.meta.url), "utf8");
  for (const page of [privacy, eula]) {
    assert.match(page, /support@broadwaypixels\.com/);
    assert.match(page, /local|offline/i);
    assert.match(page, /store (?:availability|approval)/i);
  }
  assert.match(privacy, /Settings &gt; Privacy &amp; Data/);
  assert.match(privacy, /export|delete/i);
  assert.match(privacy, /Last updated 2026-09-04/);
  assert.match(privacy, /Firebase Authentication/);
  assert.match(privacy, /Cloud Firestore/);
  assert.match(privacy, /Sign in with Apple/);
  assert.match(privacy, /Google AdMob/);
  assert.match(privacy, /User Messaging Platform/);
  assert.match(privacy, /Google's non-personalized test ads/);
  assert.match(privacy, /disables Google's publisher first-party ID/);
  assert.match(privacy, /does not request Apple's App Tracking Transparency permission/);
  assert.match(privacy, /Delete Cloud Account/);
  assert.match(privacy, /id="choices"/);
  assert.match(privacy, /signing out alone does not delete/);
  assert.match(privacy, /does not include Firebase Analytics or Crashlytics/);
  assert.doesNotMatch(privacy, /provider integrations remain unfinished|Conditional production providers/);
  assert.match(eula, /Last updated 2026-08-03/);
  assert.match(eula, /in-development/i);
});

test("Steady legal pages disclose wellness, Coach, subscription, and data-request boundaries", async () => {
  const privacy = await readFile(new URL("../steady-privacy.html", import.meta.url), "utf8");
  const terms = await readFile(new URL("../steady-terms.html", import.meta.url), "utf8");
  for (const page of [privacy, terms]) {
    assert.match(page, /Last updated 2026-08-27/);
    assert.match(page, /support@broadwaypixels\.com/);
    assert.match(page, /not (?:a medical service|medical care)/i);
    assert.match(page, /Steady privacy policy|Privacy policy/i);
  }
  assert.match(privacy, /Supabase/);
  assert.match(privacy, /OpenAI/);
  assert.match(privacy, /RevenueCat/);
  assert.match(privacy, /Health data will not be used for advertising/);
  assert.match(privacy, /access, correction, export, or deletion/i);
  assert.match(privacy, /Settings &gt; Data &amp; Privacy &gt; Delete account and data/);
  assert.match(privacy, /does not cancel a store subscription/);
  assert.match(terms, /automatically renewing monthly or yearly subscription/i);
  assert.match(terms, /Deleting Steady or your Steady account does not automatically cancel/i);
  assert.match(terms, /does not guarantee a particular amount or rate of weight change/i);
});

test("dashboard stays out of search and public analytics", async () => {
  const dashboard = await readFile(new URL("../dashboard.html", import.meta.url), "utf8");
  const clientScript = await readFile(new URL("../script.js", import.meta.url), "utf8");
  assert.match(dashboard, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(clientScript, /trackedPages[^;]+dashboard/s);
});

test("visible site copy contains no em or en dashes", async () => {
  const files = [...publicPages, "dashboard.html"];
  const pages = await Promise.all(files.map((file) => readFile(new URL(`../${file}`, import.meta.url), "utf8")));
  pages.forEach((page) => assert.doesNotMatch(page, /[—–]/));
});
