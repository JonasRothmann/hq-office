// The world's one door for other areas (spec section 6): THREE, frame hooks, desk anchors, projection, parenting.
// Bus events: "world:ready", "world:select" (lane name), "world:layout" (the names of the lanes at desks).
import { THREE } from "./kit.js";

export { THREE };

let world = null;
const frames = new Set();

// world.js binds itself here when it mounts; the functions below answer null or nothing until then.
export function bindWorld(w) { world = w; }
export function runFrame(now, dt) { for (const fn of [...frames]) { try { fn(now, dt); } catch (e) { console.error("world frame hook failed", e); } } }

// fn(now, dt) after the scene updates, before render. Returns a function that removes it.
export function onFrame(fn) {
  frames.add(fn);
  return () => frames.delete(fn);
}

// A THREE.Vector3 in world space above the lane's desk, or null when the lane has no desk.
export function deskAnchor(lane) {
  return world?.deskAnchor(lane) ?? null;
}

// A world point to CSS pixels on the canvas: { x, y, visible }.
export function project(v3) {
  if (!world) return { x: 0, y: 0, visible: false };
  return world.project(v3);
}

// Parent an object to a lane's desk group (its own frame: the desk's centre on the floor at the origin, the worker's
// chair toward +z), or to the world when lane is null. The desk is the lane's own; its room is shared by its team.
export function addToWorld(obj, lane) {
  return world?.addToWorld(obj, lane) ?? false;
}
