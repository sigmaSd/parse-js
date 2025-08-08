import {
  assertEquals,
  assertStringIncludes,
  assertThrows,
} from "jsr:@std/assert@1";
import process from "node:process";
import {
  addValidator,
  argument,
  command,
  description,
  parse,
  required,
  subCommand,
  type,
} from "jsr:@sigma/parse";
import { createColors } from "../src/colors.ts";

// Test helper to capture console output
function captureConsoleOutput(fn: () => void): string {
  const originalLog = console.log;
  const originalError = console.error;
  let output = "";

  console.log = (...args: unknown[]) => {
    output += args.join(" ") + "\n";
  };
  console.error = (...args: unknown[]) => {
    output += args.join(" ") + "\n";
  };

  try {
    fn();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  return output.trim();
}

// Test helper to simulate process.exit
let exitCode: number | null = null;
const originalExit = process.exit;

function mockProcessExit() {
  process.exit = ((code?: number) => {
    exitCode = code || 0;
    throw new Error(`Process exit called with code ${exitCode}`);
  }) as typeof process.exit;
}

function restoreProcessExit() {
  process.exit = originalExit;
  exitCode = null;
}

Deno.test("Basic argument parsing with defaults", () => {
  @parse(["--port", "3000", "--debug"])
  class Config {
    static port: number = 8080;
    static debug: boolean = false;
    static host: string = "localhost";
  }

  assertEquals(Config.port, 3000);
  assertEquals(Config.debug, true);
  assertEquals(Config.host, "localhost");
});

Deno.test("Boolean argument parsing", () => {
  @parse(["--verbose", "--prod=false"])
  class Config {
    static verbose: boolean = false;
    static prod: boolean = true;
  }

  assertEquals(Config.verbose, true);
  assertEquals(Config.prod, false);
});

Deno.test("String and number type inference from defaults", () => {
  @parse(["--count", "42"])
  class Config {
    static count: number = 0;
    static enabled: boolean = false;
  }

  assertEquals(Config.count, 42);
  assertEquals(Config.enabled, false);
});

Deno.test("Explicit type specification with @type decorator", () => {
  @parse(["--timeout", "30", "--host", "example.com"])
  class Config {
    @type("number")
    static timeout: number;

    @type("string")
    static host: string;

    static debug: boolean = false;
  }

  assertEquals(Config.timeout, 30);
  assertEquals(Config.host, "example.com");
  assertEquals(Config.debug, false);
});

Deno.test("Required validation", () => {
  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @parse(["--port", "3000"])
        class _Config {
          static port: number = 8080;

          @type("string")
          @required()
          static host: string;
        }
      } catch (_e) {
        // Expected process.exit call
      }
    });

    assertEquals(exitCode, 1);
    assertEquals(output, "Validation error for --host: is required");
  } finally {
    restoreProcessExit();
  }
});

Deno.test("Custom validator decorators", () => {
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

  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @parse(["--port", "5"])
        class _Config {
          @min(10)
          @max(100)
          static port: number = 80;
        }
      } catch (_e) {
        // Expected process.exit call
      }
    });

    assertEquals(exitCode, 1);
    assertEquals(output, "Validation error for --port: must be at least 10");
  } finally {
    restoreProcessExit();
  }
});

Deno.test("Multiple validators on same property", () => {
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

  @parse(["--port", "50"])
  class Config {
    @min(10)
    @max(100)
    static port: number = 80;
  }

  assertEquals(Config.port, 50);
});

Deno.test("String validation with oneOf", () => {
  function oneOf(choices: string[]) {
    return addValidator((value: unknown) => {
      if (typeof value === "string" && !choices.includes(value)) {
        return `must be one of: ${choices.join(", ")}`;
      }
      return null;
    });
  }

  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @parse(["--env", "staging"])
        class _Config {
          @oneOf(["dev", "prod"])
          static env: string = "dev";
        }
      } catch (_e) {
        // Expected process.exit call
      }
    });

    assertEquals(exitCode, 1);
    assertEquals(
      output,
      "Validation error for --env: must be one of: dev, prod",
    );
  } finally {
    restoreProcessExit();
  }
});

Deno.test("Help message generation", () => {
  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @parse(["--help"])
        class _Config {
          static port: number = 8080;
          static debug: boolean = false;

          @type("string")
          static host: string;
        }
      } catch (_e) {
        // Expected process.exit call
      }
    });

    assertEquals(exitCode, 0);
    assertEquals(output.includes("Usage:"), true);
    assertEquals(output.includes("--port <number>"), true);
    assertEquals(output.includes("--debug"), true);
    assertEquals(output.includes("--host <string>"), true);
  } finally {
    restoreProcessExit();
  }
});

Deno.test("Short help flag", () => {
  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @parse(["-h"])
        class _Config {
          static port: number = 8080;
        }
      } catch (_e) {
        // Expected process.exit call
      }
    });

    assertEquals(exitCode, 0);
    assertEquals(output.includes("Usage:"), true);
  } finally {
    restoreProcessExit();
  }
});

Deno.test("Unknown argument handling", () => {
  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @parse(["--unknown", "value"])
        class _Config {
          static port: number = 8080;
        }
      } catch (_e) {
        // Expected process.exit call
      }
    });

    assertEquals(exitCode, 1);
    assertEquals(output, "Unknown argument: --unknown");
  } finally {
    restoreProcessExit();
  }
});

Deno.test("Missing value for argument", () => {
  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @parse(["--port"])
        class _Config {
          static port: number = 8080;
        }
      } catch (_e) {
        // Expected process.exit call
      }
    });

    assertEquals(exitCode, 1);
    assertEquals(output, "Missing value for argument: --port");
  } finally {
    restoreProcessExit();
  }
});

