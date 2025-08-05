# CLI Argument Parser

A lightweight, decorator-based CLI argument parsing library for TypeScript/JavaScript with built-in validation support using modern decorator metadata.

## Features

- 🎯 **Decorator-based**: Simple `@parse(args)` decorator for classes
- 🔍 **Type inference**: Automatically detects string, number, and boolean types from defaults
- 🏷️ **Explicit typing**: Use `@type()` decorator for properties without defaults
- ✅ **Validation system**: Extensible validation with custom decorators
- 📚 **Auto-generated help**: Built-in `--help` flag with usage information
- 📝 **Help descriptions**: Use `@description()` to add help text for properties
- 🚀 **Zero dependencies**: Pure TypeScript/JavaScript
- 🎨 **Clean API**: Uses modern decorator metadata - no manual class names needed
- 🔧 **Flexible**: Support for required fields, optional properties, and complex validation

## Quick Start

### Basic Usage

```typescript
import { parse } from "./lib.ts";

@parse(Deno.args)
class Config {
  static port: number = 8000;
  static host: string = "localhost";
  static debug: boolean = false;
}

// Usage: deno run app.ts --port 3000 --host 0.0.0.0 --debug
console.log(`Server running on ${Config.host}:${Config.port}`);
console.log(`Debug mode: ${Config.debug ? "enabled" : "disabled"}`);
```

### With App Information

```typescript
import { parse } from "./lib.ts";

@parse(Deno.args, {
  name: "myserver",
  description: "A simple HTTP server with configurable options"
})
class Config {
  static port: number = 8000;
  static host: string = "localhost";
  static debug: boolean = false;
}
```

### With Type Specification, Validation, and Help Text

```typescript
import { addValidator, description, parse, required, type } from "./lib.ts";

// Custom validation decorators
function min(minValue: number) {
  return addValidator((value: unknown) => {
    if (typeof value === "number" && value < minValue) {
      return `must be at least ${minValue}, got ${value}`;
    }
    return null;
  });
}

function oneOf(choices: string[]) {
  return addValidator((value: unknown) => {
    if (typeof value === "string" && !choices.includes(value)) {
      return `must be one of: ${choices.join(", ")}, got ${value}`;
    }
    return null;
  });
}

@parse(Deno.args)
class Config {
  @description("Port number to listen on")
  @min(1)
  static port: number = 8080;

  @description("Environment to run in")
  @oneOf(["development", "production", "test"])
  static env: string = "development";

  @description("Request timeout in seconds (required)")
  @type("number")
  @min(10)
  @required()
  static timeout: number; // Required property without default

  @description("Host address to connect to")
  @type("string")
  static host: string; // Optional property without default

  @description("Enable debug logging")
  static debug: boolean = false;
}
```

## Command Line Usage

The library supports multiple argument formats:

```bash
# Long form with equals
deno run app.ts --port=3000 --env=production

# Long form with space
deno run app.ts --port 3000 --env production

# Boolean flags (standalone = true)
deno run app.ts --debug

# Boolean with explicit value
deno run app.ts --debug=false

# Built-in help
deno run app.ts --help
```

## API Reference

### `@parse(args, options?)`

Class decorator factory that enables CLI argument parsing for static class properties.

**Parameters:**
- `args: string[]` - The array of arguments to parse
- `options?: object` - Optional app configuration
  - `name?: string` - The name of the application (shown in help)
  - `description?: string` - A brief description of the application (shown in help)

```typescript
@parse(Deno.args)
class MyConfig {
  static value: string = "default";
}

// With app information
@parse(Deno.args, {
  name: "myapp",
  description: "A CLI tool for processing data"
})
class MyConfig {
  static value: string = "default";
}

// Custom arguments (for testing)
const customArgs = ["--port", "3000", "--debug"];
@parse(customArgs)
class TestConfig {
  static port: number = 8000;
  static debug: boolean = false;
}
```

### `@type(typeName)`

Decorator to explicitly specify the type of a property without a default value.

**Parameters:**
- `typeName: "string" | "number" | "boolean"` - The type of the property

```typescript
@parse(Deno.args)
class Config {
  @type("number")
  static timeout: number; // Optional number property

  @type("string")
  @required()
  static apiKey: string; // Required string property
}
```

### `@required()`

Decorator to mark a property as required. This is a convenience function built using `addValidator`.

```typescript
@parse(Deno.args)
class Config {
  @type("string")
  @required()
  static apiKey: string;
}
```

### `@description(text)`

Decorator to add help text for properties that will be shown in the `--help` output.

**Parameters:**
- `text: string` - The description text to show in help

```typescript
@parse(Deno.args)
class Config {
  @description("The port number to listen on")
  static port: number = 8080;

  @description("Enable verbose logging output")
  static debug: boolean = false;

  @type("string")
  @description("API endpoint URL")
  @required()
  static apiUrl: string;
}
```

### `addValidator(validator)`

Utility function for creating custom validation decorators.

**Parameters:**
- `validator: Validator` - The validation function to apply

**Returns:** A decorator function

### `Validator`

Type definition for validation functions.

```typescript
type Validator = (value: unknown) => string | null;
```

Returns `null` if validation passes, or an error message string if validation fails.

