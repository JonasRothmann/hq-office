// Loads the state, tells every panel (the bus "state" event), listens to the server's stream and reloads the page
// when its files change.
import { keepDrafts } from "../inbox/drafts.js";
import { CONFIG, S, setCONFIG, setS } from "./state.js";
import { scheduleTick, tick } from "../inbox/clock.js";
import { emit } from "./bus.js";

let pageStamp = null;
// The stream's first message is the whole state; after that each message holds only the parts of the state that
// changed. Listeners get the names of those parts (null for a whole state) and draw only what shows one of them.
function apply(part, whole) {
  setS(whole ? part : Object.assign(S, part));
  setCONFIG(S.config ?? CONFIG);
  if (pageStamp == null) pageStamp = S.page;
  else if (S.page !== pageStamp) { keepDrafts(); location.reload(); return; }
  emit("state", S, whole ? null : new Set(Object.keys(part)));
  tick();
  scheduleTick();
}
async function load() { apply(await (await fetch("/api/state")).json(), true); }
let stream = null;
function connect() {
  const es = (stream = new EventSource("/api/stream"));
  es.onmessage = (e) => {
    if (e.data[0] === "{") { apply(JSON.parse(e.data), !S); return; }
    // An older server sends only its version number, and the page fetches the whole state.
    if (!S || Number(e.data) !== S.version) load().catch(() => {});
  };
}
// A page that goes away (reload, navigation, or into the back-forward cache) closes its stream, so old streams
// never hold the browser's six connections to this server. Shown again from that cache, it opens a new one.
addEventListener("pagehide", () => { stream?.close(); stream = null; });
addEventListener("pageshow", (e) => { if (e.persisted && !stream) connect(); });
connect();
