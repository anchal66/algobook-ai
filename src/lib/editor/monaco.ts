"use client";
/**
 * Bundled Monaco (Module 03 W-07/W-31). The ESM API plus the four tokenizers we ship (Java, Python,
 * C++, JavaScript) and a worker environment, handed to @monaco-editor/react's loader so no CDN is
 * involved and monaco-vim / monaco-emacs share the same instance.
 */
import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import "monaco-editor/esm/vs/basic-languages/java/java.contribution.js";
import "monaco-editor/esm/vs/basic-languages/python/python.contribution.js";
import "monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution.js";
import "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js";
import { loader } from "@monaco-editor/react";

declare global {
  interface Window { MonacoEnvironment?: { getWorker: (workerId: string, label: string) => Worker } }
}

if (typeof window !== "undefined") {
  window.MonacoEnvironment = {
    getWorker: () => new Worker(new URL("monaco-editor/esm/vs/editor/editor.worker.js", import.meta.url), { type: "module" }),
  };
  loader.config({ monaco });
}

export { monaco };
