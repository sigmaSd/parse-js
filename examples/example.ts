import {
  addValidator,
  Args,
  argument,
  cli,
  command,
  description,
  required,
  subCommand,
  type,
} from "../src/index.ts";

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
  port: number = 8080;

  @description("Host address to bind to")
  host: string = "localhost";

  @description("Enable HTTPS")
  https: boolean = false;

  @description("Number of worker processes")
  @type("number")
  @min(1)
  @max(16)
  workers: number = 1;
}

@command
class BuildCommand {
  @description("Output directory")
  @required()
  output: string = "";

  @description("Source files to build")
  @required()
  sources: string[] = [];

  @description("Enable minification")
  minify: boolean = false;

  @description("Target environment")
  @oneOf(["development", "production", "test"])
  env: string = "development";
}

@command
class TestCommand {
  @description("Test files pattern")
  @type("string")
  pattern: string = "";

  @description("Enable coverage reporting")
  coverage: boolean = false;

  @description("Number of parallel workers")
  @type("number")
  @min(1)
  parallel: number = 1;

  @description("Test timeout in seconds")
  @min(1)
  @max(300)
  timeout: number = 30;
}

@command
class ProcessCommand {
  @argument({ description: "Input file to process" })
  @required()
  @type("string")
  input: string = "";

  @argument({ description: "Output file path" })
  @type("string")
  output: string = "processed.txt";

  @argument({ description: "Additional files to include", rest: true })
  @type("string[]")
  files: string[] = [];

  @description("Processing format")
  @oneOf(["json", "xml", "csv"])
  format: string = "json";

  @description("Enable verbose output")
  verbose: boolean = false;
}

////////////////
// Nested subcommands example - Database operations
//

@command
class StartDatabaseCommand {
  @description("Database port")
  @min(1000)
  @max(65535)
  port: number = 5432;

  @description("Database host")
  host: string = "localhost";

  @description("Enable SSL connection")
  ssl: boolean = false;
}

@command
class StopDatabaseCommand {
  @description("Force stop without graceful shutdown")
  force: boolean = false;

  @description("Timeout for graceful shutdown (seconds)")
  @min(1)
  @max(300)
  timeout: number = 30;
}

@command
class MigrateCommand {
  @description("Migration direction")
  @oneOf(["up", "down"])
  direction: string = "up";

  @description("Number of migrations to run")
  @type("number")
  @min(1)
  count: number = 1;
}

@command
class DatabaseCommand {
  @description("Start the database server")
  @subCommand(StartDatabaseCommand)
  start?: StartDatabaseCommand;

  @description("Stop the database server")
  @subCommand(StopDatabaseCommand)
  stop?: StopDatabaseCommand;

  @description("Run database migrations")
  @subCommand(MigrateCommand)
  migrate?: MigrateCommand;

  @description("Database name")
  @type("string")
  name: string = "";

  @description("Connection timeout (seconds)")
  @min(1)
  @max(60)
  timeout: number = 10;
}

////////////////
// Main configuration with subcommands
//

@cli({
  name: "myapp",
  description:
    "A powerful CLI application with nested subcommands, validation, and help",
})
class MyArgs extends Args {
  @description("Start the development server")
  @subCommand(ServeCommand)
  serve?: ServeCommand;

  @description("Build the project")
  @subCommand(BuildCommand)
  build?: BuildCommand;

  @description("Run the test suite")
  @subCommand(TestCommand)
  test?: TestCommand;

  @description("Process files with positional arguments")
  @subCommand(ProcessCommand)
  process?: ProcessCommand;

  @description("Database operations")
  @subCommand(DatabaseCommand)
  database?: DatabaseCommand;

  @description("Configuration file to use")
  @type("string")
  config: string = "";

  @description("Enable verbose logging")
  verbose: boolean = false;

  @description("Enable debug mode")
  debug: boolean = false;
}

////////////////
// Command execution logic
//

function main() {
  const args = MyArgs.parse(Deno.args);

  console.log("=== MyApp CLI Demo ===\n");

  if (args.serve) {
    console.log("🚀 Starting development server...");
    console.log(`   Host: ${args.serve.host}`);
    console.log(`   Port: ${args.serve.port}`);
    console.log(`   HTTPS: ${args.serve.https ? "enabled" : "disabled"}`);
    console.log(`   Workers: ${args.serve.workers}`);
  } else if (args.build) {
    console.log("🔨 Building project...");
    console.log(`   Output: ${args.build.output}`);
    console.log(`   Sources: ${args.build.sources.join(", ")}`);
    console.log(`   Environment: ${args.build.env}`);
    console.log(`   Minify: ${args.build.minify ? "enabled" : "disabled"}`);
  } else if (args.test) {
    console.log("🧪 Running tests...");
    if (args.test.pattern) {
      console.log(`   Pattern: ${args.test.pattern}`);
    }
    console.log(`   Coverage: ${args.test.coverage ? "enabled" : "disabled"}`);
    console.log(`   Timeout: ${args.test.timeout}s`);
    console.log(`   Parallel workers: ${args.test.parallel}`);
  } else if (args.process) {
    console.log("📄 Processing files...");
    console.log(`   Input: ${args.process.input}`);
    console.log(`   Output: ${args.process.output}`);
    console.log(`   Format: ${args.process.format}`);
    console.log(`   Verbose: ${args.process.verbose ? "enabled" : "disabled"}`);
    if (args.process.files.length > 0) {
      console.log(`   Additional files: ${args.process.files.join(", ")}`);
    }
  } else if (args.database) {
    console.log("🗄️  Database operations...");
    if (args.database.name) {
      console.log(`   Database: ${args.database.name}`);
    }
    console.log(`   Connection timeout: ${args.database.timeout}s`);

    if (args.database.start) {
      console.log("   🚀 Starting database server...");
      console.log(`      Host: ${args.database.start.host}`);
      console.log(`      Port: ${args.database.start.port}`);
      console.log(
        `      SSL: ${args.database.start.ssl ? "enabled" : "disabled"}`,
      );
    } else if (args.database.stop) {
      console.log("   🛑 Stopping database server...");
      console.log(`      Force: ${args.database.stop.force ? "yes" : "no"}`);
      console.log(`      Graceful timeout: ${args.database.stop.timeout}s`);
    } else if (args.database.migrate) {
      console.log("   📊 Running migrations...");
      console.log(`      Direction: ${args.database.migrate.direction}`);
      console.log(`      Count: ${args.database.migrate.count}`);
    }
  } else {
    console.log("No command specified. Use --help to see available commands.");
  }

  console.log("\nGlobal options:");
  console.log(`   Config: ${args.config || "default"}`);
  console.log(`   Verbose: ${args.verbose}`);
  console.log(`   Debug: ${args.debug}`);
}

if (import.meta.main) {
  main();
}

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
