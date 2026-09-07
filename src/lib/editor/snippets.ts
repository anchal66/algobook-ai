/**
 * Keyword / type / snippet completion lists for Java (ported from v1) and Python
 * (Module 03 W-08). C++ and JavaScript rely on Monaco's built-in word suggestions.
 */
import type * as Monaco from "monaco-editor";

export interface SnippetDef { label: string; insertText: string; detail: string }

export const JAVA_KEYWORDS = [
  "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class", "const", "continue", "default", "do", "double",
  "else", "enum", "extends", "final", "finally", "float", "for", "goto", "if", "implements", "import", "instanceof", "int", "interface",
  "long", "native", "new", "package", "private", "protected", "public", "return", "short", "static", "strictfp", "super", "switch",
  "synchronized", "this", "throw", "throws", "transient", "try", "void", "volatile", "while", "true", "false", "null",
];

export const JAVA_TYPES = [
  "String", "Integer", "Long", "Double", "Float", "Boolean", "Character", "Object", "List", "ArrayList", "LinkedList", "Map", "HashMap",
  "TreeMap", "LinkedHashMap", "Set", "HashSet", "TreeSet", "Queue", "PriorityQueue", "Stack", "Deque", "ArrayDeque", "Arrays",
  "Collections", "Math", "StringBuilder", "StringBuffer", "System", "Scanner", "Optional", "Stream", "Comparator", "Iterator", "Iterable",
  "Random", "Pair", "int[]", "int[][]", "String[]", "char[]", "boolean[]", "long[]",
];

export const JAVA_SNIPPETS: SnippetDef[] = [
  { label: "for", insertText: "for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t$0\n}", detail: "For loop" },
  { label: "foreach", insertText: "for (${1:int} ${2:item} : ${3:collection}) {\n\t$0\n}", detail: "Enhanced for loop" },
  { label: "while", insertText: "while (${1:condition}) {\n\t$0\n}", detail: "While loop" },
  { label: "ifelse", insertText: "if (${1:condition}) {\n\t$0\n} else {\n\t\n}", detail: "If-else block" },
  { label: "trycatch", insertText: "try {\n\t$0\n} catch (${1:Exception} ${2:e}) {\n\t${3:e.printStackTrace();}\n}", detail: "Try-catch block" },
  { label: "sout", insertText: "System.out.println(${1});", detail: "Print to stdout" },
  { label: "soutf", insertText: "System.out.printf(\"${1:%s}\\n\", ${2});", detail: "Formatted print" },
  { label: "main", insertText: "public static void main(String[] args) {\n\t$0\n}", detail: "Main method" },
  { label: "bsearch", insertText: "int left = 0, right = ${1:arr}.length - 1;\nwhile (left <= right) {\n\tint mid = left + (right - left) / 2;\n\tif (${1:arr}[mid] == ${2:target}) return mid;\n\telse if (${1:arr}[mid] < ${2:target}) left = mid + 1;\n\telse right = mid - 1;\n}\nreturn -1;", detail: "Binary Search" },
  { label: "bfs", insertText: "Queue<${1:Integer}> queue = new LinkedList<>();\nqueue.offer(${2:start});\nSet<${1:Integer}> visited = new HashSet<>();\nvisited.add(${2:start});\nwhile (!queue.isEmpty()) {\n\t${1:Integer} curr = queue.poll();\n\t$0\n}", detail: "BFS Template" },
  { label: "dfs", insertText: "private void dfs(${1:int node}, ${2:boolean[] visited}) {\n\tvisited[${1:node}] = true;\n\t$0\n}", detail: "DFS Template" },
  { label: "swap", insertText: "int temp = ${1:arr}[${2:i}];\n${1:arr}[${2:i}] = ${1:arr}[${3:j}];\n${1:arr}[${3:j}] = temp;", detail: "Swap elements" },
  { label: "hashmap", insertText: "Map<${1:String}, ${2:Integer}> ${3:map} = new HashMap<>();", detail: "New HashMap" },
  { label: "arraylist", insertText: "List<${1:Integer}> ${2:list} = new ArrayList<>();", detail: "New ArrayList" },
  { label: "sort", insertText: "Arrays.sort(${1:arr});", detail: "Sort array" },
  { label: "sortcmp", insertText: "Arrays.sort(${1:arr}, (a, b) -> ${2:a - b});", detail: "Sort with comparator" },
  { label: "maxmin", insertText: "Math.max(${1:a}, ${2:b})", detail: "Math.max" },
  { label: "matrix", insertText: "int[][] ${1:matrix} = new int[${2:rows}][${3:cols}];", detail: "2D array" },
];

