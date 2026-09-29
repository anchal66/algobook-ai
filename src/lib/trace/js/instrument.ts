/**
 * JavaScript source instrumentation for the visualizer (Module 07 §3.3).
 *
 * The user's code is parsed with acorn and rewritten so that, at run time, a `__t` runtime object learns
 * about every executed statement, every function entry/exit and every return value:
 *
 *   function f(a) { let b = a + 1; return b; }
 *   ⇒
 *   function f(a) { __t.enter("f", 1, [["a", () => a]]); try {
 *       const __g1 = [["b", () => b]];
 *       __t.line(1, [__g0, __g1]); let b = a + 1;
 *       __t.line(1, [__g0, __g1]); return __t.ret(b);
 *     } catch (__e) { __t.throw(__e); throw __e; } finally { __t.exit(); } }
 *
 * Locals are captured lazily through getter closures so a `let` that is still in its temporal dead zone
 * simply throws inside the getter (the runtime skips it) instead of breaking the program, and closures in
 * `for (let …)` loops see the right per-iteration binding. The driver appended after the user code is not
 * instrumented, so the trace only contains the student's lines.
 */
import { Parser, type Node, type Options } from "acorn";
import { generate } from "astring";

type AnyNode = Node & Record<string, unknown>;
type Statement = AnyNode;
type Expression = AnyNode;

export interface InstrumentResult {
  code: string;
  /** Number of functions instrumented (0 means the code has no function — nothing will be traced). */
  functions: number;
}

export class InstrumentError extends Error {
  constructor(message: string, public readonly line: number | null) {
    super(message);
    this.name = "InstrumentError";
  }
}

const PARSE_OPTIONS: Options = { ecmaVersion: 2022, sourceType: "script", locations: true, allowReturnOutsideFunction: false };

let gSeq = 0;

// ── AST builders ─────────────────────────────────────────────────────────────

function id(name: string): Expression { return { type: "Identifier", name } as unknown as Expression; }
function lit(value: string | number | boolean | null): Expression { return { type: "Literal", value, raw: JSON.stringify(value) } as unknown as Expression; }
function member(obj: string, prop: string): Expression { return { type: "MemberExpression", object: id(obj), property: id(prop), computed: false, optional: false } as unknown as Expression; }
function call(callee: Expression, args: Expression[]): Expression { return { type: "CallExpression", callee, arguments: args, optional: false } as unknown as Expression; }
function exprStmt(expression: Expression): Statement { return { type: "ExpressionStatement", expression } as unknown as Statement; }
function arr(elements: Expression[]): Expression { return { type: "ArrayExpression", elements } as unknown as Expression; }
function block(body: Statement[]): Statement { return { type: "BlockStatement", body } as unknown as Statement; }
function getter(name: string): Expression {
  return arr([lit(name), { type: "ArrowFunctionExpression", params: [], body: id(name), expression: true, async: false, generator: false } as unknown as Expression]);
}
function thisGetter(): Expression {
  return arr([lit("this"), { type: "ArrowFunctionExpression", params: [], body: { type: "ThisExpression" }, expression: true, async: false, generator: false } as unknown as Expression]);
}
function constDecl(name: string, init: Expression): Statement {
  return { type: "VariableDeclaration", kind: "const", declarations: [{ type: "VariableDeclarator", id: id(name), init }] } as unknown as Statement;
}
function lineOf(n: Node): number { return n.loc?.start.line ?? 0; }

// ── Scope analysis ───────────────────────────────────────────────────────────

/** Names bound by a pattern (params, destructuring). */
function patternNames(p: AnyNode | null | undefined, out: string[]): void {
  if (!p) return;
  switch (p.type) {
    case "Identifier": out.push(p.name as string); break;
    case "ObjectPattern": for (const prop of p.properties as AnyNode[]) patternNames((prop.type === "RestElement" ? prop.argument : prop.value) as unknown as AnyNode, out); break;
    case "ArrayPattern": for (const el of p.elements as (AnyNode | null)[]) patternNames(el, out); break;
    case "RestElement": patternNames(p.argument as AnyNode, out); break;
    case "AssignmentPattern": patternNames(p.left as AnyNode, out); break;
    default: break;
  }
}

const FUNCTION_TYPES = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);

