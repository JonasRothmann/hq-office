// createWorld's pickable option, in headless Chrome (WebGL on SwiftShader; skipped without Chrome): a hit on an object
// the host refuses is skipped, so pick returns what is behind it and the object does not swallow the click.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { serve, PKG } from "../tools/serve.ts";
import { startChrome, openTab, findChrome } from "../tools/chrome.ts";
import { labUrl } from "../tools/shot.ts";

const T = 240_000; // the machine may be loaded: Chrome and SwiftShader take their time

describe.skipIf(!findChrome())("pickable", () => {
  let server: ReturnType<typeof serve>, chrome: Awaited<ReturnType<typeof startChrome>>, tab: Awaited<ReturnType<typeof openTab>>;

  beforeAll(async () => {
    server = serve({ root: PKG });
    chrome = await startChrome();
    tab = await openTab(chrome.cdp, { w: 800, h: 600 });
    await tab.load(labUrl(server.port, "/@hq/world/test/fixtures/house.world.js", {}));
    await tab.evaluate(`(async () => {
      const { createWorld } = await import("@hq/world");
      const { default: house } = await import("/@hq/world/test/fixtures/house.world.js");
      const make = (o = {}) => {
        const c = document.createElement("canvas");
        Object.assign(c.style, { position: "fixed", left: "0px", top: "0px", width: "800px", height: "600px", zIndex: 10 });
        document.body.append(c);
        return createWorld(c, house, { clock: "manual", size: { w: 800, h: 600 }, startActs: false, time: "12:00", ...o });
      };
      // a screen point that picks the given id with the default options, found by sampling the desk's footprint
      const spot = (w, id, y) => {
        const o = w.lot.objects.find((x) => x.id === id);
        for (const dx of [0, -0.3, 0.3, -0.6, 0.6]) for (const dz of [0, 0.15, -0.15]) {
          const q = w.project([o.pos[0] + dx, y, o.pos[2] + dz]);
          if (w.pick(q.x, q.y)?.id === id) return [q.x, q.y];
        }
        throw new Error("no point on screen picks " + id);
      };
      window.__p = { make, spot };
    })()`);
  }, T);

  afterAll(async () => { await chrome?.close(); server?.stop(true); });

  test("a refused object is skipped: pick returns what is behind it, and the default still picks it", async () => {
    const r = await tab.evaluate(`(() => {
      const { make, spot } = __p;
      const plain = make();
      const deskP = spot(plain, "desk-1", 0.74);
      const plainHit = plain.pick(...deskP)?.id;
      plain.dispose();
      const w = make({ pickable: (id) => id !== "desk-1" });
      const hit = w.pick(...deskP);
      w.dispose();
      return { plainHit, hit };
    })()`);
    expect(r.plainHit).toBe("desk-1");
    expect(r.hit?.id).not.toBe("desk-1");
  }, T);
});
