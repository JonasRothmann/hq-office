// What a worker does for its lane's status: where it goes and the clip it loops there. One row per status, so a
// status's act is a line to read or change; the places are the worker's own (its chair, the tile beside its desk,
// its spot in the break area).

export const STATUS_ACTS = {
  moving: { place: "desk", clip: "type" },         // working: types at the desk
  needs_you: { place: "beside", clip: "wave" },    // a question for the owner: up beside the desk, hand raised
  blocked: { place: "beside", clip: "wave" },      // blocked on a prompt: the same
  hq_turn: { place: "desk", clip: "sit" },         // waiting on HQ: sits back from the keyboard
  waiting: { place: "desk", clip: "lean-back" },   // waiting on CI or another lane: leans back, hands behind the head
  stale: { place: "desk", clip: "sit" },           // waiting on HQ for a long time: sits
  done: { place: "break", clip: "drink" },         // done: a drink in the break area
  parked: { place: "break", clip: "idle" },        // parked: stands in the break area
  gone: { place: "break", clip: "idle" },          // its agent is gone: the same
};

// An unknown status counts as parked.
export const rowOf = (status) => STATUS_ACTS[status] ?? STATUS_ACTS.parked;

// A place to the act that takes the worker there. `at`: { chair, beside, spot } (spot is `beside` when the break
// area is full, so the worker stays by its desk).
const PLACES = {
  desk: (at, clip) => ({ do: "sit", target: at.chair, clip }),
  beside: (at, clip) => ({ do: "walk", to: at.beside, clip }),
  break: (at, clip) => ({ do: "walk", to: at.spot, clip }),
};

// The walk to the lead's desk (docs/engine/rfc.md 12, step 4) goes here when it is built: a place "lead" whose act is
// { do: "visit", target: at.lead, wait, then: { do: "sit", target: at.chair, clip } }, with at.lead (the lead's desk)
// from plan.js, and a setting that turns it on.
export function actFor(who, status, at) {
  const row = rowOf(status);
  return { who, ...PLACES[row.place](at, row.clip) };
}
