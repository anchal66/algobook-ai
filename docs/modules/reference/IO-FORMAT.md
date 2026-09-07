# Problem I/O contract (shared by Modules 01–03)

Every problem declares `params[] {name,type}`, `functionName` and `returnType`.
Test inputs are stored **once** in the canonical stdin format below and shared by
all language drivers. Drivers (private, per language) parse stdin, call the
user's function and print the result in the canonical output format. The judge
compares stdout with `expectedOutput` using the problem's `checker`.

Implementation: `src/lib/judge/stdin.ts` (`encodeInput`, `parseInput`, `formatValue`).

## Types
`int | long | double | bool | string | char`, arrays `T[]`, matrices `T[][]`,
`ListNode`, `TreeNode` (and `void` for return only).

## stdin encoding (one parameter after another, in `params` order)
| Type | Encoding | Example value → stdin |
|---|---|---|
| scalar | one token per line | `9` → `9⏎` |
| `string` | raw line (may contain spaces) | `"a b"` → `a b⏎` |
| `T[]` | `N⏎` then N space-separated tokens on one line (empty line when N = 0) | `[2,7,11,15]` → `4⏎2 7 11 15⏎` |
| `string[]` | `N⏎` then one string per line | `["ab","c"]` → `2⏎ab⏎c⏎` |
| `T[][]` | `R C⏎` then R lines of C tokens (`string[][]`: R·C lines) | `[[1,2],[3,4]]` → `2 2⏎1 2⏎3 4⏎` |
| `ListNode` / `TreeNode` | LeetCode array literal on one line | `[1,2,null,3]⏎` |

Two Sum: `params = [{nums:int[]},{target:int}]`, values `[2,7,11,15], 9` → `4⏎2 7 11 15⏎9⏎`.

## stdout encoding (what drivers print, what `expectedOutput` stores)
| Return type | Printed as |
|---|---|
| `int`/`long` | decimal |
| `double` | 5 decimals (`0.50000`); use `checker.type = "float"` |
| `bool` | `true` / `false` |
| `string` | the raw string on one line |
| `char` | the character |
| `T[]` | `[a,b,c]` with no spaces; strings quoted `["a","b"]` |
| `T[][]` | `[[1,2],[3,4]]` |
| `ListNode` | `[1,2,3]` |
| `TreeNode` | level-order with `null`s, trailing nulls trimmed: `[1,null,2]` |
| `void` | print the (mutated) first argument using the rules above |

Problems whose answer is order-independent (e.g. "return in any order") must use
`checker.type = "unordered_lines"` and print one element per line instead of a
list literal.
