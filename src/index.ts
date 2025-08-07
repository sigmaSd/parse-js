import type { ParseOptions, ParseResult, SubCommand } from "./types.ts";
import { collectArgumentDefs } from "./metadata.ts";
import { parseArguments } from "./parsers/commands.ts";
import { printHelp } from "./help.ts";
import { handleHelpDisplay } from "./error-handling.ts";

/**
 * Main parse function and class decorator factory.
 *
 * This is the primary entry point for the CLI parsing system. It can be used
 * as a decorator on classes to automatically parse command line arguments and
 * populate static class properties with the parsed values.
 *
 * The parsing process:
 * 1. Analyze the target class to collect argument definitions
 * 2. Extract subcommand relationships from decorator metadata
 * 3. Parse the provided arguments according to the definitions
 * 4. Validate all parsed values against their validation rules
 * 5. Apply the parsed values to the class properties
 * 6. Handle help flags and error conditions automatically
 *
 * @param args - Array of command line arguments to parse (e.g., Deno.args)
 * @param options - Optional configuration for the application
 * @param options.name - Application name shown in help text
 * @param options.description - Application description shown in help text
 * @returns A class decorator function
 *
 * @throws Will exit the process with code 1 on parsing or validation errors (unless exitOnError is false)
 * @throws Will exit the process with code 0 when help is requested (unless exitOnHelp is false)
 *
 * @example Simple application:
 * ```ts
 * @parse(Deno.args, { name: "calculator", description: "A simple calculator" })
 * class Calculator {
 *   @description("First number")
 *   static a: number = 0;
 *
 *   @description("Second number")
 *   static b: number = 0;
 *
 *   @description("Operation to perform")
 *   @type("string")
 *   @addValidator(oneOf(["add", "subtract", "multiply", "divide"]))
 *   static operation: string = "add";
 * }
 * ```
 *
 * @example With validation:
 * ```ts
 * @parse(Deno.args)
 * class ServerConfig {
 *   @description("Port number (1-65535)")
 *   @addValidator(range(1, 65535))
 *   static port: number = 8080;
 *
 *   @description("Server environment")
 *   @addValidator(oneOf(["development", "staging", "production"]))
 *   static env: string = "development";
 * }
 * ```
 *
 * @example Complex application with subcommands:
 * ```ts
 * @command
 * class DeployCommand {
 *   @description("Deployment environment")
 *   static env: string = "staging";
 *
 *   @description("Skip confirmation prompts")
 *   static force: boolean = false;
 * }
 *
 * @parse(Deno.args, { name: "myapp", description: "Application deployment tool" })
 * class MyApp {
 *   @description("Enable verbose logging")
 *   static verbose: boolean = false;
 *
 *   @description("Deploy the application")
 *   @subCommand(DeployCommand)
 *   static deploy: DeployCommand;
 * }
 * ```
 */
export function parse(
  args: string[],
  options?: ParseOptions,
): <T extends new () => unknown>(target: T, ctx: ClassDecoratorContext) => T {
  return function <T extends new () => unknown>(
    target: T,
    ctx: ClassDecoratorContext,
  ): T {
    // Use addInitializer to run the parsing logic when the class is initialized
    ctx.addInitializer(function () {
      const klass = this as unknown as {
        [Symbol.metadata]?: Record<string | symbol, unknown>;
        [key: string]: unknown;
      };

      // Collect argument definitions from the class
      const { parsedArgs, argumentDefs } = collectArgumentDefs(
        klass as unknown as new () => unknown,
      );

      // Extract subcommand definitions from class metadata
      const subCommands = collectSubCommands(klass);

      // Handle default command when no arguments are provided
      if (args.length === 0 && options?.defaultCommand) {
        if (options.defaultCommand === "help") {
          // Show help and exit
          const helpText = printHelp(
            parsedArgs,
            argumentDefs,
            options,
            subCommands.size > 0 ? subCommands : undefined,
          );
          handleHelpDisplay(helpText, options);
        } else if (subCommands.has(options.defaultCommand)) {
          // Run the default subcommand
          const defaultArgs = [options.defaultCommand];
          const parsed = parseArguments(
            defaultArgs,
            parsedArgs,
            argumentDefs,
            options,
            subCommands.size > 0 ? subCommands : undefined,
          );
          applyParsedValues(
            klass,
            parsedArgs,
            argumentDefs,
            subCommands,
            parsed,
          );
          return;
        }
      }

      // Parse the provided arguments
      const parsed = parseArguments(
        args,
        parsedArgs,
        argumentDefs,
        options,
        subCommands.size > 0 ? subCommands : undefined,
      );

      // Apply parsed values to class properties
      applyParsedValues(klass, parsedArgs, argumentDefs, subCommands, parsed);
    });

    return target;
  };
}

