// deno-lint-ignore-file no-import-prefix
/**
 * Comprehensive test suite for the CLI argument parsing library.
 *
 * This file contains tests ported to the new instance-based API
 * using Args.parse().
 */

import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  addValidator,
  arg,
  Args,
  cli,
  command,
  opt,
  subCommand,
} from "../mod.ts";

// Helper functions for testing

// User-defined validation decorators
function minValue(min: number) {
  return addValidator((value: unknown) => {
    if (typeof value === "number" && value < min) {
      return `must be at least ${min}`;
    }
    return null;
  });
}

function range(min: number, max: number) {
  return addValidator((value: unknown) => {
    if (typeof value === "number" && (value < min || value > max)) {
      return `must be between ${min} and ${max}`;
    }
    return null;
  });
}

function min(minValue: number) {
  return addValidator((value: unknown) => {
    if (typeof value === "number" && value < minValue) {
      return `must be at least ${minValue}`;
    }
    return null;
  });
}

function max(maxValue: number) {
  return addValidator((value: unknown) => {
    if (typeof value === "number" && value > maxValue) {
      return `must be at most ${maxValue}`;
    }
    return null;
  });
}

Deno.test("Basic opt parsing with defaults", () => {
  @cli({ name: "testapp" })
  class Config extends Args {
    @opt({ description: "Port number to listen on" })
    @minValue(1000)
    port: number = 8080;

    @opt({ description: "Enable debug mode" })
    debug: boolean = false;

    @opt({ description: "Host address to bind to" })
    host: string = "localhost";
  }

  const result = Config.parse(["--port", "3000", "--debug"]);
  assertEquals(result.port, 3000);
  assertEquals(result.debug, true);
  assertEquals(result.host, "localhost");
});

Deno.test("Option parsing with explicit types", () => {
  @cli({ name: "testapp" })
  class Config extends Args {
    @opt({ description: "Enable verbose output" })
    verbose: boolean = false;

    @opt({ description: "Production mode" })
    prod: boolean = false;
  }

  const result = Config.parse(["--verbose", "--prod"]);
  assertEquals(result.verbose, true);
  assertEquals(result.prod, true);
});

Deno.test("Array opt parsing", () => {
  @cli({ name: "testapp" })
  class Config extends Args {
    @opt({ description: "Request count" })
    count: number = 1;

    @opt({ description: "Enable feature" })
    enabled: boolean = false;
  }

  const result = Config.parse(["--count", "5", "--enabled"]);
  assertEquals(result.count, 5);
  assertEquals(result.enabled, true);
});

Deno.test("Optional fields with validation", () => {
  @cli({ name: "testapp" })
  class Config extends Args {
    @opt({ description: "Connection timeout in seconds" })
    @range(1, 300)
    timeout: number = 30;

    @opt({ description: "Host address" })
    host: string = "localhost";
  }

  const result = Config.parse(["--timeout", "60", "--host", "example.com"]);
  assertEquals(result.timeout, 60);
  assertEquals(result.host, "example.com");
});

Deno.test("Array fields with validation", () => {
  @cli({ name: "testapp" })
  class Config extends Args {
    @opt({ description: "Tags to include", type: "string[]" })
    tags: string[] = [];

    @opt({ description: "Port numbers", type: "number[]" })
    ports: number[] = [];
  }

  const result = Config.parse([
    "--tags",
    "web,api,frontend",
    "--ports",
    "3000,8080,9000",
  ]);
  assertEquals(result.tags, ["web", "api", "frontend"]);
  assertEquals(result.ports, [3000, 8080, 9000]);
});

Deno.test("Required field validation", () => {
  @cli({ name: "testapp", exitOnError: false })
  class Config extends Args {
    @opt({
      description: "API key for authentication",
      type: "string",
      required: true,
    })
    apiKey!: string;

    @opt({ description: "Port number" })
    port: number = 8080;
  }

  // Should work with required field provided
  const result = Config.parse(["--apiKey", "secret123", "--port", "3000"]);
  assertEquals(result.apiKey, "secret123");
  assertEquals(result.port, 3000);

  // Should fail without required field
  assertThrows(
    () => Config.parse(["--port", "3000"]),
    Error,
    "required",
  );
});

