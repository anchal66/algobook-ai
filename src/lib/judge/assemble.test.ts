import { describe, expect, it } from "vitest";
import { assemble, assembleJava } from "./assemble";

describe("assembleJava", () => {
  it("dedupes imports and strips public from non-Main classes", () => {
    const user = `import java.util.*;\nimport java.util.HashMap;\npublic class Solution {\n  public int[] twoSum(int[] a, int t) { return a; }\n}`;
    const driver = `import java.util.*;\nimport java.io.*;\npublic class Main { public static void main(String[] a) {} }`;
    const out = assembleJava(user, driver);
    expect(out.match(/import java\.util\.\*;/g)?.length).toBe(1);
    expect(out).toContain("import java.io.*;");
    expect(out).toContain("class Solution {");
    expect(out).not.toContain("public class Solution");
    expect(out).toContain("public class Main");
    // method modifiers untouched
    expect(out).toContain("public int[] twoSum");
  });
  it("adds implicit Java imports once and the Python prelude", () => {
    const j = assembleJava("class Solution {}", "public class Main {}");
    expect(j.match(/import java\.util\.\*;/g)?.length).toBe(1);
    const py = assemble("python", "class Solution:\n    pass", "print(1)");
    expect(py).toMatch(/^from typing import List/);
    expect(py.indexOf("class Solution")).toBeGreaterThan(0);
  });
  it("adds the C++ prelude once", () => {
    expect(assemble("cpp", "class Solution {};", "int main(){}")).toMatch(/^#include <bits\/stdc\+\+\.h>/);
    expect(assemble("cpp", "#include <bits/stdc++.h>\nclass Solution {};", "int main(){}").match(/bits\/stdc\+\+/g)?.length).toBe(1);
  });
});
