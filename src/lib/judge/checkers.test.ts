import { describe, expect, it } from "vitest";
import { compare, exact, float, normalize, unorderedLines } from "./checkers";

describe("checkers", () => {
  it("exact ignores trailing whitespace, CRLF and trailing newlines", () => {
    expect(exact("0 1\n", "0 1")).toBe(true);
    expect(exact("a\nb", "a  \r\nb\r\n\r\n")).toBe(true);
    expect(exact("a\nb", "a\n b")).toBe(false);
    expect(exact("1", "2")).toBe(false);
  });
  it("normalize keeps internal blank lines", () => {
    expect(normalize("a\n\nb\n\n")).toBe("a\n\nb");
  });
  it("unordered_lines sorts lines", () => {
    expect(unorderedLines("b\na\nc", "c\nb\na\n")).toBe(true);
    expect(unorderedLines("a\na", "a")).toBe(false);
  });
  it("float compares within eps", () => {
    expect(float("3.14159", "3.141592")).toBe(true);
    expect(float("1.0 2.0", "1.0000001 2")).toBe(true);
    expect(float("1.0", "1.1")).toBe(false);
    expect(float("1 2", "1")).toBe(false);
  });
  it("compare dispatches on checker type", () => {
    expect(compare({ type: "float", eps: 0.5 }, "1", "1.4")).toBe(true);
    expect(compare({ type: "exact" }, "x", "y")).toBe(false);
  });
});
