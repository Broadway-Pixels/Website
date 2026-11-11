(() => {
  const grid = document.querySelector("[data-latest-reels]");
  if (!grid) return;

  const cards = [...grid.querySelectorAll(".short-card")].map((card) => ({
    card,
    date: card.querySelector("time"),
    title: card.querySelector("h3"),
    image: card.querySelector("img"),
  }));
  if (!cards.length || cards.some(({ date, title, image }) => !date || !title || !image)) return;

  const dateFormat = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long", timeZone: "America/New_York",
  });
  const fallbackImages = new Map(cards.map(({ card, image }) => [card.href, image.getAttribute("src")]));

  async function refresh() {
    try {
      const response = await fetch("/api/reels", { credentials: "omit", signal: AbortSignal.timeout(8000) });
      if (!response.ok) return;
      const { reels } = await response.json();
      if (!Array.isArray(reels) || !reels.length || reels.length > cards.length) return;

      const items = [];
      const ids = new Set();
      for (const reel of reels) {
        if (typeof reel?.id !== "string" || !/^[A-Za-z0-9_-]{11}$/.test(reel.id) || ids.has(reel.id)) return;
        if (typeof reel.title !== "string" || !reel.title.trim() || reel.title.length > 200) return;
        if (typeof reel.publishedAt !== "string") return;
        const published = new Date(reel.publishedAt);
        if (!Number.isFinite(published.valueOf())) return;
        ids.add(reel.id);
        items.push({ id: reel.id, title: reel.title, published });
      }

      // A partial feed should not leave a duplicate or reorder the static cards.
      if (items.length < cards.length) return;
      items.sort((a, b) => b.published - a.published);
      for (const item of items) {
        item.href = `https://www.youtube.com/shorts/${item.id}`;
        item.image = fallbackImages.get(item.href) || `/api/reels/thumbnail/${item.id}`;
      }
      // Keep the bundled deck intact if an upstream thumbnail is missing.
      await Promise.all(items.filter(({ href }) => !fallbackImages.has(href)).map(async (item) => {
        const image = new Image();
        image.src = item.image;
        await image.decode();
      }));
      if (grid.contains(document.activeElement)) return;
      cards.forEach(({ card, date, title, image }, index) => {
        const item = items[index];
        card.href = item.href;
        title.textContent = item.title;
        date.dateTime = item.published.toISOString();
        date.textContent = dateFormat.format(item.published);
        if (image.getAttribute("src") !== item.image) image.src = item.image;
      });
    } catch {
      // Keep the bundled cards usable when the feed is slow or unavailable.
    }
  }

  void refresh();
})();
