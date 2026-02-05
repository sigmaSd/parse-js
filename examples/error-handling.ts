/**
 * Example demonstrating configurable error handling in the CLI parser.
 *
 * This example shows how to use the new error handling features to create
 * more robust CLI applications that don't always exit on errors.
 */

import {
  Args,
  cli,
  command,
  isParseError,
  option,
  subCommand,
} from "../mod.ts";

// Example 1: Default behavior (exits on errors)
console.log("=== Example 1: Default Behavior (Process Exit) ===");

try {
  @cli({
    name: "default-app",
    description: "App with default error handling",
  })
  class DefaultConfig extends Args {
    @option()
    port: number = 8080;

    @option()
    debug: boolean = false;
  }

  DefaultConfig.parse(["--port", "invalid"]);
} catch {
  console.log("This won't be reached - process.exit() was called");
}

// Example 2: Graceful error handling (throws instead of exiting)
console.log("\n=== Example 2: Graceful Error Handling ===");

try {
  @cli({
    name: "graceful-app",
    description: "App with graceful error handling",
    exitOnError: false,
    exitOnHelp: false,
  })
  class GracefulConfig extends Args {
    @option()
    port: number = 8080;

    @option()
    debug: boolean = false;
  }

  GracefulConfig.parse(["--port", "invalid"]);
} catch (error) {
  if (isParseError(error)) {
    console.log(`❌ Parse Error: ${error.message}`);
    console.log(`   Type: ${error.type}`);
    console.log(`   Exit Code: ${error.exitCode}`);
    if (error.context?.argumentName) {
      console.log(`   Argument: ${error.context.argumentName}`);
    }
  } else {
    console.log(`❌ Unexpected error: ${error}`);
  }
}

// Example 3: Custom error and help handlers
console.log("\n=== Example 3: Custom Handlers ===");

function handleError(error: string, exitCode: number) {
  console.log(`🔥 Custom Error Handler:`);
  console.log(`   Message: ${error}`);
  console.log(`   Exit Code: ${exitCode}`);
  console.log(`   Time: ${new Date().toISOString()}`);
}

function handleHelp(helpText: string) {
  console.log(`📖 Custom Help Handler:`);
  console.log("━".repeat(50));
  console.log(helpText);
  console.log("━".repeat(50));
  console.log("For more information, visit: https://example.com/docs");
}

try {
  @cli({
    name: "custom-app",
    description: "App with custom handlers",
    exitOnError: false,
    exitOnHelp: false,
    onError: handleError,
    onHelp: handleHelp,
  })
  class CustomConfig extends Args {
    @option({ description: "Server port number" })
    port: number = 8080;

    @option({ description: "Enable debug logging" })
    debug: boolean = false;
  }

  CustomConfig.parse(["--help"]);
} catch {
  console.log("Help was displayed via custom handler");
}

// Example 4: Server application that shouldn't crash
console.log("\n=== Example 4: Server Application ===");

@command
class StartCommand {
  @option({ description: "Port to listen on" })
  port: number = 3000;

  @option({ description: "Host to bind to" })
  host: string = "localhost";

  @option({
    description: "Configuration file path",
    required: true,
    type: "string",
  })
  config!: string;
}

@command
class StopCommand {
  @option({ description: "Force stop without graceful shutdown" })
  force: boolean = false;
}

class ServerApp {
  private isRunning = true;

