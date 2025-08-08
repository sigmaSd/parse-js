# Configurable Error Handling

The CLI parsing library now supports configurable error handling with two
distinct patterns: **Notification Pattern** (default) for backward
compatibility, and **Control Pattern** for advanced use cases where custom
handlers have complete control over execution flow.

## Overview

### Default Behavior (Notification Pattern)

By default, the library maintains backward compatibility:

- **Parsing errors**: Print error message and call `process.exit(1)`
- **Help requests**: Print help text and call `process.exit(0)`

### With Configuration Options

**Without Custom Handlers (Notification Pattern):**

- Set `exitOnError: false` to throw `ParseError` instead of exiting
- Set `exitOnHelp: false` to throw `ParseError` instead of exiting

**With Custom Handlers (Control Pattern):**

- Custom handlers (`onError`, `onHelp`) take **complete control**
- Exit flags (`exitOnError`, `exitOnHelp`) are **ignored** when custom handlers
  are provided
- Handlers decide whether to continue execution, throw errors, or exit the
  process
- Perfect for servers, testing, and advanced integration scenarios

## Configuration Options

Add these options to your `ParseOptions`:

```ts
interface ParseOptions {
  // ... existing options

  /** Whether to call process.exit() on parsing errors (default: true) */
  /** NOTE: Ignored when onError callback is provided */
  exitOnError?: boolean;

  /** Whether to call process.exit() when help is shown (default: true) */
  /** NOTE: Ignored when onHelp callback is provided */
  exitOnHelp?: boolean;

  /** Custom error handler with COMPLETE CONTROL over error handling */
  /** When provided, exitOnError is ignored and handler decides what happens */
  onError?: (error: string, exitCode: number) => void;

  /** Custom help handler with COMPLETE CONTROL over help display */
  /** When provided, exitOnHelp is ignored and handler decides what happens */
  onHelp?: (helpText: string) => void;
}
```

## Basic Usage

### Notification Pattern: Throw Errors Instead of Exiting