Deno.test("Invalid number parsing", () => {
  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @parse(["--port", "not-a-number"])
        class _Config {
          static port: number = 8080;
        }
      } catch (_e) {
        // Expected process.exit call
      }
    });

    assertEquals(exitCode, 1);
    assertEquals(output, "Invalid number for --port: not-a-number");
  } finally {
    restoreProcessExit();
  }
});

Deno.test("Property without default or type decorator throws error", () => {
  assertThrows(
    () => {
      @parse([])
      class _Config {
        static port: number; // No default, no @type decorator
      }
    },
    Error,
    "Property 'port' in class '_Config' has no default value and no @type decorator",
  );
});

Deno.test("Equals sign syntax for arguments", () => {
  @parse(["--port=3000", "--host=example.com", "--debug=true"])
  class Config {
    static port: number = 8080;
    static debug: boolean = false;

    @type("string")
    static host: string;
  }

  assertEquals(Config.port, 3000);
  assertEquals(Config.host, "example.com");
  assertEquals(Config.debug, true);
});

Deno.test("Mixed argument styles", () => {
  @parse(["--port=3000", "--debug", "--host", "example.com"])
  class Config {
    static port: number = 8080;
    static debug: boolean = false;

    @type("string")
    static host: string;
  }

  assertEquals(Config.port, 3000);
  assertEquals(Config.debug, true);
  assertEquals(Config.host, "example.com");
});

Deno.test("Validation on default values", () => {
  function min(minValue: number) {
    return addValidator((value: unknown) => {
      if (typeof value === "number" && value < minValue) {
        return `must be at least ${minValue}`;
      }
      return null;
    });
  }

  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @parse([])
        class _Config {
          @min(10)
          static port: number = 5; // Default value fails validation
        }
      } catch (_e) {
        // Expected process.exit call
      }
    });

    assertEquals(exitCode, 1);
    assertEquals(output, "Validation error for --port: must be at least 10");
  } finally {
    restoreProcessExit();
  }
});

Deno.test("Description decorator in help output", () => {
  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @parse(["--help"])
        class _Config {
          @description("The port number to listen on")
          static port: number = 8080;

          @description("Enable verbose logging")
          static debug: boolean = false;

          @type("string")
          @description("API endpoint URL")
          static apiUrl: string;
        }
      } catch (_e) {
        // Expected process.exit call
      }
    });

    assertEquals(exitCode, 0);
    assertEquals(output.includes("The port number to listen on"), true);
    assertEquals(output.includes("Enable verbose logging"), true);
    assertEquals(output.includes("API endpoint URL"), true);
  } finally {
    restoreProcessExit();
  }
});

Deno.test("App name and description in help output", () => {
  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @parse(["--help"], {
          name: "testapp",
          description: "A test CLI application for demonstration",
        })
        class _Config {
          @description("The port number to listen on")
          static port: number = 8080;
        }
      } catch (_e) {
        // Expected process.exit call
      }
    });

    assertEquals(exitCode, 0);
    assertEquals(output.includes("testapp"), true);
    assertEquals(
      output.includes("A test CLI application for demonstration"),
      true,
    );
    assertEquals(output.includes("Usage:\n  testapp [options]"), true);
  } finally {
    restoreProcessExit();
  }
});

Deno.test("Parse without app info (backward compatibility)", () => {
  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @parse(["--help"])
        class _Config {
          static port: number = 8080;
        }
      } catch (_e) {
        // Expected process.exit call
      }
    });

    assertEquals(exitCode, 0);
    assertEquals(
      output.includes("Usage:\n  [runtime] script.js [options]"),
      true,
    );
    assertEquals(output.includes("Options:"), true);
  } finally {
    restoreProcessExit();
  }
});

Deno.test("Array parsing with defaults", () => {
  @parse(["--tags", "web,api,test"])
  class Config {
    static tags: string[] = ["default"];
    static ports: number[] = [8080, 3000];
  }

  assertEquals(Config.tags, ["web", "api", "test"]);
  assertEquals(Config.ports, [8080, 3000]); // unchanged default
});

Deno.test("Array parsing with explicit types", () => {
  @parse(["--files", "a.txt,b.txt", "--ports", "3000,4000,5000"])
  class Config {
    @type("string[]")
    static files: string[];

    @type("number[]")
    static ports: number[];
  }

  assertEquals(Config.files, ["a.txt", "b.txt"]);
  assertEquals(Config.ports, [3000, 4000, 5000]);
});

Deno.test("Empty array parsing", () => {
  @parse(["--items", ""])
  class Config {
    @type("string[]")
    static items: string[];
  }

  assertEquals(Config.items, [""]);
});

Deno.test("Number array parsing with invalid number", () => {
  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @parse(["--ports", "3000,abc,4000"])
        class _Config {
          @type("number[]")
          static ports: number[];
        }
      } catch (_e) {
        // Expected process.exit call
      }
    });

    assertEquals(exitCode, 1);
    assertEquals(output, "Invalid number in array for --ports: abc");
  } finally {
    restoreProcessExit();
  }
});

Deno.test("Array validation with custom validators", () => {
  function minLength(min: number) {
    return addValidator((value: unknown) => {
      if (Array.isArray(value) && value.length < min) {
        return `must have at least ${min} items`;
      }
      return null;
    });
  }

  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @parse(["--items", "a"])
        class _Config {
          @type("string[]")
          @minLength(3)
          static items: string[];
        }
      } catch (_e) {
        // Expected process.exit call
      }
    });

    assertEquals(exitCode, 1);
    assertEquals(
      output,
      "Validation error for --items: must have at least 3 items",
    );
  } finally {
    restoreProcessExit();
  }
});

