# CLI Argument Parser

A lightweight, decorator-based CLI argument parsing library for javascript with
built-in validation support.

## Features

- 🎯 **Decorator-based**: Simple `@parse(args)` decorator for classes
- 🔍 **Type inference**: Automatically detects string, number, and boolean types
- ✅ **Validation system**: Extensible validation with custom decorators
- 📚 **Auto-generated help**: Built-in `--help` flag with usage information
- 🚀 **Zero dependencies**: Pure TypeScript/JavaScript
- 🎨 **Clean API**: Minimal boilerplate, maximum clarity

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

### With Validation

```typescript
import { addValidator, parse } from "jsr:@sigma/parse";

// Custom validation decorators
function min(minValue: number) {
  return function (_target: unknown, context: { name: string }) {
    addValidator("Config", context.name, (value: unknown) => {
      if (typeof value === "number" && value < minValue) {
        return `must be at least ${minValue}, got ${value}`;
      }
      return null;
    });
  };
}

function oneOf(choices: string[]) {
  return function (_target: unknown, context: { name: string }) {
    addValidator("Config", context.name, (value: unknown) => {
      if (typeof value === "string" && !choices.includes(value)) {
        return `must be one of: ${choices.join(", ")}, got ${value}`;
      }
      return null;
    });
  };
}

@parse(Deno.args)
class Config {
  @min(1)
  static port: number = 8000;

  @oneOf(["development", "production", "test"])
  static env: string = "development";

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

# Boolean flags
deno run app.ts --debug

# Built-in help
deno run app.ts --help
```

## API Reference

### `@parse(args)`

Class decorator factory that enables CLI argument parsing for static class
properties.

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

### `addValidator(className, propertyName, validator)`

Utility function for creating custom validation decorators.

**Parameters:**

- `className: string` - The name of the class the property belongs to
- `propertyName: string` - The name of the property to validate
- `validator: Validator` - The validation function to apply

**Returns:** `void`

### `Validator`

Type definition for validation functions.

```typescript
type Validator = (value: unknown) => string | null;
```

Returns `null` if validation passes, or an error message string if validation
fails.

## Creating Custom Validators

Here are some common validation patterns:

### Numeric Range Validation

```typescript
function range(min: number, max: number) {
  return function (_target: unknown, context: { name: string }) {
    addValidator("MyClass", context.name, (value: unknown) => {
      if (typeof value === "number") {
        if (value < min) return `must be at least ${min}`;
        if (value > max) return `must be at most ${max}`;
      }
      return null;
    });
  };
}

@parse(Deno.args)
class Config {
  @range(1, 65535)
  static port: number = 8000;
}
```

### String Pattern Validation

```typescript
function pattern(regex: RegExp, message: string) {
  return function (_target: unknown, context: { name: string }) {
    addValidator("MyClass", context.name, (value: unknown) => {
      if (typeof value === "string" && !regex.test(value)) {
        return message;
      }
      return null;
    });
  };
}

@parse(Deno.args)
class Config {
  @pattern(
    /^[a-zA-Z0-9_-]+$/,
    "must contain only alphanumeric characters, hyphens, and underscores",
  )
  static name: string = "myapp";
}
```

### Required Fields

```typescript
function required(_target: unknown, context: { name: string }) {
  addValidator("MyClass", context.name, (value: unknown) => {
    if (value === undefined || value === null || value === "") {
      return "is required";
    }
    return null;
  });
}

@parse(Deno.args)
class Config {
  @required
  static apiKey: string = "";
}
```

## Error Handling

The library provides clear error messages for validation failures:

```bash
$ deno run app.ts --port 70000
Validation error for --port: must be at most 65535, got 70000

$ deno run app.ts --env invalid
Validation error for --env: must be one of: development, production, test, got invalid
```

## Help Generation

The `--help` flag automatically generates usage information:

```bash
$ deno run app.ts --help
Usage:
  [runtime] script.js [options]

Options:
  -p, --port <number>
  -e, --env <string>
  -d, --debug
  -h, --help
      Show this help message
```

## Examples

See `example.ts` for a complete working example with custom validation
decorators.

## Type Support

The library automatically detects and handles:

- **Strings**: `static name: string = "default"`
- **Numbers**: `static port: number = 8000`
- **Booleans**: `static debug: boolean = false`

## License

MIT
