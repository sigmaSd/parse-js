import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import process from "node:process";
import {
  addValidator,
  command,
  description,
  parse,
  required,
  subCommand,
  type,
} from "jsr:@sigma/parse";

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
