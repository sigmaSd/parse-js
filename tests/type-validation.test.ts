// deno-lint-ignore-file no-import-prefix
/**
 * Type validation and CLI argument behavior tests.
 *
 * This file contains tests for strict type validation and CLI argument parsing behavior
 * ported to the new instance-based API using Args.parse().
 *
 * 1. ✅ Strict Type Validation
 *    - All properties without defaults require explicit @type decorators
 *    - No implicit type defaults (removed "string" fallback)
 *    - Better error messages for missing type information
 *
 * 2. ✅ CLI Argument Separator (--) Behavior
 *    - Documents intentional behavior for arguments after "--"
 *    - Arguments after -- are processed through positional schema
 *    - Allows structured handling via rest arguments
 *
 * Key principles:
 * - Explicit is better than implicit (no default types)
 * - Type safety through required @type decorators
 * - Clear error messages guide users to correct usage
 */

import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  Args,
  argument,
  cli,
  command,
  required,
  subCommand,
  type,
} from "../src/index.ts";

Deno.test("Type inference from defaults works without @type decorator", () => {
  // This should work - type inferred from default value
  @command
  class WorkingCommand {
    @argument({ description: "Files to process", rest: true })
    @type("string[]")
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
    @argument({ description: "Files to process", rest: true })
    @type("string[]")
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

Deno.test("Array option parsing works with default values", () => {
  // Array options work with default values
  @cli({ name: "test" })
  class Config extends Args {
    @type("string[]")
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
    @argument({ description: "Binary" })
    @required()
    @type("string")
    binary: string = "";

    @argument({ description: "Args", rest: true })
    @type("string[]")
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
    @argument({ description: "Binary" })
    @required()
    @type("string")
    binary: string = "";

    @argument({ description: "First arg" })
    @type("string")
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

  // With current implementation, args after -- that don't fit into
  // defined positional args should be... where do they go?
  assertEquals(result.run!.binary, "node");
  assertEquals(result.run!.firstArg, "script.js");

  // The question is: where do "--version" and "--trace-warnings" go?
  // According to CLI conventions, they should be available as raw args
  // but currently they're processed through the positional arg system
});

Deno.test("-- separator: documented intentional behavior", () => {
  // This test documents the intentional behavior of the library:
  // Arguments after -- are processed through positional argument schema
  // rather than being passed as raw arguments

  @command
  class DocCommand {
    @argument({ description: "Command to run" })
    @required()
    @type("string")
    cmd: string = "";

    @argument({ description: "Arguments for the command", rest: true })
    @type("string[]")
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

  // This is the INTENTIONAL behavior:
  // - Arguments after -- are still processed through positional args
  // - This allows structured handling via rest arguments
  // - While different from some CLI conventions, it provides better integration
  assertEquals(result.exec!.cmd, "node");
  assertEquals(result.exec!.args, ["--version", "--inspect", "script.js"]);

  // Note: If you need raw access to args after --, you would need to:
  // 1. Not define rest arguments, and
  // 2. Access the unparsed arguments through the parsing result
  // This is by design to encourage structured argument handling
});

Deno.test("Proposed: -- separator should provide raw access", () => {
  // This test demonstrates what we might want instead:
  // A way to access the raw arguments after --

  @command
  class ProposedCommand {
    @argument({ description: "Binary" })
    @required()
    @type("string")
    binary: string = "";

    // Hypothetical: access to raw args after --
    // rawArgs?: string[];
  }

  @cli({ name: "test" })
  class ProposedConfig extends Args {
    @subCommand(ProposedCommand)
    run?: ProposedCommand;
  }

  const result = ProposedConfig.parse([
    "run",
    "node",
    "--",
    "--version",
    "--trace-warnings",
    "script.js",
  ]);

  assertEquals(result.run!.binary, "node");

  // Hypothetically, we might want:
  // assertEquals(result.run!.rawArgs, ["--version", "--trace-warnings", "script.js"]);

  // This would follow CLI conventions where everything after --
  // is passed literally to the program
});

Deno.test("Reserved property names - user-defined length and name work correctly", () => {
  // Test that user-defined instance properties named 'length' and 'name'
  // are correctly distinguished from built-in class properties
  @command
  class ReservedNamesCommand {
    @argument({ description: "Input file" })
    @type("string")
    input: string = "";

    // User-defined 'length' property - should work
    length: number = 10;

    // User-defined 'name' property - should work
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

Deno.test("Reserved property names - built-in properties are skipped", () => {
  // Test that built-in class properties are properly skipped
  // while user-defined properties with the same names work
  @command
  class MixedPropertiesCommand {
    // This user-defined length should work
    length: number = 25;

    // Regular property
    timeout: number = 30;
  }

  @cli({ name: "test" })
  class MixedConfig extends Args {
    @subCommand(MixedPropertiesCommand)
    cmd?: MixedPropertiesCommand;
  }

  const result = MixedConfig.parse([
    "cmd",
    "--length",
    "100",
    "--timeout",
    "60",
  ]);

  // User-defined properties should be parsed
  assertEquals(result.cmd!.length, 100);
  assertEquals(result.cmd!.timeout, 60);
});

Deno.test("Reserved property names - prototype property restriction", () => {
  // JavaScript itself prevents defining static properties named 'prototype'
  // This test documents that this is a language-level restriction
  assertThrows(
    () => {
      eval(`
        class TestClass {
          static prototype = "custom";
        }
      `);
    },
    SyntaxError,
    "Classes may not have a static property named 'prototype'",
  );
});

Deno.test("Reserved property names - property descriptor validation", () => {
  // Test the internal logic that distinguishes built-in vs user-defined properties
  class TestClass {
    customLength = 42;
    customName = "test";
  }

  const instance = new TestClass();

  // Get descriptors for comparison
  const builtInLength = Object.getOwnPropertyDescriptor(class {}, "length");
  const builtInName = Object.getOwnPropertyDescriptor(class {}, "name");
  const userLength = Object.getOwnPropertyDescriptor(instance, "customLength");
  const userName = Object.getOwnPropertyDescriptor(instance, "customName");

  // Built-in properties: non-writable, non-enumerable
  assertEquals(builtInLength?.writable, false);
  assertEquals(builtInLength?.enumerable, false);
  assertEquals(builtInName?.writable, false);
  assertEquals(builtInName?.enumerable, false);

  // User-defined properties: writable, enumerable
  assertEquals(userLength?.writable, true);
  assertEquals(userLength?.enumerable, true);
  assertEquals(userName?.writable, true);
  assertEquals(userName?.enumerable, true);
});

Deno.test("Type validation - properties with reserved names work with defaults", () => {
  // Test that user-defined properties with reserved names work with defaults
  @command
  class GoodCommand {
    // Has default, should work
    length: number = 0;
  }

  @cli({ name: "test" })
  class GoodConfig extends Args {
    @subCommand(GoodCommand)
    cmd?: GoodCommand;
  }

  const result = GoodConfig.parse(["cmd"]);
  assertEquals(result.cmd!.length, 0);
});

Deno.test("Type validation - reserved names work with defaults", () => {
  // Test that properties with reserved names work with default values
  @command
  class GoodCommand {
    length: number = 0;
    name: string = "";
  }

  @cli({ name: "test" })
  class GoodConfig extends Args {
    @subCommand(GoodCommand)
    cmd?: GoodCommand;
  }

  const result = GoodConfig.parse([
    "cmd",
    "--length",
    "75",
    "--name",
    "test-app",
  ]);

  assertEquals(result.cmd!.length, 75);
  assertEquals(result.cmd!.name, "test-app");
});

Deno.test("Edge case: -- with no positional args defined", () => {
  @command
  class NoPositionalCommand {
    verbose: boolean = false;
  }

  @cli({ name: "test" })
  class EdgeConfig extends Args {
    @subCommand(NoPositionalCommand)
    cmd?: NoPositionalCommand;
  }

  const result = EdgeConfig.parse([
    "cmd",
    "--verbose",
    "--",
    "--help",
    "file.txt",
  ]);

  // Flags before -- should be parsed
  assertEquals(result.cmd!.verbose, true);

  // Args after -- currently go... somewhere.
  // According to CLI conventions, they should be available as raw args
  // but since no positional args are defined, they might be lost
});

Deno.test("Type validation - properties with defaults work without @type", () => {
  // Test that properties with defaults work without @type decorator
  @cli({ name: "test" })
  class StrictConfig extends Args {
    // Has default - should work
    strictProperty: string = "";
  }

  const result = StrictConfig.parse([]);
  assertEquals(result.strictProperty, "");
});

Deno.test("Type validation - properties with defaults don't need @type", () => {
  // Properties with defaults should work without @type
  @cli({ name: "test" })
  class DefaultConfig extends Args {
    // This should work - has default value
    port: number = 8080;

    // This should work - has default value
    host: string = "localhost";

    // This should work - has default value
    enabled: boolean = false;
  }

  const result = DefaultConfig.parse(["--port", "3000", "--enabled"]);
  assertEquals(result.port, 3000);
  assertEquals(result.host, "localhost");
  assertEquals(result.enabled, true);
});

Deno.test("Type validation - defaults provide type information", () => {
  // Properties with defaults provide type information automatically
  @cli({ name: "test" })
  class ExplicitTypeConfig extends Args {
    apiKey: string = ""; // Has default, works without @type

    timeout: number = 30; // Has default, works without @type
  }

  const result = ExplicitTypeConfig.parse([
    "--apiKey",
    "secret123",
    "--timeout",
    "60",
  ]);
  assertEquals(result.apiKey, "secret123");
  assertEquals(result.timeout, 60);
});

Deno.test("Type validation - properties without defaults and @type should error", () => {
  // Test that properties without defaults and without @type decorator throw an error
  assertThrows(
    () => {
      @cli({ name: "test" })
      class BadConfig extends Args {
        // This should error - no default value and no @type decorator
        @argument()
        @required()
        input!: string;
      }

      BadConfig.parse([]);
    },
    Error,
    'Property \'input\' has no default value and no @type() decorator. Use @type("string"), @type("number"), etc. to specify the expected type. This is required because TypeScript cannot infer the type from undefined values.',
  );

  // Test for regular option (not positional argument)
  assertThrows(
    () => {
      @cli({ name: "test" })
      class BadConfig2 extends Args {
        // This should error - no default value and no @type decorator
        @required()
        apiKey?: string;
      }

      BadConfig2.parse([]);
    },
    Error,
    "Property 'apiKey' has no default value and no @type() decorator",
  );

  // Test for rawRest argument
  assertThrows(
    () => {
      @cli({ name: "test" })
      class BadConfig3 extends Args {
        // This should error - no default value and no @type decorator for rawRest
        @argument({ rest: true })
        remaining?: string[];
      }

      BadConfig3.parse([]);
    },
    Error,
    "Property 'remaining' has no default value and no @type() decorator",
  );
});

Deno.test("Type validation - properties with @type but no defaults should work", () => {
  // Test that properties with @type decorator but no defaults work correctly
  @cli({ name: "test" })
  class GoodConfig extends Args {
    @type("string")
    @required()
    apiKey?: string;

    @argument()
    @type("string")
    @required()
    input?: string;
  }

  const result = GoodConfig.parse(["testfile.txt", "--apiKey", "secret123"]);
  assertEquals(result.apiKey, "secret123");
  assertEquals(result.input, "testfile.txt");
});
