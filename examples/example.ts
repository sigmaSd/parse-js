import {
  addValidator,
  arg,
  Args,
  cli,
  command,
  opt,
  subCommand,
} from "../mod.ts";

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
  @opt({ description: "Port number to listen on" })
  @min(1000)
  @max(65535)
  port: number = 8080;

  @opt({ description: "Host address to bind to" })
  host: string = "localhost";

  @opt({ description: "Enable HTTPS" })
  https: boolean = false;

  @opt({ description: "Number of worker processes", type: "number" })
  @min(1)
  @max(16)
  workers: number = 1;
}

@command
class BuildCommand {
  @opt({ description: "Output directory", required: true })
  output!: string;

  @opt({ description: "Source files to build", required: true })
  sources!: string[];

  @opt({ description: "Enable minification" })
  minify: boolean = false;

  @opt({ description: "Target environment" })
  @oneOf(["development", "production", "test"])
  env: string = "development";
}

@command
class TestCommand {
  @opt({ description: "Test files pattern", type: "string" })
  pattern: string = "";

  @opt({ description: "Enable coverage reporting" })
  coverage: boolean = false;

  @opt({ description: "Number of parallel workers", type: "number" })
  @min(1)
  parallel: number = 1;

  @opt({ description: "Test timeout in seconds" })
  @min(1)
  @max(300)
  timeout: number = 30;
}

@command
class ProcessCommand {
  @arg({ description: "Input file to process", required: true, type: "string" })
  input!: string;

  @arg({ description: "Output file path", type: "string" })
  output: string = "processed.txt";

  @arg({
    description: "Additional files to include",
    rest: true,
    type: "string[]",
  })
  files: string[] = [];

  @opt({ description: "Processing format" })
  @oneOf(["json", "xml", "csv"])
  format: string = "json";

  @opt({ description: "Enable verbose output" })
  verbose: boolean = false;
}

////////////////
// Nested subcommands example - Database operations
//

@command
class StartDatabaseCommand {
  @opt({ description: "Database port" })
  @min(1000)
  @max(65535)
  port: number = 5432;

  @opt({ description: "Database host" })
  host: string = "localhost";

  @opt({ description: "Enable SSL connection" })
  ssl: boolean = false;
}

@command
class StopDatabaseCommand {
  @opt({ description: "Force stop without graceful shutdown" })
  force: boolean = false;

  @opt({ description: "Timeout for graceful shutdown (seconds)" })
  @min(1)
  @max(300)
  timeout: number = 30;
}

@command
class MigrateCommand {
  @opt({ description: "Migration direction" })
  @oneOf(["up", "down"])
  direction: string = "up";

  @opt({ description: "Number of migrations to run", type: "number" })
  @min(1)
  count: number = 1;
}

@command
class DatabaseCommand {
  @subCommand(StartDatabaseCommand)
  start?: StartDatabaseCommand;

  @subCommand(StopDatabaseCommand)
  stop?: StopDatabaseCommand;

  @subCommand(MigrateCommand)
  migrate?: MigrateCommand;

  @opt({ description: "Database name", type: "string" })
  name: string = "";

  @opt({ description: "Connection timeout (seconds)" })
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
  @subCommand(ServeCommand, { description: "Start the development server" })
  serve?: ServeCommand;

  @subCommand(BuildCommand, { description: "Build the project" })
  build?: BuildCommand;

  @subCommand(TestCommand, { description: "Run the test suite" })
  test?: TestCommand;

  @subCommand(ProcessCommand, {
    description: "Process files with positional arguments",
  })
  process?: ProcessCommand;

  @subCommand(DatabaseCommand, { description: "Database operations" })
  database?: DatabaseCommand;

  @opt({ description: "Configuration file to use", type: "string" })
  config: string = "";

  @opt({ description: "Enable verbose logging" })
  verbose: boolean = false;

  @opt({ description: "Enable debug mode" })
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
