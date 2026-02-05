/**
 * Tests for the Args-based CLI API.
 *
 * This test suite verifies that the new @cli decorator with Args base class
 * works correctly for all CLI parsing scenarios.
 */

import { assertEquals, assertThrows } from "@std/assert";
import {
  addValidator,
  arg,
  Args,
  cli,
  command,
  oneOf,
  opt,
  ParseError,
  range,
  subCommand,
} from "../mod.ts";

Deno.test("Args API - basic functionality", () => {
  @cli({ name: "testapp", description: "Test application" })
  class TestApp extends Args {
    @opt({ description: "Enable verbose mode" })
    verbose: boolean = false;

    @opt({ description: "Port number" })
    port: number = 8080;

    @opt({ description: "Server name" })
    name: string = "server";
  }

  const result = TestApp.parse([
    "--verbose",
    "--port",
    "3000",
    "--name",
    "myserver",
  ]);

  assertEquals(result.verbose, true);
  assertEquals(result.port, 3000);
  assertEquals(result.name, "myserver");
});

Deno.test("Args API - with validation", () => {
  @cli({
    name: "validationtest",
    description: "Test validation",
    exitOnError: false,
  })
  class ValidationTest extends Args {
    @opt({ description: "Port number (1-65535)" })
    @addValidator(range(1, 65535))
    port: number = 8080;

    @opt({ description: "Environment" })
    @addValidator(oneOf(["dev", "staging", "prod"]))
    env: string = "dev";
  }

  // Valid arguments should work
  const validResult = ValidationTest.parse([
    "--port",
    "3000",
    "--env",
    "staging",
  ]);
  assertEquals(validResult.port, 3000);
  assertEquals(validResult.env, "staging");

  // Invalid port should throw
  assertThrows(() => {
    ValidationTest.parse(["--port", "70000"]);
  });

  // Invalid environment should throw
  assertThrows(() => {
    ValidationTest.parse(["--env", "invalid"]);
  });
});

Deno.test("Args API - required fields", () => {
  @cli({
    name: "requiredtest",
    description: "Test required fields",
    exitOnError: false,
  })
  class RequiredTest extends Args {
    @opt({ description: "Required API key", type: "string", required: true })
    apiKey!: string;

    @opt({ description: "Optional debug flag" })
    debug: boolean = false;
  }

  // Should work with required field provided
  const validResult = RequiredTest.parse([
    "--apiKey",
    "secret123",
    "--debug",
  ]);
  assertEquals(validResult.apiKey, "secret123");
  assertEquals(validResult.debug, true);

  // Should throw when required field is missing
  assertThrows(() => {
    RequiredTest.parse(["--debug"]);
  });
});

Deno.test("Args API - with subcommands", () => {
  @command
  class BuildCommand {
    @opt({ description: "Enable production mode" })
    production: boolean = false;

    @opt({ description: "Output directory" })
    output: string = "dist";
  }

  @command
  class ServeCommand {
    @opt({ description: "Port to serve on" })
    port: number = 3000;

    @opt({ description: "Development mode" })
    dev: boolean = false;
  }

  @cli({
    name: "buildtool",
    description: "Build and serve tool",
    exitOnError: false,
  })
  class BuildTool extends Args {
    @opt({ description: "Verbose logging" })
    verbose: boolean = false;

    @subCommand(BuildCommand)
    build?: BuildCommand;

    @subCommand(ServeCommand)
    serve?: ServeCommand;
  }

  // Test build subcommand
  const buildResult = BuildTool.parse([
    "--verbose",
    "build",
    "--production",
    "--output",
    "public",
  ]);
  assertEquals(buildResult.verbose, true);

  // Perfect type safety - no casting needed!
  assertEquals(buildResult.build!.production, true);
  assertEquals(buildResult.build!.output, "public");

  // Test serve subcommand
  const serveResult = BuildTool.parse(["serve", "--port", "8080", "--dev"]);

  assertEquals(serveResult.serve!.port, 8080);
  assertEquals(serveResult.serve!.dev, true);
});

Deno.test("Args API - with positional arguments", () => {
  @cli({ name: "fileproc", description: "File processor" })
  class FileProcessor extends Args {
    @arg({ description: "Input file", type: "string" })
    input: string = "";

    @arg({ description: "Output file", type: "string" })
    output: string = "";

    @arg({ description: "Additional files", rest: true, type: "string[]" })
    extras: string[] = [];

    @opt({ description: "Processing mode" })
    mode: string = "copy";
  }

  const result = FileProcessor.parse([
    "input.txt",
    "output.txt",
    "extra1.txt",
    "extra2.txt",
    "--mode",
    "transform",
  ]);

  assertEquals(result.input, "input.txt");
  assertEquals(result.output, "output.txt");
  assertEquals(result.extras, ["extra1.txt", "extra2.txt"]);
  assertEquals(result.mode, "transform");
});