export const PYTHON_KEYWORDS = [
  "False", "None", "True", "and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del", "elif", "else", "except",
  "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return", "try",
  "while", "with", "yield",
];

export const PYTHON_TYPES = [
  "int", "float", "str", "bool", "list", "dict", "set", "tuple", "deque", "defaultdict", "Counter", "heapq", "bisect", "math",
  "itertools", "functools", "collections", "List", "Dict", "Set", "Tuple", "Optional", "range", "enumerate", "zip", "sorted", "reversed",
  "len", "sum", "min", "max", "abs", "map", "filter", "any", "all",
];

export const PYTHON_SNIPPETS: SnippetDef[] = [
  { label: "for", insertText: "for ${1:i} in range(${2:n}):\n\t$0", detail: "For loop" },
  { label: "foreach", insertText: "for ${1:item} in ${2:iterable}:\n\t$0", detail: "For-each loop" },
  { label: "enumerate", insertText: "for ${1:i}, ${2:x} in enumerate(${3:nums}):\n\t$0", detail: "Enumerate loop" },
  { label: "while", insertText: "while ${1:condition}:\n\t$0", detail: "While loop" },
  { label: "ifelse", insertText: "if ${1:condition}:\n\t$0\nelse:\n\tpass", detail: "If-else block" },
  { label: "def", insertText: "def ${1:name}(${2:args}):\n\t$0", detail: "Function" },
  { label: "bsearch", insertText: "left, right = 0, len(${1:arr}) - 1\nwhile left <= right:\n\tmid = (left + right) // 2\n\tif ${1:arr}[mid] == ${2:target}:\n\t\treturn mid\n\telif ${1:arr}[mid] < ${2:target}:\n\t\tleft = mid + 1\n\telse:\n\t\tright = mid - 1\nreturn -1", detail: "Binary Search" },
  { label: "bfs", insertText: "queue = deque([${1:start}])\nvisited = {${1:start}}\nwhile queue:\n\tcurr = queue.popleft()\n\t$0", detail: "BFS Template" },
  { label: "dfs", insertText: "def dfs(${1:node}, visited):\n\tvisited.add(${1:node})\n\t$0", detail: "DFS Template" },
  { label: "counter", insertText: "${1:counts} = Counter(${2:nums})", detail: "Counter" },
  { label: "defaultdict", insertText: "${1:graph} = defaultdict(${2:list})", detail: "defaultdict" },
  { label: "heap", insertText: "heapq.heappush(${1:heap}, ${2:item})", detail: "Heap push" },
  { label: "sortkey", insertText: "${1:arr}.sort(key=lambda ${2:x}: ${3:x})", detail: "Sort with key" },
  { label: "matrix", insertText: "${1:grid} = [[0] * ${2:cols} for _ in range(${3:rows})]", detail: "2D list" },
  { label: "print", insertText: "print(${1})", detail: "Print" },
];

/** Registers keyword/type/snippet providers for Java and Python. Returns a disposer. */
export function registerSnippetProviders(monaco: typeof Monaco): Monaco.IDisposable {
  const make = (keywords: string[], types: string[], snippets: SnippetDef[]): Monaco.languages.CompletionItemProvider => ({
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range: Monaco.IRange = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
      const suggestions: Monaco.languages.CompletionItem[] = [
        ...keywords.map((k) => ({ label: k, kind: monaco.languages.CompletionItemKind.Keyword, insertText: k, range, sortText: "1" + k })),
        ...types.map((t) => ({ label: t, kind: monaco.languages.CompletionItemKind.Class, insertText: t, detail: "Type", range, sortText: "0" + t })),
        ...snippets.map((s) => ({
          label: s.label, kind: monaco.languages.CompletionItemKind.Snippet, insertText: s.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: s.detail, range, sortText: "00" + s.label,
        })),
      ];
      return { suggestions };
    },
  });
  const a = monaco.languages.registerCompletionItemProvider("java", make(JAVA_KEYWORDS, JAVA_TYPES, JAVA_SNIPPETS));
  const b = monaco.languages.registerCompletionItemProvider("python", make(PYTHON_KEYWORDS, PYTHON_TYPES, PYTHON_SNIPPETS));
  return { dispose: () => { a.dispose(); b.dispose(); } };
}