Deno.test("Array help output formatting", () => {
  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @parse(["--help"])
        class _Config {
          @type("string[]")
          @description("List of input files")
          static files: string[];

          @type("number[]")
          @description("Port numbers to use")
          static ports: number[];
        }
      } catch (_e) {
        // Expected process.exit call
      }
    });

    assertEquals(exitCode, 0);
    assertEquals(output.includes("--files <string,string,...>"), true);
    assertEquals(output.includes("List of input files"), true);
    assertEquals(output.includes("--ports <number,number,...>"), true);
    assertEquals(output.includes("Port numbers to use"), true);
  } finally {
    restoreProcessExit();
  }
});

Deno.test("Mixed array and scalar arguments", () => {
  @parse(["--files", "a.txt,b.txt", "--port", "3000", "--debug"])
  class Config {
    @type("string[]")
    static files: string[];

    static port: number = 8080;
    static debug: boolean = false;
  }

  assertEquals(Config.files, ["a.txt", "b.txt"]);
  assertEquals(Config.port, 3000);
  assertEquals(Config.debug, true);
});

Deno.test("Global options with subcommands", () => {
  @command
  class RunCommand {
    static force: boolean = false;
  }

  @parse(["--debug", "run", "--force"])
  class Config {
    @subCommand(RunCommand)
    static run: RunCommand;

    static debug: boolean = false;
  }

  assertEquals(Config.run instanceof RunCommand, true);
  assertEquals(RunCommand.force, true);
  assertEquals(Config.debug, true);
});

Deno.test("Subcommand help shows command name", () => {
  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @command
        class RunCommand {
          static force: boolean = false;
        }

        @parse(["run", "--help"], { name: "mycli" })
        class _Config {
          @subCommand(RunCommand)
          static run: RunCommand;
        }
      } catch (_e) {
        // Expected process.exit call
      }
    });

    assertEquals(exitCode, 0);
    assertEquals(output.includes("Usage:\n  mycli run [options]"), true);
  } finally {
    restoreProcessExit();
  }
});

Deno.test("Global options in different positions with subcommands", () => {
  @command
  class ServeCommand {
    static port: number = 8080;
  }

  @parse(["--verbose", "--config", "app.json", "serve", "--port", "3000"])
  class Config {
    @subCommand(ServeCommand)
    static serve: ServeCommand;

    static verbose: boolean = false;

    @type("string")
    static config: string;
  }

  assertEquals(Config.serve instanceof ServeCommand, true);
  assertEquals(ServeCommand.port, 3000);
  assertEquals(Config.verbose, true);
  assertEquals(Config.config, "app.json");
});

Deno.test("Basic subcommand parsing", () => {
  @command
  class RunCommand {
    static force: boolean = false;
    static verbose: boolean = false;
  }

  @command
  class ListCommand {
    static color: string = "red";
    static all: boolean = false;
  }

  @parse(["run", "--force", "--verbose"])
  class Config {
    @subCommand(RunCommand)
    static run: RunCommand;

    @subCommand(ListCommand)
    static list: ListCommand;

    static debug: boolean = false;
  }

  assertEquals(Config.run instanceof RunCommand, true);
  assertEquals(Config.list, undefined);
  assertEquals(RunCommand.force, true);
  assertEquals(RunCommand.verbose, true);
  assertEquals(Config.debug, false);
});

Deno.test("Subcommand with different command", () => {
  @command
  class RunCommand {
    static force: boolean = false;
  }

  @command
  class ListCommand {
    static color: string = "red";
    static limit: number = 10;
  }

  @parse(["list", "--color", "blue", "--limit", "20"])
  class Config {
    @subCommand(RunCommand)
    static run: RunCommand;

    @subCommand(ListCommand)
    static list: ListCommand;
  }

  assertEquals(Config.run, undefined);
  assertEquals(Config.list instanceof ListCommand, true);
  assertEquals(ListCommand.color, "blue");
  assertEquals(ListCommand.limit, 20);
});

Deno.test("Subcommand help output", () => {
  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @command
        class RunCommand {
          static force: boolean = false;
        }

        @parse(["--help"])
        class _Config {
          @description("Run the application")
          @subCommand(RunCommand)
          static run: RunCommand;

          static debug: boolean = false;
        }
      } catch (_e) {
        // Expected process.exit call
      }
    });

    assertEquals(exitCode, 0);
    assertEquals(output.includes("Commands:"), true);
    assertEquals(output.includes("run"), true);
    assertEquals(output.includes("Run the application"), true);
    assertEquals(output.includes("Global Options:"), true);
  } finally {
    restoreProcessExit();
  }
});

Deno.test("Subcommand with array types", () => {
  @command
  class BuildCommand {
    @type("string")
    static output: string;

    @type("string[]")
    static sources: string[];

    static minify: boolean = false;
  }

  @parse([
    "build",
    "--output",
    "dist",
    "--sources",
    "main.ts,utils.ts",
    "--minify",
  ])
  class Config {
    @subCommand(BuildCommand)
    static build: BuildCommand;
  }

  assertEquals(Config.build instanceof BuildCommand, true);
  assertEquals(BuildCommand.output, "dist");
  assertEquals(BuildCommand.sources, ["main.ts", "utils.ts"]);
  assertEquals(BuildCommand.minify, true);
});

