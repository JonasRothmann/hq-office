// Links as preview cards: what each one is, its title, who linked it and the room shelf it is also on, all from what
// the server knows (S.inbox's links). Nothing is fetched from another site, not even a picture.
import { clock, esc } from "../core/format.js";

// Small icons, drawn on a grid.
const icon = (paths) => `<svg viewBox="0 0 12 12" aria-hidden="true" shape-rendering="crispEdges">${paths}</svg>`;
const ICON = {
  "claude-artifact": icon(`<path d="M5 0h2v3H5zM5 9h2v3H5zM0 5h3v2H0zM9 5h3v2H9zM3 3h2v2H3zM7 3h2v2H7zM3 7h2v2H3zM7 7h2v2H7zM5 5h2v2H5z"/>`),
  link: icon(`<path d="M1 4h2v1H1zM0 5h1v3H0zM1 8h4v1H1zM5 5h1v3H5zM4 4h1v1H4zM6 3h4v1H6zM10 4h1v3h-1zM6 7h4v1H6zM6 4h1v3H6zM3 6h6v1H3z"/>`),
  file: icon(`<path d="M2 0h6v1H2zM8 1h1v1H8zM9 2h1v1H9zM10 3h1v9H10zM1 1h1v11H1zM2 11h8v1H2zM8 2h1v2h2v1H8zM3 5h5v1H3zM3 7h5v1H3zM3 9h4v1H3z"/>`),
  image: icon(`<path d="M0 1h12v1H0zM0 2h1v9H0zM11 2h1v9h-1zM0 10h12v1H0zM2 8l3-3 2 2 1-1 2 2v1H2zM8 3h2v2H8z"/>`),
  room: icon(`<path d="M1 1h10v1H1zM1 2h1v9H1zM10 2h1v9h-1zM1 10h10v1H1zM4 5h4v3H4zM3 4h1v1H3zM8 4h1v1H8zM3 8h1v1H3zM8 8h1v1H8z"/>`),
};
const KIND = { "claude-artifact": "Claude artifact", file: "File", image: "Image", room: "Room" };

// On this page's own origin ("//host/x" and "/\host/x" are other hosts, so a prefix check is not enough).
const onThisHud = (u) => {
  try {
    return new URL(u, location.href).origin === location.origin;
  } catch {
    return false;
  }
};

export function linkCards(links = []) {
  return links.map((l) => {
    if (l.kind === "room") {
      const slug = l.url.replace(/^#room\//, "");
      return `<button class="lcard room" type="button" data-read="room:${esc(slug)}"><span class="lthumb">${ICON.room}</span><span class="ltx"><b>${esc(l.title)}</b><small>Room on this HUD</small></span><span class="lopen">Open</span></button>`;
    }
    // A picture shows only when it is on this HUD; anything else is its kind's icon.
    const local = onThisHud(l.url);
    const thumb = l.kind === "image" && local ? `<img src="${esc(l.url)}" alt="" loading="lazy">` : ICON[l.kind] ?? ICON.link;
    const sub = [esc(KIND[l.kind] ?? (l.host || "Link")),l.by ? `linked by ${esc(l.by)}${l.at ? ` ${clock(l.at)}` : ""}` : "", l.shelf ? `also on the ${esc(l.shelf.title)} shelf` : ""].filter(Boolean).join(" · ");
    return `<a class="lcard ${esc(l.kind)}" href="${esc(l.url)}" target="_blank" rel="noopener"><span class="lthumb">${thumb}</span><span class="ltx"><b>${esc(l.title)}</b><small>${sub}</small></span><span class="lopen">Open ↗</span></a>`;
  }).join("");
}
