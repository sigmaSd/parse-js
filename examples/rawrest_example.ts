#!/usr/bin/env -S deno run --allow-all

/**
 * Comprehensive example demonstrating @rawRest decorator usage.
 *
 * The @rawRest decorator is perfect for building proxy commands that need to
 * forward arguments to other tools without parsing them as CLI options.
 *
 * Run examples:
 *   deno run examples/rawrest_example.ts
 *   deno run examples/rawrest_example.ts docker run --rm -it ubuntu bash
 *   deno run examples/rawrest_example.ts --verbose kubectl get pods --all-namespaces
 *   deno run examples/rawrest_example.ts --help
 */

import {
  argument,
  command,
  description,
  parse,
  rawRest,
  subCommand,
  type,
} from "../src/index.ts";

// Example 1: Simple proxy command
console.log("=== Example 1: Simple Proxy Command ===");

@parse(
  Deno.args.length > 0
    ? Deno.args
    : ["docker", "run", "--rm", "-it", "ubuntu", "bash"],
  {
    name: "container-proxy",
    description: "A proxy that forwards commands to container runtimes",
  },
)
class ContainerProxy {
  @argument({ description: "Container runtime (docker, podman, etc.)" })
  static runtime: string = "";

  @rawRest("All arguments to pass to the container runtime")
  static runtimeArgs: string[] = [];

  @description("Enable verbose logging")
  static verbose: boolean = false;

  @description("Dry run - show command but don't execute")
  static dryRun: boolean = false;
}

console.log("Runtime:", ContainerProxy.runtime);
console.log("Runtime args:", ContainerProxy.runtimeArgs);
console.log("Verbose:", ContainerProxy.verbose);
console.log("Dry run:", ContainerProxy.dryRun);

if (ContainerProxy.dryRun) {
  console.log(
    "Would execute:",
    ContainerProxy.runtime,
    ...ContainerProxy.runtimeArgs,
  );
} else if (ContainerProxy.verbose) {
  console.log(
    "Executing:",
    ContainerProxy.runtime,
    ...ContainerProxy.runtimeArgs,
  );
}

console.log("\n" + "=".repeat(60) + "\n");

// Example 2: Development tool proxy
console.log("=== Example 2: Development Tool Proxy ===");

@command
class RunCommand {
  @argument({ description: "Script or binary name" })
  static name: string = "";

  @rawRest("Arguments to pass to the script/binary")
  static args: string[] = [];

  @description("Run in background")
  static background: boolean = false;

  @description("Restart on file changes")
  static watch: boolean = false;
}

@command
class TestCommand {
  @rawRest("Test framework arguments")
  static testArgs: string[] = [];

  @description("Show coverage report")
  static coverage: boolean = false;

  @description("Run tests in watch mode")
  static watch: boolean = false;
}

// Simulate different subcommands
const exampleCommands = [
  ["run", "deno", "run", "--allow-net", "server.ts", "--port", "3000"],
  ["test", "--coverage", "--", "--parallel", "--reporter", "json"],
];

