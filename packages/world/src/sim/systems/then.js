// The then step: a visit's pause is over, so plan its `then` act from where the visitor stands now (the world may have
// changed since the visit began) and queue it in place of this one.
export default {
  name: "then",
  step: "then",
  run(ecs, dt, { replan }) {
    for (const [id, t] of ecs.query("then")) {
      ecs.remove(id, "then");
      replan(id, t.act);
    }
  },
};
