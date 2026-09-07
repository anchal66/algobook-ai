import { describe, expect, it } from "vitest";
import { resolveInitialCode } from "@/lib/workspace/drafts";

describe("draft reconciliation (Module 03 W-07)", () => {
  const starter = "class Solution {}";
  it("uses the starter when there is no draft", () => {
    expect(resolveInitialCode({ local: null, server: null, starter })).toBe(starter);
  });
  it("prefers the newer of local and server", () => {
    const server = { code: "server", updatedAt: new Date(2_000_000).toISOString() };
    expect(resolveInitialCode({ local: { code: "local", updatedAt: 3_000_000 }, server, starter })).toBe("local");
    expect(resolveInitialCode({ local: { code: "local", updatedAt: 1_000_000 }, server, starter })).toBe("server");
  });
  it("falls back to whichever copy exists", () => {
    expect(resolveInitialCode({ local: { code: "local", updatedAt: 1 }, server: null, starter })).toBe("local");
    expect(resolveInitialCode({ local: null, server: { code: "server", updatedAt: new Date(1).toISOString() }, starter })).toBe("server");
  });
});
