import { describe, expect, it } from "vitest";

import { evaluateFormula } from "@/runtime/data/formula";

describe("evaluateFormula - valid expressions", () => {
  it("evaluates basic arithmetic with precedence", () => {
    expect(evaluateFormula("2 + 3 * 4", {})).toBe(14);
    expect(evaluateFormula("(2 + 3) * 4", {})).toBe(20);
  });

  it("resolves identifiers from the context, including dotted paths", () => {
    expect(evaluateFormula("revenue / orders", { revenue: 400, orders: 2 })).toBe(200);
    expect(evaluateFormula("total_sales.current", { total_sales: { current: 100 } })).toBe(100);
  });

  it("supports unary minus and nested parentheses", () => {
    expect(evaluateFormula("-5 + 10", {})).toBe(5);
    expect(evaluateFormula("((1 + 2))", {})).toBe(3);
  });

  it("supports decimals", () => {
    expect(evaluateFormula("1.5 * 2", {})).toBe(3);
  });
});

describe("evaluateFormula - safe failure modes (resolve to null, never throw)", () => {
  it("division by zero", () => {
    expect(evaluateFormula("1 / 0", {})).toBeNull();
  });

  it("an unknown identifier", () => {
    expect(evaluateFormula("unknown_field", {})).toBeNull();
  });

  it("a non-numeric resolved value", () => {
    expect(evaluateFormula("label", { label: "hello" })).toBeNull();
  });

  it("empty expression", () => {
    expect(evaluateFormula("", {})).toBeNull();
  });
});

describe("evaluateFormula - adversarial inputs never execute anything, always resolve to null", () => {
  const adversarialInputs = [
    "process.exit()",
    "require('fs').readFileSync('/etc/passwd')",
    "__proto__.constructor.constructor('return process')()",
    "a; while(true){}",
    "a; b",
    "a b",
    "1e999999999",
    "`template`",
    '"double quoted"',
    "constructor",
    "__proto__",
  ];

  it.each(adversarialInputs)("rejects %s", (input) => {
    expect(() => evaluateFormula(input, { a: 1, b: 2, process: 1, require: 1 })).not.toThrow();
    expect(evaluateFormula(input, { a: 1, b: 2, process: 1, require: 1 })).toBeNull();
  });

  it("rejects a formula longer than the max length", () => {
    const longExpression = `${"1+".repeat(150)}1`;
    expect(evaluateFormula(longExpression, {})).toBeNull();
  });

  it("rejects deeply nested parentheses rather than overflowing the stack", () => {
    const nested = `${"(".repeat(500)}1${")".repeat(500)}`;
    expect(() => evaluateFormula(nested, {})).not.toThrow();
    expect(evaluateFormula(nested, {})).toBeNull();
  });

  it("rejects a long flat run of unary minus rather than overflowing the stack", () => {
    const manyMinuses = `${"-".repeat(500)}1`;
    expect(() => evaluateFormula(manyMinuses, {})).not.toThrow();
    expect(evaluateFormula(manyMinuses, {})).toBeNull();
  });

  it("never resolves a __proto__/constructor/prototype identifier even if it happens to be numeric-looking", () => {
    const poisoned = { __proto__: { polluted: 1 }, constructor: 1, prototype: 1 };
    expect(evaluateFormula("__proto__", poisoned)).toBeNull();
    expect(evaluateFormula("constructor", poisoned)).toBeNull();
  });
});