/** `var` declarations and function declarations hoisted to the enclosing function (not crossing nested functions). */
function hoistedNames(body: AnyNode, out: string[]): void {
  const visit = (n: AnyNode | null | undefined): void => {
    if (!n || typeof n.type !== "string") return;
    if (FUNCTION_TYPES.has(n.type)) return;
    if (n.type === "VariableDeclaration" && n.kind === "var") for (const d of n.declarations as AnyNode[]) patternNames(d.id as AnyNode, out);
    if (n.type === "FunctionDeclaration" && n.id) out.push((n.id as AnyNode).name as string);
    for (const key of Object.keys(n)) {
      if (key === "type" || key === "loc" || key === "start" || key === "end") continue;
      const v: unknown = n[key];
      if (Array.isArray(v)) { for (const c of v as unknown[]) if (c && typeof c === "object" && "type" in c) visit(c as AnyNode); }
      else if (v && typeof v === "object" && "type" in v) visit(v as AnyNode);
    }
  };
  visit(body);
}

/** `let` / `const` / `class` / function declarations directly in a statement list (block-scoped). */
function blockNames(stmts: Statement[], out: string[]): void {
  for (const s of stmts) {
    if (s.type === "VariableDeclaration" && s.kind !== "var") for (const d of s.declarations as AnyNode[]) patternNames(d.id as AnyNode, out);
    if (s.type === "ClassDeclaration" && s.id) out.push((s.id as AnyNode).name as string);
    if (s.type === "FunctionDeclaration" && s.id) out.push((s.id as AnyNode).name as string);
  }
}

function uniq(names: string[]): string[] { return [...new Set(names)]; }

// ── Transformer ──────────────────────────────────────────────────────────────

interface Ctx {
  /** Getter-array identifiers visible at this point (outermost first). */
  groups: string[];
  /** Inside an instrumented function (probes only make sense there). */
  inFunction: boolean;
}

let functionCount = 0;

function probe(line: number, groups: string[]): Statement {
  return exprStmt(call(member("__t", "line"), [lit(line), arr(groups.map(id))]));
}

function functionName(fn: AnyNode, parent: AnyNode | null, key: string | null): string {
  if (fn.id) return (fn.id as AnyNode).name as string;
  if (parent) {
    if (parent.type === "VariableDeclarator" && (parent.id as AnyNode).type === "Identifier") return (parent.id as AnyNode).name as string;
    if (parent.type === "AssignmentExpression" && (parent.left as AnyNode).type === "Identifier") return (parent.left as AnyNode).name as string;
    if ((parent.type === "MethodDefinition" || parent.type === "Property") && key === "value") {
      const k = parent.key as AnyNode;
      if (k.type === "Identifier") return parent.kind === "constructor" ? "constructor" : (k.name as string);
      if (k.type === "Literal") return String(k.value);
    }
  }
  return "anonymous";
}

/** Rewrites one function: entry/exit bookkeeping, a getter group for params + hoisted vars, and probes in its body. */
function transformFunction(fn: AnyNode, name: string, ctx: Ctx): void {
  functionCount++;
  const params: string[] = [];
  for (const p of fn.params as AnyNode[]) patternNames(p, params);
  let body = fn.body as AnyNode;
  // `x => x + 1` → `x => { return x + 1; }`
  if (body.type !== "BlockStatement") {
    body = block([{ type: "ReturnStatement", argument: body } as unknown as Statement]);
    fn.body = body;
    fn.expression = false;
  }
  const hoisted: string[] = [];
  hoistedNames(body, hoisted);
  const names = uniq([...params, ...hoisted]);
  const g = `__g${++gSeq}`;
  const getters = names.map(getter);
  if (fn.type !== "ArrowFunctionExpression") getters.push(thisGetter());
  void ctx;
  const inner: Ctx = { groups: [g], inFunction: true };
  const stmts = transformStatements(body.body as Statement[], inner, { skipBlockNames: false });
  const argGetters = arr(params.map(getter));
  const enter = exprStmt(call(member("__t", "enter"), [lit(name), lit(lineOf(fn)), argGetters]));
  const tryStmt: Statement = {
    type: "TryStatement",
    block: block([constDecl(g, arr(getters)), ...stmts]),
    handler: { type: "CatchClause", param: id("__e"), body: block([exprStmt(call(member("__t", "throw"), [id("__e")])), { type: "ThrowStatement", argument: id("__e") } as unknown as Statement]) },
    finalizer: block([exprStmt(call(member("__t", "exit"), []))]),
  } as unknown as Statement;
  body.body = [enter, tryStmt];
}

