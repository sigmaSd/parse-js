import { assertEquals } from "@std/assert";
import {
  arrayLength,
  custom,
  integer,
  length,
  max,
  min,
  oneOf,
  pattern,
  range,
  requiredValidator,
  validateValue,
} from "../src/validation.ts";

Deno.test("validateValue - basic sequence", () => {
  const validators = [
    min(10),
    max(20),
  ];

  assertEquals(validateValue(15, validators), null);
  assertEquals(validateValue(5, validators), "must be at least 10");
  assertEquals(validateValue(25, validators), "must be at most 20");
  assertEquals(validateValue(15, []), null);
});

Deno.test("requiredValidator", () => {
  const v = requiredValidator();
  assertEquals(v(undefined), "is required");
  assertEquals(v(null), "is required");
  assertEquals(v(""), "cannot be empty");
  assertEquals(v("  "), "cannot be empty");
  assertEquals(v([]), "cannot be empty");
  assertEquals(v("valid"), null);
  assertEquals(v(0), null);
  assertEquals(v(false), null);
  assertEquals(v(["item"]), null);
});

Deno.test("min validator", () => {
  const v = min(10);
  assertEquals(v(10), null);
  assertEquals(v(11), null);
  assertEquals(v(9), "must be at least 10");
  assertEquals(v("not a number"), null); // should only validate numbers
});

Deno.test("max validator", () => {
  const v = max(10);
  assertEquals(v(10), null);
  assertEquals(v(9), null);
  assertEquals(v(11), "must be at most 10");
  assertEquals(v("not a number"), null);
});

Deno.test("length validator", () => {
  const v1 = length(3);
  assertEquals(v1("abc"), null);
  assertEquals(v1("abcd"), null);
  assertEquals(v1("ab"), "must be at least 3 characters long");
  assertEquals(v1(123), null);

  const v2 = length(3, 5);
  assertEquals(v2("abc"), null);
  assertEquals(v2("abcde"), null);
  assertEquals(v2("abcdef"), "must be at most 5 characters long");
});

Deno.test("pattern validator", () => {
  const v1 = pattern(/^[a-z]+$/);
  assertEquals(v1("abc"), null);
  assertEquals(v1("abc1"), "must match pattern ^[a-z]+$");

  const v2 = pattern(/^[a-z]+$/, "only letters allowed");
  assertEquals(v2("abc1"), "only letters allowed");
  assertEquals(v1(123), null);
});

Deno.test("oneOf validator", () => {
  const v = oneOf(["a", "b", "c"]);
  assertEquals(v("a"), null);
  assertEquals(v("d"), "must be one of: a, b, c");
});

Deno.test("arrayLength validator", () => {
  const v1 = arrayLength(2);
  assertEquals(v1([1, 2]), null);
  assertEquals(v1([1, 2, 3]), null);
  assertEquals(v1([1]), "must have at least 2 items");
  assertEquals(v1("not an array"), null);

  const v2 = arrayLength(2, 3);
  assertEquals(v2([1, 2]), null);
  assertEquals(v2([1, 2, 3]), null);
  assertEquals(v2([1, 2, 3, 4]), "must have at most 3 items");
});

Deno.test("range validator", () => {
  const v = range(10, 20);
  assertEquals(v(10), null);
  assertEquals(v(20), null);
  assertEquals(v(15), null);
  assertEquals(v(9), "must be between 10 and 20");
  assertEquals(v(21), "must be between 10 and 20");
  assertEquals(v("not a number"), null);
});

Deno.test("integer validator", () => {
  const v = integer();
  assertEquals(v(10), null);
  assertEquals(v(10.5), "must be an integer");
  assertEquals(v("10"), null);
});

Deno.test("custom validator", () => {
  const v = custom((n: number) => n % 2 === 0, "must be even");
  assertEquals(v(2), null);
  assertEquals(v(3), "must be even");
});
