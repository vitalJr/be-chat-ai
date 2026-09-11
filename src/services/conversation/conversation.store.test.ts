import { describe, expect, it } from "vitest";
import {
  addMessage,
  clearHistory,
  getHistory,
  setHistory,
} from "./conversation.store.js";

const USER = "user-1";

describe("conversation.store", () => {
  it("starts a new conversation empty instead of returning undefined", () => {
    expect(getHistory(USER, "new-conversation")).toEqual([]);
  });

  it("appends messages in the order they were added", () => {
    addMessage(USER, "ordering", "user", "hi");
    addMessage(USER, "ordering", "assistant", "hello");

    expect(getHistory(USER, "ordering")).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
  });

  it("keeps each conversationId's history isolated from the others", () => {
    addMessage(USER, "alice", "user", "message from alice");
    addMessage(USER, "bruno", "user", "message from bruno");

    expect(getHistory(USER, "alice")).toEqual([{ role: "user", content: "message from alice" }]);
    expect(getHistory(USER, "bruno")).toEqual([{ role: "user", content: "message from bruno" }]);
  });

  it("clearHistory empties only the given conversation", () => {
    addMessage(USER, "to-clear", "user", "will be cleared");
    addMessage(USER, "untouched", "user", "should survive");

    clearHistory(USER, "to-clear");

    expect(getHistory(USER, "to-clear")).toEqual([]);
    expect(getHistory(USER, "untouched")).toEqual([{ role: "user", content: "should survive" }]);
  });

  it("setHistory replaces the entire history", () => {
    addMessage(USER, "to-replace", "user", "original message");

    setHistory(USER, "to-replace", [{ role: "system", content: "summary" }]);

    expect(getHistory(USER, "to-replace")).toEqual([{ role: "system", content: "summary" }]);
  });

  it("keeps the same conversationId isolated between different users", () => {
    addMessage("user-a", "shared-id", "user", "message from user-a");
    addMessage("user-b", "shared-id", "user", "message from user-b");

    expect(getHistory("user-a", "shared-id")).toEqual([
      { role: "user", content: "message from user-a" },
    ]);
    expect(getHistory("user-b", "shared-id")).toEqual([
      { role: "user", content: "message from user-b" },
    ]);
  });
});
