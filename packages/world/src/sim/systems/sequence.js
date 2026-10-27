// The sequence system: a character with a queue and no step in progress starts the queue's next step, by adding it
// as a component of its kind (walk, turn, enter, ...). Step systems remove their component when the step is done.
export default {
  name: "sequence",
  run(ecs) {
    const kinds = ecs.stepKinds();
    for (const [id, queue] of ecs.query("queue")) {
      if (kinds.some((k) => ecs.has(id, k))) continue;
      const next = queue.steps.shift();
      if (!next) { ecs.remove(id, "queue"); continue; }
      if (!kinds.includes(next.kind)) throw new Error(`no system runs step '${next.kind}'; register one with step: "${next.kind}"`);
      ecs.add(id, next.kind, { ...next, t: 0 });
    }
  },
};
