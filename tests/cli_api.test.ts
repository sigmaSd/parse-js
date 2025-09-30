/**
 * Tests for the Args-based CLI API.
 *
 * This test suite verifies that the new @cli decorator with Args base class
 * works correctly for all CLI parsing scenarios.
 */

import { assertEquals, assertThrows } from "@std/assert";
import {
  addValidator,
  Args,
  argument,
  cli,
  command,
  description,
  oneOf,
  range,
  required,
  subCommand,
  type,
} from "../src/index.ts";

Deno.test("Args API - basic functionality", () => {
  @cli({ name: "testapp", description: "Test application" })
  class TestApp extends Args {
    @description("Enable verbose mode")
    verbose: boolean = false;

    @description("Port number")
    port: number = 8080;

    @description("Server name")
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
    @description("Port number (1-65535)")
    @addValidator(range(1, 65535))
    port: number = 8080;

    @description("Environment")
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
    @description("Required API key")
    @type("string")
    @required()
    apiKey: string = "";

    @description("Optional debug flag")
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
    @description("Enable production mode")
    production: boolean = false;

    @description("Output directory")
    output: string = "dist";
  }

  @command
  class ServeCommand {
    @description("Port to serve on")
    port: number = 3000;

    @description("Development mode")
    dev: boolean = false;
  }

  @cli({
    name: "buildtool",
    description: "Build and serve tool",
    exitOnError: false,
  })
  class BuildTool extends Args {
    @description("Verbose logging")
    verbose: boolean = false;

    @description("Build the project")
    @subCommand(BuildCommand)
    build?: BuildCommand;

    @description("Serve the project")
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
    @argument({ description: "Input file" })
    @type("string")
    input: string = "";

    @argument({ description: "Output file" })
    @type("string")
    output: string = "";

    @argument({ description: "Additional files", rest: true })
    @type("string[]")
    extras: string[] = [];

    @description("Processing mode")
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
    @description("List of tags")
    @type("string[]")
    tags: string[] = [];

    @description("List of numbers")
    @type("number[]")
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
    @description("Debug flag")
    debug: boolean = false;

    @description("Port number")
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
    @description("Verbose mode")
    verbose: boolean = false;

    @description("Quiet mode")
    quiet: boolean = false;

    @description("Debug mode")
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
    @description("A number")
    num: number = 0;

    @description("A string")
    str: string = "";

    @description("Explicit string type")
    @type("string")
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
    @description("Some option")
    option: string = "default";
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
    @description("Database host")
    host: string = "localhost";

    @description("Database port")
    port: number = 5432;
  }

  @command
  class DeployCommand {
    @description("Environment to deploy to")
    @addValidator(oneOf(["staging", "production"]))
    env: string = "staging";

    @description("Database configuration")
    @subCommand(DatabaseCommand)
    database?: DatabaseCommand;
  }

  @cli({ name: "myapp", description: "My application" })
  class MyApp extends Args {
    @description("Verbose output")
    verbose: boolean = false;

    @description("Deploy the application")
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
    @description("Some option")
    option: string = "default";
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
    @description("Port to serve on")
    port: number = 3000;

    @description("Host to bind to")
    host: string = "localhost";
  }

  @cli({
    name: "defaultsubcmd",
    description: "Test default subcommand",
    defaultCommand: "serve",
    exitOnError: false,
  })
  class DefaultSubCmd extends Args {
    @description("Verbose output")
    verbose: boolean = false;

    @description("Start the server")
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
    @description("Some option")
    option: string = "default";
  }

  // Should return defaults when no arguments and no defaultCommand
  const result = NoDefault.parse([]);
  assertEquals(result.option, "default");
});

Deno.test("Args API - subcommands don't inherit parent's defaultCommand", () => {
  @command
  class SubCmd {
    @description("Some value")
    value: string = "subdefault";
  }

  @cli({
    name: "parentcmd",
    description: "Parent with defaultCommand",
    defaultCommand: "help",
    exitOnHelp: false,
  })
  class ParentCmd extends Args {
    @description("Subcommand")
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
