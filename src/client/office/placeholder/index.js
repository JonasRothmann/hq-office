// Placeholders for the Japandi pieces the office will have (step 3 of docs/engine/rfc.md 12): one plain block per
// piece, with the piece's footprint and height, so the layout, nav and the camera are right before the art exists.
// Step 3 replaces each placeholder/<piece> with japandi/<piece>. Append new objects at the end of both lists.
import { definePack } from "@hq/world/model";
import sofa from "./sofa.js";
import teaTable from "./tea-table.js";
import kitchenette from "./kitchenette.js";
import bookshelf from "./bookshelf.js";

export default definePack({
  id: "placeholder",
  palette: {
    light: { block: "#c9c0b2", edge: "#a99f90" },
    dark: { block: "#b3aa9c", edge: "#8f8576" },
  },
  objects: [
    sofa,
    teaTable,
    kitchenette,
    bookshelf,
  ],
});