for (const args of exampleCommands) {
  console.log(`\nTesting with args: ${JSON.stringify(args)}`);

  try {
    @parse(args, {
      name: "devtool",
      description: "Development tool with proxy commands",
      exitOnError: false,
    })
    class DevTool {
      @description("Enable debug output")
      static debug: boolean = false;

      @description("Run a script with arguments")
      @subCommand(RunCommand)
      static run: RunCommand;

      @description("Run tests with framework arguments")
      @subCommand(TestCommand)
      static test: TestCommand;
    }

    console.log("Debug:", DevTool.debug);

    if (DevTool.run) {
      console.log("Run command detected:");
      console.log("- Name:", RunCommand.name);
      console.log("- Args:", RunCommand.args);
      console.log("- Background:", RunCommand.background);
      console.log("- Watch:", RunCommand.watch);
    }

    if (DevTool.test) {
      console.log("Test command detected:");
      console.log("- Test args:", TestCommand.testArgs);
      console.log("- Coverage:", TestCommand.coverage);
      console.log("- Watch:", TestCommand.watch);
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

@parse(["npm", "run", "build", "--", "--production", "--verbose"], {
  name: "pkg-proxy",
  description: "Universal package manager proxy",
  exitOnError: false,
})
class PackageProxy {
  @argument({ description: "Package manager (npm, yarn, pnpm, bun)" })
  static manager: string = "";

  @argument({ description: "Command (install, run, build, etc.)" })
  static command: string = "";

  @rawRest("All arguments for the package manager")
  static managerArgs: string[] = [];

  @description("Show what would be executed without running")
  static whatIf: boolean = false;

  @description("Force operation even if risky")
  static force: boolean = false;
}

console.log("Package manager:", PackageProxy.manager);
console.log("Command:", PackageProxy.command);
console.log("Manager args:", PackageProxy.managerArgs);
console.log("What-if mode:", PackageProxy.whatIf);
console.log("Force:", PackageProxy.force);

const fullCommand = [
  PackageProxy.manager,
  PackageProxy.command,
  ...PackageProxy.managerArgs,
];
console.log("Full command that would be executed:", fullCommand.join(" "));

console.log("\n" + "=".repeat(60) + "\n");

// Example 4: Complex validation with rawRest
console.log("=== Example 4: Validation with rawRest ===");

function _minArgs(min: number) {
  return (value: unknown) => {
    if (Array.isArray(value) && value.length < min) {
      return `must provide at least ${min} arguments`;
    }
    return null;
  };
}

function _validCommand() {
  return (value: unknown) => {
    if (
      typeof value === "string" && !["exec", "run", "spawn"].includes(value)
    ) {
      return "must be one of: exec, run, spawn";
    }
    return null;
  };
}

try {
  @parse(["exec", "ls", "-la", "/tmp"], {
    name: "validated-proxy",
    description: "Proxy with validation",
    exitOnError: false,
  })
  class ValidatedProxy {
    @argument({ description: "Execution mode" })
    @type("string")
    // Note: You would use @addValidator(validCommand()) here
    // but for this example we'll keep it simple
    static mode: string = "";

    @rawRest("Command and arguments to execute")
    // Note: You would use @addValidator(minArgs(1)) here
    static cmdArgs: string[] = [];

    @description("Set execution timeout in seconds")
    @type("number")
    static timeout: number = 30;

    @description("Capture stdout/stderr")
    static capture: boolean = false;
  }

  console.log("Mode:", ValidatedProxy.mode);
  console.log("Command args:", ValidatedProxy.cmdArgs);
  console.log("Timeout:", ValidatedProxy.timeout);
  console.log("Capture:", ValidatedProxy.capture);

  if (ValidatedProxy.cmdArgs.length === 0) {
    console.log("Warning: No command provided to execute");
  } else {
    console.log("Would execute:", ValidatedProxy.cmdArgs.join(" "));
    console.log("With timeout:", ValidatedProxy.timeout, "seconds");
    console.log("Capture output:", ValidatedProxy.capture);
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

@parse([
  "deploy",
  "--env",
  "staging",
  "helm",
  "upgrade",
  "myapp",
  "./chart",
  "--set",
  "image.tag=v1.2.3",
], {
  name: "pipeline-step",
  description: "CI/CD pipeline step executor",
  exitOnError: false,
})
class PipelineStep {
  @argument({ description: "Step type (build, test, deploy, etc.)" })
  static stepType: string = "";

  @rawRest("Tool-specific command and arguments")
  static toolCommand: string[] = [];

  @description("Environment (dev, staging, prod)")
  static env: string = "dev";

  @description("Pipeline run ID")
  static runId: string = "";

  @description("Skip safety checks")
  static skipChecks: boolean = false;

  @description("Maximum execution time in minutes")
  @type("number")
  static maxTime: number = 30;
}

console.log("Step type:", PipelineStep.stepType);
console.log("Environment:", PipelineStep.env);
console.log("Run ID:", PipelineStep.runId);
console.log("Tool command:", PipelineStep.toolCommand);
console.log("Skip checks:", PipelineStep.skipChecks);
console.log("Max time:", PipelineStep.maxTime, "minutes");

// Simulate pipeline execution
console.log("\n🚀 Pipeline Step Execution:");
console.log("Environment:", PipelineStep.env);
console.log("Step:", PipelineStep.stepType);
console.log("Command:", PipelineStep.toolCommand.join(" "));
console.log("Safety checks:", PipelineStep.skipChecks ? "DISABLED" : "enabled");
console.log("Timeout:", PipelineStep.maxTime, "minutes");

console.log("\n" + "=".repeat(60) + "\n");

console.log("✅ All @rawRest examples completed!");
console.log("\nKey benefits of @rawRest:");
console.log("• Captures all remaining arguments without parsing flags");
console.log("• Perfect for proxy commands that forward to other tools");
console.log("• Works seamlessly with regular CLI options and validation");
console.log("• Supports complex command hierarchies with subcommands");
console.log("• Handles edge cases like -- separator and mixed argument orders");
