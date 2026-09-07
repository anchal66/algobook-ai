/** monaco-emacs ships no type definitions; this is the subset Module 03 uses. */
declare module "monaco-emacs" {
  import type * as Monaco from "monaco-editor";
  export class EmacsExtension {
    constructor(editor: Monaco.editor.IStandaloneCodeEditor);
    start(): void;
    dispose(): void;
    onDidMarkChange(cb: (marked: boolean) => void): Monaco.IDisposable;
    onDidChangeKey(cb: (key: string) => void): Monaco.IDisposable;
  }
}