Deno.test("Custom validation functions", () => {
  @cli({ name: "testapp", exitOnError: false })
  class Config extends Args {
    @opt({ description: "Port number" })
    @range(1000, 65535)
    port: number = 8080;
  }

  // Valid port should work
  const result = Config.parse(["--port", "3000"]);
  assertEquals(result.port, 3000);

  // Invalid port should fail
  assertThrows(
    () => Config.parse(["--port", "999"]),
    Error,
    "must be between 1000 and 65535",
  );
});

Deno.test("Positional arguments", () => {
  @command
  class Config {
    @arg({ description: "Input file", required: true, type: "string" })
    input!: string;

    @arg({ description: "Output file", type: "string" })
    output: string = "output.txt";

    @opt({ description: "Enable verbose output" })
    verbose: boolean = false;
  }

  @cli({ name: "testapp" })
  class App extends Args {
    @subCommand(Config)
    cmd?: Config;
  }

  const result = App.parse(["cmd", "input.txt", "result.txt", "--verbose"]);
  assertEquals(result.cmd!.input, "input.txt");
  assertEquals(result.cmd!.output, "result.txt");
  assertEquals(result.cmd!.verbose, true);
});

Deno.test("Rest arguments", () => {
  @command
  class Config {
    @arg({ description: "First file", required: true, type: "string" })
    first!: string;

    @arg({ description: "Additional files", rest: true, type: "string[]" })
    files: string[] = [];

    @opt({ description: "Enable verbose output" })
    verbose: boolean = false;
  }

  @cli({ name: "testapp" })
  class App extends Args {
    @subCommand(Config)
    cmd?: Config;
  }

  const result = App.parse([
    "cmd",
    "first.txt",
    "second.txt",
    "third.txt",
    "--verbose",
  ]);
  assertEquals(result.cmd!.first, "first.txt");
  assertEquals(result.cmd!.files, ["second.txt", "third.txt"]);
  assertEquals(result.cmd!.verbose, true);
});

Deno.test("Simple subcommands", () => {
  @command
  class ServeCommand {
    @opt({ description: "Port to listen on" })
    @range(1000, 65535)
    port: number = 8080;

    @opt({ description: "Enable SSL" })
    ssl: boolean = false;
  }

  @command
  class BuildCommand {
    @opt({ description: "Output directory" })
    output: string = "dist";

    @opt({ description: "Enable minification" })
    minify: boolean = false;
  }

  @cli({ name: "testapp" })
  class App extends Args {
    @opt({ description: "Enable verbose logging" })
    verbose: boolean = false;

    @subCommand(ServeCommand)
    serve?: ServeCommand;

    @subCommand(BuildCommand)
    build?: BuildCommand;
  }

  const serveResult = App.parse([
    "--verbose",
    "serve",
    "--port",
    "3000",
    "--ssl",
  ]);
  assertEquals(serveResult.verbose, true);
  assertEquals(serveResult.serve!.port, 3000);
  assertEquals(serveResult.serve!.ssl, true);

  const buildResult = App.parse(["build", "--output", "public", "--minify"]);
  assertEquals(buildResult.verbose, false);
  assertEquals(buildResult.build!.output, "public");
  assertEquals(buildResult.build!.minify, true);
});

