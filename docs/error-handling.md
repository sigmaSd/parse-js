# Configurable Error Handling

The CLI parsing library now supports configurable error handling, allowing you
to control whether the library exits the process or handles errors gracefully
through exceptions and callbacks.

## Overview

By default, the library maintains backward compatibility:

- **Parsing errors**: Print error message and call `process.exit(1)`
- **Help requests**: Print help text and call `process.exit(0)`

With the new configuration options, you can:

- Prevent automatic process exits
- Handle errors through exceptions or custom callbacks
- Integrate better with servers, tests, and larger applications

## Configuration Options

Add these options to your `ParseOptions`:

```ts
interface ParseOptions {
  // ... existing options

  /** Whether to call process.exit() on parsing errors (default: true) */
  exitOnError?: boolean;

  /** Whether to call process.exit() when help is shown (default: true) */
  exitOnHelp?: boolean;

  /** Custom error handler called instead of process.exit() when exitOnError is false */
  onError?: (error: string, exitCode: number) => void;

  /** Custom help handler called instead of process.exit() when exitOnHelp is false */
  onHelp?: (helpText: string) => void;
}
```

## Basic Usage

### Throw Errors Instead of Exiting

```ts
try {
  @parse(["--port", "invalid"], {
    name: "myapp",
    exitOnError: false, // Don't exit on errors
    exitOnHelp: false, // Don't exit on help
  })
  class Config {
    static port: number = 8080;
  }
} catch (error) {
  if (isParseError(error)) {
    console.log(`Parse error: ${error.message}`);
    console.log(`Error type: ${error.type}`);
    console.log(`Exit code: ${error.exitCode}`);
  }
}
```

### Custom Error Handler

```ts
@parse(args, {
  name: "myapp",
  exitOnError: false,
  onError: (error, exitCode) => {
    console.error(`❌ CLI Error: ${error}`);
    // Log to monitoring system
    logger.error({ error, exitCode, timestamp: new Date() });
  },
})
class Config {
  static port: number = 8080;
}
```

### Custom Help Handler

```ts
@parse(args, {
  name: "myapp",
  exitOnHelp: false,
  onHelp: (helpText) => {
    // Display help in a custom format
    console.log("=== Custom Help ===");
    console.log(helpText);
    console.log("Visit: https://myapp.com/docs");
  },
})
class Config {
  static port: number = 8080;
}
```

## Error Types and Context

The `ParseError` class provides detailed information about what went wrong:

```ts
export class ParseError extends Error {
  constructor(
    public readonly type: ParseErrorType,
    public readonly message: string,
    public readonly exitCode: number = 1,
    public readonly context?: {
      argumentName?: string;
      value?: string;
      validationMessage?: string;
    },
  );
}

export type ParseErrorType =
  | "unknown_argument"
  | "missing_value"
  | "invalid_number"
  | "invalid_array_number"
  | "validation_error"
  | "missing_required_argument"
  | "missing_type_information";
```

### Type Guard

Use the `isParseError()` type guard to safely handle errors:

```ts
try {
  // ... parsing code
} catch (error) {
  if (isParseError(error)) {
    switch (error.type) {
      case "unknown_argument":
        console.log(`Unknown flag: ${error.context?.argumentName}`);
        break;
      case "validation_error":
        console.log(`Validation failed: ${error.context?.validationMessage}`);
        break;
      default:
        console.log(`Parse error: ${error.message}`);
    }
  } else {
    console.log(`Unexpected error: ${error}`);
  }
}
```

## Use Cases

### Server Applications

Servers shouldn't crash when receiving invalid CLI commands:

```ts
class WebServer {
  async handleCLICommand(args: string[]) {
    try {
      @parse(args, {
        name: "server-cli",
        exitOnError: false,
        onError: (error) => {
          this.logger.warn(`Invalid CLI command: ${error}`);
        },
      })
      class Command {
        static action: string = "status";
        static port: number = 3000;
      }

      // Process valid command
      await this.executeCommand(Command);
    } catch (error) {
      // Server continues running
      this.logger.error("Command processing failed", error);
    }
  }
}
```

### Testing Frameworks

Test argument parsing without process exits:

```ts
Deno.test("CLI parsing validation", () => {
  // Test valid arguments
  @parse(["--port", "3000"], { exitOnError: false })
  class ValidConfig {
    static port: number = 8080;
  }
  assertEquals(ValidConfig.port, 3000);

  // Test invalid arguments
  assertThrows(
    () => {
      @parse(["--port", "invalid"], { exitOnError: false })
      class InvalidConfig {
        static port: number = 8080;
      }
    },
    ParseError,
    "Invalid number",
  );
});
```

### Configuration Management

Graceful fallbacks when configuration is invalid:

```ts
function loadConfig(args: string[]) {
  try {
    @parse(args, {
      exitOnError: false,
      onError: (error) => {
        console.warn(`Config error: ${error}, using defaults`);
      },
    })
    class Config {
      @required()
      static apiKey: string;
      static port: number = 3000;
    }

    return { apiKey: Config.apiKey, port: Config.port };
  } catch (error) {
    // Return safe defaults
    return { apiKey: process.env.API_KEY || "", port: 3000 };
  }
}
```

### Custom Help Systems

Integrate with custom documentation systems:

```ts
@parse(args, {
  exitOnHelp: false,
  onHelp: (helpText) => {
    // Send to custom help system
    await documentationSystem.displayInteractiveHelp(helpText);
  },
})
class Config {
  static command: string = "help";
}
```

## Migration Guide

The new error handling is fully backward compatible. Existing code continues to
work unchanged.

To migrate to graceful error handling:

1. **Add `exitOnError: false`** to prevent process exits on errors
2. **Add `exitOnHelp: false`** to prevent process exits on help
3. **Wrap parsing in try-catch** to handle `ParseError` exceptions
4. **Optionally add custom handlers** with `onError` and `onHelp`

### Before (exits process):

```ts
@parse(args)
class Config {
  static port: number = 8080;
}
// Process exits on error
```

### After (throws exceptions):

```ts
try {
  @parse(args, { exitOnError: false })
  class Config {
    static port: number = 8080;
  }
  // Use Config.port
} catch (error) {
  if (isParseError(error)) {
    // Handle parse error gracefully
    console.error(`Configuration error: ${error.message}`);
  }
}
```

## Best Practices

1. **Use `exitOnError: false` for servers** - Prevent crashes from invalid input
2. **Use custom handlers for logging** - Track parsing errors in monitoring
   systems
3. **Provide fallback configurations** - Ensure applications can continue with
   defaults
4. **Test error scenarios** - Use `exitOnError: false` to test validation logic
5. **Preserve exit codes** - Use `error.exitCode` for consistent error reporting

## API Reference

### New Exports

```ts
export class ParseError extends Error {/* ... */}
export function isParseError(error: unknown): error is ParseError;
export function handleParsingError(
  message: string,
  options?: ParseOptions,
): never;
export function handleHelpDisplay(
  helpText: string,
  options?: ParseOptions,
): never;
export const ErrorHandlers: {/* convenience functions */};
export const ErrorMessages: {/* message templates */};
```

### ParseOptions Extensions

```ts
interface ParseOptions {
  exitOnError?: boolean;
  exitOnHelp?: boolean;
  onError?: (error: string, exitCode: number) => void;
  onHelp?: (helpText: string) => void;
}
```

This feature makes the library much more suitable for integration into larger
applications while maintaining full backward compatibility with existing code.
