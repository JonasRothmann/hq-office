// Another agent's text, made safe to show in a lead's terminal (decision D20): the lead prompt (lead-router.ts) and
// `hud held` (hud.ts) both quote through here, so a question can never print as a command line or move the cursor.

// Line breaks in every form a terminal or a UI may honour: CR LF, CR, VT, FF, NEL, LINE and PARAGRAPH SEPARATOR.
const BREAKS = /\r\n?|[\u000b\u000c\u0085\u2028\u2029]/g;
// What is left that is not text: every C0 and C1 control but the line feed (TAB, ESC, BEL, the C1 CSI and OSC), and
// the bidi controls (LRM, RLM, ALM, the embeddings and overrides U+202A to U+202E, the isolates U+2066 to U+2069).
const CONTROLS = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

// One line: every break is a space and every control is gone. For short fields such as a lane's name.
export const oneLine = (text: unknown) => String(text ?? "").replace(BREAKS, " ").replace(/\n/g, " ").replace(CONTROLS, (c) => (c === "\t" ? " " : ""));

// Quoted lines: every break is a new line, every control is gone, and every line starts with "| ".
export const quoteAgentText = (text: unknown) =>
  String(text ?? "")
    .replace(BREAKS, "\n")
    .replace(CONTROLS, (c) => (c === "\t" ? " " : ""))
    .split("\n")
    .map((l) => `| ${l}`)
    .join("\n");