Deno.test("Subcommand validation", () => {
  function min(minValue: number) {
    return addValidator((value: unknown) => {
      if (typeof value === "number" && value < minValue) {
        return `must be at least ${minValue}`;
      }
      return null;
    });
  }

  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @command
        class TestCommand {
          @min(10)
          static count: number = 5;
        }

        @parse(["test"])
        class _Config {
          @subCommand(TestCommand)
          static test: TestCommand;
        }
      } catch (_e) {
        // Expected process.exit call
      }
    });

    assertEquals(exitCode, 1);
    assertEquals(output, "Validation error for --count: must be at least 10");
  } finally {
    restoreProcessExit();
  }
});

Deno.test("No subcommand selected - regular parsing", () => {
  @command
  class RunCommand {
    static force: boolean = false;
  }

  @parse(["--debug"])
  class Config {
    @subCommand(RunCommand)
    static run: RunCommand;

    static debug: boolean = false;
  }

  assertEquals(Config.run, undefined);
  assertEquals(Config.debug, true);
});

Deno.test("Mixed global and subcommand properties", () => {
  @command
  class ServeCommand {
    static port: number = 8080;
    static host: string = "localhost";
  }

  @parse(["serve", "--port", "3000", "--host", "0.0.0.0"])
  class Config {
    @subCommand(ServeCommand)
    static serve: ServeCommand;

    @description("Global config file")
    @type("string")
    static config: string;

    static verbose: boolean = false;
  }

  assertEquals(Config.serve instanceof ServeCommand, true);
  assertEquals(ServeCommand.port, 3000);
  assertEquals(ServeCommand.host, "0.0.0.0");
  assertEquals(Config.config, undefined);
  assertEquals(Config.verbose, false);
});

Deno.test("Nested subcommands - two levels deep", () => {
  @command
  class StartCommand {
    static port: number = 5432;
    static host: string = "localhost";
  }

  @command
  class StopCommand {
    static force: boolean = false;
  }

  @command
  class DatabaseCommand {
    @subCommand(StartCommand)
    static start: StartCommand;

    @subCommand(StopCommand)
    static stop: StopCommand;

    static timeout: number = 30;
  }

  @parse(["database", "start", "--port", "8080", "--host", "0.0.0.0"])
  class Config {
    @subCommand(DatabaseCommand)
    static database: DatabaseCommand;

    static verbose: boolean = false;
  }

  assertEquals(Config.database instanceof DatabaseCommand, true);
  assertEquals(DatabaseCommand.start instanceof StartCommand, true);
  assertEquals(StartCommand.port, 8080);
  assertEquals(StartCommand.host, "0.0.0.0");
  assertEquals(DatabaseCommand.timeout, 30);
  assertEquals(Config.verbose, false);
});

Deno.test("Nested subcommands - global options with nested commands", () => {
  @command
  class RestartCommand {
    static graceful: boolean = false;
  }

  @command
  class ServiceCommand {
    @subCommand(RestartCommand)
    static restart: RestartCommand;

    static serviceName = "default";
  }

  @parse([
    "--verbose",
    "service",
    "--serviceName",
    "web",
    "restart",
    "--graceful",
  ])
  class Config {
    @subCommand(ServiceCommand)
    static service: ServiceCommand;

    static verbose: boolean = false;
  }

  assertEquals(Config.verbose, true);
  assertEquals(Config.service instanceof ServiceCommand, true);
  assertEquals(ServiceCommand.serviceName, "web");
  assertEquals(ServiceCommand.restart instanceof RestartCommand, true);
  assertEquals(RestartCommand.graceful, true);
});

Deno.test("parseArguments handles flags after rest arguments", () => {
  function oneOf(choices: string[]) {
    return addValidator((value: unknown) => {
      if (typeof value === "string" && !choices.includes(value)) {
        return `must be one of: ${choices.join(", ")}, got ${value}`;
      }
      return null;
    });
  }

  @command
  class ProcessCommand {
    @argument(0, "Input file")
    @required()
    @type("string")
    static input: string;

    @argument(1, "Output file")
    static output: string = "output.txt";

    @argument(2, "Additional files", { rest: true })
    @type("string[]")
    static files: string[] = [];

    @description("Output format")
    @oneOf(["json", "xml", "csv"])
    static format: string = "json";

    @description("Enable verbose output")
    static verbose: boolean = false;
  }

  @parse([
    "process",
    "input.txt",
    "result.txt",
    "file1.txt",
    "file2.txt",
    "--format",
    "xml",
    "--verbose",
  ], {
    name: "test",
  })
  class Config {
    @subCommand(ProcessCommand)
    static process: ProcessCommand;

    static globalFlag: boolean = false;
  }

  // Test that positional arguments are parsed correctly
  assertEquals(ProcessCommand.input, "input.txt");
  assertEquals(ProcessCommand.output, "result.txt");
  assertEquals(ProcessCommand.files, ["file1.txt", "file2.txt"]);

  // Test that flags after rest arguments are parsed correctly
  assertEquals(ProcessCommand.format, "xml");
  assertEquals(ProcessCommand.verbose, true);

  // Test that global flags are not affected
  assertEquals(Config.globalFlag, false);
});

