// Warm white plaster over a band: a smoked skirting, pale oak battens and a smoked rail level with the window sills.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "plaster",
  kind: "wall",
  color: "plaster",
  pattern: "plain",
  bands: [{ to: 0.1, color: "smoked" }, { to: 0.76, color: "oak", pattern: "battens" }, { to: 0.8, color: "smoked-light" }],
});
