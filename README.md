# CLI Argument Parser for Deno

A powerful, type-safe command line argument parser for Deno using decorators and
inheritance.

## Features

- 🚀 **Perfect Type Safety** - No `as any` casting needed
- 🎯 **Clean API** - `MyApp.parse(args)` with direct property access
- 🏗️ **Decorator-Based** - Use `@cli`, `@description`, `@required`, etc.
- 📦 **Subcommands** - Hierarchical command structure with full type safety
- ✅ **Validation** - Built-in and custom validators
- 🔧 **Instance Properties** - Natural, intuitive property definitions
- 📚 **Self-Contained** - Each command class handles its own parsing

## Quick Start

```typescript
import {
  Args,
  argument,
  cli,
  description,
  required,
  type,
} from "@sigma/parse";

@cli({ name: "calculator", description: "a simple calculator" })
class calculator extends Args {
  @argument({ description: "first number" })
  @type("number")
  @required()
  a?: number;

  @argument({ description: "second number" })
  @type("number")
  @required()
  b?: number;

  @description("operation to perform")
  operation = "add";
}

// parse command line arguments
const args = calculator.parse(Deno.args);

// handle potentially undefined values
if (args.a !== undefined && args.b !== undefined) {
  console.log(`${args.a} ${args.operation} ${args.b} = ${args.a + args.b}`);
} else {
  console.error("both numbers are required");
}
```

Usage:

```bash
deno run calculator.ts 10 5 --operation add
# Output: 10 add 5 = 15
```

## API Overview

### Main Command Class

Your main command class must extend `Args` to get the static `parse` method:

```typescript
@cli({ name: "myapp", description: "My application" })
class MyApp extends Args {
  @description("Enable verbose logging")
  verbose = false;

  @description("Port number")
  port = 8080;
}

const args = MyApp.parse(Deno.args);
console.log(args.verbose, args.port); // Fully typed!
```

### Subcommands

Subcommands are plain classes (no need to extend `Args`):

```typescript
@command
class ServeCommand {
  @description("Port to serve on")
  port = 3000;

  @description("Enable development mode")
  dev = false;
}

@cli({ name: "myapp", description: "My application" })
class MyApp extends Args {
  @description("Start development server")
  @subCommand(ServeCommand)
  serve?: ServeCommand;
}

const args = MyApp.parse(["serve", "--port", "8080", "--dev"]);
console.log(args.serve.port, args.serve.dev); // Perfect type safety!
```

## Decorators

### Class Decorators

- `@cli(options)` - Configure main command class
- `@command` - Mark a class as a subcommand

### Property Decorators

- `@description(text)` - Add help text
- `@type(type)` - Specify argument type explicitly (required for properties
  without defaults)
- `@required()` - Mark as required
- `@argument(options)` - Define positional argument
- `@subCommand(CommandClass)` - Link to subcommand class

### Validation Decorators

- `@addValidator(validator)` - Add custom validation
- Built-in validators: `range()`, `oneOf()`, `pattern()`, `length()`, etc.

## Property Syntax

### Required vs Optional Properties

**Required properties** (no default value):

- Must use `@type("type")` decorator
- Use optional syntax: `property?: type`
- Usually combined with `@required()`

```typescript ignore
@type("string")
@required()
apiKey?: string;
```

**Optional properties** (with default values):

- Don't need `@type` decorator (inferred from default)
- Use assignment syntax: `property = defaultValue`

```typescript
verbose = false; // inferred as boolean
port = 8080; // inferred as number
mode = "development"; // inferred as string
```

### Type Validation

Properties without defaults and without `@type()` will throw an error:

```typescript ignore
// ❌ This will error - no default and no @type
@required()
apiKey?: string;

// ✅ Fixed - add @type decorator
@type("string")
@required()
apiKey?: string;

// ✅ Or provide a default (no @type needed)
apiKey = "";
```

## Comprehensive Example

Here's a complete example showing positional arguments, flag arguments, and proper type safety:

