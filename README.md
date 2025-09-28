# @sigma/parse

A powerful, decorator-based CLI argument parser for Deno and Node.js with
TypeScript support.

## Features

- 🎯 **Type-safe** - Full TypeScript support with automatic type inference
- 🎨 **Decorator-based** - Clean, declarative API using decorators
- 🔧 **Flexible** - Supports options, positional arguments, subcommands, and
  rest arguments
- ✅ **Validation** - Built-in validators with custom validation support
- 📖 **Auto-help** - Automatic help generation
- 🎛️ **Configurable** - Extensive configuration options

## Quick Start

```typescript
import { argument, description, parse, required } from "@sigma/parse";

@parse(Deno.args, { name: "myapp", description: "A simple CLI tool" })
class MyApp {
  @description("Enable verbose output")
  static verbose: boolean = false;

  @description("Port number")
  static port: number = 8080;

  @argument({ description: "Input file" })
  @type("string")
  static input: string;

  @argument({ description: "Output file" })
  static output: string = "output.txt";
}

// Access parsed values
console.log(`Processing ${MyApp.input}`);
if (MyApp.output) {
  console.log(`Output to ${MyApp.output}`);
}
```

## Basic Usage

### Options (Flags)

```typescript
@parse(Deno.args)
class Config {
  // Boolean flag: --verbose
  @description("Enable verbose logging")
  static verbose: boolean = false;

  // Number option: --port 3000
  @description("Server port")
  static port: number = 8080;

  // String option: --env production
  @description("Environment")
  static env: string = "development";
}
```

### Positional Arguments

```typescript
@parse(Deno.args)
class FileProcessor {
  // Required positional argument
  @argument({ description: "Input file" })
  @type("string")
  static input: string;

  // Optional with default value
  @argument({ description: "Output file" })
  static output: string = "result.txt";

  // Rest arguments (captures remaining values)
  @argument({ description: "Additional files", rest: true })
  @type("string[]")
  static files: string[] = [];
}

// Usage: myapp input.txt [output.txt] [file1.txt file2.txt ...]
```

### Type Specification

```typescript
@parse(Deno.args)
class Config {
  // Explicit type (required when no default value)
  @type("string")
  @required()
  static apiKey: string;

  // Array types
  @type("string[]")
  static tags: string[] = [];

  @type("number[]")
  static ports: number[] = [8080];
}
```

### Validation

```typescript
import { min, oneOf, pattern, range } from "@sigma/parse";

@parse(Deno.args)
class Config {
  @description("Environment")
  @oneOf(["dev", "staging", "prod"])
  static env: string = "dev";

  @description("Port (1-65535)")
  @range(1, 65535)
  static port: number = 8080;

  @description("Email address")
  @pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  @type("string")
  static email: string;

  @description("Thread count (minimum 1)")
  @min(1)
  static threads: number = 4;
}
```

### Subcommands

```typescript
import { command, subCommand } from "@sigma/parse";

@command
class BuildCommand {
  @description("Enable production mode")
  static production: boolean = false;

  @description("Output directory")
  static output: string = "dist";
}

@command
class ServeCommand {
  @description("Port to serve on")
  static port: number = 3000;

  @description("Enable watch mode")
  static watch: boolean = false;
}

@parse(Deno.args, { name: "myapp" })
class MyApp {
  @description("Enable verbose logging")
  static verbose: boolean = false;

  @description("Build the application")
  @subCommand(BuildCommand)
  static build: BuildCommand;

  @description("Serve the application")
  @subCommand(ServeCommand)
  static serve: ServeCommand;
}

// Usage: myapp build --production
// Usage: myapp serve --port 8080 --watch
```

### Raw Rest Arguments (for proxy commands)

```typescript
import { rawRest } from "@sigma/parse";

@parse(Deno.args)
class DockerProxy {
  @argument({ description: "Docker command" })
  @type("string")
  static command: string;

  @rawRest("Arguments to pass to docker")
  static dockerArgs: string[] = [];

  @description("Show what would be executed")
  static dryRun: boolean = false;
}

// Usage: docker-proxy run --dry-run --rm -it ubuntu bash
// command = "run"
// dockerArgs = ["--rm", "-it", "ubuntu", "bash"]
// dryRun = true
```

