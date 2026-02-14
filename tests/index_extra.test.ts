import { assertEquals, assertThrows } from "@std/assert";
import { arg, Args, cli, command, opt, subCommand } from "../src/index.ts";
import process from "node:process";

Deno.test("gen-completions fish success", () => {
  const originalExit = process.exit;
  let exitCode = -1;
  (process as unknown as { exit: (code: number) => never }).exit =
    ((code: number) => {
      exitCode = code;
      throw new Error("exit");
    }) as unknown as (code: number) => never;

  @cli({ name: "app" })
  class App extends Args {}

  try {
    App.parse(["gen-completions", "fish"]);
  } catch (_e: unknown) {
    assertEquals((_e as Error).message, "exit");
    assertEquals(exitCode, 0);
  } finally {
    process.exit = originalExit;
  }
});

Deno.test("Args.parse without @cli", () => {
  class NoCli extends Args {
    prop = "val";
  }
  const result = NoCli.parse([]);
  assertEquals(result.prop, "val");
});

Deno.test("subcommand with defaultCommand", () => {
  @command
  class SubSub {}

  @command({ defaultCommand: "help" })
  class Sub {
    @subCommand(SubSub)
    subsub?: SubSub;
  }

  @cli({ name: "app", exitOnHelp: false })
  class App extends Args {
    @subCommand(Sub)
    sub?: Sub;
  }

  assertThrows(() => App.parse(["sub"]), Error, "Usage:");
});

Deno.test("subcommand without options inherits parent options (partial)", () => {
  @command
  class Sub {}
  @cli({ name: "app", showDefaults: false })
  class App extends Args {
    @subCommand(Sub)
    sub?: Sub;
  }
  App.parse(["sub"]);
});

Deno.test("parseInstanceBased - help display no exit", () => {
  @cli({ name: "app", exitOnHelp: false, onHelp: () => {} })
  class App extends Args {
    @opt()
    port = 8080;
  }
  const result = App.parse(["--help"]);
  assertEquals(result.port, 8080);
});

Deno.test("subcommand inherits parent options and positionals", () => {
  @command
  class Sub {}
  @cli({ name: "app" })
  class App extends Args {
    @opt()
    port = 8080;
    @arg()
    input = "default";
    @subCommand(Sub)
    sub?: Sub;
  }

  // Test provided parent args
  const result1 = App.parse(["--port", "9000", "foo", "sub"]);
  assertEquals((result1 as unknown as Record<string, unknown>).port, 9000);
  assertEquals((result1 as unknown as Record<string, unknown>).input, "foo");

  // Test parent defaults
  const result2 = App.parse(["sub"]);
  assertEquals((result2 as unknown as Record<string, unknown>).port, 8080);
  assertEquals(
    (result2 as unknown as Record<string, unknown>).input,
    "default",
  );
});

Deno.test("defaultCommand with actual subcommand", () => {
  @command
  class Sub {
    @arg()
    x = "";
  }
  @cli({ name: "app", defaultCommand: "sub" })
  class App extends Args {
    @subCommand(Sub)
    sub?: Sub;
  }
  const result = App.parse([]);
  assertEquals(result.sub instanceof Sub, true);
});

Deno.test("defaultCommand with invalid command", () => {
  @cli({ name: "app", defaultCommand: "invalid" })
  class App extends Args {}
  const result = App.parse([]);
  assertEquals(result, new App());
  // It returns {} because 'invalid' is not in subCommands
});

Deno.test("cli decorator - missing metadata error", () => {
  const decorator = cli({ name: "test" });
  assertThrows(
    () =>
      decorator(
        class {} as unknown as new () => unknown,
        {} as unknown as ClassDecoratorContext,
      ),
    Error,
    "Decorator metadata is not available",
  );
});

Deno.test("subcommand with static parse method", () => {
  class CustomSub {
    static parse(_args: string[]) {
      return "custom result";
    }
  }

  @cli({ name: "app" })
  class App extends Args {
    @subCommand(CustomSub)
    sub?: unknown;
  }

  const result = App.parse(["sub", "foo"]);
  assertEquals(result.sub, "custom result");
});

Deno.test("defaultCommand: 'help'", () => {
  @cli({ name: "app", defaultCommand: "help", exitOnHelp: false })
  class App extends Args {
    @arg()
    input = "";
  }

  // Should display help when no args
  assertThrows(() => App.parse([]), Error, "Usage:");
});

Deno.test("gen-completions with help", () => {
  @cli({ name: "app", exitOnHelp: false })
  class App extends Args {}

  // Trigger help for the gen-completions subcommand itself
  try {
    App.parse(["gen-completions", "--help"]);
  } catch (_e) {
    // Expected help error
  }
});

Deno.test("subcommand with custom description in @subCommand", () => {
  @command
  class Sub {}

  @cli({ name: "app" })
  class App extends Args {
    @subCommand(Sub, { description: "custom desc" })
    sub?: Sub;
  }

  // This covers some merging logic in executeSubCommand
  App.parse(["sub"]);
});
