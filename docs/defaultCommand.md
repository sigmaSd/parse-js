# `defaultCommand` Configuration

## Overview

The `defaultCommand` option allows you to specify what happens when a CLI
command is invoked **without any arguments**. This works for both the main
application command (via `@cli`) and subcommands (via `@command`).

## When Does `defaultCommand` Trigger?

### Main Command

For the main application command, `defaultCommand` triggers when:

```bash
# Running the CLI with NO arguments at all
myapp

# This is equivalent to not providing any flags, subcommands, or positional arguments
```

**Does NOT trigger when:**

```bash
myapp --help           # Has an argument (--help flag)
myapp subcommand       # Has an argument (subcommand)
myapp input.txt        # Has an argument (positional argument)
myapp --verbose        # Has an argument (--verbose flag)
```

### Subcommands

For subcommands, `defaultCommand` triggers when the subcommand is invoked
**without additional arguments**:

```bash
# Subcommand invoked with NO additional arguments
myapp serve

# This means the subcommand name is provided, but nothing after it
```

**Does NOT trigger when:**

```bash
myapp serve --help     # Subcommand has an argument (--help flag)
myapp serve --port 8080 # Subcommand has arguments
myapp serve input.txt  # Subcommand has a positional argument
```

## Usage Examples

### Main Command with `defaultCommand: "help"`

```typescript
import { Args, cli } from "@sigma/parse";

@cli({
  name: "calculator",
  description: "A simple calculator",
  defaultCommand: "help",
})
class Calculator extends Args {
  @description("First number")
  a: number = 0;

  @description("Second number")
  b: number = 0;
}

// When run with no arguments:
// $ calculator
// Shows help text automatically
```

### Subcommand with `defaultCommand: "help"`

```typescript
import { Args, cli, command, description, subCommand } from "@sigma/parse";

@command({ defaultCommand: "help" })
class ServeCommand {
  @description("Port to serve on")
  port: number = 3000;

  @description("Host to bind to")
  host: string = "localhost";
}

@cli({
  name: "devtool",
  description: "Development tool",
})
class DevTool extends Args {
  @description("Start the server")
  @subCommand(ServeCommand)
  serve?: ServeCommand;
}

// When run without subcommand arguments:
// $ devtool serve
// Shows help for the serve subcommand (not the main help)
//
// Usage:
//   devtool serve [options]
//
// Options:
//   --port <number> (default: 3000)
//       Port to serve on
//   --host <string> (default: "localhost")
//       Host to bind to
```

### Main Command with `defaultCommand` Pointing to a Subcommand

```typescript
import { Args, cli, command, subCommand } from "@sigma/parse";

@command
class InitCommand {
  @description("Project name")
  name: string = "my-project";
}

@cli({
  name: "devtool",
  description: "Development tool",
  defaultCommand: "init", // Execute init by default
})
class DevTool extends Args {
  @description("Initialize a new project")
  @subCommand(InitCommand)
  init?: InitCommand;
}

// When run with no arguments:
// $ devtool
// Automatically executes: devtool init
// Result: init command runs with default values (name = "my-project")
```

## Behavior Details

### `defaultCommand: "help"`

When set to `"help"`, the command will display its help text and exit (or throw
if `exitOnHelp: false`).

### `defaultCommand: "<subcommand-name>"`

When set to a subcommand name, that subcommand will be executed with **no
additional arguments** (using its default values).

### No `defaultCommand` Set

When `defaultCommand` is not specified:

- The command executes normally with default values
- No special behavior occurs

## Inheritance Rules

### Subcommands DO NOT Inherit Parent's `defaultCommand`

This is by design to allow fine-grained control:

```typescript
@command // No defaultCommand - will execute with defaults
class BuildCommand {
  minify: boolean = false;
}

@command({ defaultCommand: "help" }) // Has its own defaultCommand
class ServeCommand {
  port: number = 3000;
}

@cli({
  name: "devtool",
  defaultCommand: "help", // Only applies to main command
})
class DevTool extends Args {
  @subCommand(BuildCommand)
  build?: BuildCommand;

  @subCommand(ServeCommand)
  serve?: ServeCommand;
}

// $ devtool
// Shows help (main command's defaultCommand)

// $ devtool build
// Executes build with defaults (no defaultCommand set on BuildCommand)

// $ devtool serve
// Shows help for serve (ServeCommand has defaultCommand: "help")
```

### Error Handling Options ARE Inherited

While `defaultCommand` is not inherited, other options like `exitOnError` and
`exitOnHelp` **are** inherited by subcommands:

```typescript
@command({ defaultCommand: "help" })
class ServeCommand {
  port: number = 3000;
}

@cli({
  name: "devtool",
  exitOnHelp: false, // This IS inherited by subcommands
})
class DevTool extends Args {
  @subCommand(ServeCommand)
  serve?: ServeCommand;
}

// When help is shown, it will throw ParseError instead of exiting
// because exitOnHelp: false is inherited
```

## Common Patterns

### 1. Help by Default Everywhere

```typescript
@command({ defaultCommand: "help" })
class SubCommand {
  // ...
}

@cli({
  name: "myapp",
  defaultCommand: "help",
})
class MyApp extends Args {
  @subCommand(SubCommand)
  sub?: SubCommand;
}

// Both main command and subcommand show help when called without args
```

### 2. Auto-Execute Default Subcommand

```typescript
@command
class DefaultCommand {
  // ...
}

@cli({
  name: "myapp",
  defaultCommand: "default", // Execute 'default' subcommand when no args
})
class MyApp extends Args {
  @subCommand(DefaultCommand)
  default?: DefaultCommand;
}

// $ myapp
// Automatically runs the default subcommand
```

### 3. Mixed Behavior

```typescript
@command({ defaultCommand: "help" })
class ComplexCommand {
  // Show help if called without args
}

@command
class SimpleCommand {
  // Execute with defaults if called without args
}

@cli({
  name: "myapp",
  // No defaultCommand - will fail if called without args
})
class MyApp extends Args {
  @subCommand(ComplexCommand)
  complex?: ComplexCommand;

  @subCommand(SimpleCommand)
  simple?: SimpleCommand;
}

// $ myapp
// Error: missing subcommand

// $ myapp complex
// Shows help for complex command

// $ myapp simple
// Executes simple command with defaults
```

## Summary

| Scenario                           | Triggers When                              | Example                      |
| ---------------------------------- | ------------------------------------------ | ---------------------------- |
| Main command with `defaultCommand` | No arguments at all                        | `myapp`                      |
| Subcommand with `defaultCommand`   | Subcommand invoked without additional args | `myapp serve`                |
| `defaultCommand: "help"`           | Shows help text                            | Display usage information    |
| `defaultCommand: "<name>"`         | Executes named subcommand                  | Run subcommand with defaults |
| No `defaultCommand`                | Normal execution                           | Use default values           |
