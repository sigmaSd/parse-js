import {
  addValidator,
  argument,
  command,
  description,
  parse,
  required,
  subCommand,
  type,
} from "@sigma/parse";
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

@command
class ProcessCommand {
  @argument({ description: "Input file to process" })
  @required()
  @type("string")
  static input: string;

  @argument({ description: "Output file path" })
  static output: string = "processed.txt";

  @argument({ description: "Additional files to include", rest: true })
  @type("string[]")
  static files: string[] = [];

  @description("Processing format")
  @oneOf(["json", "xml", "csv"])
  static format: string = "json";

  @description("Enable verbose output")
  static verbose: boolean = false;
}

////////////////
// Nested subcommands example - Database operations
//

@command
class StartDatabaseCommand {
  @description("Database port")
  @min(1000)
  @max(65535)
  static port: number = 5432;

  @description("Database host")
  static host: string = "localhost";

  @description("Enable SSL connection")
  static ssl: boolean = false;
}

@command
class StopDatabaseCommand {
  @description("Force stop without graceful shutdown")
  static force: boolean = false;

  @description("Timeout for graceful shutdown (seconds)")
  @min(1)
  @max(300)
  static timeout: number = 30;
}

@command
class MigrateCommand {
  @description("Migration direction")
  @oneOf(["up", "down"])
  static direction: string = "up";

  @description("Number of migrations to run")
  @type("number")
  @min(1)
  static count: number;
}

@command
class DatabaseCommand {
  @description("Start the database server")
  @subCommand(StartDatabaseCommand)
  static start: StartDatabaseCommand;

  @description("Stop the database server")
  @subCommand(StopDatabaseCommand)
  static stop: StopDatabaseCommand;

  @description("Run database migrations")
  @subCommand(MigrateCommand)
  static migrate: MigrateCommand;

  @description("Database name")
  @type("string")
  static name: string;

  @description("Connection timeout (seconds)")
  @min(1)
  @max(60)
  static timeout: number = 10;
}

////////////////
// Main configuration with subcommands
//

@parse(process.argv.slice(2), {
  name: "myapp",
  description:
    "A powerful CLI application with nested subcommands, validation, and help",
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

  @description("Process files with positional arguments")
  @subCommand(ProcessCommand)
  static process: ProcessCommand;

  @description("Database operations")
  @subCommand(DatabaseCommand)
  static database: DatabaseCommand;

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
} else if (MyArgs.process) {
  console.log("📄 Processing files...");
  console.log(`   Input: ${ProcessCommand.input}`);
  console.log(`   Output: ${ProcessCommand.output}`);
  console.log(`   Format: ${ProcessCommand.format}`);
  console.log(`   Verbose: ${ProcessCommand.verbose ? "enabled" : "disabled"}`);
  if (ProcessCommand.files.length > 0) {
    console.log(`   Additional files: ${ProcessCommand.files.join(", ")}`);
  }
} else if (MyArgs.database) {
  console.log("🗄️  Database operations...");
  if (DatabaseCommand.name) {
    console.log(`   Database: ${DatabaseCommand.name}`);
  }
  console.log(`   Connection timeout: ${DatabaseCommand.timeout}s`);

  if (DatabaseCommand.start) {
    console.log("   🚀 Starting database server...");
    console.log(`      Host: ${StartDatabaseCommand.host}`);
    console.log(`      Port: ${StartDatabaseCommand.port}`);
    console.log(
      `      SSL: ${StartDatabaseCommand.ssl ? "enabled" : "disabled"}`,
    );
  } else if (DatabaseCommand.stop) {
    console.log("   🛑 Stopping database server...");
    console.log(`      Force: ${StopDatabaseCommand.force ? "yes" : "no"}`);
    console.log(`      Graceful timeout: ${StopDatabaseCommand.timeout}s`);
  } else if (DatabaseCommand.migrate) {
    console.log("   📊 Running migrations...");
    console.log(`      Direction: ${MigrateCommand.direction}`);
    if (MigrateCommand.count) {
      console.log(`      Count: ${MigrateCommand.count}`);
    }
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
// deno run example.ts process input.txt output.json extra1.txt extra2.txt --format json --verbose
//
// Nested subcommands (2-3 levels deep):
// deno run example.ts database start --port 5432 --host 0.0.0.0 --ssl
// deno run example.ts database stop --force --timeout 60
// deno run example.ts database migrate --direction up --count 3
// deno run example.ts --verbose database --name mydb start --port 8080
//
// With global options:
// deno run example.ts --verbose --debug serve --port 8080
// deno run example.ts --config prod.json build --output build --sources src/app.ts --env production
// deno run example.ts --verbose database --name prod migrate --direction up
//
// Help commands:
// deno run example.ts --help
// deno run example.ts serve --help
// deno run example.ts build --help
// deno run example.ts test --help
// deno run example.ts process --help
// deno run example.ts database --help
// deno run example.ts database start --help
// deno run example.ts database migrate --help
//
// Validation examples (these will fail):
// deno run example.ts serve --port 99999  (port too high)
// deno run example.ts build --env invalid  (invalid environment)
// deno run example.ts test --timeout 500  (timeout too high)
// deno run example.ts database start --port 99999  (nested validation)
// deno run example.ts database migrate --direction invalid  (invalid direction)
//
// Global options only:
// deno run example.ts --config app.json --verbose
