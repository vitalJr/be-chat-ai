// conversation.store.ts is pure in-memory logic (a Map), no I/O and no
// external services — straightforward to test in isolation. The store is
// a module-level singleton, so each test below uses its own unique
// conversationId to avoid leaking state between tests.
import { describe, expect, it } from "vitest";
import {
  addMessage,
  clearHistory,
  getHistory,
  setHistory,
} from "./conversation.store.js";

describe("conversation.store", () => {
  it("starts a new conversation empty instead of returning undefined", () => {
    expect(getHistory("new-conversation")).toEqual([]);
  });

  it("appends messages in the order they were added", () => {
    addMessage("ordering", "user", "hi");
    addMessage("ordering", "assistant", "hello");

    expect(getHistory("ordering")).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
  });

  it("keeps each conversationId's history isolated from the others", () => {
    addMessage("alice", "user", "message from alice");
    addMessage("bruno", "user", "message from bruno");

    expect(getHistory("alice")).toEqual([{ role: "user", content: "message from alice" }]);
    expect(getHistory("bruno")).toEqual([{ role: "user", content: "message from bruno" }]);
  });

  it("clearHistory empties only the given conversation", () => {
    addMessage("to-clear", "user", "will be cleared");
    addMessage("untouched", "user", "should survive");

    clearHistory("to-clear");

    expect(getHistory("to-clear")).toEqual([]);
    expect(getHistory("untouched")).toEqual([{ role: "user", content: "should survive" }]);
  });

  it("setHistory replaces the entire history", () => {
    addMessage("to-replace", "user", "original message");

    setHistory("to-replace", [{ role: "system", content: "summary" }]);

    expect(getHistory("to-replace")).toEqual([{ role: "system", content: "summary" }]);
  });
});