function transformExpression(node: AnyNode | null | undefined, parent: AnyNode | null, key: string | null, ctx: Ctx): void {
  if (!node || typeof node.type !== "string") return;
  if (FUNCTION_TYPES.has(node.type)) {
    // Parameters may contain default-value functions; transform them first.
    for (const p of node.params as AnyNode[]) transformExpression(p, node, "params", ctx);
    transformFunction(node, functionName(node, parent, key), ctx);
    return;
  }
  for (const k of Object.keys(node)) {
    if (k === "type" || k === "loc" || k === "start" || k === "end") continue;
    const v = node[k];
    if (Array.isArray(v)) { for (const c of v) if (c && typeof c === "object" && "type" in (c as object)) transformExpression(c as AnyNode, node, k, ctx); }
    else if (v && typeof v === "object" && "type" in (v as object)) {
      const child = v as AnyNode;
      if (child.type === "BlockStatement") child.body = transformStatements(child.body as Statement[], ctx, { skipBlockNames: false });
      else transformExpression(child, node, k, ctx);
    }
  }
}

/** Ensures a statement in a non-list position (if/loop body) is a block that starts with a probe. */
function ensureBlock(stmt: Statement, ctx: Ctx, extraLine?: number): Statement {
  const inner = stmt.type === "BlockStatement" ? (stmt.body as Statement[]) : [stmt];
  const out = transformStatements(inner, ctx, { skipBlockNames: false });
  if (extraLine !== undefined && ctx.inFunction) out.unshift(probe(extraLine, ctx.groups));
  return block(out);
}

function transformStatements(stmts: Statement[], ctx: Ctx, o: { skipBlockNames: boolean }): Statement[] {
  const out: Statement[] = [];
  let groups = ctx.groups;
  if (!o.skipBlockNames && ctx.inFunction) {
    const names: string[] = [];
    blockNames(stmts, names);
    if (names.length) {
      const g = `__g${++gSeq}`;
      out.push(constDecl(g, arr(uniq(names).map(getter))));
      groups = [...ctx.groups, g];
    }
  }
  const local: Ctx = { ...ctx, groups };
  for (const s of stmts) {
    if (local.inFunction && s.type !== "FunctionDeclaration" && s.type !== "ClassDeclaration" && s.type !== "EmptyStatement") out.push(probe(lineOf(s), groups));
    out.push(...transformStatement(s, local));
  }
  return out;
}

