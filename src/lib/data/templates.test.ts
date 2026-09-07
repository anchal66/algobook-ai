import { describe, expect, it } from "vitest";
import { parseTemplateMarkdown } from "./templates";

describe("parseTemplateMarkdown", () => {
  it("parses numbers, titles and difficulty aliases", () => {
    const items = parseTemplateMarkdown("1. Two Sum - Easy\n1922. Count Good Numbers - Med.\n\n23. Merge k Sorted Lists - Hard\nnot a line\n");
    expect(items).toEqual([
      { number: 1, title: "Two Sum", difficulty: "Easy", order: 0 },
      { number: 1922, title: "Count Good Numbers", difficulty: "Medium", order: 1 },
      { number: 23, title: "Merge k Sorted Lists", difficulty: "Hard", order: 2 },
    ]);
  });
});