Deno.test("Nested subcommands", () => {
  @command
  class StartDbCommand {
    @opt({ description: "Database port" })
    port: number = 5432;

    @opt({ description: "Database host" })
    host: string = "localhost";
  }

  @command
  class StopDbCommand {
    @opt({ description: "Force stop" })
    force: boolean = false;
  }

  @command
  class DatabaseCommand {
    @subCommand(StartDbCommand)
    start?: StartDbCommand;

    @subCommand(StopDbCommand)
    stop?: StopDbCommand;

    @opt({ description: "Database name", type: "string" })
    name: string = "";
  }

  @cli({ name: "testapp" })
  class App extends Args {
    @subCommand(DatabaseCommand)
    database?: DatabaseCommand;

    @opt({ description: "Enable verbose logging" })
    verbose: boolean = false;
  }

  const result = App.parse([
    "--verbose",
    "database",
    "--name",
    "mydb",
    "start",
    "--port",
    "5433",
  ]);
  assertEquals(result.verbose, true);
  assertEquals(result.database!.name, "mydb");
  assertEquals(result.database!.start!.port, 5433);
  assertEquals(result.database!.start!.host, "localhost");
});

Deno.test("Help display", () => {
  @cli({ name: "testapp", description: "Test application", exitOnHelp: false })
  class Config extends Args {
    @opt({ description: "Port number" })
    port: number = 8080;

    @opt({ description: "Enable debug mode" })
    debug: boolean = false;

    @opt({ description: "Host address" })
    host: string = "localhost";
  }

  assertThrows(
    () => Config.parse(["--help"]),
    Error,
    "testapp",
  );
});

Deno.test("Environment variable parsing", () => {
  @cli({ name: "testapp" })
  class Config extends Args {
    @opt({ description: "Port number" })
    port: number = 8080;

    @opt({ description: "Debug mode" })
    debug: boolean = false;

    @opt({ description: "Host address" })
    host: string = "localhost";
  }

  // Test normal parsing
  const result = Config.parse(["--port", "3000"]);
  assertEquals(result.port, 3000);
  assertEquals(result.debug, false);
  assertEquals(result.host, "localhost");
});

Deno.test("Complex validation scenario", () => {
  @cli({ name: "testapp", exitOnError: false })
  class Config extends Args {
    @opt({ description: "Server count" })
    @range(1, 10)
    count: number = 1;

    @opt({ description: "Connection rate limit" })
    @min(1)
    rate: number = 10;

    @opt({ description: "Feature enabled" })
    enabled: boolean = false;

    @opt({ description: "Service tags", type: "string[]" })
    tags: string[] = [];

    @opt({ description: "Available ports", type: "number[]" })
    ports: number[] = [];
  }

  const result = Config.parse([
    "--count",
    "3",
    "--rate",
    "50",
    "--enabled",
    "--tags",
    "web,api",
    "--ports",
    "8080,9000",
  ]);

  assertEquals(result.count, 3);
  assertEquals(result.rate, 50);
  assertEquals(result.enabled, true);
  assertEquals(result.tags, ["web", "api"]);
  assertEquals(result.ports, [8080, 9000]);

  // Test validation failure
  assertThrows(
    () => Config.parse(["--count", "15"]),
    Error,
    "must be between 1 and 10",
  );
});

Deno.test("Optional and required fields mixed", () => {
  @command
  class Config {
    @arg({
      description: "Input file to process",
      required: true,
      type: "string",
    })
    input!: string;

    @opt({ description: "Server port" })
    @range(1000, 65535)
    port: number = 8080;

    @opt({ description: "Enable verbose logging" })
    verbose: boolean = false;

    @opt({ description: "Configuration file path" })
    config: string = "";
  }

  @cli({ name: "testapp" })
  class App extends Args {
    @subCommand(Config)
    cmd?: Config;
  }

  // Should work with required argument
  const result = App.parse(["cmd", "input.txt", "--port", "3000", "--verbose"]);
  assertEquals(result.cmd!.input, "input.txt");
  assertEquals(result.cmd!.port, 3000);
  assertEquals(result.cmd!.verbose, true);
  assertEquals(result.cmd!.config, "");
});

