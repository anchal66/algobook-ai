import { describe, expect, it } from "vitest";
import { formatCode, reindentBraces } from "@/lib/editor/format";

describe("brace re-indenter (Module 03 W-07 format fallback)", () => {
  it("re-indents Java by brace depth", () => {
    const messy = "class Solution {\npublic int f(int x) {\nif (x > 0) {\nreturn 1;\n}\nreturn 0;\n}\n}";
    expect(reindentBraces(messy, 4)).toBe("class Solution {\n    public int f(int x) {\n        if (x > 0) {\n            return 1;\n        }\n        return 0;\n    }\n}");
  });

  it("ignores braces inside strings, chars and comments", () => {
    const src = 'class A {\nString s = "{";\nchar c = \'}\';\n// }\n/* { */\nint x = 1;\n}';
    expect(reindentBraces(src, 2)).toBe('class A {\n  String s = "{";\n  char c = \'}\';\n  // }\n  /* { */\n  int x = 1;\n}');
  });

  it("outdents case labels and keeps blank lines", () => {
    const src = "switch (x) {\ncase 1:\nbreak;\n\ndefault:\nbreak;\n}";
    expect(reindentBraces(src, 4)).toBe("switch (x) {\n    case 1:\n        break;\n\n    default:\n        break;\n}");
  });

  it("leaves Python indentation alone and only trims trailing whitespace", () => {
    const src = "def f(x):   \n    if x:  \n        return 1\n    return 0";
    expect(formatCode("python", src, 4)).toBe("def f(x):\n    if x:\n        return 1\n    return 0");
  });

  it("is idempotent", () => {
    const src = "int main() {\n  for (int i = 0; i < 3; i++) {\n    if (i) {\n      x++;\n    }\n  }\n}";
    const once = formatCode("cpp", src, 2);
    expect(formatCode("cpp", once, 2)).toBe(once);
  });
});
