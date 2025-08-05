# CLI Argument Parser

A lightweight, decorator-based CLI argument parsing library for
TypeScript/JavaScript with built-in validation support using modern decorator
metadata.

## Features

- 🎯 **Decorator-based**: Simple `@parse(args)` decorator for classes
- 🔍 **Type inference**: Automatically detects string, number, boolean, and
  array types from defaults
- 🏷️ **Explicit typing**: Use `@type()` decorator for properties without
  defaults
- 📋 **Array support**: Parse comma-separated lists with `--items a,b,c`
- 🚀 **Subcommands**: Full subcommand support with `@subCommand()` and
  `@command`
- ✅ **Validation system**: Extensible validation with custom decorators
- 📚 **Auto-generated help**: Built-in `--help` flag with usage information
- 📝 **Help descriptions**: Use `@description()` to add help text for properties
- 🌐 **Global options**: Mix global and subcommand-specific options
- 🚀 **Zero dependencies**: Pure TypeScript/JavaScript
- 🎨 **Clean API**: Uses modern decorator metadata - no manual class names
  needed
- 🔧 **Flexible**: Support for required fields, optional properties, and complex
  validation

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

### With App Information

```typescript
import { parse } from "jsr:@sigma/parse";

@parse(Deno.args, {
  name: "myserver",
  description: "A simple HTTP server with configurable options",
})
class Config {
  static port: number = 8000;
  static host: string = "localhost";
  static debug: boolean = false;
}
```

### With Type Specification, Validation, and Help Text

```typescript
import {
  addValidator,
  description,
  parse,
  required,
  type,
} from "jsr:@sigma/parse";

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

### With Subcommands

```typescript
import {
  command,
  description,
  parse,
  subCommand,
  type,
} from "jsr:@sigma/parse";

@command
class RunCommand {
  @description("Force the operation")
  static force: boolean = false;

  @description("Enable verbose output")
  static verbose: boolean = false;

  @description("Number of retries")
  @type("number")
  static retries: number;
}

@command
class BuildCommand {
  @description("Output directory")
  @type("string")
  static output: string;

  @description("Enable minification")
  static minify: boolean = false;
}

@parse(Deno.args, {
  name: "mycli",
  description: "A powerful CLI tool with subcommands",
})
class MyArgs {
  @description("Run the application")
  @subCommand(RunCommand)
  static run: RunCommand;

  @description("Build the project")
  @subCommand(BuildCommand)
  static build: BuildCommand;

  @description("Enable global debug mode")
  static debug: boolean = false;
}

// Usage examples:
// mycli run --force --verbose --retries 3
// mycli --debug build --output dist --minify
// mycli run --help
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

# Arrays with comma-separated values
deno run app.ts --files a.txt,b.txt,c.txt --ports 3000,4000,5000

# Subcommands
deno run app.ts run --force --verbose
deno run app.ts build --output dist --minify

# Global options with subcommands
deno run app.ts --debug run --force
deno run app.ts --config app.json build --output dist

# Built-in help
deno run app.ts --help
deno run app.ts run --help
```

## API Reference

### `@parse(args, options?)`

Class decorator factory that enables CLI argument parsing for static class
properties.

**Parameters:**

- `args: string[]` - The array of arguments to parse
- `options?: object` - Optional app configuration
  - `name?: string` - The name of the application (shown in help)
  - `description?: string` - A brief description of the application (shown in
    help)

```typescript
@parse(Deno.args)
class MyConfig {
  static value: string = "default";
}

