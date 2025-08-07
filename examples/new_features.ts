/**
 * Demonstration of new CLI parsing features:
 * - Colored help output with NO_COLOR support
 * - Default values shown in help text
 * - Default command functionality
 */

import {
  argument,
  command,
  description,
  parse,
  required,
  subCommand,
  type,
} from "jsr:@sigma/parse";

// Define subcommands
@command
class ServeCommand {
  @description("Port to serve on")
  static port: number = 3000;

  @description("Host to bind to")
  static host: string = "localhost";

  @description("Enable HTTPS")
  static ssl: boolean = false;

  @argument(0, "Directory to serve")
  static directory: string = ".";
}

@command
class BuildCommand {
  @description("Output directory")
  static output: string = "dist";

  @description("Enable minification")
  static minify: boolean = false;

  @description("Build target")
  @type("string")
  static target: string = "es2020";

  @argument(0, "Entry file")
  @required()
  @type("string")
  static entry: string;

  @argument(1, "Additional files", { rest: true })
  @type("string[]")
  static files: string[] = [];
}

@command
class TestCommand {
  @description("Test pattern to match")
  static pattern: string = "**/*.test.ts";

  @description("Enable coverage reporting")
  static coverage: boolean = false;

  @description("Watch for file changes")
  static watch: boolean = false;
}

// Main application configuration
@parse(Deno.args, {
  name: "devtool",
  description: "A modern development tool with colored help and smart defaults",
  color: true, // Enable colored output (respects NO_COLOR)
  showDefaults: true, // Show default values in help
  defaultCommand: "help", // Show help when no command is provided
})
class DevTool {
  @description("Enable verbose logging")
  static verbose: boolean = false;

  @description("Configuration file path")
  static config: string = "devtool.json";

  @description("Environment to run in")
  static env: string = "development";

  @description("Start the development server")
  @subCommand(ServeCommand)
  static serve: ServeCommand;

  @description("Build the project")
  @subCommand(BuildCommand)
  static build: BuildCommand;

  @description("Run tests")
  @subCommand(TestCommand)
  static test: TestCommand;
}

// Example usage:
console.log("\n🎉 DevTool initialized!");

if (DevTool.serve) {
  console.log(
    `🚀 Starting server on http://${ServeCommand.host}:${ServeCommand.port}`,
  );
  console.log(`📁 Serving directory: ${ServeCommand.directory}`);
  if (ServeCommand.ssl) console.log("🔒 SSL enabled");
}

if (DevTool.build) {
  console.log(`🏗️  Building ${BuildCommand.entry} to ${BuildCommand.output}`);
  console.log(`🎯 Target: ${BuildCommand.target}`);
  if (BuildCommand.minify) console.log("📦 Minification enabled");
  if (BuildCommand.files.length > 0) {
    console.log(`📄 Additional files: ${BuildCommand.files.join(", ")}`);
  }
}

if (DevTool.test) {
  console.log(`🧪 Running tests with pattern: ${TestCommand.pattern}`);
  if (TestCommand.coverage) console.log("📊 Coverage reporting enabled");
  if (TestCommand.watch) console.log("👀 Watch mode enabled");
}

if (DevTool.verbose) {
  console.log("🔍 Verbose logging enabled");
}

console.log(`⚙️  Environment: ${DevTool.env}`);
console.log(`📋 Config file: ${DevTool.config}`);

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

# Disable colors
NO_COLOR=1 deno run new_features.ts

# Help for specific command
deno run new_features.ts serve --help

Features demonstrated:
- ✅ Colored help output (respects NO_COLOR env var)
- ✅ Default values shown in help text
- ✅ Default command (shows help when no args provided)
- ✅ Nested subcommands with proper help
- ✅ Mixed positional and flag arguments
- ✅ Rest arguments for multiple files
*/
