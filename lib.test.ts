import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import process from "node:process";
import { addValidator, parse, required, type } from "./lib.ts";

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
