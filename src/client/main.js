// The page's entry. Loads every built-in area in the order the old single script ran them, so the panels and the
// timers start as before. New features do not go here: a folder with an index.js is loaded by the page on its own
// (see AGENTS.md); the 3D office (world/) is one of them.
import "./core/dom.js";
import "./questions/drafts.js";
import "./core/state.js";
import "./questions/announce.js";
import "./feed/feed.js";
import "./sound/sound.js";
import "./core/status.js";
import "./core/format.js";
import "./core/text.js";
import "./core/net.js";
import "./settings/prefs.js";
import "./topbar/topbar.js";
import "./questions/questions.js";
import "./secrets/secrets.js";
import "./card/card.js";
import "./messages/messages.js";
import "./work-board/work-board.js";
import "./images/images.js";
import "./core/clicks.js";
import "./questions/answer.js";
import "./tell/tell.js";
import "./settings/panel.js";
import "./core/boot.js";
