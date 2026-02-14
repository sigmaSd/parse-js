import { assertEquals, assertThrows } from "@std/assert";
import { arg, Args, cli, command, opt, subCommand } from "../src/index.ts";
import {
  collectArgumentDefs,
  collectInstanceArgumentDefs,
  extractTypeFromDescriptor,
  getTypeFromValue,
} from "../src/metadata.ts";

Deno.test("collectArgumentDefs", () => {
  @cli({ name: "test" })
  class StaticConfig extends Args {
    @opt()
    static port = 8080;
  }

  // Symbol.metadata is not populated for static properties in the same way
  // without explicit metadata support or different decorator usage.
  // Actually, @opt is a property decorator, and when used on static it might work.

  const result = collectArgumentDefs(
    StaticConfig as unknown as new () => unknown,
  );
  // It might be empty if decorators don't support static props easily here
  // but we want to cover the lines.
  assertEquals(result.optDefs.length, 1);
});

Deno.test("collectArgumentDefs - no metadata", () => {
  class NoMetadata {}
  const result = collectArgumentDefs(
    NoMetadata as unknown as new () => unknown,
  );
  assertEquals(result.optDefs.length, 0);
  assertEquals(result.positionalDefs.length, 0);
});

Deno.test("collectArgumentDefs - mocked metadata", () => {
  const mockKlass = function () {};
  (mockKlass as unknown as { [Symbol.metadata]: Record<string, unknown> })[
    Symbol.metadata
  ] = {
    optProp: {
      opt: { short: "o" },
      description: "opt desc",
      type: "number",
    },
    argProp: {
      arg: { rest: true },
      description: "arg desc",
      type: "string[]",
    },
    subProp: {
      subCommand: function () {},
    },
  };

  const result = collectArgumentDefs(mockKlass as unknown as new () => unknown);
  assertEquals(result.optDefs.length, 1);
  assertEquals(result.positionalDefs.length, 1);
  assertEquals(result.optDefs[0].name, "optProp");
  assertEquals(result.positionalDefs[0].name, "argProp");
});

Deno.test("collectArgumentDefs - duplicate short flag", () => {
  const mockKlass = function () {};
  (mockKlass as unknown as { [Symbol.metadata]: Record<string, unknown> })[
    Symbol.metadata
  ] = {
    prop1: { opt: { short: "v" } },
    prop2: { opt: { short: "v" } },
  };

  assertThrows(
    () => collectArgumentDefs(mockKlass as unknown as new () => unknown),
    Error,
    "Duplicate short flag '-v'",
  );
});

Deno.test("getTypeFromValue", () => {
  assertEquals(getTypeFromValue("string"), "string");
  assertEquals(getTypeFromValue(123), "number");
  assertEquals(getTypeFromValue(true), "boolean");
  assertEquals(getTypeFromValue(["a", "b"]), "string[]");
  assertEquals(getTypeFromValue([1, 2]), "number[]");
  assertEquals(getTypeFromValue([]), "string[]");
  assertEquals(getTypeFromValue({}), "string");
  assertEquals(getTypeFromValue(null), "string");
});

Deno.test("validatePositionalArguments - error cases", () => {
  @cli({ name: "test" })
  class RestNotLast extends Args {
    @arg({ rest: true })
    restArgs: string[] = [];

    @arg()
    afterRest: string = "";
  }

  assertThrows(
    () =>
      collectInstanceArgumentDefs(
        new RestNotLast() as unknown as Record<string, unknown>,
      ),
    Error,
    "Only the last argument can be marked as rest",
  );

  @cli({ name: "test" })
  class RestAndRaw extends Args {
    @arg({ rest: true })
    restArgs: string[] = [];

    @arg({ raw: true })
    rawArgs: string[] = [];
  }

  assertThrows(
    () =>
      collectInstanceArgumentDefs(
        new RestAndRaw() as unknown as Record<string, unknown>,
      ),
    Error,
    "Cannot use both rest: true and raw: true",
  );
});

Deno.test("collectInstanceArgumentDefs - undecorated property", () => {
  @cli({ name: "test" })
  class UndecoratedConfig extends Args {
    @arg()
    input: string = "";

    notArg: string = "ignored";
  }
  const result = collectInstanceArgumentDefs(
    new UndecoratedConfig() as unknown as Record<string, unknown>,
  );
  assertEquals(result.positionalDefs.length, 1);
});

Deno.test("collectInstanceArgumentDefs - subcommand", () => {
  @command
  class Sub {}

  @cli({ name: "test" })
  class SubConfig extends Args {
    @subCommand(Sub)
    sub?: Sub;
  }
  const result = collectInstanceArgumentDefs(
    new SubConfig() as unknown as Record<string, unknown>,
  );
  assertEquals(result.subCommands.size, 1);
  assertEquals(result.subCommands.get("sub")?.name, "sub");
});

Deno.test("collectInstanceArgumentDefs - strict: false", () => {
  @cli({ name: "test" })
  class NoTypeNoDefault extends Args {
    @arg()
    input: unknown = undefined;

    @opt()
    flag: unknown = undefined;
  }

  const result = collectInstanceArgumentDefs(
    new NoTypeNoDefault() as unknown as Record<string, unknown>,
    {
      strict: false,
    },
  );
  assertEquals(result.positionalDefs.length, 0);
  assertEquals(result.optDefs.length, 0);
});