// With app information
@parse(Deno.args, {
  name: "myapp",
  description: "A CLI tool for processing data",
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

- `typeName: "string" | "number" | "boolean" | "string[]" | "number[]"` - The
  type of the property

```typescript
@parse(Deno.args)
class Config {
  @type("number")
  static timeout: number; // Optional number property

  @type("string")
  @required()
  static apiKey: string; // Required string property

  @type("string[]")
  static files: string[]; // Optional string array

  @type("number[]")
  static ports: number[]; // Optional number array
}
```

### `@required()`

Decorator to mark a property as required. This is a convenience function built
using `addValidator`.

```typescript
@parse(Deno.args)
class Config {
  @type("string")
  @required()
  static apiKey: string;
}
```

### `@description(text)`

Decorator to add help text for properties that will be shown in the `--help`
output.

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

### `@command`

Class decorator to mark a class as a command class for subcommand parsing.

```typescript
@command
class RunCommand {
  static force: boolean = false;
  static verbose: boolean = false;
}
```

### `@subCommand(commandClass)`

Decorator to associate a property with a command class for subcommand
functionality.

**Parameters:**

- `commandClass: new () => unknown` - The command class to associate with this
  subcommand

```typescript
@parse(Deno.args)
class Config {
  @description("Run the application")
  @subCommand(RunCommand)
  static run: RunCommand;

  @description("Build the project")
  @subCommand(BuildCommand)
  static build: BuildCommand;
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

Returns `null` if validation passes, or an error message string if validation
fails.

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

### Array Validation

```typescript
function minLength(min: number) {
  return addValidator((value: unknown) => {
    if (Array.isArray(value) && value.length < min) {
      return `must have at least ${min} items`;
    }
    return null;
  });
}

function allInRange(min: number, max: number) {
  return addValidator((value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "number" && (item < min || item > max)) {
          return `all numbers must be between ${min} and ${max}`;
        }
      }
    }
    return null;
  });
}

@parse(Deno.args)
class Config {
  @description("List of input files")
  @type("string[]")
  @minLength(1)
  static files: string[];

  @description("Port numbers to listen on")
  @type("number[]")
  @allInRange(1000, 9999)
  static ports: number[];
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
    "must contain only alphanumeric characters, hyphens, and underscores",
  )
  static name: string = "myapp";
}
```

### Custom Required Validator

While the library provides a built-in `@required()` decorator, you can easily
create your own:

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
  static port: number = 8000; // Inferred as number

  @description("Host address to bind to")
  static host: string = "localhost"; // Inferred as string

  @description("Enable debug mode")
  static debug: boolean = false; // Inferred as boolean

  @description("Default file list")
  static files: string[] = ["app.js"]; // Inferred as string[]

  @description("Default port list")
  static ports: number[] = [8080, 3000]; // Inferred as number[]
}
```

### Without Default Values (Explicit Type Required)

```typescript
@parse(Deno.args)
class Config {
  @description("Request timeout in seconds")
  @type("number")
  static timeout: number; // Optional number property

  @description("API key for authentication (required)")
  @type("string")
  @required()
  static apiKey: string; // Required string property

  @description("Enable verbose output")
  @type("boolean")
  static verbose: boolean; // Optional boolean property

  @description("List of input files")
  @type("string[]")
  static files: string[]; // Optional string array

  @description("Port numbers to use")
  @type("number[]")
  static ports: number[]; // Optional number array
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

$ deno run app.ts --ports 3000,abc,4000
Invalid number in array for --ports: abc

$ deno run app.ts --files a.txt
Validation error for --files: must have at least 3 items
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

$ deno run app.ts --files
Missing value for argument: --files
```

## Help Generation

The `--help` flag automatically generates usage information:

```bash
$ deno run app.ts --help
Usage:
  [runtime] script.js [options]

Options:
  --port <number>
      Port number to listen on
  --apiKey <string>
      API key for authentication (required)
  --retries <number>
      Number of retry attempts (1-10)
  --files <string,string,...>
      List of input files to process
  --ports <number,number,...>
      Port numbers to listen on
  --debug
      Enable debug logging
  --help
      Show this help message
```

### With Subcommands

When using subcommands, the help output shows available commands:

```bash
$ deno run app.ts --help
mycli

A powerful CLI tool with subcommands

Usage:
  mycli <command> [options]

Commands:
  run
      Run the application
  build
      Build the project

Global Options:
  --debug
      Enable global debug mode
  --help
      Show this help message
```

### Subcommand-Specific Help

Each subcommand has its own help:

````bash
$ deno run app.ts run --help
Usage:
  mycli run [options]

Options:
  --force
      Force the operation
  --verbose
      Enable verbose output
  --retries <number>
      Number of retries
  --help
      Show this help message

## Array Usage Examples

### Basic Array Parsing

```bash
# String arrays
deno run app.ts --files index.html,styles.css,script.js

# Number arrays
deno run app.ts --ports 3000,4000,5000

# Mixed with other arguments
deno run app.ts --files a.txt,b.txt --port 8080 --debug
````

### Array with Defaults

```typescript
@parse(Deno.args)
class Config {
  @description("Input files to process")
  static files: string[] = ["default.txt"];

  @description("Ports to listen on")
  static ports: number[] = [8080];
}