Deno.test("Args API - array types", () => {
  @cli({
    name: "arraytest",
    description: "Test array parsing",
    exitOnError: false,
  })
  class ArrayTest extends Args {
    @opt({ description: "List of tags", type: "string[]" })
    tags: string[] = [];

    @opt({ description: "List of numbers", type: "number[]" })
    numbers: number[] = [];
  }

  const result = ArrayTest.parse([
    "--tags",
    "tag1,tag2,tag3",
    "--numbers",
    "1,2,3,4",
  ]);

  assertEquals(result.tags, ["tag1", "tag2", "tag3"]);
  assertEquals(result.numbers, [1, 2, 3, 4]);
});

Deno.test("Args API - empty arguments", () => {
  @cli({ name: "emptytest", description: "Test empty args" })
  class EmptyTest extends Args {
    @opt({ description: "Debug flag" })
    debug: boolean = false;

    @opt({ description: "Port number" })
    port: number = 8080;
  }

  // Should return defaults when no arguments provided
  const result = EmptyTest.parse([]);
  assertEquals(result.debug, false);
  assertEquals(result.port, 8080);
});

Deno.test("Args API - boolean flags", () => {
  @cli({ name: "booltest", description: "Test boolean parsing" })
  class BoolTest extends Args {
    @opt({ description: "Verbose mode" })
    verbose: boolean = false;

    @opt({ description: "Quiet mode" })
    quiet: boolean = false;

    @opt({ description: "Debug mode" })
    debug: boolean = true; // Default true
  }

  // Test setting flags to true
  const result1 = BoolTest.parse(["--verbose", "--quiet"]);
  assertEquals(result1.verbose, true);
  assertEquals(result1.quiet, true);
  assertEquals(result1.debug, true); // Should keep default

  // Test explicit boolean values
  const result2 = BoolTest.parse(["--verbose=false", "--debug=false"]);
  assertEquals(result2.verbose, false);
  assertEquals(result2.debug, false);
  assertEquals(result2.quiet, false); // Should keep default
});

Deno.test("Args API - type coercion", () => {
  @cli({ name: "typetest", description: "Test type coercion" })
  class TypeTest extends Args {
    @opt({ description: "A number" })
    num: number = 0;

    @opt({ description: "A string" })
    str: string = "";

    @opt({ description: "Explicit string type", type: "string" })
    explicitStr: string = "default";
  }

  const result = TypeTest.parse([
    "--num",
    "42.5",
    "--str",
    "hello",
    "--explicitStr",
    "world",
  ]);

  assertEquals(result.num, 42.5);
  assertEquals(typeof result.num, "number");
  assertEquals(result.str, "hello");
  assertEquals(typeof result.str, "string");
  assertEquals(result.explicitStr, "world");
});

Deno.test("Args API - help flag handling", () => {
  @cli({
    name: "helptest",
    description: "Test help handling",
    exitOnHelp: false,
  })
  class HelpTest extends Args {
    @opt({ description: "Some opt" })
    opt: string = "default";
  }

  // Help flag should be handled by the system
  // This test verifies the structure can handle help without throwing
  assertThrows(() => {
    HelpTest.parse(["--help"]);
  });
});

Deno.test("Args API - nested subcommands with perfect type safety", () => {
  @command
  class DatabaseCommand {
    @opt({ description: "Database host" })
    host: string = "localhost";

    @opt({ description: "Database port" })
    port: number = 5432;
  }

  @command
  class DeployCommand {
    @opt({ description: "Environment to deploy to" })
    @addValidator(oneOf(["staging", "production"]))
    env: string = "staging";

    @subCommand(DatabaseCommand)
    database?: DatabaseCommand;
  }

  @cli({ name: "myapp", description: "My application" })
  class MyApp extends Args {
    @opt({ description: "Verbose output" })
    verbose: boolean = false;

    @subCommand(DeployCommand)
    deploy?: DeployCommand;
  }

  const result = MyApp.parse([
    "--verbose",
    "deploy",
    "--env",
    "production",
    "database",
    "--host",
    "prod-db.example.com",
    "--port",
    "3306",
  ]);

  // Perfect type safety throughout the chain!
  assertEquals(result.verbose, true);
  assertEquals(result.deploy!.env, "production");
  assertEquals(result.deploy!.database!.host, "prod-db.example.com");
  assertEquals(result.deploy!.database!.port, 3306);
});

Deno.test("Args API - defaultCommand: 'help'", () => {
  @cli({
    name: "helpdefault",
    description: "Test default help command",
    defaultCommand: "help",
    exitOnHelp: false,
  })
  class HelpDefault extends Args {
    @opt({ description: "Some opt" })
    opt: string = "default";
  }

  // Should show help when no arguments provided
  // The parser will throw an error because exitOnHelp is false but help is triggered
  assertThrows(() => {
    HelpDefault.parse([]);
  });
});

