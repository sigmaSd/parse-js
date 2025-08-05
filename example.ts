import {
  addValidator,
  command,
  description,
  parse,
  required,
  subCommand,
  type,
} from "./lib.ts";
import process from "node:process";

////////////////
// User-defined validation decorators
//

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

function oneOf(choices: string[]) {
  return addValidator((value: unknown) => {
    if (typeof value === "string" && !choices.includes(value)) {
      return `must be one of: ${choices.join(", ")}, got ${value}`;
    }
    return null;
  });
}

////////////////
// Command classes for subcommands
//

@command
class ServeCommand {
  @description("Port number to listen on")
  @min(1000)
  @max(65535)
  static port: number = 8080;

  @description("Host address to bind to")
  static host: string = "localhost";

  @description("Enable HTTPS")
  static https: boolean = false;

  @description("Number of worker processes")
  @type("number")
  @min(1)
  @max(16)
  static workers: number;
}

@command
class BuildCommand {
  @description("Output directory")
  @type("string")
  @required()
  static output: string;

  @description("Source files to build")
  @type("string[]")
  @required()
  static sources: string[];

  @description("Enable minification")
  static minify: boolean = false;

  @description("Target environment")
  @oneOf(["development", "production", "test"])
  static env: string = "development";
}

@command
class TestCommand {
  @description("Test files pattern")
  @type("string")
  static pattern: string;

  @description("Enable coverage reporting")
  static coverage: boolean = false;

  @description("Number of parallel workers")
  @type("number")
  @min(1)
  static parallel: number;

  @description("Test timeout in seconds")
  @min(1)
  @max(300)
  static timeout: number = 30;
}

////////////////
// Main configuration with subcommands
//

@parse(process.argv.slice(2), {
  name: "myapp",
  description:
    "A powerful CLI application with subcommands, validation, and help",
})
class MyArgs {
  @description("Start the development server")
  @subCommand(ServeCommand)
  static serve: ServeCommand;

  @description("Build the project")
  @subCommand(BuildCommand)
  static build: BuildCommand;

  @description("Run the test suite")
  @subCommand(TestCommand)
  static test: TestCommand;

  @description("Configuration file to use")
  @type("string")
  static config: string;

  @description("Enable verbose logging")
  static verbose: boolean = false;

  @description("Enable debug mode")
  static debug: boolean = false;
}

////////////////
// Command execution logic
//

console.log("=== MyApp CLI Demo ===\n");

if (MyArgs.serve) {
  console.log("🚀 Starting development server...");
  console.log(`   Host: ${ServeCommand.host}`);
  console.log(`   Port: ${ServeCommand.port}`);
  console.log(`   HTTPS: ${ServeCommand.https ? "enabled" : "disabled"}`);
  if (ServeCommand.workers) {
    console.log(`   Workers: ${ServeCommand.workers}`);
  }
} else if (MyArgs.build) {
  console.log("🔨 Building project...");
  console.log(`   Output: ${BuildCommand.output}`);
  console.log(`   Sources: ${BuildCommand.sources.join(", ")}`);
  console.log(`   Environment: ${BuildCommand.env}`);
  console.log(`   Minify: ${BuildCommand.minify ? "enabled" : "disabled"}`);
} else if (MyArgs.test) {
  console.log("🧪 Running tests...");
  if (TestCommand.pattern) {
    console.log(`   Pattern: ${TestCommand.pattern}`);
  }
  console.log(`   Coverage: ${TestCommand.coverage ? "enabled" : "disabled"}`);
  console.log(`   Timeout: ${TestCommand.timeout}s`);
  if (TestCommand.parallel) {
    console.log(`   Parallel workers: ${TestCommand.parallel}`);
  }
} else {
  console.log("No command specified. Use --help to see available commands.");
}

console.log("\nGlobal options:");
console.log(`   Config: ${MyArgs.config || "default"}`);
console.log(`   Verbose: ${MyArgs.verbose}`);
console.log(`   Debug: ${MyArgs.debug}`);

////////////////
// Example usage commands:
//
// Basic subcommands:
// deno run example.ts serve --port 3000 --host 0.0.0.0
// deno run example.ts build --output dist --sources src/main.ts,src/utils.ts --minify
// deno run example.ts test --pattern user --coverage --parallel 4
//
// With global options:
// deno run example.ts --verbose --debug serve --port 8080
// deno run example.ts --config prod.json build --output build --sources src/app.ts --env production
//
// Help commands:
// deno run example.ts --help
// deno run example.ts serve --help
// deno run example.ts build --help
// deno run example.ts test --help
//
// Validation examples (these will fail):
// deno run example.ts serve --port 99999  (port too high)
// deno run example.ts build --env invalid  (invalid environment)
// deno run example.ts test --timeout 500  (timeout too high)
//
// Global options only:
// deno run example.ts --config app.json --verbose
