import {
  assertEquals,
  assertInstanceOf,
  assertThrows,
} from "jsr:@std/assert@1";
import {
  addValidator,
  argument,
  command,
  description,
  handleHelpDisplay,
  handleParsingError,
  isParseError,
  parse,
  ParseError,
  required,
  subCommand,
  type,
} from "jsr:@sigma/parse";
import process from "node:process";

Deno.test("Error handling - default behavior (exitOnError: true)", () => {
  // Mock process.exit to capture calls
  let exitCode: number | undefined;
  const originalExit = process.exit;

  process.exit = ((code?: number) => {
    exitCode = code || 0;
    throw new Error(`Process exit called with code ${exitCode}`);
  }) as typeof process.exit;

  try {
    assertThrows(
      () => {
        @parse(["--unknown"], { name: "test" })
        class _Config {
          static port: number = 8080;
        }
      },
      Error,
      "Process exit called with code 1",
    );

    assertEquals(exitCode, 1);
  } finally {
    process.exit = originalExit;
  }
});

Deno.test("Error handling - disable exit behavior (exitOnError: false)", () => {
  assertThrows(
    () => {
      @parse(["--unknown"], {
        name: "test",
        exitOnError: false,
      })
      class _Config {
        static port: number = 8080;
      }
    },
    ParseError,
    "Unknown argument: --unknown",
  );
});

Deno.test("Error handling - custom error handler", () => {
  let capturedError = "";
  let capturedExitCode = 0;

  assertThrows(() => {
    @parse(["--port", "invalid"], {
      name: "test",
      exitOnError: false,
      onError: (error, code) => {
        capturedError = error;
        capturedExitCode = code;
      },
    })
    class _Config {
      static port: number = 8080;
    }
  }, ParseError);

  assertEquals(capturedError, "Invalid number for --port: invalid");
  assertEquals(capturedExitCode, 1);
});

Deno.test("Error handling - validation errors with custom handler", () => {
  function min(minValue: number) {
    return (value: unknown) => {
      if (typeof value === "number" && value < minValue) {
        return `must be at least ${minValue}`;
      }
      return null;
    };
  }

  let errorMessage = "";

  assertThrows(() => {
    @parse(["--port", "5"], {
      name: "test",
      exitOnError: false,
      onError: (error) => {
        errorMessage = error;
      },
    })
    class _Config {
      @addValidator(min(10))
      static port: number = 8080;
    }
  }, ParseError);

  assertEquals(
    errorMessage,
    "Validation error for --port: must be at least 10",
  );
});

Deno.test("Help handling - default behavior (exitOnHelp: true)", () => {
  let exitCode: number | undefined;
  const originalExit = process.exit;

  process.exit = ((code?: number) => {
    exitCode = code || 0;
    throw new Error(`Process exit called with code ${exitCode}`);
  }) as typeof process.exit;

  try {
    assertThrows(
      () => {
        @parse(["--help"], { name: "test" })
        class _Config {
          static port: number = 8080;
        }
      },
      Error,
      "Process exit called with code 0",
    );

    assertEquals(exitCode, 0);
  } finally {
    process.exit = originalExit;
  }
});

Deno.test("Help handling - disable exit behavior (exitOnHelp: false)", () => {
  assertThrows(
    () => {
      @parse(["--help"], {
        name: "test",
        exitOnHelp: false,
      })
      class _Config {
        static port: number = 8080;
      }
    },
    ParseError,
    "Usage:",
  );
});

Deno.test("Help handling - custom help handler", () => {
  let capturedHelpText = "";

  assertThrows(() => {
    @parse(["--help"], {
      name: "testapp",
      description: "A test application",
      exitOnHelp: false,
      onHelp: (helpText) => {
        capturedHelpText = helpText;
      },
    })
    class _Config {
      @description("Port number")
      static port: number = 8080;
    }
  }, ParseError);

  assertEquals(capturedHelpText.includes("testapp"), true);
  assertEquals(capturedHelpText.includes("A test application"), true);
  assertEquals(capturedHelpText.includes("--port"), true);
});

Deno.test("Error handling - subcommand errors respect configuration", () => {
  @command
  class TestCommand {
    @required()
    @type("string")
    static apiKey: string;
  }

  assertThrows(
    () => {
      @parse(["test"], {
        name: "app",
        exitOnError: false,
      })
      class _Config {
        @subCommand(TestCommand)
        static test: TestCommand;
      }
    },
    ParseError,
    "Validation error for --apiKey: is required",
  );
});

Deno.test("Error handling - positional argument errors", () => {
  assertThrows(
    () => {
      @parse(["text"], {
        exitOnError: false,
      })
      class _Config {
        @argument(0, "Number input")
        static input: number = 0;
      }
    },
    ParseError,
    "Invalid number for input: text",
  );
});