/**
 * Determines if a property is a user-defined static property vs a built-in class property.
 *
 * Built-in properties like `length`, `name`, and `prototype` have specific characteristics:
 * - `writable: false` and `enumerable: false` for built-ins
 * - `writable: true` and `enumerable: true` for user-defined static properties
 *
 * @param descriptor - Property descriptor from Object.getOwnPropertyDescriptor()
 * @returns true if this is a user-defined property that should be processed
 */
function isUserDefinedProperty(descriptor: PropertyDescriptor): boolean {
  // User-defined static properties are typically writable and enumerable
  // Built-in properties are typically non-writable and non-enumerable
  return descriptor.writable === true && descriptor.enumerable === true;
}

/**
 * Collects subcommand definitions from a class's metadata.
 *
 * This function scans through all static properties of a class to find
 * those marked with the @subCommand decorator, building a map of available
 * subcommands for the parsing system.
 *
 * @param klass - The class to scan for subcommand properties
 * @returns Map of subcommand names to their definitions
 */
function collectSubCommands(klass: {
  [Symbol.metadata]?: Record<string | symbol, unknown>;
  [key: string]: unknown;
}): Map<string, SubCommand> {
  const subCommands = new Map<string, SubCommand>();
  const propertyNames = Object.getOwnPropertyNames(klass);
  const classMetadata = klass[Symbol.metadata];

  for (const propName of propertyNames) {
    const descriptor = Object.getOwnPropertyDescriptor(klass, propName);

    // Skip built-in class properties, but allow user-defined properties with the same names
    if (
      (propName === "length" || propName === "name" ||
        propName === "prototype") &&
      (!descriptor || !isUserDefinedProperty(descriptor))
    ) {
      continue;
    }

    // Check for subcommand metadata
    const propertyMetadata = classMetadata?.[propName] as {
      subCommand?: new () => unknown;
      description?: string;
    };

    if (propertyMetadata?.subCommand) {
      subCommands.set(propName, {
        name: propName,
        commandClass: propertyMetadata.subCommand,
        description: propertyMetadata.description,
      });
    }
  }

  return subCommands;
}

/**
 * Applies parsed values to class properties.
 *
 * This function takes the parsed argument values and assigns them to the
 * appropriate static properties on the target class. It handles regular
 * options, positional arguments, and subcommand instances.
 *
 * @param klass - The target class to modify
 * @param parsedArgs - Regular CLI options definitions
 * @param argumentDefs - Positional argument definitions
 * @param subCommands - Subcommand definitions
 * @param parsed - The parsed values object
 */
function applyParsedValues(
  klass: { [key: string]: unknown },
  parsedArgs: Array<{ name: string }>,
  argumentDefs: Map<number, { name: string }>,
  subCommands: Map<string, SubCommand>,
  parsed: ParseResult,
): void {
  // Apply regular option values
  for (const arg of parsedArgs) {
    if (Object.prototype.hasOwnProperty.call(parsed, arg.name)) {
      klass[arg.name] = parsed[arg.name];
    }
  }

  // Apply positional argument values
  for (const [_index, argDef] of argumentDefs) {
    if (Object.prototype.hasOwnProperty.call(parsed, argDef.name)) {
      klass[argDef.name] = parsed[argDef.name];
    }
  }

  // Apply subcommand instances
  for (const [name, _subCommand] of subCommands) {
    if (Object.prototype.hasOwnProperty.call(parsed, name)) {
      klass[name] = parsed[name];
    }
  }
}

// Re-export all public APIs
export * from "./types.ts";
export {
  addValidator,
  argument,
  command,
  type DecoratorContext,
  description,
  required,
  subCommand,
  type,
  validate,
} from "./decorators.ts";
export {
  arrayLength,
  custom,
  integer,
  length,
  max,
  min,
  oneOf,
  pattern,
  range,
  validateValue,
} from "./validation.ts";
export { printHelp } from "./help.ts";
export { collectArgumentDefs, extractTypeFromDescriptor } from "./metadata.ts";
export {
  captureHelpText,
  ErrorHandlers,
  ErrorMessages,
  handleHelpDisplay,
  handleParsingError,
  isParseError,
  ParseError,
} from "./error-handling.ts";
