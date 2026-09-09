import { describe, expect, it, vi } from "vitest";
import { SectionDraft, mergeSectionDraft } from "./sectionDraft";

describe("section drafts", () => {
  it("keeps keystrokes local and commits the final value once", () => {
    const initial = { name: "Sword", quantity: 1 };
    const draft = new SectionDraft(initial);
    const save = vi.fn();
    for (const name of ["S", "Sw", "Sword +1"])
      draft.edit({ ...initial, name });
    expect(save).not.toHaveBeenCalled();
    expect(draft.value.name).toBe("Sword +1");
    draft.flush(initial, save);
    draft.flush(initial, save);
    expect(save).toHaveBeenCalledExactlyOnceWith({
      ...initial,
      name: "Sword +1",
    });
  });
  it("preserves unrelated remote changes through a cache remount", () => {
    const initial = { coins: { gp: 10, sp: 2 }, profile: { name: "Hero" } };
    const draft = new SectionDraft(initial);
    draft.edit({ ...initial, coins: { ...initial.coins, gp: 120 } });
    const incoming = { coins: { gp: 10, sp: 8 }, profile: { name: "Renamed" } };
    expect(draft.rebase(incoming)).toEqual({
      coins: { gp: 120, sp: 8 },
      profile: { name: "Renamed" },
    });
    const save = vi.fn();
    draft.flush(incoming, save);
    expect(save).toHaveBeenCalledWith(draft.value);
  });
  it("treats ordered build levels as atomic choices without touching other fields", () => {
    const base = { levels: ["Fighter"], languages: ["Common"] };
    const edited = { ...base, levels: ["Wizard", "Rogue"] };
    expect(
      mergeSectionDraft(base, edited, {
        ...base,
        languages: ["Common", "Elven"],
      }),
    ).toEqual({ levels: ["Wizard", "Rogue"], languages: ["Common", "Elven"] });
  });
  it("preserves explicit field removals and zero values", () => {
    const base: { override?: number; gp: number; extra?: boolean } = {
      override: 12,
      gp: 5,
    };
    expect(
      mergeSectionDraft(base, { gp: 0 }, { ...base, extra: true }),
    ).toEqual({ gp: 0, extra: true });
  });
  it("retains pending edits when saving is temporarily locked", () => {
    const draft = new SectionDraft({ trait: "Old" });
    draft.edit({ trait: "New" });
    draft.flush({ trait: "Old" }, () => false);
    expect(draft.dirty).toBe(true);
    expect(draft.requested).toBe(true);
    draft.rebase({ trait: "Old" });
    const save = vi.fn();
    draft.flush({ trait: "Old" }, save);
    expect(save).toHaveBeenCalledExactlyOnceWith({ trait: "New" });
    expect(draft.requested).toBe(false);
  });
  it("does not save reverted or untouched edits", () => {
    const draft = new SectionDraft({ name: "Original" });
    draft.edit({ name: "Temporary" });
    draft.edit({ name: "Original" });
    const save = vi.fn();
    draft.flush({ name: "Original" }, save);
    expect(save).not.toHaveBeenCalled();
  });
  it("does not discard a draft if saving throws", () => {
    const draft = new SectionDraft({ name: "Original" });
    draft.edit({ name: "Retain" });
    expect(() =>
      draft.flush({ name: "Original" }, () => {
        throw new Error("storage");
      }),
    ).toThrow("storage");
    expect(draft.dirty).toBe(true);
  });
});
