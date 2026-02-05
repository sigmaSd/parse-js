// deno-lint-ignore-file no-import-prefix
/**
 * Type validation and CLI argument behavior tests.
 */

import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { arg, Args, cli, command, opt, subCommand } from "../mod.ts";

Deno.test("Type inference from defaults works without @type in decorator", () => {
  // This should work - type inferred from default value
  @command
  class WorkingCommand {
    @arg({ description: "Files to process", rest: true })
    files: string[] = [];
  }

  @cli({ name: "test" })
  class WorkingConfig extends Args {
    @subCommand(WorkingCommand)
    cmd?: WorkingCommand;
  }

  const result = WorkingConfig.parse(["cmd", "test.txt"]);
  assertEquals(result.cmd!.files, ["test.txt"]);
});

Deno.test("Type validation - properties with defaults should work", () => {
  // This should work - type inferred from default value
  @command
  class CommandWithDefault {
    @arg({ description: "Files to process", rest: true })
    files: string[] = [];
  }

  @cli({ name: "test" })
  class ConfigWithDefault extends Args {
    @subCommand(CommandWithDefault)
    cmd?: CommandWithDefault;
  }

  const result = ConfigWithDefault.parse(["cmd", "test.txt", "test2.txt"]);
  assertEquals(result.cmd!.files, ["test.txt", "test2.txt"]);
});

Deno.test("Array opt parsing works with default values", () => {
  // Array options work with default values
  @cli({ name: "test" })
  class Config extends Args {
    @opt({ type: "string[]" })
    tags: string[] = []; // Has default, should work
  }

  // This should work since we have a default
  const result = Config.parse(["--tags", "web,api"]);
  assertEquals(result.tags, ["web", "api"]);
});

Deno.test("-- separator: current behavior vs expected behavior", () => {
  // Current behavior: everything after -- gets processed through positional args
  @command
  class CurrentCommand {
    @arg({ description: "Binary", required: true, type: "string" })
    binary: string = "";

    @arg({ description: "Args", rest: true, type: "string[]" })
    args: string[] = [];
  }

  @cli({ name: "test" })
  class CurrentConfig extends Args {
    @subCommand(CurrentCommand)
    run?: CurrentCommand;
  }

  const result = CurrentConfig.parse([
    "run",
    "node",
    "--",
    "--version",
    "--trace-warnings",
    "script.js",
  ]);

  // Current behavior: args after -- are processed as positional args
  assertEquals(result.run!.binary, "node");
  assertEquals(result.run!.args, [
    "--version",
    "--trace-warnings",
    "script.js",
  ]);
});

Deno.test("-- separator: what happens without rest argument", () => {
  @command
  class LimitedCommand {
    @arg({ description: "Binary", required: true, type: "string" })
    binary: string = "";

    @arg({ description: "First arg", type: "string" })
    firstArg: string = "";
  }

  @cli({ name: "test" })
  class LimitedConfig extends Args {
    @subCommand(LimitedCommand)
    run?: LimitedCommand;
  }

  const result = LimitedConfig.parse([
    "run",
    "node",
    "script.js",
    "--",
    "--version",
    "--trace-warnings",
  ]);

  assertEquals(result.run!.binary, "node");
  assertEquals(result.run!.firstArg, "script.js");
});

Deno.test("-- separator: documented intentional behavior", () => {
  @command
  class DocCommand {
    @arg({ description: "Command to run", required: true, type: "string" })
    cmd: string = "";

    @arg({
      description: "Arguments for the command",
      rest: true,
      type: "string[]",
    })
    args: string[] = [];
  }

  @cli({ name: "test" })
  class DocConfig extends Args {
    @subCommand(DocCommand)
    exec?: DocCommand;
  }

  const result = DocConfig.parse([
    "exec",
    "node",
    "--",
    "--version",
    "--inspect",
    "script.js",
  ]);

  assertEquals(result.exec!.cmd, "node");
  assertEquals(result.exec!.args, ["--version", "--inspect", "script.js"]);
});

Deno.test("Reserved property names - user-defined length and name work correctly", () => {
  @command
  class ReservedNamesCommand {
    @arg({ description: "Input file", type: "string" })
    input: string = "";

    @opt()
    length: number = 10;

    @opt()
    name: string = "default";
  }

  @cli({ name: "test" })
  class ReservedConfig extends Args {
    @subCommand(ReservedNamesCommand)
    cmd?: ReservedNamesCommand;
  }

  const result = ReservedConfig.parse([
    "cmd",
    "test.txt",
    "--length",
    "50",
    "--name",
    "custom",
  ]);

  assertEquals(result.cmd!.input, "test.txt");
  assertEquals(result.cmd!.length, 50);
  assertEquals(result.cmd!.name, "custom");
});

Deno.test("Type validation - properties with defaults work without type in decorator", () => {
  @cli({ name: "test" })
  class StrictConfig extends Args {
    @opt()
    strictProperty: string = "";
  }

  const result = StrictConfig.parse([]);
  assertEquals(result.strictProperty, "");
});

Deno.test("Type validation - properties with defaults don't need explicit type", () => {
  @cli({ name: "test" })
  class DefaultConfig extends Args {
    @opt()
    port: number = 8080;

    @opt()
    host: string = "localhost";

    @opt()
    enabled: boolean = false;
  }

  const result = DefaultConfig.parse(["--port", "3000", "--enabled"]);
  assertEquals(result.port, 3000);
  assertEquals(result.host, "localhost");
  assertEquals(result.enabled, true);
});

Deno.test("Type validation - properties without defaults and type should error", () => {
  // Test that properties without defaults and without type in @arg throw an error
  assertThrows(
    () => {
      @cli({ name: "test" })
      class BadConfig extends Args {
        @arg({ required: true })
        input!: string;
      }

      BadConfig.parse([]);
    },
    Error,
    "Property 'input' has no default value and no type specified in @arg()",
  );

  // Test for regular opt
  assertThrows(
    () => {
      @cli({ name: "test" })
      class BadConfig2 extends Args {
        @opt({ required: true })
        apiKey?: string;
      }

      BadConfig2.parse([]);
    },
    Error,
    "Property 'apiKey' has no default value and no type specified in @opt()",
  );
});

Deno.test("Type validation - properties with type but no defaults should work", () => {
  @cli({ name: "test" })
  class GoodConfig extends Args {
    @opt({ type: "string", required: true })
    apiKey?: string;

    @arg({ type: "string", required: true })
    input?: string;
  }

  const result = GoodConfig.parse(["testfile.txt", "--apiKey", "secret123"]);
  assertEquals(result.apiKey, "secret123");
  assertEquals(result.input, "testfile.txt");
});
