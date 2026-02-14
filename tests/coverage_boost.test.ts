import { assertEquals, assertThrows } from "@std/assert";
import { arg, Args, cli, command, subCommand, validate } from "../src/index.ts";
import { parseTokens } from "../src/parser.ts";
import { tokenize } from "../src/tokenizer.ts";
import process from "node:process";
import type { OptDef } from "../src/types.ts";

Deno.test("Coverage: exitOnHelp false with positional defaults", () => {
  @cli({ name: "app", exitOnHelp: false, onHelp: () => {} })
  class App extends Args {
    @arg()
    input = "default_input";
  }
  const result = App.parse(["--help"]);
  assertEquals(result.input, "default_input");
});

Deno.test("Coverage: defaultCommand 'help' with positional defaults", () => {
  @cli({
    name: "app",
    defaultCommand: "help",
    exitOnHelp: false,
    onHelp: () => {},
  })
  class App extends Args {
    @arg()
    input = "default_input";
  }
  const result = App.parse([]);
  assertEquals(result.input, "default_input");
});

Deno.test("Coverage: defaultCommand subcommand with positional defaults", () => {
  @command
  class Sub {
    @arg()
    x = "sub_default";
  }
  @cli({ name: "app", defaultCommand: "sub" })
  class App extends Args {
    @subCommand(Sub)
    sub?: Sub;
  }
  const result = App.parse([]);
  assertEquals(result.sub?.x, "sub_default");
});

Deno.test("Coverage: gen-completions with shell validation", () => {
  const originalExit = process.exit;
  const originalLog = console.log;
  (process as unknown as { exit: (code: number) => never }).exit = (() => {
    throw new Error("exited");
  }) as unknown as (code: number) => never;
  console.log = () => {};

  @cli({ name: "app" })
  class App extends Args {}

  try {
    // This should trigger the 'success' path in executeSubCommand for gen-completions
    assertThrows(() => App.parse(["gen-completions", "fish"]), Error, "exited");
  } finally {
    process.exit = originalExit;
    console.log = originalLog;
  }
});

Deno.test("Coverage: parser.ts short flag bundle non-boolean error", () => {
  const optDefs: OptDef[] = [
    { name: "port", type: "number", short: "p" },
    { name: "verbose", type: "boolean", short: "v" },
  ];
  const tokens = tokenize(["-vp", "8080"]);
  // Should throw ParseError because exitOnError: false makes it throw instead of process.exit
  assertThrows(
    () =>
      parseTokens(tokens, optDefs, [], new Map(), {
        exitOnError: false,
      }),
    Error,
    "Combined short flag -p must be boolean",
  );
});

Deno.test("Coverage: help.ts isRequiredByValidator with custom validator", () => {
  // This needs to trigger printHelp and isRequiredByValidator for a POSITIONAL arg
  @cli({ name: "app", exitOnHelp: false })
  class App extends Args {
    @validate(() => "is required") // Custom validator that returns 'is required'
    @arg()
    input: string = "";
  }

  try {
    App.parse(["--help"]);
  } catch (_e) {
    // Expected help error
  }
});

Deno.test("Coverage: parser.ts multi-char short flag bundle success", () => {
  const optDefs: OptDef[] = [
    { name: "a", type: "boolean", short: "a" },
    { name: "b", type: "boolean", short: "b" },
  ];
  const tokens = tokenize(["-ab"]);
  const status = parseTokens(tokens, optDefs, [], new Map());
  assertEquals(status.type, "success");
  if (status.type === "success") {
    assertEquals(status.result.a, true);
    assertEquals(status.result.b, true);
  }
});

Deno.test("Coverage: index.ts mergedOptions with undefined parentOptions", () => {
  // This targets line 391: parentOptions ? ... : undefined
  // We need executeSubCommand to be called with parentOptions as undefined
  // This happens if parseInstanceBased is called with options as undefined

  @command
  class Sub {}

  // We can't use Args.parse because it always provides metadata-based options
  // But we can use the internal parseInstanceBased if we export it or find a way to trigger it
  // Actually, Args.parse calls parseInstanceBased(instance, args, cliOptions, "", "")
  // if cliOptions is undefined (no @cli), then parentOptions is undefined.

  class AppWithoutCli extends Args {
    @subCommand(Sub)
    sub?: Sub;
  }

  const result = AppWithoutCli.parse(["sub"]);
  assertEquals(result.sub instanceof Sub, true);
});
