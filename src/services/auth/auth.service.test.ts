import { describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
} from "./auth.service.js";

describe("hashPassword / verifyPassword", () => {
  it("accepts the correct password", () => {
    const hash = hashPassword("correct-horse-battery-staple");
    expect(verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
  });

  it("rejects an incorrect password", () => {
    const hash = hashPassword("correct-horse-battery-staple");
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("produces a different hash each time (random salt)", () => {
    const first = hashPassword("same-password");
    const second = hashPassword("same-password");
    expect(first).not.toBe(second);
  });
});

describe("signToken / verifyToken", () => {
  it("round-trips a valid token", () => {
    const token = signToken({ sub: "1", username: "vital" });
    const payload = verifyToken(token);

    expect(payload.sub).toBe("1");
    expect(payload.username).toBe("vital");
  });

  it("throws for a tampered token", () => {
    const token = signToken({ sub: "1", username: "vital" });
    const tampered = `${token}tampered`;

    expect(() => verifyToken(tampered)).toThrow();
  });
});
