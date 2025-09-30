// deno-lint-ignore-file no-import-prefix
import {
  assertEquals,
  assertInstanceOf,
  assertThrows,
} from "jsr:@std/assert@1";
import {
  addValidator,
  Args,
  argument,
  cli,
  command,
  handleHelpDisplay,
  handleParsingError,
  isParseError,
  ParseError,
  required,
  subCommand,
  type,
} from "../src/index.ts";

Deno.test("Error handling - default behavior (exitOnError: true)", () => {
  // Mock Deno.exit to capture calls
  let exitCode: number | undefined;
  const originalExit = Deno.exit;

  Deno.exit = ((code?: number) => {
    exitCode = code || 0;
    throw new Error(`Deno exit called with code ${exitCode}`);
  }) as typeof Deno.exit;

  try {
    @cli({ name: "test" })
    class Config extends Args {
      port: number = 8080;
    }

    assertThrows(
      () => {
        Config.parse(["--unknown"]);
      },
      Error,
      "Deno exit called with code 1",
    );

    assertEquals(exitCode, 1);
  } finally {
    Deno.exit = originalExit;
  }
});

Deno.test("Error handling - disable exit behavior (exitOnError: false)", () => {
  @cli({
    name: "test",
    exitOnError: false,
  })
  class Config extends Args {
    port: number = 8080;
  }

  assertThrows(
    () => {
      Config.parse(["--unknown"]);
    },
    ParseError,
    "Unknown argument: --unknown",
  );
});

Deno.test("Error handling - custom error handler", () => {
  let capturedError = "";
  let capturedExitCode = 0;

  @cli({
    name: "test",
    exitOnError: false,
    onError: (error, code) => {
      capturedError = error;
      capturedExitCode = code;
      // Custom handler chooses not to throw/exit
    },
  })
  class Config extends Args {
    port: number = 8080;
  }

  // With custom handler, no exception should be thrown - handler has control
  Config.parse(["--port", "invalid"]);

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

  @cli({
    name: "test",
    exitOnError: false,
    onError: (error) => {
      errorMessage = error;
      // Custom handler chooses not to throw/exit
    },
  })
  class Config extends Args {
    @addValidator(min(10))
    port: number = 8080;
  }

  // With custom handler, no exception should be thrown - handler has control
  Config.parse(["--port", "5"]);

  assertEquals(
    errorMessage,
    "Validation error for --port: must be at least 10",
  );
});

Deno.test("Help handling - default behavior (exitOnHelp: true)", () => {
  let exitCode: number | undefined;
  const originalExit = Deno.exit;

  Deno.exit = ((code?: number) => {
    exitCode = code || 0;
    throw new Error(`Deno exit called with code ${exitCode}`);
  }) as typeof Deno.exit;

  try {
    @cli({ name: "test" })
    class Config extends Args {
      port: number = 8080;
    }

    assertThrows(
      () => {
        Config.parse(["--help"]);
      },
      Error,
      "Deno exit called with code 0",
    );

    assertEquals(exitCode, 0);
  } finally {
    Deno.exit = originalExit;
  }
});

Deno.test("Help handling - disable exit behavior (exitOnHelp: false)", () => {
  @cli({
    name: "test",
    exitOnHelp: false,
  })
  class Config extends Args {
    port: number = 8080;
  }

  assertThrows(
    () => {
      Config.parse(["--help"]);
    },
    ParseError,
    "Usage:",
  );
});

Deno.test("Help handling - custom help handler", () => {
  let capturedHelp = "";

  @cli({
    name: "test",
    exitOnHelp: false,
    onHelp: (helpText) => {
      capturedHelp = helpText;
      // Custom handler chooses not to throw/exit
    },
  })
  class Config extends Args {
    port: number = 8080;
  }

  // With custom handler, no exception should be thrown - handler has control
  Config.parse(["--help"]);

  assertEquals(capturedHelp.includes("test"), true);
  assertEquals(capturedHelp.includes("--port"), true);
});

Deno.test("Error handling - subcommand errors respect configuration", () => {
  @command
  class TestCommand {
    @required()
    @type("string")
    apiKey: string = "";
  }

  @cli({
    name: "app",
    exitOnError: false,
  })
  class Config extends Args {
    @subCommand(TestCommand)
    test?: TestCommand;
  }

  assertThrows(
    () => {
      Config.parse(["test"]);
    },
    ParseError,
    "Validation error for --apiKey: is required",
  );
});

