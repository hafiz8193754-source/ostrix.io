import { describe, expect, it } from "vitest";
import { splitLinked } from "./chatHistory";
describe("chat history removal", () => {
  it("hides consultation-linked chats and deletes the rest", () => {
    expect(splitLinked(["a", "b", "c"], new Set(["b"]))).toEqual({ toDelete: ["a", "c"], toHide: ["b"] });
    expect(splitLinked([], new Set(["b"]))).toEqual({ toDelete: [], toHide: [] });
  });
});
