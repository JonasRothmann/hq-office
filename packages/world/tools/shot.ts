#!/usr/bin/env bun
// Render a world file headlessly and save the frame, so an agent can see what it built.
//
//   bun packages/world/tools/shot.ts <world.js> [--rot 0..3] [--zoom 0..2] [--theme light|dark] [--time 14:00]
//        [--walls up|cutaway|down] [--focus ROOM] [--focus-on x,z] [--advance MS] [--size 1280x800] [--clean]
//        [--root DIR] [--out shot.jpg]
//
// Paths are relative to the current directory, from anywhere. The lab serves the folder that holds the world and every
// file it imports (its packs), or --root. The world runs on a manual clock: nothing moves until --advance ms have been
// simulated (acts walk and sit in that time). WebGL runs on SwiftShader.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, relative } from "node:path";
import { serve } from "./serve.ts";
import { startChrome, openTab } from "./chrome.ts";
import { fileArg, rootFor, shown } from "./paths.ts";

export type ShotOptions = { rot?: number; zoom?: number; theme?: string; time?: string; walls?: string; focus?: string; focusOn?: string; clean?: boolean };

export function labUrl(port: number, worldUrl: string, o: ShotOptions) {
  const q = new URLSearchParams({ world: worldUrl, manual: "1" });
  for (const [k, v] of Object.entries({ rot: o.rot, zoom: o.zoom, theme: o.theme, time: o.time, walls: o.walls, focus: o.focus, focusOn: o.focusOn })) if (v !== undefined) q.set(k, String(v));
  if (o.clean !== false) q.set("clean", "1");
  return `http://127.0.0.1:${port}/@hq/world/lab/index.html?${q}`;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const arg = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
  const world = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
  if (!world) { console.error("usage: bun tools/shot.ts <world.js> [--rot N] [--zoom N] [--theme T] [--time HH:MM] [--walls MODE] [--out FILE]"); process.exit(2); }
  const root = rootFor([world], arg("root"));
  const out = fileArg(arg("out") ?? "shot.jpg");
  const [w, h] = (arg("size") ?? "1280x800").split("x").map(Number);
  const num = (k: string) => (arg(k) !== undefined ? Number(arg(k)) : undefined);
  const server = serve({ root });
  const chrome = await startChrome();
  try {
    const tab = await openTab(chrome.cdp, { w, h });
    const rel = relative(root, fileArg(world));
    if (rel.startsWith("..")) throw new Error(`${shown(fileArg(world))} is not under --root ${shown(root)}`);
    const worldUrl = "/" + rel.split("\\").join("/");
    await tab.load(labUrl(server.port, worldUrl, { rot: num("rot"), zoom: num("zoom"), theme: arg("theme"), time: arg("time"), walls: arg("walls"), focus: arg("focus"), focusOn: arg("focus-on"), clean: !args.includes("--chrome") }));
    const state = await tab.evaluate(`JSON.stringify(window.__lab.world.advance(${Number(arg("advance") ?? 0)}))`);
    const shot = await tab.screenshot(out.endsWith(".png") ? "png" : "jpeg");
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, shot);
    const s = JSON.parse(state);
    console.log(`${shown(out)}: rot ${s.rot} zoom ${s.zoom} walls ${s.walls} ${s.theme} ${s.time}; camera y ${s.camera.y}; ${s.draws} draw calls, ${Math.round(s.triangles / 1000)}k triangles; ${s.characters.map((c: any) => `${c.id} ${c.clip}`).join(", ")}`);
    if (tab.errors.length) console.log(`page said: ${tab.errors.join(" | ")}`);
  } finally {
    await chrome.close();
    server.stop(true);
  }
}
