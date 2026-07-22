const pages = new Map([
  ["/", "/index.html"],
  ["/music", "/music.html"],
  ["/videos", "/content.html"],
  ["/projects", "/projects.html"],
  ["/support", "/support.html"],
  ["/dashboard", "/dashboard.html"],
]);

const legacyPages = new Map([
  ["/index.html", "/"],
  ["/music.html", "/music"],
  ["/content.html", "/videos"],
  ["/projects.html", "/projects"],
  ["/support.html", "/support"],
  ["/dashboard.html", "/dashboard"],
  ["/music/", "/music"],
  ["/videos/", "/videos"],
  ["/projects/", "/projects"],
  ["/support/", "/support"],
  ["/dashboard/", "/dashboard"],
]);

export function resolvePublicRequest(pathname) {
  if (legacyPages.has(pathname)) return { type: "redirect", location: legacyPages.get(pathname) };
  if (pages.has(pathname)) return { type: "file", file: pages.get(pathname) };
  return { type: "file", file: pathname };
}
