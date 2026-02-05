/**
 * Demonstration of modern CLI parsing features:
 * - Colored help output with simple boolean control
 * - Default values shown in help text
 * - Default command functionality
 * - Unified decorators (@opt, @arg)
 */

import { arg, Args, cli, command, opt, subCommand } from "../mod.ts";

// Define subcommands
@command
class ServeCommand {
  @opt({ description: "Port to serve on" })
  port: number = 3000;

  @opt({ description: "Host to bind to" })
  host: string = "localhost";

  @opt({ description: "Enable HTTPS" })
  ssl: boolean = false;

  @arg({ description: "Directory to serve", type: "string" })
  directory: string = ".";
}

@command
class BuildCommand {
  @opt({ description: "Output directory" })
  output: string = "dist";

  @opt({ description: "Enable minification" })
  minify: boolean = false;

  @opt({ description: "Build target", type: "string" })
  target: string = "es2020";

  @arg({ description: "Entry file", required: true, type: "string" })
  entry: string = "";

  @arg({ description: "Additional files", rest: true, type: "string[]" })
  files: string[] = [];
}

@command
class TestCommand {
  @opt({ description: "Test pattern to match" })
  pattern: string = "**/*.test.ts";

  @opt({ description: "Enable coverage reporting" })
  coverage: boolean = false;

  @opt({ description: "Watch for file changes" })
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
  @opt({ description: "Enable verbose logging" })
  verbose: boolean = false;

  @opt({ description: "Configuration file path" })
  config: string = "devtool.json";

  @opt({ description: "Environment to run in" })
  env: string = "development";

  @subCommand(ServeCommand, { description: "Start the development server" })
  serve?: ServeCommand;

  @subCommand(BuildCommand, { description: "Build the project" })
  build?: BuildCommand;

  @subCommand(TestCommand, { description: "Run tests" })
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
