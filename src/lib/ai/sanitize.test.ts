import { describe, expect, it } from "vitest";
import { clip, clipCode, sanitizeUserPrompt } from "./sanitize";

describe("sanitize", () => {
  it("flattens newlines, escapes quotes and caps length", () => {
    expect(sanitizeUserPrompt('a\nb\t"c" \\d\u0000e')).toBe('a b \\"c\\" \\\\d e');
    expect(sanitizeUserPrompt("x".repeat(500)).length).toBe(300);
    expect(sanitizeUserPrompt(undefined)).toBe("");
  });
  it("clips with an ellipsis and bounds code by bytes", () => {
    expect(clip("hello world", 6)).toBe("hello…");
    expect(clipCode("é".repeat(10), 8)).toMatch(/^é{4}\n\/\/ …\[truncated\]$/);
  });
});
