/**
 * Type validation and CLI argument behavior tests.
 *
 * This file contains tests for strict type validation and CLI argument parsing behavior:
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
  argument,
  command,
  parse,
  required,
  subCommand,
  type,
} from "jsr:@sigma/parse";

Deno.test("Strict type validation - require @type for all properties without defaults", () => {
  // This should work - explicit type specified
  @command
  class _WorkingCommand {
    @argument(0, "Files to process", { rest: true })
    @type("string[]")
    static files: string[];
  }

  // This should fail - no @type and no default
  assertThrows(
    () => {
      @command
      class FailingCommand {
        @argument(0, "Files to process", { rest: true })
        static files: string[]; // No @type, no default - should require @type
      }

      // Trigger validation by trying to parse

      @parse(["cmd", "test.txt"], { name: "test" })
      class _Config {
        @subCommand(FailingCommand)
        static cmd: FailingCommand;
      }
    },
    Error,
    "has no default value and no @type decorator",
  );
});

Deno.test("Type validation - properties with defaults should work", () => {
  // This should work - type inferred from default value
  @command
  class CommandWithDefault {
    @argument(0, "Files to process", { rest: true })
    static files: string[] = [];
  }

  @parse(["cmd", "test.txt", "test2.txt"], { name: "test" })
  class _Config {
    @subCommand(CommandWithDefault)
    static cmd: CommandWithDefault;
  }

  assertEquals(CommandWithDefault.files, ["test.txt", "test2.txt"]);
});

Deno.test("Option type validation - should require @type for all properties without defaults", () => {
  // This should fail - option without @type and no default
  assertThrows(
    () => {
      @parse(["--tags", "web,api"], { name: "test" })
      class _Config {
        static tags: string[]; // No @type, no default - should require @type
      }
    },
    Error,
    "has no default value and no @type decorator",
  );
});

Deno.test("-- separator: current behavior vs expected behavior", () => {
  // Current behavior: everything after -- gets processed through positional args
  @command
  class CurrentCommand {
    @argument(0, "Binary")
    @required()
    @type("string")
    static binary: string;

    @argument(1, "Args", { rest: true })
    @type("string[]")
    static args: string[] = [];
  }

  @parse([
    "run",
    "node",
    "--",
    "--version",
    "--trace-warnings",
    "script.js",
  ], { name: "test" })
  class _CurrentConfig {
    @subCommand(CurrentCommand)
    static run: CurrentCommand;
  }

  // Current behavior: args after -- are processed as positional args
  assertEquals(CurrentCommand.binary, "node");
  assertEquals(CurrentCommand.args, [
    "--version",
    "--trace-warnings",
    "script.js",
  ]);
});

Deno.test("-- separator: what happens without rest argument", () => {
  @command
  class LimitedCommand {
    @argument(0, "Binary")
    @required()
    @type("string")
    static binary: string;

    @argument(1, "First arg")
    static firstArg: string = "";
  }

  @parse([
    "run",
    "node",
    "script.js",
    "--",
    "--version",
    "--trace-warnings",
  ], { name: "test" })
  class _LimitedConfig {
    @subCommand(LimitedCommand)
    static run: LimitedCommand;
  }

  // With current implementation, args after -- that don't fit into
  // defined positional args should be... where do they go?
  assertEquals(LimitedCommand.binary, "node");
  assertEquals(LimitedCommand.firstArg, "script.js");

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
    @argument(0, "Command to run")
    @required()
    @type("string")
    static cmd: string;

    @argument(1, "Arguments for the command", { rest: true })
    @type("string[]")
    static args: string[] = [];
  }

  @parse([
    "exec",
    "node",
    "--",
    "--version",
    "--inspect",
    "script.js",
  ], { name: "test" })
  class _DocConfig {
    @subCommand(DocCommand)
    static exec: DocCommand;
  }

  // This is the INTENTIONAL behavior:
  // - Arguments after -- are still processed through positional args
  // - This allows structured handling via rest arguments
  // - While different from some CLI conventions, it provides better integration
  assertEquals(DocCommand.cmd, "node");
  assertEquals(DocCommand.args, ["--version", "--inspect", "script.js"]);

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
    @argument(0, "Binary")
    @required()
    @type("string")
    static binary: string;

    // Hypothetical: access to raw args after --
    // static _rawArgs?: string[];
  }

  @parse([
    "run",
    "node",
    "--",
    "--version",
    "--trace-warnings",
    "script.js",
  ], { name: "test" })
  class _ProposedConfig {
    @subCommand(ProposedCommand)
    static run: ProposedCommand;
  }

  assertEquals(ProposedCommand.binary, "node");

  // Hypothetically, we might want:
  // assertEquals(ProposedCommand._rawArgs, ["--version", "--trace-warnings", "script.js"]);

  // This would follow CLI conventions where everything after --
  // is passed literally to the program
});

Deno.test("Reserved property names - user-defined length and name work correctly", () => {
  // Test that user-defined static properties named 'length' and 'name'
  // are correctly distinguished from built-in class properties
  @command
  class ReservedNamesCommand {
    @argument(0, "Input file")
    @type("string")
    static input: string;

    // User-defined 'length' property - should work
    static length: number = 10;

    // User-defined 'name' property - should work
    static name: string = "default";
  }

  @parse(["cmd", "test.txt", "--length", "50", "--name", "custom"], {
    name: "test",
  })
  class _Config {
    @subCommand(ReservedNamesCommand)
    static cmd: ReservedNamesCommand;
  }

  assertEquals(ReservedNamesCommand.input, "test.txt");
  assertEquals(ReservedNamesCommand.length, 50);
  assertEquals(ReservedNamesCommand.name, "custom");
});

Deno.test("Reserved property names - built-in properties are skipped", () => {
  // Test that built-in class properties are properly skipped
  // while user-defined properties with the same names work
  @command
  class MixedPropertiesCommand {
    // This user-defined length should work
    static length: number = 25;

    // Regular property
    static timeout: number = 30;
  }

  @parse(["cmd", "--length", "100", "--timeout", "60"], { name: "test" })
  class _Config {
    @subCommand(MixedPropertiesCommand)
    static cmd: MixedPropertiesCommand;
  }

  // User-defined properties should be parsed
  assertEquals(MixedPropertiesCommand.length, 100);
  assertEquals(MixedPropertiesCommand.timeout, 60);
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
    static customLength = 42;
    static customName = "test";
  }

  // Get descriptors for comparison
  const builtInLength = Object.getOwnPropertyDescriptor(class {}, "length");
  const builtInName = Object.getOwnPropertyDescriptor(class {}, "name");
  const userLength = Object.getOwnPropertyDescriptor(TestClass, "customLength");
  const userName = Object.getOwnPropertyDescriptor(TestClass, "customName");

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

Deno.test("Type validation - properties with reserved names require explicit types", () => {
  // Test that user-defined properties with reserved names still follow type rules
  assertThrows(
    () => {
      @command
      class BadCommand {
        // No default, no @type - should fail
        static length: number;
      }

      @parse(["cmd"], { name: "test" })
      class _Config {
        @subCommand(BadCommand)
        static cmd: BadCommand;
      }
    },
    Error,
    "has no default value and no @type decorator",
  );
});

Deno.test("Type validation - reserved names with explicit types work", () => {
  // Test that explicit @type decorators work for reserved names
  @command
  class GoodCommand {
    @type("number")
    static length: number;

    @type("string")
    static name: string;
  }

  @parse(["cmd", "--length", "75", "--name", "test-app"], { name: "test" })
  class _Config {
    @subCommand(GoodCommand)
    static cmd: GoodCommand;
  }

  assertEquals(GoodCommand.length, 75);
  assertEquals(GoodCommand.name, "test-app");
});

Deno.test("Edge case: -- with no positional args defined", () => {
  @command
  class NoPositionalCommand {
    static verbose: boolean = false;
  }

  @parse([
    "cmd",
    "--verbose",
    "--",
    "--help",
    "file.txt",
  ], { name: "test" })
  class _EdgeConfig {
    @subCommand(NoPositionalCommand)
    static cmd: NoPositionalCommand;
  }

  // Flags before -- should be parsed
  assertEquals(NoPositionalCommand.verbose, true);

  // Args after -- currently go... somewhere.
  // According to CLI conventions, they should be available as raw args
  // but since no positional args are defined, they might be lost
});
