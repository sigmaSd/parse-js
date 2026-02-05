#!/usr/bin/env -S deno run --allow-all

/**
 * Comprehensive example demonstrating @arg({ raw: true }) usage with the new Args API.
 *
 * The raw: true opt in @arg is perfect for building proxy commands that need to
 * forward arguments to other tools without parsing them as CLI options.
 *
 * Run examples:
 *   deno run examples/rawrest_example.ts
 *   deno run examples/rawrest_example.ts docker run --rm -it ubuntu bash
 *   deno run examples/rawrest_example.ts --verbose kubectl get pods --all-namespaces
 *   deno run examples/rawrest_example.ts --help
 */

import { arg, Args, cli, command, opt, subCommand } from "../mod.ts";

// Example 1: Simple proxy command
console.log("=== Example 1: Simple Proxy Command ===");

@cli({
  name: "container-proxy",
  description: "A proxy that forwards commands to container runtimes",
})
class ContainerProxy extends Args {
  @arg({
    description: "Container runtime (docker, podman, etc.)",
    type: "string",
  })
  runtime: string = "";

  @arg({
    description: "All arguments to pass to the container runtime",
    raw: true,
  })
  runtimeArgs: string[] = [];

  @opt({ description: "Enable verbose logging" })
  verbose: boolean = false;

  @opt({ description: "Dry run - show command but don't execute" })
  dryRun: boolean = false;
}

const exampleArgs = Deno.args.length > 0
  ? Deno.args
  : ["docker", "run", "--rm", "-it", "ubuntu", "bash"];

const proxy = ContainerProxy.parse(exampleArgs);

console.log("Runtime:", proxy.runtime);
console.log("Runtime args:", proxy.runtimeArgs);
console.log("Verbose:", proxy.verbose);
console.log("Dry run:", proxy.dryRun);

if (proxy.dryRun) {
  console.log("Would execute:", proxy.runtime, ...proxy.runtimeArgs);
} else if (proxy.verbose) {
  console.log("Executing:", proxy.runtime, ...proxy.runtimeArgs);
}

console.log("\n" + "=".repeat(60) + "\n");

// Example 2: Development tool proxy
console.log("=== Example 2: Development Tool Proxy ===");

@command
class RunCommand {
  @arg({ description: "Script or binary name", type: "string" })
  name: string = "";

  @arg({ description: "Arguments to pass to the script/binary", raw: true })
  args: string[] = [];

  @opt({ description: "Run in background" })
  background: boolean = false;

  @opt({ description: "Restart on file changes" })
  watch: boolean = false;
}

@command
class TestCommand {
  @arg({ description: "Test framework arguments", raw: true })
  testArgs: string[] = [];

  @opt({ description: "Show coverage report" })
  coverage: boolean = false;

  @opt({ description: "Run tests in watch mode" })
  watch: boolean = false;
}

@cli({
  name: "devtool",
  description: "Development tool with proxy commands",
  exitOnError: false,
})
class DevTool extends Args {
  @opt({ description: "Enable debug output" })
  debug: boolean = false;

  @subCommand(RunCommand)
  run?: RunCommand;

  @subCommand(TestCommand)
  test?: TestCommand;
}

// Simulate different subcommands
const exampleCommands = [
  ["run", "deno", "run", "--allow-net", "server.ts", "--port", "3000"],
  ["test", "--coverage", "--", "--parallel", "--reporter", "json"],
];