Deno.test("extractTypeFromDescriptor", () => {
  const metadata = {};

  assertEquals(
    extractTypeFromDescriptor({ value: "s" }, metadata, "p", "C"),
    "string",
  );
  assertEquals(
    extractTypeFromDescriptor({ value: 1 }, metadata, "p", "C"),
    "number",
  );
  assertEquals(
    extractTypeFromDescriptor({ value: true }, metadata, "p", "C"),
    "boolean",
  );
  assertEquals(
    extractTypeFromDescriptor({ value: ["a"] }, metadata, "p", "C"),
    "string[]",
  );
  assertEquals(
    extractTypeFromDescriptor({ value: [1] }, metadata, "p", "C"),
    "number[]",
  );
  assertEquals(
    extractTypeFromDescriptor({ value: [] }, metadata, "p", "C"),
    "string[]",
  );

  assertEquals(
    extractTypeFromDescriptor({ value: [{}] }, metadata, "p", "C"),
    "string[]",
  );

  // Test with explicit type in metadata
  assertEquals(
    extractTypeFromDescriptor({}, { type: "number" }, "p", "C"),
    "number",
  );

  assertThrows(
    () => extractTypeFromDescriptor({}, {}, "p", "C"),
    Error,
    "has no type specified",
  );
});

Deno.test("validatePositionalArguments - arg then rest", () => {
  @cli({ name: "test" })
  class ArgThenRest extends Args {
    @arg()
    normalArg: string = "";

    @arg({ rest: true })
    restArgs: string[] = [];
  }
  collectInstanceArgumentDefs(
    new ArgThenRest() as unknown as Record<string, unknown>,
  );
});

Deno.test("validatePositionalArguments - multiple args with raw", () => {
  @cli({ name: "test" })
  class MultiRawConfig extends Args {
    @arg({ raw: true })
    rawArgs: string[] = [];

    @arg()
    normalArg: string = "";
  }
  collectInstanceArgumentDefs(
    new MultiRawConfig() as unknown as Record<string, unknown>,
  );
});

Deno.test("collectInstanceArgumentDefs - strict throw", () => {
  @cli({ name: "test" })
  class NoTypeNoDefaultArg extends Args {
    @arg()
    input: unknown = undefined;
  }
  assertThrows(
    () =>
      collectInstanceArgumentDefs(
        new NoTypeNoDefaultArg() as unknown as Record<string, unknown>,
      ),
    Error,
    "has no default value and no type specified in @arg()",
  );

  @cli({ name: "test" })
  class NoTypeNoDefaultOpt extends Args {
    @opt()
    flag: unknown = undefined;
  }
  assertThrows(
    () =>
      collectInstanceArgumentDefs(
        new NoTypeNoDefaultOpt() as unknown as Record<string, unknown>,
      ),
    Error,
    "has no default value and no type specified in @opt()",
  );
});

Deno.test("collectInstanceArgumentDefs - raw arg", () => {
  @cli({ name: "test" })
  class RawConfig extends Args {
    @arg({ raw: true })
    rawArgs: string[] = [];
  }
  const result = collectInstanceArgumentDefs(
    new RawConfig() as unknown as Record<string, unknown>,
  );
  assertEquals(result.positionalDefs[0].raw, true);
});

Deno.test("collectInstanceArgumentDefs - no metadata", () => {
  class NoMetadata {}
  const result = collectInstanceArgumentDefs(
    new NoMetadata() as unknown as Record<string, unknown>,
  );
  assertEquals(result.optDefs.length, 0);
  assertEquals(result.positionalDefs.length, 0);
  assertEquals(result.subCommands.size, 0);
});

Deno.test("collectInstanceArgumentDefs - opt without short", () => {
  @cli({ name: "test" })
  class NoShortConfig extends Args {
    @opt()
    flag: string = "";
  }
  const result = collectInstanceArgumentDefs(
    new NoShortConfig() as unknown as Record<string, unknown>,
  );
  assertEquals(result.optDefs[0].short, undefined);
});

Deno.test("collectArgumentDefs - null metadata entry", () => {
  const mockKlass = function () {};
  (mockKlass as unknown as { [Symbol.metadata]: Record<string, unknown> })[
    Symbol.metadata
  ] = {
    prop1: null as unknown as Record<string, unknown>,
  };
  const result = collectArgumentDefs(mockKlass as unknown as new () => unknown);
  assertEquals(result.optDefs.length, 0);
});

Deno.test("validatePositionalArguments - no raw", () => {
  const result = collectInstanceArgumentDefs(
    new class extends Args {
      @arg()
      input = "";
    }() as unknown as Record<string, unknown>,
  );
  assertEquals(result.positionalDefs.length, 1);
});
Deno.test("collectInstanceArgumentDefs - duplicate short flag", () => {
  @cli({ name: "test" })
  class DuplicateShort extends Args {
    @opt({ short: "v" })
    verbose: boolean = false;

    @opt({ short: "v" })
    version: boolean = false;
  }

  assertThrows(
    () =>
      collectInstanceArgumentDefs(
        new DuplicateShort() as unknown as Record<string, unknown>,
      ),
    Error,
    "Duplicate short flag '-v'",
  );
});
