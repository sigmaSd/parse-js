# CLI Argument Parser

A lightweight, decorator-based CLI argument parsing library for TypeScript/JavaScript with built-in validation support using modern decorator metadata.

## Features

- 🎯 **Decorator-based**: Simple `@parse(args)` decorator for classes
- 🔍 **Type inference**: Automatically detects string, number, and boolean types from defaults
- 🏷️ **Explicit typing**: Use `@type()` decorator for properties without defaults
- ✅ **Validation system**: Extensible validation with custom decorators
- 📚 **Auto-generated help**: Built-in `--help` flag with usage information
- 🚀 **Zero dependencies**: Pure TypeScript/JavaScript
- 🎨 **Clean API**: Uses modern decorator metadata - no manual class names needed
- 🔧 **Flexible**: Support for required fields, optional properties, and complex validation

## Quick Start

### Basic Usage

```typescript
import { parse } from "jsr:@sigma/parse";

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

### With Type Specification and Validation

```typescript
import { addValidator, parse, required, type } from "jsr:@sigma/parse";

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
  @min(1)
  static port: number = 8000;

  @oneOf(["development", "production", "test"])
  static env: string = "development";

  @type("number")
  @min(10)
  @required()
  static timeout: number; // Required property without default

  @type("string")
  static host: string; // Optional property without default

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

### `@parse(args)`

Class decorator factory that enables CLI argument parsing for static class properties.

**Parameters:**
- `args: string[]` - The array of arguments to parse

```typescript
@parse(Deno.args)
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
  static port: number = 8000;      // Inferred as number
  static host: string = "localhost"; // Inferred as string
  static debug: boolean = false;    // Inferred as boolean
}
```

### Without Default Values (Explicit Type Required)

```typescript
@parse(Deno.args)
class Config {
  @type("number")
  static timeout: number;  // Optional number property

  @type("string")
  @required()
  static apiKey: string;   // Required string property

  @type("boolean")
  static verbose: boolean; // Optional boolean property
}
```

### Mixed Properties

```typescript
@parse(Deno.args)
class Config {
  // Properties with defaults (type inferred)
  static port: number = 8000;
  static debug: boolean = false;

  // Required property without default
  @type("string")
  @required()
  static apiKey: string;

  // Optional property without default
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
  -a, --apiKey <string>
  -r, --retries <number>
  -d, --debug
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