  async start() {
    console.log("🚀 Server starting...");

    // Simulate server lifecycle
    while (this.isRunning) {
      await this.handleCommand();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log("🛑 Server stopped");
  }

  private handleCommand() {
    // Simulate receiving CLI commands while server is running
    const testCommands = [
      ["start", "--config", "app.json", "--port", "8080"],
      ["start", "--config"], // Missing value - should not crash server
      ["stop", "--force"],
      ["invalid-command"], // Unknown command - should not crash server
    ];

    for (const args of testCommands) {
      try {
        console.log(`\n📝 Processing command: ${args.join(" ")}`);

        @cli({
          name: "server",
          description: "Server management CLI",
          exitOnError: false, // Don't exit on errors
          exitOnHelp: false, // Don't exit on help
          onError: (error, code) => {
            console.log(`⚠️  Command failed: ${error} (code: ${code})`);
            console.log("   Server continues running...");
          },
          onHelp: (helpText) => {
            console.log("📋 Help requested:");
            console.log(helpText);
          },
        })
        class ServerConfig extends Args {
          @subCommand(StartCommand)
          start?: StartCommand;

          @subCommand(StopCommand)
          stop?: StopCommand;

          @option({ description: "Global verbose flag" })
          verbose: boolean = false;
        }

        const result = ServerConfig.parse(args);

        // Process successful command
        if (result.start) {
          console.log(
            `✅ Start command: port=${result.start.port}, config=${result.start.config}`,
          );
        } else if (result.stop) {
          console.log(
            `✅ Stop command: force=${result.stop.force}`,
          );
          this.isRunning = false;
          break;
        }
      } catch (error) {
        if (isParseError(error)) {
          // Parse errors are handled by onError callback above
          // Server continues running
        } else {
          console.log(`💥 Unexpected error: ${error}`);
          // Could log to monitoring system, etc.
        }
      }
    }
  }
}

// Example 5: Testing framework integration
console.log("\n=== Example 5: Testing Framework ===");

class _TestRunner {
  static runTests() {
    const testCases = [
      {
        name: "Valid arguments",
        args: ["--port", "3000", "--debug"],
        shouldSucceed: true,
      },
      {
        name: "Invalid port number",
        args: ["--port", "not-a-number"],
        shouldSucceed: false,
        expectedErrorType: "invalid_number",
      },
      {
        name: "Unknown argument",
        args: ["--unknown-flag"],
        shouldSucceed: false,
        expectedErrorType: "unknown_argument",
      },
      {
        name: "Missing required value",
        args: ["--port"],
        shouldSucceed: false,
        expectedErrorType: "missing_value",
      },
    ];

    for (const testCase of testCases) {
      console.log(`\n🧪 Test: ${testCase.name}`);

      try {
        @cli({
          name: "test-app",
          exitOnError: false,
          exitOnHelp: false,
        })
        class TestConfig extends Args {
          @option()
          port: number = 8080;

          @option()
          debug: boolean = false;
        }

        const result = TestConfig.parse(testCase.args);

        if (testCase.shouldSucceed) {
          console.log(`   ✅ PASS - Arguments parsed successfully`);
          console.log(
            `   📊 port=${result.port}, debug=${result.debug}`,
          );
        } else {
          console.log(`   ❌ FAIL - Expected error but parsing succeeded`);
        }
      } catch (error) {
        if (isParseError(error)) {
          if (!testCase.shouldSucceed) {
            if (
              !testCase.expectedErrorType ||
              error.type === testCase.expectedErrorType
            ) {
              console.log(`   ✅ PASS - Got expected error: ${error.message}`);
            } else {
              console.log(
                `   ❌ FAIL - Got error type ${error.type}, expected ${testCase.expectedErrorType}`,
              );
            }
          } else {
            console.log(`   ❌ FAIL - Unexpected error: ${error.message}`);
          }
        } else {
          console.log(`   ❌ FAIL - Unexpected error type: ${error}`);
        }
      }
    }
  }
}

// Example 6: Configuration validation with custom recovery
console.log("\n=== Example 6: Configuration Validation ===");

class _ConfigManager {
  static loadConfig(args: string[]) {
    try {
      @cli({
        name: "config-app",
        exitOnError: false,
        onError: (error) => {
          console.log(`⚠️  Configuration error: ${error}`);
          console.log("   Loading default configuration...");
        },
      })
      class AppConfig extends Args {
        @option({ description: "Database URL", required: true, type: "string" })
        dbUrl!: string;

        @option({ description: "API port" })
        port: number = 3000;

        @option({ description: "Environment" })
        env: string = "development";
      }

      const result = AppConfig.parse(args);
      return {
        dbUrl: result.dbUrl,
        port: result.port,
        env: result.env,
      };
    } catch (error) {
      if (isParseError(error)) {
        // Return safe defaults when parsing fails
        console.log("   Using fallback configuration");
        return {
          dbUrl: "sqlite://./app.db",
          port: 3000,
          env: "development",
        };
      }
      throw error;
    }
  }
}

// Run the examples
console.log("\nRunning server example...");
const _server = new ServerApp();
// Note: In a real application, you would await server.start()
// For this example, we'll just show it's possible

console.log("\nRunning test suite...");
_TestRunner.runTests();

console.log("\n✨ All examples completed!");