// Override defaults:
// deno run app.ts --files new1.txt,new2.txt --ports 3000,4000
```

### Array Validation

```typescript
function minItems(min: number) {
  return addValidator((value: unknown) => {
    if (Array.isArray(value) && value.length < min) {
      return `requires at least ${min} items`;
    }
    return null;
  });
}

@parse(Deno.args)
class Config {
  @type("string[]")
  @minItems(2)
  @required()
  static files: string[];
}

// deno run app.ts --files single.txt
// Error: Validation error for --files: requires at least 2 items
```

````
### With App Information

When you provide app name and description, the help output becomes more informative:

```bash
$ deno run app.ts --help
myserver

A simple HTTP server with configurable options

Usage:
  myserver [options]

Options:
  --port <number>
      Port number to listen on
  --host <string>
      Host address to bind to
  --debug
      Enable debug logging
  --help
      Show this help message
````

## Limitations

### Property Name Restrictions

Due to JavaScript/TypeScript limitations, certain property names cannot be used
as they conflict with built-in class properties:

- `length` - Built-in property of Function
- `name` - Built-in property of Function
- `prototype` - Built-in property of Function

These properties will be automatically skipped during parsing. If you need to
use these as CLI argument names, consider using alternatives:

```typescript
@parse(Deno.args)
class Config {
  // ❌ This won't work
  // static length: number = 10;

  // ✅ Use alternatives instead
  @description("Maximum length allowed")
  static maxLength: number = 10;

  @description("Application name")
  static appName: string = "myapp";

  @description("Protocol to use")
  static protocol: string = "http";
}
```

### Type Inference Requirements

For properties without default values, you must use the `@type()` decorator:

```typescript
@parse(Deno.args)
class Config {
  // ❌ This will throw an error
  // static timeout: number;

  // ✅ Explicit type required
  @type("number")
  static timeout: number;
}
```

## Modern Decorator Metadata

This library uses the modern TC39 decorator metadata proposal, which allows
decorators to communicate with each other without requiring global state or
manual class name passing. This results in a cleaner, more maintainable API.

## Testing

The library includes comprehensive tests covering all functionality:

```bash
deno test lib.test.ts
```

## Subcommand Examples

### Basic Subcommand Setup

```typescript
import { command, description, parse, subCommand } from "jsr:@sigma/parse";

@command
class ServeCommand {
  @description("Port to listen on")
  static port: number = 8080;

  @description("Host to bind to")
  static host: string = "localhost";
}

@command
class TestCommand {
  @description("Run tests matching pattern")
  @type("string")
  static pattern: string;

  @description("Enable coverage reporting")
  static coverage: boolean = false;
}

@parse(Deno.args, {
  name: "myapp",
  description: "A web application with testing",
})
class Config {
  @description("Start the web server")
  @subCommand(ServeCommand)
  static serve: ServeCommand;

  @description("Run the test suite")
  @subCommand(TestCommand)
  static test: TestCommand;

  @description("Enable verbose logging")
  static verbose: boolean = false;
}

// Usage examples:
// myapp serve --port 3000 --host 0.0.0.0
// myapp --verbose test --pattern user --coverage
// myapp serve --help
```

### Advanced Subcommand Usage

```typescript
@command
class DeployCommand {
  @description("Deployment environment")
  @oneOf(["dev", "staging", "prod"])
  static env: string = "dev";

  @description("Services to deploy")
  @type("string[]")
  @required()
  static services: string[];

  @description("Skip confirmation prompts")
  static force: boolean = false;
}

@parse(Deno.args, { name: "deploy-tool" })
class Config {
  @description("Execute deployment")
  @subCommand(DeployCommand)
  static deploy: DeployCommand;

  @description("Configuration file path")
  @type("string")
  static config: string;
}

// Usage: deploy-tool --config prod.json deploy --env prod --services api,web,worker --force
```

### Checking Which Subcommand Was Used

```typescript
if (Config.serve) {
  console.log(`Starting server on ${ServeCommand.host}:${ServeCommand.port}`);
} else if (Config.test) {
  console.log(`Running tests with pattern: ${TestCommand.pattern}`);
} else {
  console.log("No command specified, use --help for usage");
}
```

## Subcommand Workflow

### 1. Define Command Classes

Mark classes with `@command` and define their options:

```typescript
@command
class DatabaseCommand {
  @description("Database host")
  static host: string = "localhost";

  @description("Database port")
  static port: number = 5432;

  @description("Enable SSL connection")
  static ssl: boolean = false;
}
```