```ts
try {
  @parse(["--port", "invalid"], {
    name: "myapp",
    exitOnError: false, // Don't exit on errors
    exitOnHelp: false, // Don't exit on help
    // No custom handlers = Notification Pattern
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

### Control Pattern: Custom Error Handler with Complete Control

```ts
// Custom handler has COMPLETE control - no exceptions thrown
@parse(["--port", "invalid"], {
  name: "myapp",
  // exitOnError is ignored when onError is provided
  onError: (error, exitCode) => {
    console.error(`❌ CLI Error: ${error}`);
    // Log to monitoring system
    logger.error({ error, exitCode, timestamp: new Date() });

    // Handler decides what to do:
    // - Return (continue execution)
    // - throw new Error() (stop with custom error)
    // - process.exit(exitCode) (stop with exit)
  },
})
class Config {
  static port: number = 8080; // Will have default value since parsing continues
}
```

### Control Pattern: Custom Help Handler with Complete Control

```ts
// Custom handler has COMPLETE control - no exceptions thrown
@parse(["--help"], {
  name: "myapp",
  // exitOnHelp is ignored when onHelp is provided
  onHelp: (helpText) => {
    // Display help in a custom format
    console.log("=== Custom Help ===");
    console.log(helpText);
    console.log("Visit: https://myapp.com/docs");

    // Handler decides what to do:
    // - Return (continue execution)
    // - throw new Error() (stop with custom error)
    // - process.exit(0) (stop with exit)
  },
})
class Config {
  static port: number = 8080; // Will have default value since parsing continues
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

Servers shouldn't crash when receiving invalid CLI commands. Use Control Pattern
for graceful handling:

```ts
class WebServer {
  async handleCLICommand(args: string[]) {
    // Control Pattern - custom handler has complete control
    @parse(args, {
      name: "server-cli",
      onError: (error) => {
        this.logger.warn(`Invalid CLI command: ${error}`);
        // Handler chooses to continue (doesn't throw/exit)
        // Server keeps running
      },
    })
    class Command {
      static action: string = "status";
      static port: number = 3000;
    }

    // Always executes - even after errors
    // Invalid commands use default values
    await this.executeCommand(Command);
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

Graceful fallbacks when configuration is invalid using Control Pattern:

```ts
function loadConfig(args: string[]) {
  @parse(args, {
    onError: (error) => {
      console.warn(`Config error: ${error}, using defaults`);
      // Handler chooses to continue with defaults
    },
  })
  class Config {
    @required()
    static apiKey: string;
    static port: number = 3000;
  }

  // Always returns - even with invalid config
  return {
    apiKey: Config.apiKey || process.env.API_KEY || "",
    port: Config.port,
  };
}
```

### Custom Help Systems

Integrate with custom documentation systems using Control Pattern:

```ts
@parse(args, {
  onHelp: async (helpText) => {
    // Send to custom help system
    await documentationSystem.displayInteractiveHelp(helpText);
    // Handler chooses to continue execution
  },
})
class Config {
  static command: string = "help";
}
// Execution continues after help display
```

## Migration Guide

The new error handling is fully backward compatible. Existing code continues to
work unchanged.

Choose your migration path based on your needs:

### Option 1: Notification Pattern (Simple)

1. **Add `exitOnError: false`** to prevent process exits on errors
2. **Add `exitOnHelp: false`** to prevent process exits on help
3. **Wrap parsing in try-catch** to handle `ParseError` exceptions

```ts
// Before (exits process):
@parse(args)
class Config {
  static port: number = 8080;
}

// After (throws exceptions):
try {
  @parse(args, { exitOnError: false })
  class Config {
    static port: number = 8080;
  }
} catch (error) {
  if (isParseError(error)) {
    console.error(`Configuration error: ${error.message}`);
  }
}
```

### Option 2: Control Pattern (Advanced)

1. **Add custom handlers** with `onError` and/or `onHelp`
2. **No try-catch needed** unless handler throws
3. **Exit flags are ignored** when handlers are provided

```ts
// Before (exits process):
@parse(args)
class Config {
  static port: number = 8080;
}

// After (custom control):
@parse(args, {
  onError: (error, code) => {
    console.error(`Config error: ${error}`);
    // Choose to continue, throw, or exit
  },
})
class Config {
  static port: number = 8080;
}
// Always executes - handler controls flow
```

## Best Practices

### Pattern Selection

1. **Use Notification Pattern for simple cases** - When you just want exceptions
   instead of exits
2. **Use Control Pattern for advanced integration** - Servers, testing, complex
   error handling

### Implementation Guidelines

3. **Use Control Pattern for servers** - Custom handlers prevent crashes from
   invalid input
4. **Use custom handlers for logging** - Track parsing errors in monitoring
   systems
5. **Provide fallback configurations** - Ensure applications can continue with
   defaults
6. **Test error scenarios** - Both patterns work well for testing validation
   logic
7. **Preserve exit codes** - Use `error.exitCode` for consistent error reporting

### Control Pattern Best Practices

8. **Document handler behavior** - Make it clear whether handlers continue,
   throw, or exit
9. **Be consistent** - If using Control Pattern, use it for both errors and help
10. **Consider async handlers** - Control Pattern works well with async
    operations

## API Reference

### New Exports

```ts
export class ParseError extends Error {/* ... */}
export type ParseErrorType = "unknown_argument" | "missing_value" | /* ... */;
export function isParseError(error: unknown): error is ParseError;
export function handleParsingError(
  message: string,
  options?: ParseOptions,
): void; // Returns void - custom handlers control flow
export function handleHelpDisplay(
  helpText: string,
  options?: ParseOptions,
): void; // Returns void - custom handlers control flow
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

## Summary

This configurable error handling system provides two powerful patterns:

- **Notification Pattern**: Simple upgrade from process exits to exceptions
- **Control Pattern**: Advanced integration where custom handlers have complete
  control

The Control Pattern is particularly powerful for:

- Server applications that shouldn't crash
- Testing frameworks that need predictable behavior
- Complex applications requiring custom error recovery
- Integration with monitoring and logging systems

Both patterns maintain full backward compatibility with existing code while
enabling much more flexible integration into larger applications.
