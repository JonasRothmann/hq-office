// The land pack: the pieces of the scenery round the office (outside/scenery.js places them), one file per piece, with
// the colours in look/palette.js for day and night. Original shapes, built from boxes and cylinders. Append new pieces
// at the end of both lists, one import per line.
import { definePack } from "@hq/world/model";
import { PALETTE } from "./look/palette.js";
import treeBirch from "./tree-birch.js";
import treeConifer from "./tree-conifer.js";
import treeMaple from "./tree-maple.js";
import treeMapleRed from "./tree-maple-red.js";
import treeShrub from "./tree-shrub.js";
import treeRound from "./tree-round.js";
import rock from "./rock.js";
import flower from "./flower.js";
import tuft from "./tuft.js";
import reed from "./reed.js";
import bridge from "./bridge.js";
import block from "./block.js";
import roofGable from "./roof-gable.js";
import gableEnd from "./gable-end.js";
import roofHip from "./roof-hip.js";
import roofStep from "./roof-step.js";
import spire from "./spire.js";
import pane from "./pane.js";
import frame from "./frame.js";
import awning from "./awning.js";
import wire from "./wire.js";
import lampHanging from "./lamp-hanging.js";
import lampPost from "./lamp-post.js";
import bench from "./bench.js";
import cafeTable from "./cafe-table.js";
import bollard from "./bollard.js";
import fountain from "./fountain.js";
import statue from "./statue.js";
import boatShip from "./boat-ship.js";
import boatSail from "./boat-sail.js";
import boatMotor from "./boat-motor.js";
import car from "./car.js";
import van from "./van.js";
import bus from "./bus.js";
import carLights from "./car-lights.js";
import bike from "./bike.js";
import cargoBike from "./cargo-bike.js";
import walker from "./walker.js";
import walkerLegs from "./walker-legs.js";
import head from "./head.js";
import rider from "./rider.js";
import gardenMaple from "./garden-maple.js";
import stoneLantern from "./stone-lantern.js";
import basin from "./basin.js";
import moss from "./moss.js";
import stepStone from "./step-stone.js";
import paver from "./paver.js";
import gardenBollard from "./garden-bollard.js";
import gravelBed from "./gravel-bed.js";
import pine from "./pine.js";
import shrubClipped from "./shrub-clipped.js";
import grassClump from "./grass-clump.js";
import gardenBench from "./garden-bench.js";
import deck from "./deck.js";
import bikeRack from "./bike-rack.js";
import lightPool from "./light-pool.js";
import hair from "./hair.js";

export default definePack({
  id: "land",
  palette: PALETTE,
  objects: [
    treeBirch,
    treeConifer,
    treeMaple,
    treeMapleRed,
    treeShrub,
    treeRound,
    rock,
    flower,
    tuft,
    reed,
    bridge,
    block,
    roofGable,
    gableEnd,
    roofHip,
    roofStep,
    spire,
    pane,
    frame,
    awning,
    wire,
    lampHanging,
    lampPost,
    bench,
    cafeTable,
    bollard,
    fountain,
    statue,
    boatShip,
    boatSail,
    boatMotor,
    car,
    van,
    bus,
    carLights,
    bike,
    cargoBike,
    walker,
    walkerLegs,
    head,
    rider,
    gardenMaple,
    stoneLantern,
    basin,
    moss,
    stepStone,
    paver,
    gardenBollard,
    gravelBed,
    pine,
    shrubClipped,
    grassClump,
    gardenBench,
    deck,
    bikeRack,
    lightPool,
    hair,
  ],
});
