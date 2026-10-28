// What a worker does for its lane's status: where it goes and the clip it loops there. One row per status, so a
// status's act is a line to read or change; the places are the worker's own (its chair, the tile beside its desk,
// its spot in the break area).

export const STATUS_ACTS = {
  moving: { place: "desk", clip: "type" },         // working: types at the desk
  needs_you: { place: "beside", clip: "wave" },    // a question for the owner: up beside the desk, hand raised
  blocked: { place: "beside", clip: "wave" },      // blocked on a prompt: the same
  with_lead: { place: "desk", clip: "sit" },       // a question with its lead: sits and waits at its desk
  "visit-lead": { place: "lead", clip: "idle", off: true }, // later: with the walk on, it waits beside its lead's desk
  hq_turn: { place: "desk", clip: "sit" },         // waiting on HQ: sits back from the keyboard
  waiting: { place: "desk", clip: "lean-back" },   // waiting on CI or another lane: leans back, hands behind the head
  stale: { place: "desk", clip: "sit" },           // waiting on HQ for a long time: sits
  done: { place: "break", clip: "drink" },         // done: a drink in the break area
  parked: { place: "break", clip: "idle" },        // parked: stands in the break area
  gone: { place: "break", clip: "idle" },          // its agent is gone: the same
};

// An unknown status counts as parked. A row marked `off` is never a status's row, so rowOf("visit-lead") is parked too.
export const rowOf = (status) => (STATUS_ACTS[status] && !STATUS_ACTS[status].off ? STATUS_ACTS[status] : STATUS_ACTS.parked);

// A place to the act that takes the worker there. `at`: { chair, beside, spot, lead } (spot is `beside` when the break
// area is full, so the worker stays by its desk; lead is the lead's desk, or `beside` when it has none).
const PLACES = {
  desk: (at, clip) => ({ do: "sit", target: at.chair, clip }),
  beside: (at, clip) => ({ do: "walk", to: at.beside, clip }),
  break: (at, clip) => ({ do: "walk", to: at.spot, clip }),
  lead: (at, clip) => ({ do: "walk", to: at.lead ?? at.beside, clip }),
};

// The walk to the lead is off by default (a later setting turns it on with `visitLead`).
export function actFor(who, status, at, opts = {}) {
  const row = status === "with_lead" && opts.visitLead ? STATUS_ACTS["visit-lead"] : rowOf(status);
  return { who, ...PLACES[row.place](at, row.clip) };
}
