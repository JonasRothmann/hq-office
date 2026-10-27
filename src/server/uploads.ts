// Uploads from the page's + menu: any file of a known type, up to 25 MB, kept in HUD_DATA_DIR/uploads under a name
// nobody can guess. The page and the lanes get a URL on this server, never a path on this machine's disk, so a lane on
// another machine can fetch it. A file's bytes must match its type: a PNG starts like a PNG, a text file is UTF-8.
import { randomBytes } from "node:crypto";
import { UPLOADS } from "./config.ts";
import { MAX_ROOM_FILE } from "./rooms.ts";

export const MAX_FILE = MAX_ROOM_FILE;
type Type = { mime: string; kind: "image" | "file"; magic?: (b: Uint8Array) => boolean; text?: boolean };
const starts = (sig: number[], at = 0) => (b: Uint8Array) => sig.every((x, i) => b[at + i] === x);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const text = (mime: string): Type => ({ mime: `${mime}; charset=utf-8`, kind: "file", text: true });
// By extension. Anything else is refused: no programs, no disk images, nothing the HUD cannot say is harmless to keep.
export const TYPES: Record<string, Type> = {
  png: { mime: "image/png", kind: "image", magic: starts([0x89, 0x50, 0x4e, 0x47]) },
  jpg: { mime: "image/jpeg", kind: "image", magic: starts([0xff, 0xd8, 0xff]) },
  gif: { mime: "image/gif", kind: "image", magic: starts(ascii("GIF8")) },
  webp: { mime: "image/webp", kind: "image", magic: (b) => starts(ascii("RIFF"))(b) && starts(ascii("WEBP"), 8)(b) },
  pdf: { mime: "application/pdf", kind: "file", magic: starts(ascii("%PDF-")) },
  zip: { mime: "application/zip", kind: "file", magic: starts([0x50, 0x4b, 0x03, 0x04]) },
  txt: text("text/plain"), log: text("text/plain"), md: text("text/markdown"), csv: text("text/csv"), tsv: text("text/tab-separated-values"),
  json: text("application/json"), yaml: text("text/yaml"), yml: text("text/yaml"), toml: text("text/plain"), xml: text("text/xml"),
  html: text("text/html"), svg: { ...text("image/svg+xml"), kind: "image" }, diff: text("text/x-diff"), patch: text("text/x-diff"),
  ts: text("text/plain"), js: text("text/plain"), py: text("text/plain"), sql: text("text/plain"), sh: text("text/plain"), go: text("text/plain"), rs: text("text/plain"),
};
const ALIAS: Record<string, string> = { jpeg: "jpg", markdown: "md", htm: "html" };
// A name without an extension takes one from the content type the page sent.
const BY_MIME: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "application/pdf": "pdf", "text/plain": "txt", "text/markdown": "md", "application/json": "json", "text/csv": "csv" };

// A refusal with the status the route answers: 413 too big, 415 a type the HUD does not keep.
export class Refused extends Error { constructor(public status: number, message: string) { super(message); } }

const extOf = (name: string, mime: string) => {
  const e = name.match(/\.([A-Za-z0-9]{1,8})$/)?.[1]?.toLowerCase();
  if (e) return ALIAS[e] ?? e;
  return BY_MIME[mime.split(";")[0].trim().toLowerCase()] ?? "";
};
const utf8 = new TextDecoder("utf-8", { fatal: true });
function isText(b: Uint8Array) {
  if (b.includes(0)) return false;
  try { utf8.decode(b); return true; } catch { return false; }
}

// Checks and keeps one upload. `length` is the request's Content-Length, so a file over the cap is refused unread.
export async function keep(req: Request, url: URL) {
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_FILE) throw new Refused(413, `the file is over ${MAX_FILE / 1024 / 1024} MB`);
  const original = (url.searchParams.get("name") ?? "").trim() || "file";
  const ext = extOf(original, req.headers.get("content-type") ?? "");
  const type = TYPES[ext];
  if (!type) throw new Refused(415, `${ext ? `.${ext}` : "a file without a type"} is not kept here: images, PDF, zip and text files are`);
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (!bytes.byteLength) throw new Refused(400, "the file is empty");
  if (bytes.byteLength > MAX_FILE) throw new Refused(413, `the file is over ${MAX_FILE / 1024 / 1024} MB`);
  if (type.magic && !type.magic(bytes)) throw new Refused(415, `${original} is not a ${ext.toUpperCase()} file`);
  if (type.text && !isText(bytes)) throw new Refused(415, `${original} is not a text file`);
  const stem = original.replace(/\.[^.]*$/, "").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "file";
  const name = `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}-${stem}.${ext}`;
  await Bun.write(`${UPLOADS}/${name}`, bytes);
  const at = `/uploads/${name}`;
  // href: the same file on this server's address as the page reached it, for the lane (it has no page to resolve it).
  return { url: at, href: new URL(at, url).href, name: original, kind: type.kind, type: type.mime.split(";")[0], size: bytes.byteLength };
}

// GET /uploads/NAME. Sandboxed, like a room's files: an HTML or SVG upload shows but never runs.
export async function serve(raw: string) {
  const name = decodeURIComponent(raw);
  if (!/^[\w.-]+$/.test(name) || name.startsWith(".")) return null;
  const file = Bun.file(`${UPLOADS}/${name}`);
  if (!(await file.exists())) return null;
  const type = TYPES[name.split(".").pop()!.toLowerCase()];
  return new Response(file, {
    headers: {
      "content-type": type?.mime ?? "application/octet-stream",
      "content-security-policy": "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; media-src 'self'",
      "x-content-type-options": "nosniff",
      ...(type?.mime === "application/zip" || !type ? { "content-disposition": "attachment" } : {}),
    },
  });
}
