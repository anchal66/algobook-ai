// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CaseResultView } from "@/components/workspace/Console/CaseResultView";
import { VERDICT_LABEL } from "@/components/workspace/Console/verdict";
import type { CaseResult, ProblemParam } from "@/types";

vi.mock("@/components/workspace/Console/ExplainErrorButton", () => ({ ExplainErrorButton: ({ output }: { output: string }) => <button data-testid="explain">{output.slice(0, 10)}</button> }));

const params: ProblemParam[] = [{ name: "nums", type: "int[]" }, { name: "target", type: "int" }];
const base: CaseResult = { index: 0, status: "AC", passed: true, input: "4\n2 7 11 15\n9\n", expected: "[0,1]", actual: "[0,1]", stderr: "", compileOutput: null, timeMs: 3, memoryKb: 1024 };

afterEach(cleanup);

describe("CaseResultView verdict variants (Module 03 W-33)", () => {
  it("renders named inputs, output and expected for an accepted sample case", () => {
    render(<CaseResultView params={params} result={base} />);
    expect(screen.getByDisplayValue("[2,7,11,15]")).toBeTruthy();
    expect(screen.getByDisplayValue("9")).toBeTruthy();
    expect(screen.getByText("Output")).toBeTruthy();
    expect(screen.getByText("Expected")).toBeTruthy();
    expect(screen.queryByTestId("explain")).toBeNull();
  });

  it("shows output only for custom cases", () => {
    render(<CaseResultView params={params} result={{ ...base, expected: null }} custom />);
    expect(screen.getByText("Output")).toBeTruthy();
    expect(screen.queryByText("Expected")).toBeNull();
  });

  it("shows the compiler output and the explain button on CE, without inputs", () => {
    render(<CaseResultView params={params} result={{ ...base, status: "CE", passed: false, compileOutput: "Main.java:3: error: missing return statement" }} />);
    expect(screen.getByText("Compile output")).toBeTruthy();
    expect(screen.getByText(/missing return statement/)).toBeTruthy();
    expect(screen.getByTestId("explain")).toBeTruthy();
    expect(screen.queryByDisplayValue("[2,7,11,15]")).toBeNull();
  });

  it("shows stderr in red and the explain button on RE", () => {
    render(<CaseResultView params={params} result={{ ...base, status: "RE", passed: false, actual: "", stderr: "Exception in thread main java.lang.ArrayIndexOutOfBoundsException" }} />);
    expect(screen.getByText("Stderr")).toBeTruthy();
    expect(screen.getByText(/ArrayIndexOutOfBounds/)).toBeTruthy();
    expect(screen.getByTestId("explain")).toBeTruthy();
  });

  it("explains TLE and still lists the input", () => {
    render(<CaseResultView params={params} result={{ ...base, status: "TLE", passed: false, actual: "" }} />);
    expect(screen.getByText(/longer than the time limit/)).toBeTruthy();
    expect(screen.getByDisplayValue("[2,7,11,15]")).toBeTruthy();
  });

  it("labels hidden tests from a Submit", () => {
    render(<CaseResultView params={params} result={{ ...base, status: "WA", passed: false, actual: "[1,0]" }} hidden />);
    expect(screen.getByText(/hidden test/)).toBeTruthy();
    // The verdict headline belongs to the parent view, not to the case block.
    expect(screen.queryByText(VERDICT_LABEL.WA)).toBeNull();
  });
});
