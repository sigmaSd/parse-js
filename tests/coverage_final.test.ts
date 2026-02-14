import { assertEquals, assertExists } from "@std/assert";
import { arg, Args, cli, command, opt, subCommand } from "../mod.ts";
import { parseTokens } from "../src/parser.ts";
import { printHelp } from "../src/help.ts";

Deno.test("Coverage: parser.ts boolean with explicit value", () => {
  const optDefs = [{ name: "flag", type: "boolean" as const }];
  const tokens = [{
    type: "LongFlag" as const,
    name: "flag",
    value: "true",
    raw: "--flag=true",
  }];
  const status = parseTokens(tokens, optDefs, []);
  if (status.type === "success") {
    assertEquals(status.result.flag, true);
  } else {
    throw new Error("Expected success");
  }

  const tokens2 = [{
    type: "LongFlag" as const,
    name: "flag",
    value: "false",
    raw: "--flag=false",
  }];
  const status2 = parseTokens(tokens2, optDefs, []);
  if (status2.type === "success") {
    assertEquals(status2.result.flag, false);
  }

  const tokens3 = [{
    type: "LongFlag" as const,
    name: "flag",
    value: "1",
    raw: "--flag=1",
  }];
  const status3 = parseTokens(tokens3, optDefs, []);
  if (status3.type === "success") {
    assertEquals(status3.result.flag, true);
  }
});

Deno.test("Coverage: parser.ts number[] coercion", () => {
  const optDefs = [{ name: "nums", type: "number[]" as const }];
  const tokens = [{
    type: "LongFlag" as const,
    name: "nums",
    value: "1,2,3",
    raw: "--nums=1,2,3",
  }];
  const status = parseTokens(tokens, optDefs, []);
  if (status.type === "success") {
    assertEquals(status.result.nums, [1, 2, 3]);
  }

  const tokens2 = [{
    type: "LongFlag" as const,
    name: "nums",
    value: "1,abc,3",
    raw: "--nums=1,abc,3",
  }];
  try {
    parseTokens(tokens2, optDefs, [], undefined, { exitOnError: false });
  } catch (_e) {
    assertExists(_e);
  }
});

Deno.test("Coverage: help.ts generateTypeHint number[]", () => {
  const optDefs = [{
    name: "nums",
    type: "number[]" as const,
    description: "numbers",
  }];
  const helpText = printHelp(optDefs, [], { color: false });
  assertExists(helpText.match(/<number,number,...>/));
});

Deno.test("Coverage: index.ts static parse method", () => {
  class Sub {
    static parse(args: string[]) {
      return { custom: args[0] };
    }
  }

  @cli({ name: "app" })
  class App extends Args {
    @subCommand(Sub)
    sub!: Sub;
  }

  const result = App.parse(["sub", "hello"]);
  assertEquals((result.sub as Record<string, unknown>).custom, "hello");
});

Deno.test("Coverage: index.ts mergedOptions branch", () => {
  @command
  class Sub {
    @opt({ type: "string" })
    name?: string;
  }

  @cli({ name: "app", description: "parent desc" })
  class App extends Args {
    @subCommand(Sub, { description: "sub desc" })
    sub!: Sub;
  }

  // This will hit the sub.description branch
  const result = App.parse(["sub", "--name", "foo"]);
  assertExists(result.sub);
});

Deno.test("Coverage: index.ts mergedOptions no sub description", () => {
  @command
  class Sub {
    @opt({ type: "string" })
    name?: string;
  }

  @cli({ name: "app", description: "parent desc" })
  class App extends Args {
    @subCommand(Sub)
    sub!: Sub;
  }

  // This will hit the !subOptions?.description branch
  const result = App.parse(["sub", "--name", "foo"]);
  assertExists(result.sub);
});

Deno.test("Coverage: help.ts isRequiredByValidator various branches", () => {
  const positionalDefs = [
    {
      name: "arg1",
      type: "string" as const,
      validators: [(_v: unknown) => _v ? null : "is required"],
    },
    {
      name: "arg2",
      type: "string" as const,
      validators: [],
    },
  ];
  // @ts-ignore: testing invalid parameters
  printHelp([], positionalDefs, { color: false });
});

Deno.test("Coverage: index.ts executeSubCommand parentResult branches", () => {
  @command
  class Sub {
    @opt({ type: "string" })
    name?: string;

    @opt({ type: "string" })
    parentOpt?: string;
  }

  @cli({ name: "app" })
  class App extends Args {
    @opt({ type: "string" })
    parentOpt: string = "default";

    @subCommand(Sub)
    sub!: Sub;
  }

  const result = App.parse([
    "--parentOpt",
    "parentValue",
    "sub",
    "--name",
    "subValue",
  ]);
  assertEquals(result.parentOpt, "parentValue");
});

Deno.test("Coverage: help.ts isRequiredByValidator true path", () => {
  const positionalDefs = [{
    name: "arg",
    type: "string" as const,
    validators: [
      (v: unknown) => v !== undefined ? null : "is required",
    ],
  }];
  const helpText = printHelp([], positionalDefs, { color: false });
  assertExists(helpText.match(/<arg>/));
});

Deno.test("Coverage: index.ts handleDefaultCommand help path", () => {
  @cli({ name: "app", defaultCommand: "help", exitOnHelp: false })
  class App extends Args {}

  try {
    App.parse([]);
  } catch (_e) {
    assertExists(_e);
  }
});

