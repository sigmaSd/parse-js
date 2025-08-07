/**
 * Example demonstrating configurable error handling in the CLI parser.
 *
 * This example shows how to use the new error handling features to create
 * more robust CLI applications that don't always exit on errors.
 */

import {
  command,
  description,
  isParseError,
  parse,
  required,
  subCommand,
  type,
} from "../src/index.ts";

// Example 1: Default behavior (exits on errors)
console.log("=== Example 1: Default Behavior (Process Exit) ===");

try {
  @parse(["--port", "invalid"], {
    name: "default-app",
    description: "App with default error handling",
  })
  class _DefaultConfig {
    static port: number = 8080;
    static debug: boolean = false;
  }
} catch {
  console.log("This won't be reached - process.exit() was called");
}

// Example 2: Graceful error handling (throws instead of exiting)
console.log("\n=== Example 2: Graceful Error Handling ===");

try {
  @parse(["--port", "invalid"], {
    name: "graceful-app",
    description: "App with graceful error handling",
    exitOnError: false,
    exitOnHelp: false,
  })
  class _GracefulConfig {
    static port: number = 8080;
    static debug: boolean = false;
  }
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
  @parse(["--help"], {
    name: "custom-app",
    description: "App with custom handlers",
    exitOnError: false,
    exitOnHelp: false,
    onError: handleError,
    onHelp: handleHelp,
  })
  class _CustomConfig {
    @description("Server port number")
    static port: number = 8080;

    @description("Enable debug logging")
    static debug: boolean = false;
  }
} catch {
  console.log("Help was displayed via custom handler");
}

// Example 4: Server application that shouldn't crash
console.log("\n=== Example 4: Server Application ===");

@command
class StartCommand {
  @description("Port to listen on")
  static port: number = 3000;

  @description("Host to bind to")
  static host: string = "localhost";

  @required()
  @type("string")
  @description("Configuration file path")
  static config: string;
}

@command
class StopCommand {
  @description("Force stop without graceful shutdown")
  static force: boolean = false;
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

        @parse(args, {
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
        class ServerConfig {
          @subCommand(StartCommand)
          static start: StartCommand;

          @subCommand(StopCommand)
          static stop: StopCommand;

          @description("Global verbose flag")
          static verbose: boolean = false;
        }

        // Process successful command
        if (ServerConfig.start) {
          console.log(
            `✅ Start command: port=${StartCommand.port}, config=${StartCommand.config}`,
          );
        } else if (ServerConfig.stop) {
          console.log(
            `✅ Stop command: force=${StopCommand.force}`,
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

class TestRunner {
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
        @parse(testCase.args, {
          name: "test-app",
          exitOnError: false,
          exitOnHelp: false,
        })
        class TestConfig {
          static port: number = 8080;
          static debug: boolean = false;
        }

        if (testCase.shouldSucceed) {
          console.log(`   ✅ PASS - Arguments parsed successfully`);
          console.log(
            `   📊 port=${TestConfig.port}, debug=${TestConfig.debug}`,
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

class ConfigManager {
  static loadConfig(args: string[]) {
    try {
      @parse(args, {
        name: "config-app",
        exitOnError: false,
        onError: (error) => {
          console.log(`⚠️  Configuration error: ${error}`);
          console.log("   Loading default configuration...");
        },
      })
      class AppConfig {
        @description("Database URL")
        @required()
        @type("string")
        static dbUrl: string;

        @description("API port")
        static port: number = 3000;

        @description("Environment")
        static env: string = "development";
      }

      return {
        dbUrl: AppConfig.dbUrl,
        port: AppConfig.port,
        env: AppConfig.env,
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

// Test configuration loading
const configs = [
  ["--dbUrl", "postgres://localhost/myapp", "--port", "8080"],
  ["--port", "8080"], // Missing required dbUrl
  ["--dbUrl", "postgres://localhost/myapp", "--port", "invalid"], // Invalid port
];

for (const args of configs) {
  console.log(`\n🔧 Loading config with: ${args.join(" ")}`);
  const config = ConfigManager.loadConfig(args);
  console.log(`   📋 Final config:`, config);
}

// Run the examples
console.log("\n" + "=".repeat(60));
console.log("Running server example...");
const _server = new ServerApp();
// Note: In a real application, you would await server.start()
// For this example, we'll just show it's possible

console.log("\nRunning test suite...");
await TestRunner.runTests();

console.log("\n✨ All examples completed!");
console.log("\nKey benefits of configurable error handling:");
console.log("• Server applications don't crash on invalid CLI input");
console.log("• Testing frameworks can validate error scenarios");
console.log("• Custom error handling for logging and monitoring");
console.log("• Graceful degradation with fallback configurations");
console.log("• Better integration with larger applications");
