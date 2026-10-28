// Character motion shared by the systems: speeds, easing, turning toward a heading, the floor height, and clips that
// cross-fade. Pure: plain numbers and plain objects, no three.js.
import { FLOOR_Y, QUARTER, tileKey } from "../model/grid.js";
import { CLIPS, samplePose, blendPose } from "../anim/clips.js";

export const WALK_SPEED = 1.3; // m/s
export const TURN_RATE = 9;    // rad/s
export const FADE = 0.2;       // s, the cross-fade between clips

export const facingAngle = (side) => QUARTER[side] * (Math.PI / 2);
export const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const ease = (t) => t * t * (3 - 2 * t);
export const floorAt = (lot, x, z) => (lot.floor.has(tileKey(Math.floor(x), Math.floor(z))) ? FLOOR_Y : 0);

export function turnToward(a, target, max) {
  const d = wrap(target - a);
  return Math.abs(d) <= max ? target : a + Math.sign(d) * max;
}

// anim: { clip, t, from, fadeT }. The pose now, blended out of the previous clip for FADE seconds.
export function poseOf(anim) {
  const p = samplePose(CLIPS[anim.clip] ?? CLIPS.idle, anim.t);
  return anim.from && anim.fadeT < FADE ? blendPose(anim.from, p, ease(anim.fadeT / FADE)) : p;
}

export function setClip(anim, clip) {
  if (anim.clip === clip) return;
  anim.from = poseOf(anim);
  anim.fadeT = 0;
  anim.clip = clip;
  anim.t = 0;
}