```typescript
import {
  Args,
  argument,
  cli,
  description,
  required,
  type,
  addValidator,
  oneOf,
} from "@sigma/parse";

@cli({ name: "deploy", description: "Deploy application to server" })
class DeployCommand extends Args {
  // Positional arguments (order matters)
  @argument({ description: "Application name to deploy" })
  @type("string")
  @required()
  appName?: string;

  @argument({ description: "Target environment" })
  @type("string")
  @addValidator(oneOf(["dev", "staging", "prod"]))
  @required()
  environment?: string;

  @argument({ description: "Version to deploy (optional)" })
  @type("string")
  version?: string;

  // Flag arguments (can appear anywhere)
  @description("Force deployment without confirmation")
  force = false;

  @description("Enable verbose logging")
  verbose = false;

  @description("Number of instances to deploy")
  instances = 1;

  @description("API key for authentication")
  @type("string")
  @required()
  apiKey?: string;
}

// Parse arguments
const args = DeployCommand.parse(Deno.args);

// Type-safe usage with proper undefined checking
if (args.appName && args.environment && args.apiKey) {
  console.log(`Deploying ${args.appName} to ${args.environment}`);

  if (args.version) {
    console.log(`Version: ${args.version}`);
  } else {
    console.log("Version: latest");
  }

  if (args.verbose) {
    console.log(`Instances: ${args.instances}`);
    console.log(`Force mode: ${args.force}`);
    console.log(`API Key: ${args.apiKey.substring(0, 4)}...`);
  }

  // Proceed with deployment...
} else {
  console.error("Missing required arguments");
  Deno.exit(1);
}
```

Usage examples:
```bash
# Positional args first, then flags
deploy myapp prod v1.2.3 --apiKey secret123 --verbose --instances 3

# Flags can appear anywhere
deploy myapp staging --apiKey secret123 --force

# Optional positional arg can be omitted
deploy myapp dev --apiKey secret123
```

## Examples

### Basic Application

```typescript
import {
  addValidator,
  Args,
  cli,
  description,
  range,
  required,
  type,
} from "@sigma/parse";

@cli({
  name: "server",
  description: "HTTP server",
  exitOnError: true,
})
class Server extends Args {
  @description("Port to listen on (1-65535)")
  @addValidator(range(1, 65535))
  port = 8080;

  @description("Enable verbose logging")
  verbose = false;

  @description("Server host")
  host = "localhost";

  @description("API key for authentication")
  @type("string")
  @required()
  apiKey?: string;
}

const config = Server.parse(Deno.args);
if (config.apiKey) {
  console.log(`Starting server on ${config.host}:${config.port}`);
  console.log(`API Key: ${config.apiKey.substring(0, 4)}...`);
} else {
  console.error("API key is required");
}
```

### Application with Subcommands

```typescript
import {
  addValidator,
  Args,
  cli,
  command,
  description,
  oneOf,
  subCommand,
} from "@sigma/parse";

// Subcommand classes (plain classes)
@command
class BuildCommand {
  @description("Enable production optimizations")
  production = false;

  @description("Output directory")
  output = "dist";
}

@command
class ServeCommand {
  @description("Development server port")
  port = 3000;

  @description("Enable hot reload")
  dev = false;
}

// Main application (extends Args)
@cli({ name: "build-tool", description: "Project build tool" })
class BuildTool extends Args {
  @description("Enable verbose output")
  verbose = false;

  @description("Build the project")
  @subCommand(BuildCommand)
  build?: BuildCommand;

  @description("Start development server")
  @subCommand(ServeCommand)
  serve?: ServeCommand;
}

// Usage examples:
const buildResult = BuildTool.parse([
  "build",
  "--production",
  "--output",
  "public",
]);
if (buildResult.build) {
  console.log(`Building to ${buildResult.build.output}`);
  console.log(`Production mode: ${buildResult.build.production}`);
}

const serveResult = BuildTool.parse(["serve", "--port", "8080", "--dev"]);
if (serveResult.serve) {
  console.log(`Serving on port ${serveResult.serve.port}`);
  console.log(`Dev mode: ${serveResult.serve.dev}`);
}
```

### Positional Arguments

