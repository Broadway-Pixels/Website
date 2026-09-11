const pages = new Map([
  ["/", "/index.html"],
  ["/account", "/account.html"],
  ["/account/privacy", "/account-privacy.html"],
  ["/account-logo.png", "/assets/broadway-pixels-logo-v2.png"],
  ["/music", "/music.html"],
  ["/videos", "/content.html"],
  ["/projects", "/projects.html"],
  ["/support", "/support.html"],
  ["/faq", "/faq.html"],
  ["/dashboard", "/dashboard.html"],
  ["/privacy", "/privacy.html"],
  ["/tanktopia/privacy", "/tanktopia-privacy.html"],
  ["/tanktopia/eula", "/tanktopia-eula.html"],
  ["/steady/privacy", "/steady-privacy.html"],
  ["/steady/terms", "/steady-terms.html"],
]);

const legacyPages = new Map([
  ["/index.html", "/"],
  ["/account.html", "/account"],
  ["/account/", "/account"],
  ["/music.html", "/music"],
  ["/content.html", "/videos"],
  ["/projects.html", "/projects"],
  ["/support.html", "/support"],
  ["/faq.html", "/faq"],
  ["/dashboard.html", "/dashboard"],
  ["/privacy.html", "/privacy"],
  ["/tanktopia-eula.html", "/tanktopia/eula"],
  ["/steady-privacy.html", "/steady/privacy"],
  ["/steady-terms.html", "/steady/terms"],
  ["/music/", "/music"],
  ["/videos/", "/videos"],
  ["/projects/", "/projects"],
  ["/support/", "/support"],
  ["/faq/", "/faq"],
  ["/dashboard/", "/dashboard"],
  ["/privacy/", "/privacy"],
  ["/tanktopia/privacy/", "/tanktopia/privacy"],
  ["/tanktopia/eula/", "/tanktopia/eula"],
  ["/steady/privacy/", "/steady/privacy"],
  ["/steady/terms/", "/steady/terms"],
]);

export function resolvePublicRequest(pathname) {
  if (legacyPages.has(pathname)) return { type: "redirect", location: legacyPages.get(pathname) };
  if (pages.has(pathname)) return { type: "file", file: pages.get(pathname) };
  return { type: "file", file: pathname };
}