Deno.test("Args API - defaultCommand with subcommand", () => {
  @command
  class ServeCommand {
    @opt({ description: "Port to serve on" })
    port: number = 3000;

    @opt({ description: "Host to bind to" })
    host: string = "localhost";
  }

  @cli({
    name: "defaultsubcmd",
    description: "Test default subcommand",
    defaultCommand: "serve",
    exitOnError: false,
  })
  class DefaultSubCmd extends Args {
    @opt({ description: "Verbose output" })
    verbose: boolean = false;

    @subCommand(ServeCommand)
    serve?: ServeCommand;
  }

  // Should execute the serve subcommand when no arguments provided
  const result = DefaultSubCmd.parse([]);

  assertEquals(result.verbose, false);
  assertEquals(result.serve !== undefined, true);
  assertEquals(result.serve!.port, 3000);
  assertEquals(result.serve!.host, "localhost");
});

Deno.test("Args API - no defaultCommand behavior", () => {
  @cli({
    name: "nodefault",
    description: "Test without default command",
  })
  class NoDefault extends Args {
    @opt({ description: "Some opt" })
    opt: string = "default";
  }

  // Should return defaults when no arguments and no defaultCommand
  const result = NoDefault.parse([]);
  assertEquals(result.opt, "default");
});

Deno.test("Args API - subcommands don't inherit parent's defaultCommand", () => {
  @command
  class SubCmd {
    @opt({ description: "Some value" })
    value: string = "subdefault";
  }

  @cli({
    name: "parentcmd",
    description: "Parent with defaultCommand",
    defaultCommand: "help",
    exitOnHelp: false,
  })
  class ParentCmd extends Args {
    @subCommand(SubCmd)
    sub?: SubCmd;
  }

  // Parent should show help when called without args
  assertThrows(() => {
    ParentCmd.parse([]);
  });

  // Subcommand should NOT show help, just use defaults
  const result = ParentCmd.parse(["sub"]);
  assertEquals(result.sub !== undefined, true);
  assertEquals(result.sub!.value, "subdefault");
});

Deno.test("Args API - subcommand help shows correct command path", () => {
  @command
  class BuildCommand {
    @opt({ description: "Output directory" })
    output: string = "dist";

    @opt({ description: "Enable minification" })
    minify: boolean = false;
  }

  @cli({
    name: "devtool",
    description: "Development tool",
    exitOnHelp: false,
  })
  class DevTool extends Args {
    @opt({ description: "Verbose mode" })
    verbose: boolean = false;

    @subCommand(BuildCommand)
    build?: BuildCommand;
  }

  // When help is shown for a subcommand, it should include the full command path
  assertThrows(
    () => {
      DevTool.parse(["build", "--help"]);
    },
    ParseError,
  );

  // Capture the help text to verify it contains the correct command path
  let helpText = "";
  try {
    DevTool.parse(["build", "--help"]);
  } catch (error) {
    if (error instanceof ParseError) {
      helpText = error.message;
    }
  }

  // Help should show "devtool build" in the usage, not just "devtool"
  assertEquals(helpText.includes("devtool build"), true);
  assertEquals(helpText.includes("Usage:"), true);
});

Deno.test("Args API - subcommand with defaultCommand: 'help'", () => {
  // Subcommand WITHOUT defaultCommand should execute normally with defaults
  @command
  class NormalCommand {
    @opt({ description: "Port to serve on" })
    port: number = 3000;
  }

  // Subcommand WITH defaultCommand: "help" should show help when called without args
  @command({ defaultCommand: "help" })
  class HelpCommand {
    @opt({ description: "Port to serve on" })
    port: number = 8080;
  }

  @cli({
    name: "myapp",
    description: "My application",
    exitOnHelp: false,
  })
  class MyApp extends Args {
    @subCommand(NormalCommand)
    normal?: NormalCommand;

    @subCommand(HelpCommand)
    help?: HelpCommand;
  }

  // Normal subcommand without arguments should execute with defaults
  const normalResult = MyApp.parse(["normal"]);
  assertEquals(normalResult.normal !== undefined, true);
  assertEquals(normalResult.normal!.port, 3000);

  // Subcommand with defaultCommand: "help" should throw/show help when called without args
  assertThrows(
    () => {
      MyApp.parse(["help"]);
    },
    ParseError,
  );

  // Verify it's showing help for the subcommand
  let helpText = "";
  try {
    MyApp.parse(["help"]);
  } catch (error) {
    if (error instanceof ParseError) {
      helpText = error.message;
    }
  }

  // Help should show "myapp help" in the usage
  assertEquals(helpText.includes("myapp help"), true);
  assertEquals(helpText.includes("Usage:"), true);
  assertEquals(helpText.includes("--port"), true);
});