Deno.test("parseArguments handles mixed flags and rest arguments", () => {
  @command
  class TestCommand {
    @argument(0, "First arg")
    @type("string")
    static first: string;

    @argument(1, "Rest args", { rest: true })
    @type("string[]")
    static rest: string[] = [];

    static flag1: string = "default1";
    static flag2: boolean = false;
    static flag3: number = 42;
  }

  @parse([
    "test",
    "value1",
    "rest1",
    "rest2",
    "rest3",
    "--flag1",
    "changed",
    "--flag2",
    "--flag3",
    "100",
  ], {
    name: "test",
  })
  class _Config {
    @subCommand(TestCommand)
    static test: TestCommand;
  }

  // Test positional arguments
  assertEquals(TestCommand.first, "value1");
  assertEquals(TestCommand.rest, ["rest1", "rest2", "rest3"]);

  // Test flags after rest arguments
  assertEquals(TestCommand.flag1, "changed");
  assertEquals(TestCommand.flag2, true);
  assertEquals(TestCommand.flag3, 100);
});

Deno.test("parseArguments handles flags validation after rest arguments", () => {
  function oneOf(choices: string[]) {
    return addValidator((value: unknown) => {
      if (typeof value === "string" && !choices.includes(value)) {
        return `must be one of: ${choices.join(", ")}, got ${value}`;
      }
      return null;
    });
  }

  @command
  class ValidatedCommand {
    @argument(0, "Input")
    @type("string")
    static input: string;

    @argument(1, "Files", { rest: true })
    @type("string[]")
    static files: string[] = [];

    @oneOf(["json", "xml", "csv"])
    static format: string = "json";
  }

  // Test valid format
  @parse(["cmd", "input.txt", "file1.txt", "file2.txt", "--format", "xml"], {
    name: "test",
  })
  class _ValidConfig {
    @subCommand(ValidatedCommand)
    static cmd: ValidatedCommand;
  }

  assertEquals(ValidatedCommand.format, "xml");

  // Test invalid format should throw
  mockProcessExit();

  assertThrows(() => {
    @parse([
      "cmd",
      "input.txt",
      "file1.txt",
      "file2.txt",
      "--format",
      "invalid",
    ], {
      name: "test",
    })
    class _InvalidConfig {
      @subCommand(ValidatedCommand)
      static cmd: ValidatedCommand;
    }
  });

  restoreProcessExit();
});

Deno.test("-- separator stops flag parsing", () => {
  @command
  class RunCommand {
    @argument(0, "Binary to run")
    @required()
    @type("string")
    static binary: string;

    @argument(1, "Arguments to pass", { rest: true })
    @type("string[]")
    static args: string[] = [];

    @description("Enable verbose output")
    static verbose: boolean = false;
  }

  @parse([
    "run",
    "gleam",
    "--",
    "--version",
    "--help",
    "-v",
  ], {
    name: "test",
  })
  class Config {
    @subCommand(RunCommand)
    static run: RunCommand;

    static globalVerbose: boolean = false;
  }

  // Test that positional arguments are parsed correctly
  assertEquals(RunCommand.binary, "gleam");
  assertEquals(RunCommand.args, ["--version", "--help", "-v"]);

  // Test that flags after -- are not parsed as flags
  assertEquals(RunCommand.verbose, false);
  assertEquals(Config.globalVerbose, false);
});

Deno.test("-- separator with mixed arguments", () => {
  @command
  class ExecCommand {
    @argument(0, "Command")
    @type("string")
    static command: string;

    @argument(1, "Args", { rest: true })
    @type("string[]")
    static args: string[] = [];

    static debug: boolean = false;
  }

  @parse([
    "exec",
    "--debug",
    "node",
    "--",
    "--version",
    "--trace-warnings",
  ], {
    name: "test",
  })
  class _Config {
    @subCommand(ExecCommand)
    static exec: ExecCommand;
  }

  // Test that flags before -- are parsed
  assertEquals(ExecCommand.debug, true);
  assertEquals(ExecCommand.command, "node");

  // Test that flags after -- are treated as arguments
  assertEquals(ExecCommand.args, ["--version", "--trace-warnings"]);
});

Deno.test("Nested subcommands - three levels deep", () => {
  @command
  class CreateCommand {
    static tableName = "default";
  }

  @command
  class TableCommand {
    @subCommand(CreateCommand)
    static create: CreateCommand;

    static schema: string = "public";
  }

  @command
  class DatabaseCommand {
    @subCommand(TableCommand)
    static table: TableCommand;

    static connection: string = "local";
  }

  @parse([
    "database",
    "--connection",
    "remote",
    "table",
    "--schema",
    "admin",
    "create",
    "--tableName",
    "users",
  ])
  class Config {
    @subCommand(DatabaseCommand)
    static database: DatabaseCommand;

    static debug: boolean = false;
  }

  assertEquals(Config.database instanceof DatabaseCommand, true);
  assertEquals(DatabaseCommand.connection, "remote");
  assertEquals(DatabaseCommand.table instanceof TableCommand, true);
  assertEquals(TableCommand.schema, "admin");
  assertEquals(TableCommand.create instanceof CreateCommand, true);
  assertEquals(CreateCommand.tableName, "users");
  assertEquals(Config.debug, false);
});

Deno.test("Nested subcommands - help shows proper command path", () => {
  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @command
        class StartCommand {
          static port: number = 5432;
        }

        @command
        class DatabaseCommand {
          @description("Start the database")
          @subCommand(StartCommand)
          static start: StartCommand;
        }

        @parse(["database", "start", "--help"])
        class _Config {
          @description("Database operations")
          @subCommand(DatabaseCommand)
          static database: DatabaseCommand;
        }
      } catch (_error) {
        // Expected - help exits
      }
    });

    assertStringIncludes(output, "database start [options]");
    assertStringIncludes(output, "Options:");
    assertStringIncludes(output, "--port");
  } finally {
    restoreProcessExit();
  }
});

