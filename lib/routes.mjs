const pages = new Map([
  ["/", "/index.html"],
  ["/music", "/music.html"],
  ["/label", "/label.html"],
  ["/videos", "/content.html"],
  ["/projects", "/projects.html"],
  ["/support", "/support.html"],
  ["/faq", "/faq.html"],
  ["/dashboard", "/dashboard.html"],
  ["/privacy", "/privacy.html"],
  ["/fishadise", "/fishadise.html"],
  ["/fishadise/privacy", "/tanktopia-privacy.html"],
  ["/fishadise/eula", "/tanktopia-eula.html"],
  ["/steady/privacy", "/steady-privacy.html"],
  ["/steady/terms", "/steady-terms.html"],
]);

export const legacyPages = new Map([
  ["/index.html", "/"],
  ["/music.html", "/music"],
  ["/label.html", "/label"],
  ["/label/", "/label"],
  ["/content.html", "/videos"],
  ["/projects.html", "/projects"],
  ["/support.html", "/support"],
  ["/faq.html", "/faq"],
  ["/dashboard.html", "/dashboard"],
  ["/privacy.html", "/privacy"],
  ["/steady-privacy.html", "/steady/privacy"],
  ["/steady-terms.html", "/steady/terms"],
  ["/music/", "/music"],
  ["/videos/", "/videos"],
  ["/projects/", "/projects"],
  ["/support/", "/support"],
  ["/faq/", "/faq"],
  ["/dashboard/", "/dashboard"],
  ["/privacy/", "/privacy"],
  ["/steady/privacy/", "/steady/privacy"],
  ["/steady/terms/", "/steady/terms"],
]);

// Preserve links from installed builds, bookmarks, and the former game name.
for (const base of ["tanktopia", "fishadise"]) {
  for (const path of [`/${base}/`, `/${base}.html`]) legacyPages.set(path, "/fishadise");
  for (const page of ["privacy", "eula"]) {
    for (const path of [`/${base}/${page}/`, `/${base}/${page}.html`, `/${base}-${page}`, `/${base}-${page}.html`]) {
      legacyPages.set(path, `/fishadise/${page}`);
    }
    if (base === "tanktopia") legacyPages.set(`/${base}/${page}`, `/fishadise/${page}`);
  }
}
legacyPages.set("/tanktopia", "/fishadise");

export function resolvePublicRequest(pathname) {
  if (legacyPages.has(pathname)) return { type: "redirect", location: legacyPages.get(pathname) };
  if (pages.has(pathname)) return { type: "file", file: pages.get(pathname) };
  return { type: "file", file: pathname };
}
