// A round dog bed on the floor with a dog curled up asleep on it: a wool cushion with a felt rim, a linen nest on top,
// and a tan dog, nose to tail, its head resting on its front paws. The bed is 78 cm across and 10 cm high at the rim.
import { defineObject } from "@hq/world/model";
import { ball } from "./look/shapes.js";

const BASE = 0.002;     // the wool cushion's bottom, lifted 2 mm off the floor so it does not share the rim's plane
const WOOL = 0.05;      // the wool cushion's top; the felt rim stands on it
const RIM = 0.1;        // the rim's top, 10 cm above the floor
const NEST = 0.052;     // the linen nest's bottom, 2 mm above the wool's top
const LIE = 0.082;      // the nest's top: where the dog lies

const RING = 0.355;     // the rim's centre line, from the bed's centre
const PADS = 12;        // felt pads round the rim
const BZ = -0.02;       // the dog's body centre, a little behind the bed's centre
const TAIL = 0.25;      // the tail's radius round the body's centre

export default defineObject({
  id: "dog-bed",
  footprint: [1, 1],
  height: 0.4,
  blocks: true,
  tags: ["decor", "signature"],
  build(k) {
    // the wool cushion: a low disc
    k.cyl("wool", 0.36, WOOL - BASE, [0, BASE, 0], "wool", { seg: 24 });

    // the felt rim: twelve short pads round the edge, each turned about y to follow the ring
    for (let i = 0; i < PADS; i++) {
      const a = (i / PADS) * Math.PI * 2;
      k.box("rim", [0.17, RIM - WOOL, 0.07], [Math.sin(a) * RING, WOOL, Math.cos(a) * RING], "felt", { rot: [0, a, 0] });
    }

    // the linen nest on top, lifted 2 mm off the wool
    k.cyl("nest", 0.28, LIE - NEST, [0, NEST, 0], "linen", { seg: 20 });

    // the body: a coat ball squashed into a low curl
    ball(k, "body", 0.2, [0, LIE, BZ], "coat", { sy: 0.55, bands: 4, seg: 14 });

    // the head, resting on the front of the body, with a cream muzzle and a dark nose
    ball(k, "head", 0.1, [0, LIE, 0.16], "coat", { sy: 0.85, bands: 3, seg: 10 });
    ball(k, "muzzle", 0.05, [0, 0.12, 0.2], "coat-light", { sy: 0.8, bands: 2, seg: 10 });
    k.box("nose", [0.024, 0.016, 0.014], [0, 0.165, 0.245], "ink");

    // two closed eyes: thin ink lids, 2 mm proud of the head
    for (const x of [-0.042, 0.042]) k.box("eye", [0.022, 0.008, 0.008], [x, 0.19, 0.255], "ink");

    // two floppy ears, hanging down the sides of the head and splayed outward
    for (const sx of [-1, 1]) k.box("ear", [0.035, 0.09, 0.02], [sx * 0.1, 0.1, 0.14], "coat-dark", { rot: [0, 0, -sx * 0.3] });

    // the front paws, tucked under the head
    for (const x of [-0.05, 0.05]) k.box("paw", [0.05, 0.03, 0.07], [x, LIE, 0.2], "coat");

    // the tail: three segments round the back and the left side, the last one darker
    [[Math.PI + 0.3, "coat"], [Math.PI + 1.05, "coat"], [Math.PI + 1.8, "coat-dark"]].forEach(([a, color]) => {
      k.box("tail", [0.17, 0.05, 0.055], [Math.sin(a) * TAIL, LIE, BZ + Math.cos(a) * TAIL], color, { rot: [0, a, 0] });
    });
  },
});
