/**
 * Example demonstrating the new Args-based CLI API.
 *
 * This example shows how to use the @cli decorator with Args base class
 * for clean, type-safe command line argument parsing.
 */

import {
  addValidator,
  arg,
  Args,
  cli,
  command,
  oneOf,
  option,
  range,
  subCommand,
} from "../mod.ts";

// Simple example with basic options
@cli({ name: "calculator", description: "A simple calculator application" })
class Calculator extends Args {
  @option({
    description: "First number to operate on",
    type: "number",
    required: true,
  })
  a!: number;

  @option({
    description: "Second number to operate on",
    type: "number",
    required: true,
  })
  b!: number;

  @option({
    description: "Operation to perform",
  })
  @addValidator(oneOf(["add", "subtract", "multiply", "divide"]))
  operation = "add";

  @option({ description: "Show detailed output" })
  verbose = false;
}

// Subcommands are plain classes (no need to extend Args)
@command
class BuildCommand {
  @option({ description: "Enable production optimizations" })
  production = false;

  @option({ description: "Output directory" })
  output = "dist";

  @arg({ description: "Project directory to build", type: "string" })
  project = ".";
}

@command
class ServeCommand {
  @option({ description: "Port to serve on" })
  @addValidator(range(1, 65535))
  port = 3000;

  @option({ description: "Enable development mode" })
  dev = false;

  @option({ description: "Host to bind to" })
  host = "localhost";
}

// Main app with subcommands (extends Args)
@cli({ name: "buildtool", description: "A project build and development tool" })
class BuildTool extends Args {
  @option({ description: "Enable verbose logging" })
  verbose = false;

  @option({ description: "Configuration file to use" })
  config = "build.config.js";

  @subCommand(BuildCommand)
  build?: BuildCommand;

  @subCommand(ServeCommand)
  serve?: ServeCommand;
}

// Example with positional arguments
@cli({
  name: "fileprocessor",
  description: "Process files with various operations",
})
class FileProcessor extends Args {
  @arg({ description: "Input file to process", type: "string" })
  input?: string;

  @arg({ description: "Output file (optional)", type: "string" })
  output?: string;

  @arg({
    description: "Additional files to include",
    rest: true,
    type: "string[]",
  })
  includes?: string[];

  @option({ description: "Processing operation" })
  @addValidator(oneOf(["copy", "transform", "validate"]))
  operation = "copy";

  @option({ description: "Enable verbose output" })
  verbose = false;
}

// Demo function to show the new API in action
function demonstrateAPI() {
  console.log("=== Args-Based CLI API Examples ===\n");

  // Example 1: Simple calculator
  console.log("1. Simple Calculator Example:");
  console.log("Usage: calculator --a 10 --b 5 --operation multiply --verbose");

  try {
    const calcArgs = Calculator.parse([
      "--a",
      "10",
      "--b",
      "5",
      "--operation",
      "multiply",
      "--verbose",
    ]);
    console.log("Parsed arguments:", calcArgs);

    // Perfect type safety - no casting needed!
    const result = performCalculation(
      calcArgs.a!,
      calcArgs.b!,
      calcArgs.operation,
    );
    console.log(
      `Result: ${calcArgs.a} ${calcArgs.operation} ${calcArgs.b} = ${result}`,
    );
    if (calcArgs.verbose) {
      console.log("Verbose mode enabled");
    }
  } catch (error) {
    console.error("Parsing error:", (error as Error).message);
  }

  console.log("\n" + "=".repeat(50) + "\n");

  // Example 2: Build tool with subcommands
  console.log("2. Build Tool with Subcommands:");
  console.log("Usage: buildtool --verbose serve --port 8080 --dev");

  try {
    const buildArgs = BuildTool.parse([
      "--verbose",
      "serve",
      "--port",
      "8080",
      "--dev",
    ]);
    console.log("Parsed arguments:", buildArgs);

    if (buildArgs.serve) {
      // Clean, type-safe access - no more 'as any'!
      console.log(
        `Starting development server on ${buildArgs.serve.host}:${buildArgs.serve.port}`,
      );
      console.log(
        `Development mode: ${buildArgs.serve.dev ? "enabled" : "disabled"}`,
      );
    }
  } catch (error) {
    console.error("Parsing error:", (error as Error).message);
  }

  console.log("\n" + "=".repeat(50) + "\n");

  // Example 3: File processor with positional arguments
  console.log("3. File Processor with Positional Arguments:");
  console.log(
    "Usage: fileprocessor input.txt output.txt file1.txt file2.txt --operation transform",
  );

  try {
    const fileArgs = FileProcessor.parse([
      "input.txt",
      "output.txt",
      "file1.txt",
      "file2.txt",
      "--operation",
      "transform",
      "--verbose",
    ]);
    console.log("Parsed arguments:", fileArgs);
    console.log(
      `Processing ${fileArgs.input || ""} -> ${fileArgs.output || ""}`,
    );
    console.log(`Additional files: ${fileArgs.includes?.join(", ") || ""}`);
    console.log(`Operation: ${fileArgs.operation}`);
  } catch (error) {
    console.error("Parsing error:", (error as Error).message);
  }

  console.log("\n" + "=".repeat(50) + "\n");

  // Example 4: Error handling
  console.log("4. Error Handling Example:");
  console.log("Trying to parse invalid arguments...");

  try {
    // This should fail validation
    const invalidArgs = Calculator.parse([
      "--a",
      "10",
      "--operation",
      "invalid",
    ]);
    console.log("This shouldn't print:", invalidArgs);
  } catch (error) {
    console.log("Caught expected error:", error);
  }
}

// Helper function for calculator
function performCalculation(a: number, b: number, operation: string): number {
  switch (operation) {
    case "add":
      return a + b;
    case "subtract":
      return a - b;
    case "multiply":
      return a * b;
    case "divide":
      return a / b;
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

console.log(`
=== Args-Based CLI API ===

NEW API DESIGN:
@cli({ name: "myapp", description: "My app" })
class MyApp extends Args {  // Main command extends Args
  @option({ description: "Verbose mode" })
  verbose = false;

  @subCommand(ServeCommand)
  serve?: ServeCommand;     // Subcommand property
}

@command
class ServeCommand {        // Subcommands are plain classes
  @option({ description: "Port" })
  port = 3000;
  
  @option({ description: "Dev mode" })
  dev = false;
}

USAGE:
const args = MyApp.parse(Deno.args);
console.log(args.serve.port);  // Perfect type safety!

KEY BENEFITS:
✅ Perfect type safety - no 'as any' casting needed
✅ Clean property access - args.serve.port just works
✅ Only main commands extend Args - subcommands are plain classes
✅ Self-contained - MyApp.parse() handles everything
✅ Better for testing and functional programming patterns
✅ Explicit control over when parsing happens
`);

// Run the demonstration
if (import.meta.main) {
  demonstrateAPI();
}
