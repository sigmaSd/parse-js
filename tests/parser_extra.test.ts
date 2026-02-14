import { assertEquals, assertThrows } from "@std/assert";
import { parseTokens } from "../src/parser.ts";
import { tokenize } from "../src/tokenizer.ts";
import type { OptDef, ParseOptions, PositionalDef } from "../src/types.ts";

Deno.test("parser - short help returns help", () => {
  assertEquals(parseTokens(tokenize(["-h"]), [], []).type, "help");
});

Deno.test("parser - long flag with value", () => {
  const optDefs: OptDef[] = [{ name: "foo", type: "string", validators: [] }];
  const result = parseTokens(tokenize(["--foo=bar"]), optDefs, []);
  if (result.type === "success") assertEquals(result.result.foo, "bar");
});

Deno.test("parser - missing value long flag", () => {
  const optDefs: OptDef[] = [{ name: "foo", type: "string", validators: [] }];
  const options = { exitOnError: false };
  assertThrows(
    () =>
      parseTokens(
        tokenize(["--foo"]),
        optDefs,
        [],
        undefined,
        options as unknown as ParseOptions,
      ),
    Error,
    "Missing value",
  );
});

Deno.test("parser - missing value short flag", () => {
  const optDefs: OptDef[] = [{
    name: "foo",
    type: "string",
    short: "f",
    validators: [],
  }];
  const options = { exitOnError: false };
  assertThrows(
    () =>
      parseTokens(
        tokenize(["-f"]),
        optDefs,
        [],
        undefined,
        options as unknown as ParseOptions,
      ),
    Error,
    "Missing value",
  );
});

Deno.test("parser - bundle error invalid char", () => {
  const optDefs: OptDef[] = [{
    name: "a",
    type: "boolean",
    short: "a",
    validators: [],
  }];
  const options = {
    exitOnError: false,
    onError: (msg: string) => {
      throw new Error(msg);
    },
  };
  assertThrows(
    () =>
      parseTokens(
        tokenize(["-ab"]),
        optDefs,
        [],
        undefined,
        options as unknown as ParseOptions,
      ),
    Error,
    "Unknown argument: -b",
  );
});

Deno.test("parser - bundle error non-boolean", () => {
  const optDefs: OptDef[] = [
    { name: "a", type: "boolean", short: "a", validators: [] },
    { name: "b", type: "string", short: "b", validators: [] },
  ];
  const options = {
    exitOnError: false,
    onError: (msg: string) => {
      throw new Error(msg);
    },
  };
  assertThrows(
    () =>
      parseTokens(
        tokenize(["-ab"]),
        optDefs,
        [],
        undefined,
        options as unknown as ParseOptions,
      ),
    Error,
    "must be boolean",
  );
});

Deno.test("parser - help in raw rest", () => {
  const optDefs: OptDef[] = [];
  const positionalDefs: PositionalDef[] = [
    { name: "raw", type: "string[]", raw: true, validators: [] },
  ];

  // Help as first arg -> returns help
  assertEquals(
    parseTokens(tokenize(["--help"]), optDefs, positionalDefs).type,
    "help",
  );

  // Help after some args -> captured as raw rest
  const result = parseTokens(
    tokenize(["foo", "--help"]),
    optDefs,
    positionalDefs,
  );
  assertEquals(result.type, "success");
  if (result.type === "success") {
    assertEquals(result.result.raw, ["foo", "--help"]);
  }
});

Deno.test("parser - short help in raw rest", () => {
  const optDefs: OptDef[] = [];
  const positionalDefs: PositionalDef[] = [
    { name: "raw", type: "string[]", raw: true, validators: [] },
  ];

  const result = parseTokens(tokenize(["foo", "-h"]), optDefs, positionalDefs);
  assertEquals(result.type, "success");
  if (result.type === "success") {
    assertEquals(result.result.raw, ["foo", "-h"]);
  }
});

Deno.test("coerceValue - boolean variations", () => {
  const optDefs: OptDef[] = [
    { name: "bool", type: "boolean", validators: [] },
  ];
  const positionalDefs: PositionalDef[] = [];

  const result1 = parseTokens(
    tokenize(["--bool=true"]),
    optDefs,
    positionalDefs,
  );
  if (result1.type === "success") assertEquals(result1.result.bool, true);

  const result2 = parseTokens(tokenize(["--bool=1"]), optDefs, positionalDefs);
  if (result2.type === "success") assertEquals(result2.result.bool, true);
});

Deno.test("coerceValue - number array invalid", () => {
  const optDefs: OptDef[] = [
    { name: "nums", type: "number[]", validators: [] },
  ];
  const positionalDefs: PositionalDef[] = [];

  const options = { exitOnError: false };
  assertThrows(
    () =>
      parseTokens(
        tokenize(["--nums", "1,abc"]),
        optDefs,
        positionalDefs,
        undefined,
        options as unknown as ParseOptions,
      ),
    Error,
  );
});

Deno.test("processPositional - unknown argument error", () => {
  const optDefs: OptDef[] = [];
  const positionalDefs: PositionalDef[] = [];

  assertThrows(
    () => parseTokens(tokenize(["foo"]), optDefs, positionalDefs),
    Error,
    "Unknown argument: foo",
  );
});