```typescript
@cli({ name: "file-processor", description: "Process files" })
class FileProcessor extends Args {
  @argument({ description: "Input file to process" })
  @type("string")
  @required()
  input?: string;

  @argument({ description: "Output file" })
  @type("string")
  output?: string;

  @argument({ description: "Additional files", rest: true })
  @type("string[]")
  extras?: string[];

  @description("Processing mode")
  @addValidator(oneOf(["copy", "transform", "validate"]))
  mode = "copy";
}

const args = FileProcessor.parse([
  "input.txt",
  "output.txt",
  "extra1.txt",
  "extra2.txt",
  "--mode",
  "transform",
]);

// Handle potentially undefined values
if (args.input) {
  console.log(`Processing ${args.input} -> ${args.output || "stdout"}`);
  console.log(`Mode: ${args.mode}`);
  if (args.extras && args.extras.length > 0) {
    console.log(`Extras: ${args.extras.join(", ")}`);
  }
}
```

### Array Types

```typescript
@cli({ name: "tagger", description: "Tag manager" })
class Tagger extends Args {
  @description("List of tags")
  @type("string[]")
  tags?: string[];

  @description("List of priorities")
  @type("number[]")
  priorities?: number[];
}

const args = Tagger.parse([
  "--tags",
  "frontend,backend,mobile",
  "--priorities",
  "1,2,3",
]);

// Handle potentially undefined arrays
if (args.tags) {
  console.log(args.tags); // ["frontend", "backend", "mobile"]
}
if (args.priorities) {
  console.log(args.priorities); // [1, 2, 3]
}
```

## Validation

### Built-in Validators

```typescript
import {
  arrayLength,
  integer,
  length,
  max,
  min,
  oneOf,
  pattern,
  range,
} from "@sigma/parse";

@cli({ name: "example", description: "Validation example" })
class Example extends Args {
  @addValidator(range(1, 100))
  score = 50;

  @addValidator(oneOf(["dev", "staging", "prod"]))
  env = "dev";

  @addValidator(pattern(/^[a-z]+$/))
  username = "user";

  @addValidator(length(8, 32))
  password = "password123";

  @type("string[]")
  @addValidator(arrayLength(1, 5))
  items?: string[];
}
```

### Custom Validators

```typescript
import { addValidator } from "@sigma/parse";

// Custom validator function
function email() {
  return addValidator((value: unknown) => {
    if (typeof value === "string" && !value.includes("@")) {
      return "must be a valid email address";
    }
    return null; // null means validation passed
  });
}

@cli({ name: "user", description: "User management" })
class User extends Args {
  @description("User email address")
  @type("string")
  @required()
  @email()
  email?: string;
}
```

## CLI Options

The `@cli` decorator accepts a full options object:

```typescript
@cli({
  name: "myapp", // Application name
  description: "My app", // Description for help
  color: true, // Enable colored output
  showDefaults: true, // Show default values in help
  defaultCommand: "help", // Default command when no args
  exitOnError: true, // Exit process on errors
  exitOnHelp: true, // Exit process when showing help
  onError: (error, code) => {}, // Custom error handler
  onHelp: (helpText) => {}, // Custom help handler
})
class MyApp extends Args {
  // ...
}
```

## Help Generation

Help is automatically generated based on your decorators:

```bash
$ myapp --help
myapp

My application description

Usage:
  myapp [options] [command]

Options:
  --verbose (default: false)
      Enable verbose logging
  --port <number> (default: 8080)
      Port number
  --help
      Show this help message

Commands:
  serve    Start development server
  build    Build the project
```

## Error Handling

```typescript
try {
  const args = MyApp.parse(Deno.args);
  // ... use args
} catch (error) {
  if (error instanceof ParseError) {
    console.error(`CLI Error: ${error.message}`);
    Deno.exit(error.exitCode);
  }
  throw error;
}
```

## Migration from Old API

If you're migrating from a decorator-based static property system:

**Before:**

```typescript
@parse(Deno.args, { name: "myapp" })
class MyApp {
  static verbose = false;
}
// Properties set automatically on static properties
```

**After:**

```typescript
@cli({ name: "myapp" })
class MyApp extends Args {
  verbose = false;
}
const args = MyApp.parse(Deno.args);
// Returns typed instance with perfect type safety
```

## License

MIT License - see LICENSE file for details.