Deno.test("ParseError properties and type guard", () => {
  let caughtError: unknown;

  try {
    @parse(["--invalid"], { exitOnError: false })
    class _Config {
      static port: number = 8080;
    }
  } catch (error) {
    caughtError = error;
  }

  assertEquals(isParseError(caughtError), true);

  if (isParseError(caughtError)) {
    assertEquals(caughtError.type, "unknown_argument");
    assertEquals(caughtError.message, "Unknown argument: --invalid");
    assertEquals(caughtError.exitCode, 1);
    assertEquals(caughtError.context?.argumentName, "--invalid");
    assertInstanceOf(caughtError, ParseError);
  }
});

Deno.test("Error handling - different error types", () => {
  const testCases = [
    {
      args: ["--unknown"],
      expectedType: "unknown_argument" as const,
      expectedMessage: "Unknown argument: --unknown",
    },
    {
      args: ["--port"],
      expectedType: "missing_value" as const,
      expectedMessage: "Missing value for argument: --port",
    },
    {
      args: ["--port", "abc"],
      expectedType: "invalid_number" as const,
      expectedMessage: "Invalid number for --port: abc",
    },
  ];

  for (const testCase of testCases) {
    let error: ParseError | undefined;

    try {
      @parse(testCase.args, { exitOnError: false })
      class _Config {
        static port: number = 8080;
      }
    } catch (e) {
      if (isParseError(e)) {
        error = e;
      }
    }

    assertEquals(error?.type, testCase.expectedType);
    assertEquals(error?.message, testCase.expectedMessage);
  }
});

Deno.test("Mixed configuration - help exits, errors throw", () => {
  // Help should still exit when exitOnHelp is true
  let helpExitCode: number | undefined;
  const originalExit = process.exit;

  process.exit = ((code?: number) => {
    helpExitCode = code || 0;
    throw new Error(`Process exit called with code ${helpExitCode}`);
  }) as typeof process.exit;

  try {
    assertThrows(
      () => {
        @parse(["--help"], {
          name: "test",
          exitOnError: false, // Errors should throw
          exitOnHelp: true, // Help should still exit
        })
        class _Config {
          static port: number = 8080;
        }
      },
      Error,
      "Process exit called with code 0",
    );

    assertEquals(helpExitCode, 0);
  } finally {
    process.exit = originalExit;
  }

  // Errors should throw instead of exiting
  assertThrows(
    () => {
      @parse(["--invalid"], {
        name: "test",
        exitOnError: false,
        exitOnHelp: true,
      })
      class _Config {
        static port: number = 8080;
      }
    },
    ParseError,
    "Unknown argument: --invalid",
  );
});

Deno.test("Error handling utilities - direct function calls", () => {
  // Test handleParsingError directly
  assertThrows(
    () => {
      handleParsingError("Test error", { exitOnError: false });
    },
    ParseError,
    "Test error",
  );

  // Test handleHelpDisplay directly
  assertThrows(
    () => {
      handleHelpDisplay("Test help text", { exitOnHelp: false });
    },
    ParseError,
    "Test help text",
  );

  // Test with custom handlers
  let errorCalled = false;
  let helpCalled = false;

  assertThrows(() => {
    handleParsingError("Test error", {
      exitOnError: false,
      onError: () => {
        errorCalled = true;
      },
    });
  }, ParseError);

  assertThrows(() => {
    handleHelpDisplay("Test help", {
      exitOnHelp: false,
      onHelp: () => {
        helpCalled = true;
      },
    });
  }, ParseError);

  assertEquals(errorCalled, true);
  assertEquals(helpCalled, true);
});

Deno.test("Backward compatibility - default behavior unchanged", () => {
  // When no options are provided, should behave exactly as before
  let exitCode: number | undefined;
  const originalExit = process.exit;

  process.exit = ((code?: number) => {
    exitCode = code || 0;
    throw new Error(`Process exit called with code ${exitCode}`);
  }) as typeof process.exit;

  try {
    // Test error exit
    assertThrows(
      () => {
        @parse(["--unknown"])
        class _Config {
          static port: number = 8080;
        }
      },
      Error,
      "Process exit called with code 1",
    );
    assertEquals(exitCode, 1);

    // Reset for help test
    exitCode = undefined;

    // Test help exit
    assertThrows(
      () => {
        @parse(["--help"])
        class _Config {
          static port: number = 8080;
        }
      },
      Error,
      "Process exit called with code 0",
    );
    assertEquals(exitCode, 0);
  } finally {
    process.exit = originalExit;
  }
});

Deno.test("Integration test - full error handling workflow", () => {
  const errors: string[] = [];
  const helpTexts: string[] = [];

  const options = {
    name: "testapp",
    description: "Test application",
    exitOnError: false,
    exitOnHelp: false,
    onError: (error: string) => errors.push(error),
    onHelp: (helpText: string) => helpTexts.push(helpText),
  };

  // Test error handling
  assertThrows(() => {
    @parse(["--invalid"], options)
    class _Config1 {
      static port: number = 8080;
    }
  }, ParseError);

  // Test help handling
  assertThrows(() => {
    @parse(["--help"], options)
    class _Config2 {
      static port: number = 8080;
    }
  }, ParseError);

  assertEquals(errors.length, 1);
  assertEquals(errors[0], "Unknown argument: --invalid");
  assertEquals(helpTexts.length, 1);
  assertEquals(helpTexts[0].includes("testapp"), true);
});