Deno.test("Nested subcommands - help shows nested commands", () => {
  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @command
        class StartCommand {
          static port: number = 5432;
        }

        @command
        class StopCommand {
          static force: boolean = false;
        }

        @command
        class DatabaseCommand {
          @description("Start the database")
          @subCommand(StartCommand)
          static start: StartCommand;

          @description("Stop the database")
          @subCommand(StopCommand)
          static stop: StopCommand;
        }

        @parse(["database", "--help"])
        class _Config {
          @description("Database operations")
          @subCommand(DatabaseCommand)
          static database: DatabaseCommand;
        }
      } catch (_error) {
        // Expected - help exits
      }
    });

    assertStringIncludes(output, "database <command> [options]");
    assertStringIncludes(output, "Commands:");
    assertStringIncludes(output, "start");
    assertStringIncludes(output, "Start the database");
    assertStringIncludes(output, "stop");
    assertStringIncludes(output, "Stop the database");
  } finally {
    restoreProcessExit();
  }
});

Deno.test("Nested subcommands - different command paths", () => {
  @command
  class BuildCommand {
    static output: string = "dist";
  }

  @command
  class TestCommand {
    static coverage: boolean = false;
  }

  @command
  class ProjectCommand {
    @subCommand(BuildCommand)
    static build: BuildCommand;

    @subCommand(TestCommand)
    static test: TestCommand;
  }

  // Test first path
  @parse(["project", "build", "--output", "build"])
  class Config1 {
    @subCommand(ProjectCommand)
    static project: ProjectCommand;
  }

  assertEquals(Config1.project instanceof ProjectCommand, true);
  assertEquals(ProjectCommand.build instanceof BuildCommand, true);
  assertEquals(BuildCommand.output, "build");

  // Test second path
  @parse(["project", "test", "--coverage"])
  class Config2 {
    @subCommand(ProjectCommand)
    static project: ProjectCommand;
  }

  assertEquals(Config2.project instanceof ProjectCommand, true);
  assertEquals(ProjectCommand.test instanceof TestCommand, true);
  assertEquals(TestCommand.coverage, true);
});

Deno.test("Reserved property names - user-defined length and name properties", () => {
  // Test that user-defined static properties named 'length' and 'name' work correctly
  // These should be distinguished from built-in class properties
  @parse(["--length", "100", "--name", "custom-app"])
  class Config {
    // User-defined 'length' property - should override built-in class length
    static length: number = 50;

    // User-defined 'name' property - should override built-in class name
    static name: string = "default-name";

    static debug: boolean = false;
  }

  assertEquals(Config.length, 100);
  assertEquals(Config.name, "custom-app");
  assertEquals(Config.debug, false);
});

Deno.test("Reserved property names - with descriptions and validation", () => {
  function min(minValue: number) {
    return addValidator((value: unknown) => {
      if (typeof value === "number" && value < minValue) {
        return `must be at least ${minValue}`;
      }
      return null;
    });
  }

  @parse(["--length", "25", "--name", "test-service"])
  class Config {
    @description("Maximum length allowed")
    @min(10)
    static length: number = 20;

    @description("Service name identifier")
    @required()
    static name: string = "default";
  }

  assertEquals(Config.length, 25);
  assertEquals(Config.name, "test-service");
});

Deno.test("Reserved property names - help output includes user-defined properties", () => {
  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @parse(["--help"])
        class _Config {
          @description("Array length limit")
          static length: number = 10;

          @description("Application name")
          static name: string = "myapp";

          static debug: boolean = false;
        }
      } catch (_e) {
        // Expected process.exit call
      }
    });

    assertEquals(exitCode, 0);
    assertEquals(output.includes("--length <number>"), true);
    assertEquals(output.includes("Array length limit"), true);
    assertEquals(output.includes("--name <string>"), true);
    assertEquals(output.includes("Application name"), true);
  } finally {
    restoreProcessExit();
  }
});

Deno.test("Reserved property names - subcommands with user-defined properties", () => {
  @command
  class TestCommand {
    @description("Command execution length")
    static length: number = 30;

    @description("Command name override")
    static name: string = "cmd";
  }

  @parse(["test", "--length", "60", "--name", "custom-cmd"])
  class Config {
    @subCommand(TestCommand)
    static test: TestCommand;
  }

  assertEquals(Config.test instanceof TestCommand, true);
  assertEquals(TestCommand.length, 60);
  assertEquals(TestCommand.name, "custom-cmd");
});

