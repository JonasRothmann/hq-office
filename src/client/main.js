// The page's entry. Loads every built-in area in order: the state and its helpers, the reader's views, then the stack
// and its keys, then the clock and the stream. New features do not go here: a folder with an index.js is loaded by
// the page on its own (see AGENTS.md); the 3D office (world/) and the rooms are among them.
import "./core/dom.js";
import "./inbox/drafts.js";
import "./core/state.js";
import "./sound/sound.js";
import "./core/status.js";
import "./core/format.js";
import "./core/text.js";
import "./core/net.js";
import "./settings/prefs.js";
import "./topbar/topbar.js";
import "./secrets/secrets.js";
import "./card/card.js";
import "./images/images.js";
import "./reader/shell.js";
import "./reader/ask.js";
import "./reader/update.js";
import "./reader/tell.js";
import "./work-board/work-board.js";
import "./inbox/stack.js";
import "./inbox/pills.js";
import "./inbox/keys.js";
import "./core/clicks.js";
import "./settings/panel.js";
import "./core/boot.js";
