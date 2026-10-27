// A pack folder's files against its index.js: every object file is imported and listed. Used by check.ts and tests.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

type Problem = { code: string; severity: "error"; path: string; message: string; fix: string };

// files: an optional { name: text } map instead of reading `dir` (for tests).
export function packFileProblems(dir: string, files?: Record<string, string>): Problem[] {
  const names = files ? Object.keys(files) : readdirSync(dir).filter((f) => f.endsWith(".js"));
  const read = (f: string) => (files ? files[f] : readFileSync(join(dir, f), "utf8"));
  if (!names.includes("index.js")) return [{ code: "pack.index", severity: "error", path: dir, message: "the pack has no index.js", fix: `add index.js: export default definePack({ id: "<pack>", objects: [...] })` }];
  const index = read("index.js");
  const out: Problem[] = [];
  for (const f of names.filter((n) => n !== "index.js").sort()) {
    const imported = index.match(new RegExp(`^import\\s+(\\w+)\\s+from\\s+["']\\./${f.replace(".", "\\.")}["']`, "m"));
    const name = f.replace(/\.js$/, "").replace(/-(\w)/g, (_, c) => c.toUpperCase());
    if (!imported) out.push({ code: "pack.unlisted", severity: "error", path: `${dir}/${f}`, message: `${f} is not imported by index.js, so the pack does not have it`, fix: `add \`import ${name} from "./${f}";\` at the end of the imports and \`${name},\` at the end of objects` });
    else if (!new RegExp(`objects:\\s*\\[[^\\]]*\\b${imported[1]}\\b`, "s").test(index)) out.push({ code: "pack.unlisted", severity: "error", path: `${dir}/${f}`, message: `${f} is imported as ${imported[1]} but not listed in objects`, fix: `add \`${imported[1]},\` at the end of objects` });
  }
  return out;
}
