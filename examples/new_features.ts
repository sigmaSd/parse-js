/**
 * Demonstration of new CLI parsing features:
 * - Colored help output with simple boolean control
 * - Default values shown in help text
 * - Default command functionality
 */

import {
  Args,
  argument,
  cli,
  command,
  description,
  required,
  subCommand,
  type,
} from "../src/index.ts";

// Define subcommands
@command
class ServeCommand {
  @description("Port to serve on")
  port: number = 3000;

  @description("Host to bind to")
  host: string = "localhost";

  @description("Enable HTTPS")
  ssl: boolean = false;

  @argument({ description: "Directory to serve" })
  @type("string")
  directory: string = ".";
}

@command
class BuildCommand {
  @description("Output directory")
  output: string = "dist";

  @description("Enable minification")
  minify: boolean = false;

  @description("Build target")
  @type("string")
  target: string = "es2020";

  @argument({ description: "Entry file" })
  @required()
  @type("string")
  entry: string = "";

  @argument({ description: "Additional files", rest: true })
  @type("string[]")
  files: string[] = [];
}

@command
class TestCommand {
  @description("Test pattern to match")
  pattern: string = "**/*.test.ts";

  @description("Enable coverage reporting")
  coverage: boolean = false;

  @description("Watch for file changes")
  watch: boolean = false;
}

// Main application configuration
@cli({
  name: "devtool",
  description: "A modern development tool with colored help and smart defaults",
  color: true, // Enable colored output
  showDefaults: true, // Show default values in help
  defaultCommand: "help", // Show help when no command is provided
})
class DevTool extends Args {
  @description("Enable verbose logging")
  verbose: boolean = false;

  @description("Configuration file path")
  config: string = "devtool.json";

  @description("Environment to run in")
  env: string = "development";

  @description("Start the development server")
  @subCommand(ServeCommand)
  serve?: ServeCommand;

  @description("Build the project")
  @subCommand(BuildCommand)
  build?: BuildCommand;

  @description("Run tests")
  @subCommand(TestCommand)
  test?: TestCommand;
}

function main() {
  const args = DevTool.parse(Deno.args);

  // Example usage:
  console.log("\n🎉 DevTool initialized!");

  if (args.serve) {
    console.log(
      `🚀 Starting server on http://${args.serve.host}:${args.serve.port}`,
    );
    console.log(`📁 Serving directory: ${args.serve.directory}`);
    if (args.serve.ssl) console.log("🔒 SSL enabled");
  }

  if (args.build) {
    console.log(`🏗️  Building ${args.build.entry} to ${args.build.output}`);
    console.log(`🎯 Target: ${args.build.target}`);
    if (args.build.minify) console.log("📦 Minification enabled");
    if (args.build.files.length > 0) {
      console.log(`📄 Additional files: ${args.build.files.join(", ")}`);
    }
  }

  if (args.test) {
    console.log(`🧪 Running tests with pattern: ${args.test.pattern}`);
    if (args.test.coverage) console.log("📊 Coverage reporting enabled");
    if (args.test.watch) console.log("👀 Watch mode enabled");
  }

  if (args.verbose) {
    console.log("🔍 Verbose logging enabled");
  }

  console.log(`⚙️  Environment: ${args.env}`);
  console.log(`📋 Config file: ${args.config}`);
}

if (import.meta.main) {
  main();
}

/*
Usage examples:

# Show colored help (default command)
deno run new_features.ts

# Start development server with defaults
deno run new_features.ts serve

# Start server on different port
deno run new_features.ts serve --port 8080 --ssl

# Build project
deno run new_features.ts build src/main.ts --minify --output build

# Verbose mode
deno run new_features.ts --verbose serve

# Help for specific command
deno run new_features.ts serve --help

Features demonstrated:
- ✅ Colored help output (simple boolean control)
- ✅ Default values shown in help text
- ✅ Default command (shows help when no args provided)
- ✅ Nested subcommands with proper help
- ✅ Mixed positional and flag arguments
- ✅ Rest arguments for multiple files
*/