Deno.test("Error handling - positional argument errors", () => {
  @cli({
    exitOnError: false,
  })
  class Config extends Args {
    @argument({ description: "Number input" })
    @type("number")
    input: number = 0;
  }

  assertThrows(
    () => {
      Config.parse(["text"]);
    },
    ParseError,
    "Invalid number for input: text",
  );
});

Deno.test("ParseError properties and type guard", () => {
  let caughtError: unknown;

  @cli({ exitOnError: false })
  class Config extends Args {
    port: number = 8080;
  }

  try {
    Config.parse(["--invalid"]);
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

    @cli({ exitOnError: false })
    class Config extends Args {
      port: number = 8080;
    }

    try {
      Config.parse(testCase.args);
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
  const originalExit = Deno.exit;

  Deno.exit = ((code?: number) => {
    helpExitCode = code || 0;
    throw new Error(`Deno exit called with code ${helpExitCode}`);
  }) as typeof Deno.exit;

  try {
    @cli({
      name: "test",
      exitOnError: false, // Errors should throw
      exitOnHelp: true, // Help should still exit
    })
    class Config1 extends Args {
      port: number = 8080;
    }

    assertThrows(
      () => {
        Config1.parse(["--help"]);
      },
      Error,
      "Deno exit called with code 0",
    );

    assertEquals(helpExitCode, 0);
  } finally {
    Deno.exit = originalExit;
  }

  // Errors should throw instead of exiting
  @cli({
    name: "test",
    exitOnError: false,
    exitOnHelp: true,
  })
  class Config2 extends Args {
    port: number = 8080;
  }

  assertThrows(
    () => {
      Config2.parse(["--invalid"]);
    },
    ParseError,
    "Unknown argument: --invalid",
  );
});

Deno.test("Error handling utilities - direct function calls", () => {
  // Test handleParsingError directly - should throw when no custom handler
  assertThrows(
    () => {
      handleParsingError("Test error", { exitOnError: false });
    },
    ParseError,
    "Test error",
  );

  // Test handleHelpDisplay directly - should throw when no custom handler
  assertThrows(
    () => {
      handleHelpDisplay("Test help text", { exitOnHelp: false });
    },
    ParseError,
    "Test help text",
  );

  // Test with custom handlers - should NOT throw when custom handlers provided
  let errorCalled = false;
  let helpCalled = false;

  // Custom error handler has control - should not throw
  handleParsingError("Test error", {
    exitOnError: false,
    onError: () => {
      errorCalled = true;
      // Handler chooses not to throw/exit
    },
  });

  // Custom help handler has control - should not throw
  handleHelpDisplay("Test help", {
    exitOnHelp: false,
    onHelp: () => {
      helpCalled = true;
      // Handler chooses not to throw/exit
    },
  });

  assertEquals(errorCalled, true);
  assertEquals(helpCalled, true);
});

Deno.test("Backward compatibility - default behavior unchanged", () => {
  // When no options are provided, should behave exactly as before
  let exitCode: number | undefined;
  const originalExit = Deno.exit;

  Deno.exit = ((code?: number) => {
    exitCode = code || 0;
    throw new Error(`Deno exit called with code ${exitCode}`);
  }) as typeof Deno.exit;

  try {
    @cli({})
    class Config1 extends Args {
      port: number = 8080;
    }

    // Test error exit
    assertThrows(
      () => {
        Config1.parse(["--unknown"]);
      },
      Error,
      "Deno exit called with code 1",
    );
    assertEquals(exitCode, 1);

    // Reset for help test
    exitCode = undefined;

    @cli({})
    class Config2 extends Args {
      port: number = 8080;
    }

    // Test help exit
    assertThrows(
      () => {
        Config2.parse(["--help"]);
      },
      Error,
      "Deno exit called with code 0",
    );
    assertEquals(exitCode, 0);
  } finally {
    Deno.exit = originalExit;
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

  @cli(options)
  class Config1 extends Args {
    port: number = 8080;
  }

  @cli(options)
  class Config2 extends Args {
    port: number = 8080;
  }

  // Test error handling - with custom handler, no exception should be thrown
  Config1.parse(["--invalid"]);

  // Test help handling - with custom handler, no exception should be thrown
  Config2.parse(["--help"]);

  assertEquals(errors.length, 1);
  assertEquals(errors[0], "Unknown argument: --invalid");
  assertEquals(helpTexts.length, 1);
  assertEquals(helpTexts[0].includes("testapp"), true);
});
