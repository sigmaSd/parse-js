import { assertStringIncludes } from "@std/assert";
import { Args, cli, command, opt, subCommand } from "../mod.ts";
import { generateFishCompletions } from "../src/completions.ts";
import { collectInstanceArgumentDefs } from "../src/metadata.ts";

Deno.test("completions - generateFishCompletions directly", () => {
  @command
  class BuildCommand {
    @opt({ description: "Minify output", short: "m" })
    minify = false;
  }

  @command
  class NoDescCommand {
    @opt()
    force = false;
  }

  @cli({ name: "myapp" })
  class MyApp extends Args {
    @opt({ description: "Verbose mode", short: "v" })
    verbose = false;

    @opt({ description: "No short flag" })
    noShort = "";

    @subCommand(BuildCommand, { description: "Build the project" })
    build?: BuildCommand;

    @subCommand(NoDescCommand)
    nodesc?: NoDescCommand;
  }

  const instance = new MyApp();
  const { optDefs, positionalDefs, subCommands } = collectInstanceArgumentDefs(
    instance as unknown as Record<string, unknown>,
  );

  const output = generateFishCompletions(
    "myapp",
    optDefs,
    positionalDefs,
    subCommands,
  );

  assertStringIncludes(output, "complete -c myapp -f");
  assertStringIncludes(
    output,
    'complete -c myapp -n "__fish_use_subcommand" -a "build" -d "Build the project"',
  );
  assertStringIncludes(
    output,
    'complete -c myapp -n "__fish_seen_subcommand_from build" -l minify -s m',
  );
  assertStringIncludes(
    output,
    'complete -c myapp -n "__fish_use_subcommand" -a "nodesc"',
  );
  assertStringIncludes(
    output,
    'complete -c myapp -n "__fish_use_subcommand" -l verbose -s v',
  );
  assertStringIncludes(
    output,
    'complete -c myapp -n "__fish_use_subcommand" -l noShort',
  );
});

Deno.test("completions - GenCompletionsCommand validation", () => {
  @cli({ name: "testapp", exitOnError: false })
  class TestApp extends Args {}

  // Test missing shell arg
  try {
    TestApp.parse(["gen-completions"]);
    throw new Error("Should have thrown validation error");
  } catch (error) {
    assertStringIncludes(
      (error as Error).message,
      "Validation error for argument 'shell': is required",
    );
  }

  // Test invalid shell arg
  try {
    TestApp.parse(["gen-completions", "bash"]);
    throw new Error("Should have thrown validation error");
  } catch (error) {
    assertStringIncludes(
      (error as Error).message,
      "Validation error for argument 'shell': must be one of: fish",
    );
  }
});
