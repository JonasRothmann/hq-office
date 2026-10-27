// The bookshelf's placeholder: a tall, shallow block against the wall, two tiles wide. Its front (+z) faces the room.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "bookshelf",
  footprint: [2, 1],
  height: 1.8,
  tags: ["placeholder", "storage"],
  build(k) {
    k.box("block", [1.8, 1.8, 0.35], [0, 0, -0.28], "block");
  },
});
