// The Japandi pack (docs/decisions.md D15): the office's furniture, lamps, plants, rugs, screens, doorways and
// finishes, one file per piece, with the colours in look/palette.js for day and night. Original shapes, built from
// boxes and cylinders. Append new objects at the end of both lists, one import per line.
import { definePack } from "@hq/world/model";
import { PALETTE, OVERRIDES } from "./look/palette.js";
import oak from "./oak.js";
import stone from "./stone.js";
import terrazzo from "./terrazzo.js";
import plaster from "./plaster.js";
import cladding from "./cladding.js";
import noren from "./noren.js";
import window from "./window.js";
import desk from "./desk.js";
import chair from "./chair.js";
import sofa from "./sofa.js";
import teaTable from "./tea-table.js";
import kitchenette from "./kitchenette.js";
import bookshelf from "./bookshelf.js";
import sideboard from "./sideboard.js";
import pendantWashi from "./pendant-washi.js";
import pendantCeramic from "./pendant-ceramic.js";
import floorLamp from "./floor-lamp.js";
import plantFig from "./plant-fig.js";
import plantSnake from "./plant-snake.js";
import plantMonstera from "./plant-monstera.js";
import vase from "./vase.js";
import rugLinen from "./rug-linen.js";
import rugBoro from "./rug-boro.js";
import tatami from "./tatami.js";
import shoji from "./shoji.js";
import teaCorner from "./tea-corner.js";
import workbench from "./workbench.js";
import clock from "./clock.js";
import sign from "./sign.js";
import corkboard from "./corkboard.js";
import printTall from "./print-tall.js";
import printWide from "./print-wide.js";
import radiator from "./radiator.js";
import diningTable from "./dining-table.js";
import bike from "./bike.js";
import dogBed from "./dog-bed.js";
import recordPlayer from "./record-player.js";
import loungeChair from "./lounge-chair.js";

export default definePack({
  id: "japandi",
  palette: PALETTE,
  overrides: OVERRIDES,
  objects: [
    oak,
    stone,
    terrazzo,
    plaster,
    cladding,
    noren,
    window,
    desk,
    chair,
    sofa,
    teaTable,
    kitchenette,
    bookshelf,
    sideboard,
    pendantWashi,
    pendantCeramic,
    floorLamp,
    plantFig,
    plantSnake,
    plantMonstera,
    vase,
    rugLinen,
    rugBoro,
    tatami,
    shoji,
    teaCorner,
    workbench,
    clock,
    sign,
    corkboard,
    printTall,
    printWide,
    radiator,
    diningTable,
    bike,
    dogBed,
    recordPlayer,
    loungeChair,
  ],
});