Deno.test("Reserved property names - prototype property restriction", () => {
  // Test that JavaScript prevents defining static properties named 'prototype'
  // This should fail at the language level, not the library level
  assertThrows(
    () => {
      // This will fail during class definition, not during parsing
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

Deno.test("Reserved property names - built-in vs user-defined detection", () => {
  // Test that the library correctly distinguishes between built-in and user-defined properties
  class TestClass {
    static length = 42; // User-defined
    static name = "custom"; // User-defined
  }

  // Built-in properties have different descriptor characteristics
  const builtInLength = Object.getOwnPropertyDescriptor(class {}, "length");
  const userDefinedLength = Object.getOwnPropertyDescriptor(
    TestClass,
    "length",
  );

  // Built-in: writable: false, enumerable: false
  assertEquals(builtInLength?.writable, false);
  assertEquals(builtInLength?.enumerable, false);

  // User-defined: writable: true, enumerable: true
  assertEquals(userDefinedLength?.writable, true);
  assertEquals(userDefinedLength?.enumerable, true);
});

Deno.test("Positional arguments - basic usage", () => {
  @parse(["source.txt", "dest.txt"])
  class Config {
    @argument(0, "Source file path")
    @required()
    @type("string")
    static source: string;

    @argument(1, "Destination file path")
    static dest: string = "output.txt";

    static verbose: boolean = false;
  }

  assertEquals(Config.source, "source.txt");
  assertEquals(Config.dest, "dest.txt");
  assertEquals(Config.verbose, false);
});

Deno.test("Positional arguments - with options", () => {
  @parse(["input.txt", "output.txt", "--verbose"])
  class Config {
    @argument(0, "Input file")
    @type("string")
    static input: string;

    @argument(1, "Output file")
    static output: string = "default.txt";

    static verbose: boolean = false;
  }

  assertEquals(Config.input, "input.txt");
  assertEquals(Config.output, "output.txt");
  assertEquals(Config.verbose, true);
});

Deno.test("Positional arguments - mixed with options", () => {
  @parse(["--debug", "source.txt", "--force", "dest.txt"])
  class Config {
    @argument(0, "Source file")
    @type("string")
    static source: string;

    @argument(1, "Destination file")
    @type("string")
    static dest: string;

    static debug: boolean = false;
    static force: boolean = false;
  }

  assertEquals(Config.source, "source.txt");
  assertEquals(Config.dest, "dest.txt");
  assertEquals(Config.debug, true);
  assertEquals(Config.force, true);
});

Deno.test("Positional arguments - rest arguments", () => {
  @parse(["first.txt", "second.txt", "third.txt", "fourth.txt"])
  class Config {
    @argument(0, "First file")
    @type("string")
    static first: string;

    @argument(1, "Additional files", { rest: true })
    @type("string[]")
    static files: string[];
  }

  assertEquals(Config.first, "first.txt");
  assertEquals(Config.files, ["second.txt", "third.txt", "fourth.txt"]);
});

Deno.test("Positional arguments - with default values", () => {
  @parse(["input.txt"])
  class Config {
    @argument(0, "Input file")
    @type("string")
    static input: string;

    @argument(1, "Output file")
    static output: string = "default_output.txt";

    @argument(2, "Additional files", { rest: true })
    @type("string[]")
    static files: string[] = [];
  }

  assertEquals(Config.input, "input.txt");
  assertEquals(Config.output, "default_output.txt");
  assertEquals(Config.files, []);
});

Deno.test("Positional arguments - number types", () => {
  @parse(["42", "3.14"])
  class Config {
    @argument(0, "Integer value")
    static count: number = 0;

    @argument(1, "Float value")
    static ratio: number = 1.0;
  }

  assertEquals(Config.count, 42);
  assertEquals(Config.ratio, 3.14);
});

Deno.test("Positional arguments - with validation", () => {
  function min(minValue: number) {
    return addValidator((value: unknown) => {
      if (typeof value === "number" && value < minValue) {
        return `must be at least ${minValue}`;
      }
      return null;
    });
  }

  @parse(["5"])
  class Config {
    @argument(0, "Count value")
    @min(1)
    static count: number = 0;
  }

  assertEquals(Config.count, 5);
});

Deno.test("Positional arguments - sequential position validation error", () => {
  assertThrows(
    () => {
      @parse(["test"])
      class _Config {
        @argument(0, "First")
        @type("string")
        static first: string;

        @argument(2, "Third") // Error: should be position 1
        @type("string")
        static third: string;
      }
    },
    Error,
    "Argument positions must be sequential starting from 0",
  );
});

Deno.test("Positional arguments - rest argument not last error", () => {
  assertThrows(
    () => {
      @parse(["test"])
      class _Config {
        @argument(0, "Files", { rest: true })
        @type("string[]")
        static files: string[];

        @argument(1, "Output") // Error: rest must be last
        @type("string")
        static output: string;
      }
    },
    Error,
    "Only the last argument can be marked as rest",
  );
});

Deno.test("Positional arguments - with subcommands", () => {
  @command
  class RunCommand {
    @argument(0, "Script path")
    @type("string")
    static script: string;

    static verbose: boolean = false;
  }

  @parse(["run", "test.js", "--verbose"])
  class Config {
    @subCommand(RunCommand)
    static run: RunCommand;

    static debug: boolean = false;
  }

  assertEquals(Config.run instanceof RunCommand, true);
  assertEquals(RunCommand.script, "test.js");
  assertEquals(RunCommand.verbose, true);
  assertEquals(Config.debug, false);
});

Deno.test("Color support - help output with colors enabled", () => {
  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @parse(["--help"], {
          name: "colortest",
          description: "A test app with colors",
          color: true,
        })
        class _Config {
          @description("Port number")
          static port: number = 8080;

          @description("Enable debug mode")
          static debug: boolean = false;
        }
      } catch (_e) {
        // Expected process.exit call
      }
    });

    assertEquals(exitCode, 0);
    // Test that basic help content is present
    assertEquals(output.includes("colortest"), true);
    assertEquals(output.includes("Usage:"), true);
    assertEquals(output.includes("--port"), true);
    assertEquals(output.includes("Port number"), true);
    assertEquals(output.includes("Enable debug mode"), true);
  } finally {
    restoreProcessExit();
  }
});

Deno.test("Color support - disabled when color option is false", () => {
  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @parse(["--help"], {
          name: "nocolor",
          description: "Test color disabled",
          color: false,
        })
        class _NoColorTest {
          static port: number = 8080;
        }
      } catch (_e) {
        // Expected process.exit call
      }
    });

    assertEquals(exitCode, 0);
    // Colors should NOT be present in output when color=false
    assertEquals(output.includes("\x1b["), false);
    assertEquals(output.includes("nocolor"), true);
  } finally {
    restoreProcessExit();
  }
});

