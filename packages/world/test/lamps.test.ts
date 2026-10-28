// What a host adds to a drawn view, in headless Chrome (WebGL on SwiftShader; skipped without Chrome): its own lamps,
// dark by day and lit by night, through set and remove and an edit and a theme change; and a hover target that
// refuses a hit or sends its highlight to another object. Measured in the frame's pixels.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { serve, PKG } from "../tools/serve.ts";
import { startChrome, openTab, findChrome } from "../tools/chrome.ts";
import { labUrl } from "../tools/shot.ts";

const T = 240_000; // the machine may be loaded: Chrome and SwiftShader take their time

describe.skipIf(!findChrome())("in a drawn view", () => {
  let server: ReturnType<typeof serve>, chrome: Awaited<ReturnType<typeof startChrome>>, tab: Awaited<ReturnType<typeof openTab>>;

  beforeAll(async () => {
    server = serve({ root: PKG });
    chrome = await startChrome();
    tab = await openTab(chrome.cdp, { w: 800, h: 600 });
    await tab.load(labUrl(server.port, "/@hq/world/test/fixtures/house.world.js", {}));
    // A view of the test house on a canvas of its own, at the page's top left (so client px are canvas px), still:
    // a manual clock and no acts. frame() renders and reads the whole buffer; patch() is the mean of 5×5 px round a
    // point; changed() counts the pixels that moved by more than 2 levels; spot() finds a point that picks `id`.
    await tab.evaluate(`(async () => {
      const { createWorld, fromJSON } = await import("@hq/world");
      const { default: house } = await import("/@hq/world/test/fixtures/house.world.js");
      const make = (o = {}) => {
        const c = document.createElement("canvas");
        Object.assign(c.style, { position: "fixed", left: "0px", top: "0px", width: "800px", height: "600px", zIndex: 10 });
        document.body.append(c);
        return createWorld(c, house, { clock: "manual", size: { w: 800, h: 600 }, startActs: false, time: "12:00", ...o });
      };
      const frame = (w) => {
        w.render();
        const gl = w.three.renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return { W, H, px };
      };
      const patch = (f, [x, y]) => {
        let s = 0, n = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const i = ((f.H - 1 - Math.round(y + dy)) * f.W + Math.round(x + dx)) * 4;
          s += f.px[i] + f.px[i + 1] + f.px[i + 2]; n += 3;
        }
        return s / n;
      };
      const changed = (a, b) => { let n = 0; for (let i = 0; i < a.px.length; i += 4) if (Math.abs(a.px[i] - b.px[i]) > 2 || Math.abs(a.px[i + 1] - b.px[i + 1]) > 2 || Math.abs(a.px[i + 2] - b.px[i + 2]) > 2) n++; return n; };
      const at = (w, p) => { const q = w.project(p); return [q.x, q.y]; };
      const spot = (w, id, y) => {
        const o = w.lot.objects.find((x) => x.id === id);
        for (const dx of [0, -0.3, 0.3, -0.6, 0.6]) for (const dz of [0, 0.15, -0.15]) {
          const p = at(w, [o.pos[0] + dx, y, o.pos[2] + dz]);
          if (w.pick(...p)?.id === id) return p;
        }
        throw new Error("no point on screen picks " + id);
      };
      const spots = (w) => [...w.three.scene.children].filter((c) => c.isSpotLight).length;
      window.__t = { house, fromJSON, make, frame, patch, changed, at, spot, spots };
    })()`);
  }, T);

  afterAll(async () => { await chrome?.close(); server?.stop(true); });

  test("a host lamp is dark by day, lit by night, follows set, stays through an edit and a theme, and goes with remove", async () => {
    const r = await tab.evaluate(`(() => {
      const { house, fromJSON, make, frame, patch, changed, at, spots } = __t;
      const w = make();
      const floor = at(w, [9.5, 0.06, 5.5]); // the lounge's floor, under the new lamp
      const lights = spots(w);
      const before = frame(w);
      const lamp = w.addLamp([9.5, 2.4, 5.5]);
      const day = frame(w);
      w.setTime("23:00");
      const night = patch(frame(w), floor);
      lamp.set({ intensity: 0 });
      const off = patch(frame(w), floor);
      lamp.set({ intensity: 4.2 });
      // an edit (a plant goes) and the dark theme: the lamp is still there and still lit
      const doc = structuredClone(house.doc); doc.objects = doc.objects.filter((o) => o.id !== "plant-3");
      w.apply(fromJSON(doc, house.packs));
      w.setTheme("dark");
      const darkOn = patch(frame(w), floor);
      lamp.set({ intensity: 0 });
      const darkOff = patch(frame(w), floor);
      lamp.set({ intensity: 4.2 });
      lamp.remove();
      const removed = patch(frame(w), floor);
      lamp.set({ intensity: 9 }); // after remove: nothing
      const after = { lights: spots(w), still: patch(frame(w), floor) };
      w.dispose();
      return { dayChanged: changed(before, day), night, off, darkOn, darkOff, removed, lights, after };
    })()`);
    expect(r.dayChanged).toBe(0);                         // by day the lamp gives no light at all
    expect(r.night).toBeGreaterThan(r.off + 15);          // by night it lights the floor under it
    expect(r.darkOn).toBeGreaterThan(r.darkOff + 15);     // still there, and lit, after apply and setTheme
    expect(Math.abs(r.removed - r.darkOff)).toBeLessThan(1.5); // removed: as dark as at intensity 0
    expect(r.after.lights).toBe(r.lights);               // the light itself is gone from the scene
    expect(r.after.still).toBeCloseTo(r.removed, 1);     // and set after remove does nothing
  }, T);

  test("hoverTarget: the default highlights the object hit; a host can refuse a hit or send the highlight elsewhere", async () => {
    const r = await tab.evaluate(`(() => {
      const { make, frame, patch, changed, spot } = __t;
      // the default, on a view without hoverTarget: the desk under the pointer lights up
      const plain = make();
      const deskP = spot(plain, "desk-1", 0.74);
      const plainBase = frame(plain);
      plain.hover(...deskP);
      const plainDesk = patch(frame(plain), deskP) - patch(plainBase, deskP);
      plain.dispose();

      let mode = "none";
      const w = make({ hoverTarget: (hit) => mode === "none" ? null : mode === "character" ? "ada" : hit?.id === "desk-1" ? "plant-1" : null });
      const desk = spot(w, "desk-1", 0.74), plant = spot(w, "plant-1", 0.4);
      const hits = [];
      w.on("hover", (h) => hits.push(h));
      const base = frame(w);
      const none = w.hover(...desk);
      const refused = changed(base, frame(w));
      mode = "character";
      w.hover(...desk);
      const character = changed(base, frame(w));
      mode = "redirect";
      const raw = w.hover(...desk);
      const f = frame(w);
      const out = { plainDesk, refused, character, none, raw, emitted: hits.at(-1),
        redirectDesk: patch(f, desk) - patch(base, desk), redirectPlant: patch(f, plant) - patch(base, plant) };
      w.dispose();
      return out;
    })()`);
    expect(r.plainDesk).toBeGreaterThan(3);               // the default: the desk hit is highlighted
    expect(r.none).toMatchObject({ kind: "object", id: "desk-1" }); // hover still returns the raw pick
    expect(r.refused).toBe(0);                            // null: nothing highlighted, the frame is unchanged
    expect(r.character).toBe(0);                          // a character's id is not an object: nothing either
    expect(r.raw).toMatchObject({ kind: "object", id: "desk-1" });
    expect(r.emitted).toMatchObject({ kind: "object", id: "desk-1" }); // and emits it
    expect(Math.abs(r.redirectDesk)).toBeLessThan(1);     // the desk under the pointer stays as it was
    expect(r.redirectPlant).toBeGreaterThan(3);           // the plant it was sent to lights up
  }, T);
});
