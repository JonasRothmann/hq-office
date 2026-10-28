// Problems: what validation returns. Each names what is wrong, where (a JSON path and often a tile) and the fix.

/** @typedef {{ code: string, severity: "error"|"warning", path: string, message: string, fix: string }} Problem */

/** @returns {Problem} */
export function problem(code, path, message, fix, severity = "error") {
  return { code, severity, path, message, fix };
}

// Thrown by assertValid and createWorld: every problem, one per line, with its fix.
export class WorldError extends Error {
  /** @param {Problem[]} problems */
  constructor(problems, what = "world") {
    super(`${what} has ${problems.length} problem${problems.length === 1 ? "" : "s"}:\n${formatProblems(problems)}`);
    this.name = "WorldError";
    this.problems = problems;
  }
}

export function formatProblems(problems) {
  return problems.map((p) => `  ${p.severity === "error" ? "error" : "warn "} ${p.code} at ${p.path}: ${p.message}\n        fix: ${p.fix}`).join("\n");
}

export const errorsOf = (problems) => problems.filter((p) => p.severity === "error");

// The closest names to `name` (edit distance), for "did you mean".
export function closest(name, names, max = 3) {
  const d = (a, b) => {
    const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) m[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return m[a.length][b.length];
  };
  return names.map((n) => [n, d(name, n)]).filter(([, k]) => k <= Math.max(2, name.length / 3)).sort((a, b) => a[1] - b[1]).slice(0, max).map(([n]) => n);
}