for (const args of exampleCommands) {
  console.log(`\nTesting with args: ${JSON.stringify(args)}`);

  try {
    const result = DevTool.parse(args);

    console.log("Debug:", result.debug);

    if (result.run) {
      console.log("Run command detected:");
      console.log("- Name:", result.run.name);
      console.log("- Args:", result.run.args);
      console.log("- Background:", result.run.background);
      console.log("- Watch:", result.run.watch);
    }

    if (result.test) {
      console.log("Test command detected:");
      console.log("- Test args:", result.test.testArgs);
      console.log("- Coverage:", result.test.coverage);
      console.log("- Watch:", result.test.watch);
    }
  } catch (error) {
    console.log(
      "Error:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

console.log("\n" + "=".repeat(60) + "\n");

// Example 3: Package manager proxy
console.log("=== Example 3: Package Manager Proxy ===");

@cli({
  name: "pkg-proxy",
  description: "Universal package manager proxy",
  exitOnError: false,
})
class PackageProxy extends Args {
  @arg({
    description: "Package manager (npm, yarn, pnpm, bun)",
    type: "string",
  })
  manager: string = "";

  @arg({ description: "Command (install, run, build, etc.)", type: "string" })
  command: string = "";

  @arg({ description: "All arguments for the package manager", raw: true })
  managerArgs: string[] = [];

  @opt({ description: "Show what would be executed without running" })
  whatIf: boolean = false;

  @opt({ description: "Force operation even if risky" })
  force: boolean = false;
}

const pkgProxy = PackageProxy.parse([
  "npm",
  "run",
  "build",
  "--",
  "--production",
  "--verbose",
]);

console.log("Package manager:", pkgProxy.manager);
console.log("Command:", pkgProxy.command);
console.log("Manager args:", pkgProxy.managerArgs);
console.log("What-if mode:", pkgProxy.whatIf);
console.log("Force:", pkgProxy.force);

const fullCommand = [
  pkgProxy.manager,
  pkgProxy.command,
  ...pkgProxy.managerArgs,
];
console.log("Full command that would be executed:", fullCommand.join(" "));

console.log("\n" + "=".repeat(60) + "\n");

// Example 4: Complex validation with raw rest
console.log("=== Example 4: Validation with raw rest ===");

@cli({
  name: "validated-proxy",
  description: "Proxy with validation",
  exitOnError: false,
})
class ValidatedProxy extends Args {
  @arg({ description: "Execution mode", type: "string" })
  mode: string = "";

  @arg({ description: "Command and arguments to execute", raw: true })
  cmdArgs: string[] = [];

  @opt({ description: "Set execution timeout in seconds", type: "number" })
  timeout: number = 30;

  @opt({ description: "Capture stdout/stderr" })
  capture: boolean = false;
}

try {
  const validated = ValidatedProxy.parse(["exec", "ls", "-la", "/tmp"]);

  console.log("Mode:", validated.mode);
  console.log("Command args:", validated.cmdArgs);
  console.log("Timeout:", validated.timeout);
  console.log("Capture:", validated.capture);

  if (validated.cmdArgs.length === 0) {
    console.log("Warning: No command provided to execute");
  } else {
    console.log("Would execute:", validated.cmdArgs.join(" "));
    console.log("With timeout:", validated.timeout, "seconds");
    console.log("Capture output:", validated.capture);
  }
} catch (error) {
  console.log(
    "Validation error:",
    error instanceof Error ? error.message : String(error),
  );
}

console.log("\n" + "=".repeat(60) + "\n");

// Example 5: Real-world use case - CI/CD pipeline step
console.log("=== Example 5: CI/CD Pipeline Step ===");

@cli({
  name: "pipeline-step",
  description: "CI/CD pipeline step executor",
  exitOnError: false,
})
class PipelineStep extends Args {
  @arg({ description: "Step type (build, test, deploy, etc.)", type: "string" })
  stepType: string = "";

  @arg({ description: "Tool-specific command and arguments", raw: true })
  toolCommand: string[] = [];

  @opt({ description: "Environment (dev, staging, prod)" })
  env: string = "dev";

  @opt({ description: "Pipeline run ID" })
  runId: string = "";

  @opt({ description: "Skip safety checks" })
  skipChecks: boolean = false;

  @opt({ description: "Maximum execution time in minutes", type: "number" })
  maxTime: number = 30;
}

const pipeline = PipelineStep.parse([
  "deploy",
  "--env",
  "staging",
  "helm",
  "upgrade",
  "myapp",
  "./chart",
  "--set",
  "image.tag=v1.2.3",
]);

console.log("Step type:", pipeline.stepType);
console.log("Environment:", pipeline.env);
console.log("Run ID:", pipeline.runId);
console.log("Tool command:", pipeline.toolCommand);
console.log("Skip checks:", pipeline.skipChecks);
console.log("Max time:", pipeline.maxTime, "minutes");

// Simulate pipeline execution
console.log("\n🚀 Pipeline Step Execution:");
console.log("Environment:", pipeline.env);
console.log("Step:", pipeline.stepType);
console.log("Command:", pipeline.toolCommand.join(" "));
console.log("Safety checks:", pipeline.skipChecks ? "DISABLED" : "enabled");
console.log("Timeout:", pipeline.maxTime, "minutes");

console.log("\n" + "=".repeat(60) + "\n");

console.log("✅ All examples completed!");
