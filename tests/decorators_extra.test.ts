import { assertEquals, assertThrows } from "@std/assert";
import {
  addValidator,
  arg,
  command,
  type DecoratorContext,
  opt,
  subCommand,
  validate,
} from "../src/decorators.ts";
import { Args, cli } from "../src/index.ts";

Deno.test("command - without parens", () => {
  @command
  class _Test {}
});

Deno.test("validate - function version", () => {
  const v = (_val: unknown) => "error";
  const decorator = validate(v);
  const metadata: Record<string, { validators: unknown[] }> = {};
  const context = { name: "prop", metadata };
  decorator(null, context as unknown as DecoratorContext);
  assertEquals(metadata.prop.validators[0], v);
});

Deno.test("command - with options and metadata", () => {
  const options = { defaultCommand: "help" } as const;
  const decorator = command(options);
  const metadata = {};
  const ctx = { metadata };
  decorator(
    class {} as unknown as new () => unknown,
    ctx as unknown as ClassDecoratorContext,
  );
  assertEquals((metadata as Record<string, unknown>).__cliOptions, options);
});

Deno.test("command - with options but no metadata", () => {
  const options = { defaultCommand: "help" } as const;
  const decorator = command(options);
  const ctx = {};
  decorator(
    class {} as unknown as new () => unknown,
    ctx as unknown as ClassDecoratorContext,
  );
  // Should not throw, just do nothing
});

Deno.test("opt - with desc and type", () => {
  @cli({ name: "test" })
  class _Test extends Args {
    @opt({ description: "desc", type: "number" })
    prop = 1;
  }
});

Deno.test("decorators - missing metadata error", () => {
  const context = { name: "test" };
  assertThrows(
    () =>
      addValidator(() => null)(null, context as unknown as DecoratorContext),
    Error,
    "Decorator metadata is not available",
  );
  assertThrows(
    () => subCommand(class {})(null, context as unknown as DecoratorContext),
    Error,
    "Decorator metadata is not available",
  );
  assertThrows(
    () => opt()(null, context as unknown as DecoratorContext),
    Error,
    "Decorator metadata is not available",
  );
  assertThrows(
    () => arg()(null, context as unknown as DecoratorContext),
    Error,
    "Decorator metadata is not available",
  );
});

Deno.test("opt - short: true", () => {
  @cli({ name: "test" })
  class ShortTrueConfig extends Args {
    @opt({ short: true })
    verbose = false;
  }

  // Check if it was registered correctly
  const _instance = new ShortTrueConfig();
  // We can check metadata directly or via collectInstanceArgumentDefs
});

Deno.test("opt - invalid short flag", () => {
  const context = { name: "v", metadata: {} };
  assertThrows(
    () => opt({ short: "vv" })(null, context as unknown as DecoratorContext),
    Error,
    "Short flag must be a single alphanumeric character",
  );
  assertThrows(
    () => opt({ short: "-" })(null, context as unknown as DecoratorContext),
    Error,
    "Short flag must be a single alphanumeric character",
  );
});

Deno.test("validate - predicate version", () => {
  const decorator = validate((v: number) => v > 0, "must be positive");
  const metadata: Record<
    string,
    { validators: ((v: unknown) => string | null)[] }
  > = {};
  const context = { name: "prop", metadata };
  decorator(null, context as unknown as DecoratorContext);

  const validator = metadata.prop.validators[0];
  assertEquals(validator(5), null);
  assertEquals(validator(-1), "must be positive");
});

Deno.test("decorators - required validator logic", () => {
  @cli({ name: "test" })
  class RequiredConfig extends Args {
    @opt({ required: true })
    flag!: string;

    @arg({ required: true })
    pos!: string;
  }

  // We can test the validators directly from metadata
  const metadata = (RequiredConfig as unknown as {
    [Symbol.metadata]: Record<
      string,
      { validators: ((v: unknown) => string | null)[] }
    >;
  })[Symbol.metadata];
  const flagValidator = metadata.flag.validators[0];
  const posValidator = metadata.pos.validators[0];

  assertEquals(flagValidator(""), "is required");
  assertEquals(flagValidator(null), "is required");
  assertEquals(flagValidator(undefined), "is required");
  assertEquals(flagValidator("ok"), null);

  assertEquals(posValidator(""), "is required");
  assertEquals(posValidator(null), "is required");
  assertEquals(posValidator(undefined), "is required");
  assertEquals(posValidator("ok"), null);
});