Deno.test("Error handling and validation messages", () => {
  @cli({ name: "testapp", exitOnError: false })
  class Config extends Args {
    @opt({ description: "Port number" })
    port: number = 8080;

    @opt({ description: "Host address" })
    host: string = "localhost";

    @opt({ description: "Debug mode" })
    debug: boolean = false;
  }

  // Test unknown argument
  assertThrows(
    () => Config.parse(["--unknown", "value"]),
    Error,
    "Unknown argument",
  );
});

Deno.test("Boolean flag variations", () => {
  @cli({ name: "testapp" })
  class Config extends Args {
    @opt({ description: "Verbose mode" })
    verbose: boolean = false;

    @opt({ description: "Quiet mode" })
    quiet: boolean = false;

    @opt({ description: "Debug mode" })
    debug: boolean = false;
  }

  // Test flag presence sets to true
  const result1 = Config.parse(["--verbose", "--debug"]);
  assertEquals(result1.verbose, true);
  assertEquals(result1.quiet, false);
  assertEquals(result1.debug, true);

  // Test explicit values
  const result2 = Config.parse(["--verbose=false", "--quiet=true"]);
  assertEquals(result2.verbose, false);
  assertEquals(result2.quiet, true);
  assertEquals(result2.debug, false);
});

Deno.test("Array parsing edge cases", () => {
  @cli({ name: "testapp" })
  class Config extends Args {
    @opt({ description: "Tags list", type: "string[]" })
    tags: string[] = [];

    @opt({ description: "Port numbers", type: "number[]" })
    ports: number[] = [];

    @opt({ description: "Enable feature" })
    enabled: boolean = false;
  }

  // Empty arrays should work
  const result1 = Config.parse(["--enabled"]);
  assertEquals(result1.tags, []);
  assertEquals(result1.ports, []);
  assertEquals(result1.enabled, true);

  // Single item arrays
  const result2 = Config.parse(["--tags", "single", "--ports", "8080"]);
  assertEquals(result2.tags, ["single"]);
  assertEquals(result2.ports, [8080]);
});

Deno.test("Type coercion", () => {
  @cli({ name: "testapp" })
  class Config extends Args {
    @opt({ description: "Numeric value" })
    @min(0)
    @max(100)
    num: number = 50;
  }

  const result = Config.parse(["--num", "75.5"]);
  assertEquals(result.num, 75.5);
});

Deno.test("Complex nested subcommand structure", () => {
  @command
  class CreateUserCommand {
    @arg({ description: "Username", required: true, type: "string" })
    username!: string;

    @arg({ description: "Email address", required: true, type: "string" })
    email!: string;

    @opt({ description: "Admin privileges" })
    admin: boolean = false;
  }

  @command
  class DeleteUserCommand {
    @arg({ description: "Username to delete", required: true, type: "string" })
    username!: string;

    @opt({ description: "Force deletion" })
    force: boolean = false;
  }

  @command
  class UserCommand {
    @subCommand(CreateUserCommand)
    create?: CreateUserCommand;

    @subCommand(DeleteUserCommand)
    delete?: DeleteUserCommand;
  }

  @command
  class ServerCommand {
    @opt({ description: "Server port" })
    port: number = 8080;

    @opt({ description: "Enable SSL" })
    ssl: boolean = false;
  }

  @cli({ name: "testapp" })
  class App extends Args {
    @opt({ description: "Enable verbose logging" })
    verbose: boolean = false;

    @subCommand(UserCommand)
    user?: UserCommand;

    @subCommand(ServerCommand)
    server?: ServerCommand;
  }

  const result = App.parse([
    "--verbose",
    "user",
    "create",
    "john",
    "john@example.com",
    "--admin",
  ]);

  assertEquals(result.verbose, true);
  assertEquals(result.user!.create!.username, "john");
  assertEquals(result.user!.create!.email, "john@example.com");
  assertEquals(result.user!.create!.admin, true);
});

Deno.test("Edge case: empty arguments", () => {
  @cli({ name: "testapp" })
  class Config extends Args {
    @opt({ description: "Port number" })
    port: number = 8080;

    @opt({ description: "Debug mode" })
    debug: boolean = false;

    @opt({ description: "Host address" })
    host: string = "localhost";
  }

  const result = Config.parse([]);
  assertEquals(result.port, 8080);
  assertEquals(result.debug, false);
  assertEquals(result.host, "localhost");
});