### 2. Create Main Configuration Class

Use `@subCommand()` to register command classes:

```typescript
@parse(Deno.args, { name: "myapp" })
class Config {
  @description("Database operations")
  @subCommand(DatabaseCommand)
  static db: DatabaseCommand;

  @description("Global debug mode")
  static debug: boolean = false;
}
```

### 3. Handle Subcommand Execution

Check which subcommand was selected:

```typescript
if (Config.db) {
  console.log(`Connecting to ${DatabaseCommand.host}:${DatabaseCommand.port}`);
  // Execute database command logic
} else {
  console.log("Use --help to see available commands");
}
```

## Best Practices

### Subcommand Organization

- **Group related functionality**: Each subcommand should represent a distinct
  feature
- **Use descriptive names**: `serve`, `build`, `test`, `deploy` are clear and
  intuitive
- **Keep commands focused**: Avoid overloading single commands with too many
  responsibilities

### Global vs Command Options

```typescript
@parse(Deno.args)
class Config {
  // Global options - available for all commands
  @description("Enable verbose output")
  static verbose: boolean = false;

  @description("Configuration file")
  @type("string")
  static config: string;

  // Subcommands
  @subCommand(ServeCommand)
  static serve: ServeCommand;
}
```

### Validation Patterns

```typescript
@command
class DeployCommand {
  @description("Target environment")
  @oneOf(["dev", "staging", "production"])
  @required()
  static environment: string;

  @description("Services to deploy")
  @type("string[]")
  @minLength(1)
  static services: string[];
}
```

## Nested Subcommands

The library supports nested subcommands (subcommands within subcommands) to create hierarchical command structures like `git remote add` or `docker container run`.

### Basic Nested Subcommands

```typescript
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
  @description("Start the database server")
  @subCommand(StartCommand)
  static start: StartCommand;

  @description("Stop the database server")
  @subCommand(StopCommand)
  static stop: StopCommand;

  static timeout: number = 30;
}

@parse(process.argv.slice(2), { name: "myapp" })
class Config {
  @description("Database operations")
  @subCommand(DatabaseCommand)
  static database: DatabaseCommand;

  static verbose: boolean = false;
}
```

### Usage Examples

```bash
# Two-level nested command
myapp database start --port 8080 --host 0.0.0.0

# With global and intermediate options
myapp --verbose database --timeout 60 start --port 8080

# Three-level nested commands are also supported
myapp database table create --name users
```

### Multi-Level Command Hierarchy

```typescript
@command
class CreateTableCommand {
  static tableName: string = "default";
}

@command
class TableCommand {
  @subCommand(CreateTableCommand)
  static create: CreateTableCommand;

  static schema: string = "public";
}

@command
class DatabaseCommand {
  @subCommand(TableCommand)
  static table: TableCommand;

  static connection: string = "local";
}

@parse(process.argv.slice(2))
class Config {
  @subCommand(DatabaseCommand)
  static database: DatabaseCommand;
}

// Usage: myapp database --connection remote table --schema admin create --tableName users
```

### Nested Subcommand Help

Help works automatically at every level:

```bash
myapp --help                    # Shows top-level commands
myapp database --help           # Shows database subcommands
myapp database start --help     # Shows start command options
```

### Best Practices for Nested Commands

1. **Logical Grouping**: Group related functionality together
   ```typescript
   // Good: git remote add, git remote remove
   // Bad: mixing unrelated commands at the same level
   ```

2. **Consistent Naming**: Use clear, consistent naming patterns
   ```typescript
   // Good: database start, database stop, database restart
   // Bad: database begin, database halt, database reboot
   ```

3. **Reasonable Depth**: Avoid excessive nesting (2-3 levels is usually sufficient)
   ```typescript
   // Good: app database migrate up
   // Questionable: app environment production database primary migrate schema up
   ```

### Property Name Restrictions in Nested Commands

Be aware that certain property names are reserved and cannot be used:

```typescript
@command
class MyCommand {
  static serviceName = "web";  // ✅ Good
  static name = "web";         // ❌ Bad - 'name' is reserved
  static length = 5;           // ❌ Bad - 'length' is reserved
  static prototype = {};       // ❌ Bad - 'prototype' is reserved
}
```

## Examples

See `example.ts` for a complete working example with custom validation
decorators.

## License

MIT