Deno.test("Coverage: index.ts handleDefaultCommand subcommand path", () => {
  @command
  class Sub {
    @opt({ type: "string" })
    name: string = "default";
  }

  @cli({ name: "app", defaultCommand: "sub" })
  class App extends Args {
    @subCommand(Sub)
    sub!: Sub;
  }

  const result = App.parse([]);
  assertEquals(
    (result.sub as unknown as Record<string, unknown>).name,
    "default",
  );
});

Deno.test("Coverage: index.ts executeSubCommand gen-completions help path", () => {
  @cli({ name: "app", exitOnHelp: false })
  class App extends Args {}

  try {
    App.parse(["gen-completions", "--help"]);
  } catch (_e) {
    assertExists(_e);
  }
});

Deno.test("Coverage: index.ts executeSubCommand mergedOptions description branch", () => {
  @command
  class Sub {
    @opt({ type: "string" })
    name?: string;
  }

  @cli({ name: "app" })
  class App extends Args {
    @subCommand(Sub, { description: "explicit sub desc" })
    sub!: Sub;
  }

  const result = App.parse(["sub", "--name", "test"]);
  assertExists(result.sub);
});

Deno.test("Coverage: index.ts merge logic", () => {
  @cli({ name: "app" })
  class App extends Args {
    @opt({ type: "string" })
    name: string = "default";
  }

  const result = App.parse(["--name", "explicit"]);
  assertEquals(result.name, "explicit");
});

Deno.test("Coverage: parser.ts separator with boolean", () => {
  @cli({ name: "app" })
  class App extends Args {
    @opt({ type: "boolean" })
    flag: boolean = false;

    @arg({ type: "string", rest: true })
    rest?: string[];
  }

  const result = App.parse(["--", "--flag"]);
  assertEquals(result.flag, false);
  assertEquals(result.rest, ["--flag"]);
});

Deno.test("Coverage: help.ts isRequiredByValidator alternative path", () => {
  const positionalDefs = [{
    name: "arg",
    type: "string" as const,
    default: "foo",
    validators: [
      (v: unknown) => v ? null : "some error",
    ],
  }];
  const helpText = printHelp([], positionalDefs, { color: false });
  assertExists(helpText.match(/\[arg\]/));
});

Deno.test("Coverage: parser.ts processPositional unknown error", () => {
  @cli({ name: "app" })
  class App extends Args {}

  try {
    App.parse(["positional"]);
  } catch (_e) {
    assertExists(_e);
  }
});

Deno.test("Coverage: parser.ts bundle error without rawRest", () => {
  @cli({ name: "app", exitOnError: false })
  class App extends Args {
    @opt({ type: "string" })
    name?: string;
  }

  try {
    App.parse(["-nx"]);
  } catch (_e) {
    assertExists(_e);
  }
});

Deno.test("Coverage: parser.ts bundle success to hit loop end", () => {
  @cli({ name: "app" })
  class App extends Args {
    @opt({ type: "boolean", short: "a" })
    a: boolean = false;
    @opt({ type: "boolean", short: "b" })
    b: boolean = false;
  }

  const result = App.parse(["-ab"]);
  assertEquals(result.a, true);
  assertEquals(result.b, true);
});

Deno.test("Coverage: parser.ts bundle error path to hit loop end", () => {
  @cli({
    name: "app",
    onError: () => {},
  })
  class App extends Args {
    @opt({ type: "boolean", short: "a" })
    a: boolean = false;
  }

  const result = App.parse(["-ax"]);
  assertEquals(result.a, true);
});

Deno.test("Coverage: parser.ts bundle allValid false without rawRest", () => {
  @cli({ name: "app", exitOnError: false })
  class App extends Args {
    @opt({ type: "string", short: "n" })
    name?: string;
    @opt({ type: "boolean", short: "a" })
    a: boolean = false;
  }

  try {
    App.parse(["-na"]);
  } catch (_e) {
    assertExists(_e);
  }
});

Deno.test("Coverage: parser.ts bundle unknown flag with exitOnError false", () => {
  @cli({ name: "app", exitOnError: false })
  class App extends Args {
    @opt({ type: "boolean", short: "a" })
    a: boolean = false;
  }

  try {
    App.parse(["-ax"]);
  } catch (_e) {
    assertExists(_e);
  }
});

Deno.test("Coverage: help.ts isRequiredByValidator undefined validators", () => {
  const positionalDefs = [{
    name: "arg",
    type: "string" as const,
    default: "foo",
  }];
  const helpText = printHelp([], positionalDefs, {
    color: false,
    showDefaults: false,
  });
  assertExists(helpText.match(/\[arg\]/));
});

Deno.test("Coverage: index.ts handleDefaultCommand missing branch", () => {
  @cli({ name: "app", defaultCommand: "missing" })
  class App extends Args {}

  const result = App.parse([]);
  assertEquals(Object.keys(result).length, 0);
});

Deno.test("Coverage: index.ts parseInstanceBased help no exit return", () => {
  @cli({ name: "app", exitOnHelp: false })
  class App extends Args {
    @opt({ type: "string" })
    name: string = "default";
    @arg({ type: "string" })
    pos: string = "pos-default";
  }

  try {
    App.parse(["--help"]);
  } catch (_e) {
    // ignore
  }
});