Deno.test("Show defaults - help output includes default values", () => {
  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @parse(["--help"], {
          name: "defaults-test",
          showDefaults: true,
        })
        class _Config {
          @description("Server port")
          static port: number = 8080;

          @description("Host address")
          static host: string = "localhost";

          @description("Debug mode")
          static debug: boolean = false;

          @argument(0, "Input file")
          static input: string = "input.txt";
        }
      } catch (_e) {
        // Expected process.exit call
      }
    });

    assertEquals(exitCode, 0);
    assertEquals(output.includes("(default: 8080)"), true);
    assertEquals(output.includes('(default: "localhost")'), true);
    assertEquals(output.includes("(default: false)"), true);
    assertEquals(output.includes('(default: "input.txt")'), true);
  } finally {
    restoreProcessExit();
  }
});

Deno.test("Show defaults - disabled when showDefaults is false", () => {
  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @parse(["--help"], {
          name: "no-defaults-test",
          showDefaults: false,
        })
        class _Config {
          @description("Server port")
          static port: number = 8080;

          @description("Host address")
          static host: string = "localhost";
        }
      } catch (_e) {
        // Expected process.exit call
      }
    });

    assertEquals(exitCode, 0);
    assertEquals(output.includes("(default: 8080)"), false);
    assertEquals(output.includes('(default: "localhost")'), false);
  } finally {
    restoreProcessExit();
  }
});

Deno.test("Default command - help as default", () => {
  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @parse([], {
          name: "help-default",
          description: "App with help as default",
          defaultCommand: "help",
        })
        class _Config {
          static port: number = 8080;
          static debug: boolean = false;
        }
      } catch (_e) {
        // Expected process.exit call
      }
    });

    assertEquals(exitCode, 0);
    assertEquals(output.includes("help-default"), true);
    assertEquals(output.includes("Usage:"), true);
    assertEquals(output.includes("--port"), true);
  } finally {
    restoreProcessExit();
  }
});

Deno.test("Default command - specific subcommand as default", () => {
  @command
  class ServeCommand {
    static port: number = 3000;
    static host: string = "localhost";
  }

  @parse([], {
    name: "serve-default",
    defaultCommand: "serve",
  })
  class Config {
    @subCommand(ServeCommand)
    static serve: ServeCommand;

    static debug: boolean = false;
  }

  // Default command should be executed
  assertEquals(Config.serve instanceof ServeCommand, true);
  assertEquals(ServeCommand.port, 3000);
  assertEquals(ServeCommand.host, "localhost");
  assertEquals(Config.debug, false);
});

Deno.test("Default command - invalid default command is ignored", () => {
  @command
  class TestCommand {
    static value: string = "test";
  }

  @parse([], {
    name: "invalid-default",
    defaultCommand: "nonexistent", // This command doesn't exist
  })
  class Config {
    @subCommand(TestCommand)
    static test: TestCommand;

    static flag: boolean = false;
  }

  // Should work normally when default command doesn't exist
  assertEquals(Config.test, undefined);
  assertEquals(Config.flag, false);
});

Deno.test("Combined features - colors, defaults, and default command", () => {
  @command
  class BuildCommand {
    @description("Output directory")
    static output: string = "dist";

    @description("Enable minification")
    static minify: boolean = false;
  }

  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @parse([], {
          name: "combined-test",
          description: "Testing all features together",
          color: true,
          showDefaults: true,
          defaultCommand: "help",
        })
        class _Config {
          @subCommand(BuildCommand)
          static build: BuildCommand;

          @description("Global verbose flag")
          static verbose: boolean = false;
        }
      } catch (_e) {
        // Expected process.exit call
      }
    });

    assertEquals(exitCode, 0);
    // Should show colored help with defaults
    assertEquals(output.includes("combined-test"), true);
    assertEquals(output.includes("Usage:"), true);
    assertEquals(output.includes("Commands:"), true);
    assertEquals(output.includes("build"), true);
    assertEquals(output.includes("(default: false)"), true);
  } finally {
    restoreProcessExit();
  }
});

Deno.test("Array defaults in help output", () => {
  mockProcessExit();

  try {
    const output = captureConsoleOutput(() => {
      try {
        @parse(["--help"], {
          showDefaults: true,
        })
        class _Config {
          @description("List of tags")
          static tags: string[] = ["web", "api"];

          @description("Port numbers")
          static ports: number[] = [8080, 3000];

          @description("Empty array")
          static empty: string[] = [];
        }
      } catch (_e) {
        // Expected process.exit call
      }
    });

    assertEquals(exitCode, 0);
    assertEquals(output.includes('(default: ["web","api"])'), true);
    assertEquals(output.includes("(default: [8080,3000])"), true);
    assertEquals(output.includes("(default: [])"), true);
  } finally {
    restoreProcessExit();
  }
});

Deno.test("Color utility functions - direct testing", () => {
  // Test colors when explicitly enabled (ignoring TTY for direct testing)
  const colors = createColors();

  // Test that color functions exist and return strings
  const redText = colors.red("test");
  const boldText = colors.bold("test");
  const blueText = colors.blue("test");

  assertEquals(typeof redText, "string");
  assertEquals(typeof boldText, "string");
  assertEquals(typeof blueText, "string");

  // Test that text content is preserved
  assertEquals(redText.includes("test"), true);
  assertEquals(boldText.includes("test"), true);
  assertEquals(blueText.includes("test"), true);

  // Test that isEnabled is a boolean
  assertEquals(typeof colors.isEnabled, "boolean");
});