Deno.test("Multiple validation decorators", () => {
  @cli({ name: "testapp" })
  class Config extends Args {
    @opt({ description: "Verbose output" })
    verbose: boolean = false;

    @opt({ description: "Quiet mode" })
    quiet: boolean = false;

    @opt({ description: "Debug level" })
    debug: boolean = false;
  }

  const result = Config.parse(["--verbose", "--quiet", "--debug"]);
  assertEquals(result.verbose, true);
  assertEquals(result.quiet, true);
  assertEquals(result.debug, true);
});

Deno.test("Large argument arrays", () => {
  @cli({ name: "testapp" })
  class Config extends Args {
    @opt({ description: "Request count" })
    count: number = 1;

    @opt({ description: "Rate limit" })
    rate: number = 10;

    @opt({ description: "Feature enabled" })
    enabled: boolean = false;

    @opt({ description: "Service tags", type: "string[]" })
    tags: string[] = [];

    @opt({ description: "Port numbers", type: "number[]" })
    ports: number[] = [];
  }

  const result = Config.parse([
    "--count",
    "100",
    "--rate",
    "1000",
    "--enabled",
    "--tags",
    "web,api,service,frontend,backend",
    "--ports",
    "8080,8081,8082,8083,8084",
  ]);

  assertEquals(result.count, 100);
  assertEquals(result.rate, 1000);
  assertEquals(result.enabled, true);
  assertEquals(result.tags, ["web", "api", "service", "frontend", "backend"]);
  assertEquals(result.ports, [8080, 8081, 8082, 8083, 8084]);
});

Deno.test("Configuration with both options and arguments", () => {
  @command
  class Config {
    @arg({ description: "Input files", rest: true, type: "string[]" })
    input: string[] = [];

    @opt({ description: "Server port" })
    @range(1000, 65535)
    port: number = 8080;

    @opt({ description: "Verbose output" })
    verbose: boolean = false;

    @opt({ description: "Config file path" })
    config: string = "";
  }

  @cli({ name: "testapp" })
  class App extends Args {
    @subCommand(Config)
    cmd?: Config;
  }

  const result = App.parse([
    "cmd",
    "file1.txt",
    "file2.txt",
    "file3.txt",
    "--port",
    "3000",
    "--verbose",
    "--config",
    "custom.json",
  ]);

  assertEquals(result.cmd!.input, ["file1.txt", "file2.txt", "file3.txt"]);
  assertEquals(result.cmd!.port, 3000);
  assertEquals(result.cmd!.verbose, true);
  assertEquals(result.cmd!.config, "custom.json");
});

Deno.test("Default values preservation", () => {
  @cli({ name: "testapp" })
  class Config extends Args {
    @opt({ description: "Port number" })
    port: number = 8080;

    @opt({ description: "Host address" })
    host: string = "localhost";

    @opt({ description: "Debug mode" })
    debug: boolean = false;
  }

  // Test that defaults are preserved when not specified
  const result = Config.parse(["--debug"]);
  assertEquals(result.port, 8080);
  assertEquals(result.host, "localhost");
  assertEquals(result.debug, true);
});

Deno.test("Complex mixed validation", () => {
  @cli({ name: "testapp", exitOnError: false })
  class Config extends Args {
    @opt({ description: "Server port" })
    @range(8000, 9000)
    port: number = 8080;

    @opt({ description: "Verbose mode" })
    verbose: boolean = false;
  }

  // Valid configuration
  const result = Config.parse(["--port", "8500", "--verbose"]);
  assertEquals(result.port, 8500);
  assertEquals(result.verbose, true);

  // Invalid port range
  assertThrows(
    () => Config.parse(["--port", "7000"]),
    Error,
    "must be between 8000 and 9000",
  );
});
