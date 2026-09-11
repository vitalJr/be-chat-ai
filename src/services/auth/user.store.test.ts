import { describe, expect, it } from "vitest";
import { createUser, findUserByUsername } from "./user.store.js";

describe("user.store", () => {
  it("creates a user and finds it by username", () => {
    createUser("alice", "hashed-password");

    const user = findUserByUsername("alice");

    expect(user?.username).toBe("alice");
    expect(user?.passwordHash).toBe("hashed-password");
  });

  it("returns undefined for an unknown username", () => {
    expect(findUserByUsername("does-not-exist")).toBeUndefined();
  });

  it("rejects a duplicate username", () => {
    createUser("bruno", "hashed-password");

    expect(() => createUser("bruno", "another-hash")).toThrow();
  });
});