function transformStatement(s: Statement, ctx: Ctx): Statement[] {
  switch (s.type) {
    case "FunctionDeclaration":
      transformExpression(s, null, null, ctx);
      return [s];
    case "ClassDeclaration": case "ClassExpression":
      transformExpression(s, null, null, ctx);
      return [s];
    case "ReturnStatement":
      transformExpression(s.argument as AnyNode | null, s, "argument", ctx);
      if (ctx.inFunction) s.argument = call(member("__t", "ret"), [(s.argument as Expression | null) ?? id("undefined")]);
      return [s];
    case "BlockStatement":
      s.body = transformStatements(s.body as Statement[], ctx, { skipBlockNames: false });
      return [s];
    case "IfStatement":
      transformExpression(s.test as AnyNode, s, "test", ctx);
      s.consequent = ensureBlock(s.consequent as Statement, ctx);
      if (s.alternate) s.alternate = ensureBlock(s.alternate as Statement, ctx);
      return [s];
    case "WhileStatement": case "DoWhileStatement":
      transformExpression(s.test as AnyNode, s, "test", ctx);
      if (ctx.inFunction) s.test = { type: "SequenceExpression", expressions: [call(member("__t", "line"), [lit(lineOf(s)), arr(ctx.groups.map(id))]), s.test] } as unknown as Expression;
      s.body = ensureBlock(s.body as Statement, ctx);
      return [s];
    case "ForStatement": {
      const names: string[] = [];
      if (s.init && (s.init as AnyNode).type === "VariableDeclaration") for (const d of (s.init as AnyNode).declarations as AnyNode[]) patternNames(d.id as AnyNode, names);
      transformExpression(s.init as AnyNode | null, s, "init", ctx);
      transformExpression(s.test as AnyNode | null, s, "test", ctx);
      transformExpression(s.update as AnyNode | null, s, "update", ctx);
      const loopCtx = names.length ? withGroup(ctx, names) : { ctx, decl: null as Statement | null };
      if (ctx.inFunction) {
        // The header probe runs inside the per-iteration scope, so loop variables are captured with an inline
        // getter array (the body's getter group is declared inside the body block and is not visible here).
        const headerGroups: Expression[] = ctx.groups.map(id);
        if (names.length) headerGroups.push(arr(uniq(names).map(getter)));
        const probeCall = call(member("__t", "line"), [lit(lineOf(s)), arr(headerGroups)]);
        s.test = { type: "SequenceExpression", expressions: [probeCall, (s.test as Expression | null) ?? lit(true)] } as unknown as Expression;
      }
      const body = ensureBlock(s.body as Statement, loopCtx.ctx);
      if (loopCtx.decl) (body.body as Statement[]).unshift(loopCtx.decl);
      s.body = body;
      return [s];
    }
    case "ForInStatement": case "ForOfStatement": {
      const names: string[] = [];
      if ((s.left as AnyNode).type === "VariableDeclaration") for (const d of (s.left as AnyNode).declarations as AnyNode[]) patternNames(d.id as AnyNode, names);
      transformExpression(s.right as AnyNode, s, "right", ctx);
      const loopCtx = names.length ? withGroup(ctx, names) : { ctx, decl: null as Statement | null };
      const body = ensureBlock(s.body as Statement, loopCtx.ctx, lineOf(s));
      if (loopCtx.decl) (body.body as Statement[]).unshift(loopCtx.decl);
      s.body = body;
      return [s];
    }
    case "TryStatement":
      (s.block as AnyNode).body = transformStatements((s.block as AnyNode).body as Statement[], ctx, { skipBlockNames: false });
      if (s.handler) {
        const h = s.handler as AnyNode;
        const names: string[] = [];
        patternNames(h.param as AnyNode | null, names);
        const c = names.length ? withGroup(ctx, names) : { ctx, decl: null as Statement | null };
        (h.body as AnyNode).body = transformStatements((h.body as AnyNode).body as Statement[], c.ctx, { skipBlockNames: false });
        if (c.decl) ((h.body as AnyNode).body as Statement[]).unshift(c.decl);
      }
      if (s.finalizer) (s.finalizer as AnyNode).body = transformStatements((s.finalizer as AnyNode).body as Statement[], ctx, { skipBlockNames: false });
      return [s];
    case "SwitchStatement":
      transformExpression(s.discriminant as AnyNode, s, "discriminant", ctx);
      for (const c of s.cases as AnyNode[]) {
        transformExpression(c.test as AnyNode | null, c, "test", ctx);
        c.consequent = transformStatements(c.consequent as Statement[], ctx, { skipBlockNames: true });
      }
      return [s];
    case "LabeledStatement":
      s.body = transformStatement(s.body as Statement, ctx)[0];
      return [s];
    default:
      transformExpression(s, null, null, ctx);
      return [s];
  }
}

function withGroup(ctx: Ctx, names: string[]): { ctx: Ctx; decl: Statement } {
  const g = `__g${++gSeq}`;
  return { ctx: { ...ctx, groups: [...ctx.groups, g] }, decl: constDecl(g, arr(uniq(names).map(getter))) };
}

/** Instruments `source` (the user's code). Throws `InstrumentError` on a syntax error. */
export function instrument(source: string): InstrumentResult {
  let ast: AnyNode;
  try {
    ast = Parser.parse(source, PARSE_OPTIONS) as unknown as AnyNode;
  } catch (e) {
    const err = e as { message?: string; loc?: { line: number } };
    throw new InstrumentError(err.message ?? "Syntax error", err.loc?.line ?? null);
  }
  functionCount = 0;
  gSeq = 0;
  const ctx: Ctx = { groups: [], inFunction: false };
  ast.body = transformStatements(ast.body as Statement[], ctx, { skipBlockNames: true });
  return { code: generate(ast as unknown as Node), functions: functionCount };
}
