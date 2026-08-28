import { getPath } from "./resolve-data-source";

/**
 * A restricted arithmetic expression evaluator for `transform`'s `formula`
 * step - never `eval`/`new Function`/any dynamic-code path. Hand-written
 * tokenizer + recursive-descent parser over a deliberately tiny grammar:
 *
 *   expression := term (('+' | '-') term)*
 *   term       := factor (('*' | '/') factor)*
 *   factor     := number | identifier | '(' expression ')' | '-' factor
 *   identifier := [a-zA-Z_][a-zA-Z0-9_.]*
 *   number     := [0-9]+('.'[0-9]+)?   -- no exponent syntax, deliberately
 *
 * Parentheses are ONLY the grouping production - there is no call syntax,
 * so `process.exit()`/`require('fs')`-shaped input can never execute
 * anything (an identifier directly followed by `(` matches no production
 * and is rejected as trailing input). A dotted identifier resolves against
 * the supplied context via `getPath` - the same dot-path getter component
 * bindings already use, hardened against `__proto__`/`constructor`/
 * `prototype` traversal.
 *
 * Every failure mode - an unrecognised character, a malformed number, a
 * trailing/unconsumed token, an unknown identifier, division by zero, a
 * non-finite result, or a recursion-depth overrun - resolves to `null`,
 * never throws past this module. A bad formula degrades one computed
 * value; it never crashes the page.
 */

const MAX_EXPRESSION_LENGTH = 200;
const MAX_DEPTH = 50;

type Token =
  | { kind: "number"; value: number }
  | { kind: "identifier"; value: string }
  | { kind: "+" | "-" | "*" | "/" | "(" | ")" }
  | { kind: "eof" };

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function isIdentifierStart(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
}

function isIdentifierPart(ch: string): boolean {
  return isIdentifierStart(ch) || isDigit(ch) || ch === ".";
}

/** Throws on the first unrecognised character - there is no string-literal
 * token in this grammar at all, so a quote/backtick/semicolon/brace always
 * fails here rather than being silently absorbed. */
function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expression.length) {
    const ch = expression[i];

    if (ch === " " || ch === "\t") {
      i++;
      continue;
    }

    if (isDigit(ch)) {
      const start = i;
      while (i < expression.length && isDigit(expression[i])) i++;
      if (expression[i] === ".") {
        i++;
        const fractionStart = i;
        while (i < expression.length && isDigit(expression[i])) i++;
        if (i === fractionStart) throw new Error("malformed number");
      }
      tokens.push({ kind: "number", value: Number(expression.slice(start, i)) });
      continue;
    }

    if (isIdentifierStart(ch)) {
      const start = i;
      i++;
      while (i < expression.length && isIdentifierPart(expression[i])) i++;
      tokens.push({ kind: "identifier", value: expression.slice(start, i) });
      continue;
    }

    if (ch === "+" || ch === "-" || ch === "*" || ch === "/" || ch === "(" || ch === ")") {
      tokens.push({ kind: ch });
      i++;
      continue;
    }

    throw new Error(`unexpected character "${ch}"`);
  }

  tokens.push({ kind: "eof" });
  return tokens;
}

class RestrictedParser {
  private position = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly context: Record<string, unknown>,
  ) {}

  private peek(): Token {
    return this.tokens[this.position];
  }

  private advance(): Token {
    return this.tokens[this.position++];
  }

  private expect(kind: Token["kind"]): void {
    if (this.peek().kind !== kind) throw new Error(`expected "${kind}"`);
    this.advance();
  }

  parse(): number {
    const result = this.parseExpression(0);
    if (this.peek().kind !== "eof") throw new Error("unexpected trailing input");
    return result;
  }

  private parseExpression(depth: number): number {
    let value = this.parseTerm(depth);
    for (;;) {
      const token = this.peek();
      if (token.kind === "+") {
        this.advance();
        value += this.parseTerm(depth);
      } else if (token.kind === "-") {
        this.advance();
        value -= this.parseTerm(depth);
      } else {
        return value;
      }
    }
  }

  private parseTerm(depth: number): number {
    let value = this.parseFactor(depth);
    for (;;) {
      const token = this.peek();
      if (token.kind === "*") {
        this.advance();
        value *= this.parseFactor(depth);
      } else if (token.kind === "/") {
        this.advance();
        const divisor = this.parseFactor(depth);
        value = divisor === 0 ? Number.NaN : value / divisor;
      } else {
        return value;
      }
    }
  }

  private parseFactor(depth: number): number {
    if (depth > MAX_DEPTH) throw new Error("expression nested too deeply");
    const token = this.advance();

    if (token.kind === "number") return token.value;

    if (token.kind === "identifier") return resolveIdentifier(token.value, this.context);

    if (token.kind === "(") {
      const value = this.parseExpression(depth + 1);
      this.expect(")");
      return value;
    }

    if (token.kind === "-") {
      return -this.parseFactor(depth + 1);
    }

    throw new Error("unexpected token");
  }
}

const FORBIDDEN_PATH_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

function resolveIdentifier(path: string, context: Record<string, unknown>): number {
  if (path.split(".").some((segment) => FORBIDDEN_PATH_SEGMENTS.has(segment))) {
    throw new Error(`unresolvable identifier "${path}"`);
  }
  const value = getPath(context, path);
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(numeric)) throw new Error(`unresolvable identifier "${path}"`);
  return numeric;
}

/** Evaluates a formula against a flat/nested context object, returning
 * `null` on any failure (never throws) - see this module's doc comment for
 * the full list of things that safely degrade to `null`. */
export function evaluateFormula(expression: string, context: Record<string, unknown>): number | null {
  if (expression.length === 0 || expression.length > MAX_EXPRESSION_LENGTH) return null;
  try {
    const tokens = tokenize(expression);
    const result = new RestrictedParser(tokens, context).parse();
    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}
