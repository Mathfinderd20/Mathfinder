import { describe, expect, it } from "vitest";
import { initialActors, initiativeOrder } from "./mockData";

describe("GM initiative preview", () => {
  it("gives dual initiative two separate turns", () => {
    const turns = initiativeOrder(initialActors, false).filter(
      (turn) => turn.actorId === "warden",
    );
    expect(turns.map((turn) => turn.score)).toEqual([22, 2]);
    expect(new Set(turns.map((turn) => turn.id)).size).toBe(2);
  });
  it("keeps tied actors in cast order", () => {
    expect(
      initiativeOrder(initialActors, false)
        .filter((turn) => turn.score === 16)
        .map((turn) => turn.actorId),
    ).toEqual(["goblin-1", "goblin-2"]);
  });
  it("excludes reserves, defeated actors, and unaware surprise participants", () => {
    const actors = initialActors.map((actor) =>
      actor.id === "seren" ? { ...actor, hp: 0 } : actor,
    );
    const ids = initiativeOrder(actors, true).map((turn) => turn.actorId);
    expect(ids).not.toContain("seren");
    expect(ids).not.toContain("voss");
    expect(ids).not.toContain("goblin-2");
  });
});
