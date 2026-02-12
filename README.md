# CLI Argument Parser for Deno

A powerful, type-safe command line argument parser for Deno using modern
decorators and inheritance.

## Features

- **Perfect Type Safety** - Fully typed results based on your class definitions.
- **Unified Decorators** - Simplify configuration with `@opt` and `@arg`
  objects.
- **Explicit Flags** - Clear distinction between CLI options and internal state.
- **Subcommands** - Hierarchical command structure with full type safety.
- **Validation** - Built-in and custom validators with easy composition.
- **Shell Completions** - Built-in support for generating shell completions
  (Fish).

## Quick Start

```typescript
import { arg, Args, cli, opt } from "@sigma/parse";

@cli({ name: "calculator", description: "A simple calculator" })
class Calculator extends Args {
  @arg({ type: "number", description: "first number", required: true })
  a!: number;

  @arg({ type: "number", description: "second number", required: true })
  b!: number;

  @opt({ description: "operation to perform" })
  operation = "add";
}

// Parse command line arguments
const args = Calculator.parse(["10", "5", "--operation", "multiply"]);

// Use the required values directly
console.log(`${args.a} ${args.operation} ${args.b} = ...`);
```

## API Overview

### Main Command Class

Your main command class must extend `Args` to get the static `parse` method:

```typescript
import { Args, cli, opt } from "@sigma/parse";

@cli({ name: "myapp", description: "My application" })
class MyApp extends Args {
  @opt({ description: "Enable verbose logging", short: "v" })
  verbose = false;

  @opt({ description: "Port number", type: "number" })
  port = 8080;
}

const args = MyApp.parse(Deno.args);
console.log(args.verbose, args.port); // Fully typed!
```

### Subcommands

Subcommands are plain classes (no need to extend `Args`). Link them using
`@subCommand`:

```typescript
import { Args, cli, command, opt, subCommand } from "@sigma/parse";

@command
class ServeCommand {
  @opt({ description: "Port to serve on" })
  port = 3000;

  @opt({ description: "Enable development mode", short: "d" })
  dev = false;
}

@cli({ name: "myapp" })
class MyApp extends Args {
  @subCommand(ServeCommand, { description: "Start development server" })
  serve?: ServeCommand;
}

const args = MyApp.parse(["serve", "--port", "8080", "--dev"]);
if (args.serve) {
  console.log(args.serve.port); // 8080
}
```

## Decorators

### Class Decorators

- `@cli(options)` - Configure the main application entry point.
- `@command(options?)` - Mark a class as a command or subcommand handler.

### Property Decorators

- `@opt(options)` - Mark a property as a CLI flag (`--flag`).
  - `description`: Help text.
  - `type`: Explicit type (`"string"`, `"number"`, `"boolean"`, `"string[]"`,
    `"number[]"`).
  - `required`: Mark as required.
  - `short`: Short flag character (string) or `true` to auto-assign from the
    first letter.
- `@arg(options)` - Mark a property as a positional argument.
  - `description`: Help text.
  - `type`: Explicit type.
  - `required`: Mark as required.
  - `rest`: Capture remaining positional arguments as an array.
  - `raw`: Capture ALL remaining arguments (including flags) without parsing
    them (proxy mode).
- `@subCommand(Class, options?)` - Associate a property with a subcommand class.
- `@validate(predicate, message)` - Add custom inline validation.
- `@addValidator(fn)` - Building block for reusable validators.

## Property Syntax

### Required vs Optional

**Explicitly Required** (must be provided on CLI):

```typescript ignore
@opt({ type: "string", required: true })
apiKey!: string;
```

**Optional with Default** (inferred from value):

```typescript ignore
port = 8080; // type inferred as number
```

### Automatic Short Flags

Use `short: true` to automatically use the first character of the property name
as a short flag:

```typescript ignore
verbose = false; // becomes -v, --verbose
```

## Validation

### Built-in Validators

```typescript
import { Args, cli, oneOf, opt, pattern, range, validate } from "@sigma/parse";

@cli({ name: "example" })
class Example extends Args {
  @opt()
  @validate(range(1, 100))
  score = 50;

  @opt()
  @validate(oneOf(["dev", "prod"]))
  env = "dev";

  @opt()
  @validate(pattern(/^[a-z]+$/))
  user = "admin";
}
```

### Proxy Mode (Raw Arguments)

Use `raw: true` to build wrappers that forward arguments to other tools:

```typescript ignore
@cli({ name: "proxy" })
class Proxy extends Args {
  @arg({ description: "Command to run", required: true })
  cmd!: string;

  @arg({ raw: true })
  args: string[] = [];
}

// Usage: proxy deno run --allow-net server.ts
// cmd = "deno"
// args = ["run", "--allow-net", "server.ts"]
```

## Shell Completions

Generate Fish completion scripts automatically:

```bash
# Generate fish completions
deno run myapp.ts gen-completions fish > ~/.config/fish/completions/myapp.fish
```

## License

MIT License