## API Reference

### Decorators

- `@parse(args, options?)` - Main decorator to enable parsing
- `@argument(options?)` - Mark as positional argument
- `@description(text)` - Add help description
- `@type(type)` - Explicit type specification
- `@required()` - Mark as required
- `@command` - Mark class as command
- `@subCommand(Class)` - Associate with subcommand
- `@rawRest(description?)` - Capture raw remaining arguments

### Validators

- `@oneOf(values)` - Must be one of the specified values
- `@range(min, max)` - Number must be within range
- `@min(value)` - Minimum value/length
- `@max(value)` - Maximum value/length
- `@pattern(regex)` - Must match regular expression
- `@length(min, max)` - String/array length constraints
- `@integer()` - Must be an integer
- `@arrayLength(min, max)` - Array length constraints

### Types

Supported types: `"string"`, `"number"`, `"boolean"`, `"string[]"`, `"number[]"`

### Options

```typescript
interface ParseOptions {
  name?: string; // App name in help
  description?: string; // App description in help
  exitOnError?: boolean; // Exit on parsing errors (default: true)
  exitOnHelp?: boolean; // Exit when showing help (default: true)
  showDefaults?: boolean; // Show default values in help (default: true)
  colors?: boolean; // Enable colored output (default: true)
  defaultCommand?: string; // Default subcommand or "help"
}
```

## Examples

### Simple File Processor

```typescript
@parse(Deno.args, { name: "process", description: "Process files" })
class Processor {
  @argument({ description: "Input file" })
  @type("string")
  static input: string;

  @argument({ description: "Output file" })
  static output: string = "processed.txt";

  @description("Enable verbose mode")
  static verbose: boolean = false;

  @description("Number format")
  @oneOf(["decimal", "hex", "binary"])
  static format: string = "decimal";
}

// Usage: process input.txt [output.txt] --verbose --format hex
```

### Git-like Tool

```typescript
@command
class CommitCommand {
  @argument({ description: "Commit message" })
  static message: string = "";

  @description("Add all files")
  static all: boolean = false;
}

@command
class PushCommand {
  @argument({ description: "Remote name" })
  static remote: string = "origin";

  @description("Force push")
  static force: boolean = false;
}

@parse(Deno.args, { name: "mygit", defaultCommand: "help" })
class MyGit {
  @subCommand(CommitCommand)
  static commit: CommitCommand;

  @subCommand(PushCommand)
  static push: PushCommand;
}
```

## Error Handling

```typescript
import { isParseError, ParseError } from "@sigma/parse";

@parse(Deno.args, {
  exitOnError: false,
  onError: (error: ParseError) => {
    console.error(`Error: ${error.message}`);
    if (error.type === "validation") {
      console.error(`Field: ${error.field}`);
    }
    Deno.exit(1);
  },
})
class Config {
  @required()
  @type("string")
  static apiKey: string;
}
```

### Consuming Parsed Commands

```typescript
@command
class ServeCommand {
  @description("Port to serve on")
  static port: number = 3000;

  @description("Enable watch mode")
  static watch: boolean = false;
}

@command
class BuildCommand {
  @description("Enable production mode")
  static production: boolean = false;

  @argument({ description: "Output directory" })
  static output: string = "dist";
}

@parse(Deno.args, { name: "myapp" })
class MyApp {
  @description("Enable verbose logging")
  static verbose: boolean = false;

  @subCommand(ServeCommand)
  static serve: ServeCommand;

  @subCommand(BuildCommand)
  static build: BuildCommand;
}

// Check which command was used and execute accordingly
if (MyApp.serve) {
  console.log(`Starting server on port ${ServeCommand.port}`);
  if (ServeCommand.watch) {
    console.log("Watch mode enabled");
  }
  // Start your server logic here
} else if (MyApp.build) {
  console.log(`Building to ${BuildCommand.output}`);
  if (BuildCommand.production) {
    console.log("Production build enabled");
  }
  // Run your build logic here
} else {
  console.log("No command specified. Use --help for usage.");
}

// Global options are always available
if (MyApp.verbose) {
  console.log("Verbose logging enabled");
}
```

## License

MIT