## Creating Custom Validators

Here are some common validation patterns:

### Numeric Range Validation

```typescript
function min(minValue: number) {
  return addValidator((value: unknown) => {
    if (typeof value === "number" && value < minValue) {
      return `must be at least ${minValue}, got ${value}`;
    }
    return null;
  });
}

function max(maxValue: number) {
  return addValidator((value: unknown) => {
    if (typeof value === "number" && value > maxValue) {
      return `must be at most ${maxValue}, got ${value}`;
    }
    return null;
  });
}

@parse(Deno.args)
class Config {
  @description("Port number to listen on (1-65535)")
  @min(1)
  @max(65535)
  static port: number = 8000;
}
```

### String Choice Validation

```typescript
function oneOf(choices: string[]) {
  return addValidator((value: unknown) => {
    if (typeof value === "string" && !choices.includes(value)) {
      return `must be one of: ${choices.join(", ")}, got ${value}`;
    }
    return null;
  });
}

@parse(Deno.args)
class Config {
  @description("Color theme to use")
  @oneOf(["red", "blue", "green", "yellow"])
  static color: string = "red";
}
```

### String Pattern Validation

```typescript
function pattern(regex: RegExp, message: string) {
  return addValidator((value: unknown) => {
    if (typeof value === "string" && !regex.test(value)) {
      return message;
    }
    return null;
  });
}

@parse(Deno.args)
class Config {
  @description("Application name (alphanumeric, hyphens, underscores only)")
  @pattern(
    /^[a-zA-Z0-9_-]+$/,
    "must contain only alphanumeric characters, hyphens, and underscores"
  )
  static name: string = "myapp";
}
```

### Custom Required Validator

While the library provides a built-in `@required()` decorator, you can easily create your own:

```typescript
function myRequired() {
  return addValidator((value: unknown) => {
    if (value === undefined || value === null || value === "") {
      return "is required";
    }
    return null;
  });
}
```

## Property Types

### With Default Values (Type Inferred)

```typescript
@parse(Deno.args)
class Config {
  @description("Port number to listen on")
  static port: number = 8000;      // Inferred as number
  
  @description("Host address to bind to")
  static host: string = "localhost"; // Inferred as string
  
  @description("Enable debug mode")
  static debug: boolean = false;    // Inferred as boolean
}
```

### Without Default Values (Explicit Type Required)

```typescript
@parse(Deno.args)
class Config {
  @description("Request timeout in seconds")
  @type("number")
  static timeout: number;  // Optional number property

  @description("API key for authentication (required)")
  @type("string")
  @required()
  static apiKey: string;   // Required string property

  @description("Enable verbose output")
  @type("boolean")
  static verbose: boolean; // Optional boolean property
}
```

### Mixed Properties

```typescript
@parse(Deno.args)
class Config {
  // Properties with defaults (type inferred)
  @description("Port number to listen on")
  static port: number = 8000;
  
  @description("Enable debug logging")
  static debug: boolean = false;

  // Required property without default
  @description("API key for authentication (required)")
  @type("string")
  @required()
  static apiKey: string;

  // Optional property without default
  @description("Number of retry attempts (1-10)")
  @type("number")
  @min(1)
  @max(10)
  static retries: number;
}
```

## Error Handling

The library provides clear error messages for various scenarios:

### Validation Failures
```bash
$ deno run app.ts --port 70000
Validation error for --port: must be at most 65535, got 70000

$ deno run app.ts --color purple
Validation error for --color: must be one of: red, blue, green, yellow, got purple
```

### Missing Required Fields
```bash
$ deno run app.ts --port 3000
Validation error for --apiKey: is required
```

### Missing Type Information
```bash
$ deno run app.ts
Error: Property 'timeout' in class 'Config' has no default value and no @type decorator. Either provide a default value like 'static timeout: number = 0' or use @type("number").
```

### Invalid Arguments
```bash
$ deno run app.ts --unknown value
Unknown argument: --unknown

$ deno run app.ts --port not-a-number
Invalid number for --port: not-a-number
```

## Help Generation

The `--help` flag automatically generates usage information:

```bash
$ deno run app.ts --help
Usage:
  [runtime] script.js [options]

Options:
  -p, --port <number>
      Port number to listen on
  -a, --apiKey <string>
      API key for authentication (required)
  -r, --retries <number>
      Number of retry attempts (1-10)
  -d, --debug
      Enable debug logging
  -h, --help
      Show this help message
```

### With App Information

When you provide app name and description, the help output becomes more informative:

```bash
$ deno run app.ts --help
myserver

A simple HTTP server with configurable options

Usage:
  myserver [options]

Options:
  -p, --port <number>
      Port number to listen on
  -h, --host <string>
      Host address to bind to
  -d, --debug
      Enable debug logging
  -h, --help
      Show this help message
```

## Modern Decorator Metadata

This library uses the modern TC39 decorator metadata proposal, which allows decorators to communicate with each other without requiring global state or manual class name passing. This results in a cleaner, more maintainable API.

## Testing

The library includes comprehensive tests covering all functionality:

```bash
deno test lib.test.ts
```

## Examples

See `example.ts` for a complete working example with custom validation decorators.

## License

MIT
