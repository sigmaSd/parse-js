import type { ParseOptions, ParseResult, SupportedType } from "./types.ts";
import { printHelp } from "./help.ts";
import { handleHelpDisplay, handleParsingError } from "./error-handling.ts";

/**
 * Base class for CLI argument classes.
 *
 * Classes that extend Args get a static parse method for parsing command line arguments.
 */
export class Args {
  /**
   * Parse command line arguments and return a typed instance.
   */
  static parse<T extends Args>(this: new () => T, args: string[]): T {
    const instance = new this();

    // Get CLI options from class metadata
    const classMetadata = (this as unknown as {
      [Symbol.metadata]?: Record<string | symbol, unknown>;
    })[Symbol.metadata];

    const cliOptions = classMetadata?.__cliOptions as ParseOptions | undefined;

    const result = parseInstanceBased(
      instance as Record<string, unknown>,
      args,
      cliOptions,
    );

    // Create a new instance and copy the parsed values
    const typedResult = new this();
    Object.assign(typedResult, result);

    return typedResult;
  }
}

/**
 * CLI decorator to configure a class for command line parsing.
 *
 * This decorator marks a class as a CLI command and stores configuration
 * options in the class metadata. Classes should extend Args to get the parse method.
 *
 * @param options - Configuration options including name, description, etc.
 * @returns A class decorator function
 *
 * @example
 * ```ts
 * import { Args, cli, description, type } from "./index.ts";
 *
 * @cli({ name: "calculator", description: "A simple calculator application" })
 * class Calculator extends Args {
 *   @description("First number")
 *   a = 0;
 *
 *   @description("Second number")
 *   b = 0;
 *
 *   @description("Operation to perform")
 *   operation = "add";
 * }
 *
 * const args = Calculator.parse(Deno.args);
 * console.log(args.a, args.b, args.operation);
 * ```
 */
function cli(
  options: ParseOptions,
): <T extends new () => unknown>(target: T, ctx: ClassDecoratorContext) => T {
  return function <T extends new () => unknown>(
    target: T,
    ctx: ClassDecoratorContext,
  ): T {
    // Store CLI options in class metadata
    if (!ctx.metadata) {
      throw new Error(
        "Decorator metadata is not available. Make sure you're using a compatible TypeScript/JavaScript environment.",
      );
    }

    ctx.metadata.__cliOptions = options;

    return target;
  };
}

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
 * import { Args, cli, description, type, addValidator, oneOf } from "@sigma/parse";
 *
 * @cli({ name: "calculator", description: "A simple calculator" })
 * class Calculator extends Args {
 *   @description("First number")
 *   a = 0;
 *
 *   @description("Second number")
 *   b = 0;
 *
 *   @description("Operation to perform")
 *   @addValidator(oneOf(["add", "subtract", "multiply", "divide"]))
 *   operation = "add";
 * }
 * ```
 *
 * @example With validation:
 * ```ts
 * import { Args, cli, description, addValidator, range, oneOf } from "@sigma/parse";
 *
 * @cli({ name: "server" })
 * class ServerConfig extends Args {
 *   @description("Port number (1-65535)")
 *   @addValidator(range(1, 65535))
 *   port = 8080;
 *
 *   @description("Server environment")
 *   @addValidator(oneOf(["development", "staging", "production"]))
 *   env = "development";
 * }
 * ```
 *
 * @example Complex application with subcommands:
 * ```ts
 * import { Args, cli, command, description, subCommand } from "@sigma/parse";
 *
 * @command
 * class DeployCommand {
 *   @description("Deployment environment")
 *   env = "staging";
 *
 *   @description("Skip confirmation prompts")
 *   force = false;
 * }
 *
 * @cli({ name: "myapp", description: "Application deployment tool" })
 * class MyApp extends Args {
 *   @description("Enable verbose logging")
 *   verbose = false;
 *
 *   @description("Deploy the application")
 *   @subCommand(DeployCommand)
 *   deploy?: DeployCommand;
 * }
 * ```
 */

// Re-export all public APIs
export * from "./types.ts";
export {
  addValidator,
  argument,
  command,
  type DecoratorContext,
  description,
  rawRest,
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
  type ParseErrorType,
} from "./error-handling.ts";

/**
 * Collect argument definitions from an instance instead of a class.
 */
function collectArgumentDefsFromInstance(instance: Record<string, unknown>) {
  // Get the constructor to access metadata
  const constructor = instance.constructor as new () => unknown;
  const metadata = (constructor as {
    [Symbol.metadata]?: Record<string | symbol, unknown>;
  })[Symbol.metadata];

  // Similar to collectArgumentDefs but working with instance properties
  const parsedArgs: Array<{
    name: string;
    type: string;
    default: unknown;
    validators?: Array<(value: unknown) => string | null>;
    description?: string;
  }> = [];
  const argumentDefs: Array<{
    name: string;
    type: string;
    default: unknown;
    validators?: Array<(value: unknown) => string | null>;
    rest?: boolean;
    rawRest?: boolean;
    description?: string;
  }> = [];

  // Get all property names from the instance
  const propertyNames = Object.getOwnPropertyNames(instance);

  for (const propName of propertyNames) {
    const propertyMetadata = metadata?.[propName] as {
      argument?: { rest?: boolean; description?: string };
      rawRest?: { description?: string };
      subCommand?: new () => unknown;
      type?: string;
      validators?: Array<(value: unknown) => string | null>;
      description?: string;
    } | undefined;

    if (propertyMetadata?.argument) {
      // This is a positional argument
      // Check if property has no initializer and no @type decorator
      if (instance[propName] === undefined && !propertyMetadata.type) {
        throw new Error(
          `Property '${propName}' has no default value and no @type() decorator. ` +
            `Use @type("string"), @type("number"), etc. to specify the expected type. ` +
            `This is required because TypeScript cannot infer the type from undefined values.`,
        );
      }

      argumentDefs.push({
        name: propName,
        type: propertyMetadata.type || getTypeFromValue(instance[propName]),
        default: instance[propName],
        validators: propertyMetadata.validators || [],
        rest: propertyMetadata.argument.rest,
        description: propertyMetadata.description,
      });
    } else if (propertyMetadata?.rawRest) {
      // This is a raw rest argument
      // Check if property has no initializer and no @type decorator
      if (instance[propName] === undefined && !propertyMetadata.type) {
        throw new Error(
          `Property '${propName}' has no default value and no @type() decorator. ` +
            `Use @type("string[]") or another array type to specify the expected type. ` +
            `This is required because TypeScript cannot infer the type from undefined values.`,
        );
      }

      argumentDefs.push({
        name: propName,
        type: propertyMetadata?.type || getTypeFromValue(instance[propName]),
        default: instance[propName],
        validators: propertyMetadata?.validators || [],
        rawRest: true,
        description: propertyMetadata.rawRest.description,
      });
    } else if (!propertyMetadata?.subCommand) {
      // This is a regular option
      // Check if property has no initializer and no @type decorator
      if (instance[propName] === undefined && !propertyMetadata?.type) {
        throw new Error(
          `Property '${propName}' has no default value and no @type() decorator. ` +
            `Use @type("string"), @type("number"), etc. to specify the expected type. ` +
            `This is required because TypeScript cannot infer the type from undefined values.`,
        );
      }

      parsedArgs.push({
        name: propName,
        type: propertyMetadata?.type || getTypeFromValue(instance[propName]),
        default: instance[propName],
        validators: propertyMetadata?.validators || [],
        description: propertyMetadata?.description,
      });
    }
  }

  return { parsedArgs, argumentDefs };
}

/**
 * Get type string from a value for the new API.
 */
function getTypeFromValue(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === "number") {
      return "number[]";
    }
    return "string[]";
  }
  return typeof value;
}

/**
 * Collect subcommands from an instance.
 */
function collectSubCommandsFromInstance(
  instance: Record<string, unknown>,
): Map<string, {
  name: string;
  commandClass: new () => unknown;
  description?: string;
}> {
  const subCommands = new Map();
  const constructor = instance.constructor as new () => unknown;
  const metadata = (constructor as {
    [Symbol.metadata]?: Record<string | symbol, unknown>;
  })[Symbol.metadata];

  const propertyNames = Object.getOwnPropertyNames(instance);

  for (const propName of propertyNames) {
    const propertyMetadata = metadata?.[propName] as {
      subCommand?: new () => unknown;
      description?: string;
    } | undefined;

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
 * Apply parsed values to instance and return as plain object.
 */
function _applyParsedValuesToInstance(
  instance: Record<string, unknown>,
  parsedArgs: Array<{ name: string }>,
  argumentDefs: Array<{ name: string }>,
  subCommands: Map<string, { name: string; commandClass: new () => unknown }>,
  parsed: ParseResult,
): ParseResult {
  const result: ParseResult = {};

  // Apply regular option values
  for (const arg of parsedArgs) {
    if (Object.prototype.hasOwnProperty.call(parsed, arg.name)) {
      result[arg.name] = parsed[arg.name];
    } else {
      result[arg.name] = instance[arg.name]; // Use default from instance
    }
  }

  // Apply positional argument values
  for (const argDef of argumentDefs) {
    if (Object.prototype.hasOwnProperty.call(parsed, argDef.name)) {
      result[argDef.name] = parsed[argDef.name];
    } else {
      result[argDef.name] = instance[argDef.name]; // Use default from instance
    }
  }

  // Apply subcommand instances - convert to plain objects
  for (const [name, _subCommand] of subCommands) {
    if (Object.prototype.hasOwnProperty.call(parsed, name)) {
      // For subcommands, we need to extract the parsed values
      const commandInstance = parsed[name] as {
        constructor: new () => unknown;
      };
      const subResult: Record<string, unknown> = {};

      // Extract static properties that were set by the old parsing system
      const staticProps = Object.getOwnPropertyNames(
        commandInstance.constructor,
      );
      for (const propName of staticProps) {
        if (
          propName !== "length" && propName !== "name" &&
          propName !== "prototype"
        ) {
          const descriptor = Object.getOwnPropertyDescriptor(
            commandInstance.constructor,
            propName,
          );
          if (descriptor?.writable && descriptor?.enumerable) {
            subResult[propName] =
              (commandInstance.constructor as unknown as Record<
                string,
                unknown
              >)[
                propName
              ];
          }
        }
      }

      result[name] = subResult;
    }
  }

  return result;
}

/**
 * New instance-based parsing function that works entirely with instance properties.
 */
function parseInstanceBased(
  instance: Record<string, unknown>,
  args: string[],
  options?: ParseOptions,
): ParseResult {
  // Collect argument definitions from instance
  const { parsedArgs, argumentDefs } = collectArgumentDefsFromInstance(
    instance,
  );

  // Collect subcommands from instance
  const subCommands = collectSubCommandsFromInstance(instance);

  // Validate rawRest doesn't conflict with rest arguments
  const hasRest = argumentDefs.some((def) => def.rest);
  const hasRawRest = argumentDefs.some((def) => def.rawRest);

  if (hasRest && hasRawRest) {
    throw new Error(
      "Cannot use both @argument({rest: true}) and @rawRest() in the same command. Use @rawRest() for proxy commands or regular rest arguments for typed arrays.",
    );
  }

  // Create argument map for parsing
  const argMap = new Map<string, {
    name: string;
    type: string;
    validators?: Array<(value: unknown) => string | null>;
  }>();
  for (const arg of parsedArgs) {
    argMap.set(`--${arg.name}`, arg);
  }

  // Parse arguments manually using instance-based logic
  const result: ParseResult = {};

  // Initialize with defaults from instance
  for (const arg of parsedArgs) {
    result[arg.name] = instance[arg.name];
  }
  for (const argDef of argumentDefs) {
    result[argDef.name] = instance[argDef.name];
  }

  // Check for rawRest - if present, we need special handling
  const rawRestArg = argumentDefs.find((def) => def.rawRest);
  const regularArgDefs = argumentDefs.filter((def) => !def.rawRest);

  // Handle defaultCommand when no arguments are provided
  if (args.length === 0 && options?.defaultCommand) {
    if (options.defaultCommand === "help") {
      // Show help
      const helpText = printHelp(
        parsedArgs as Array<
          {
            name: string;
            type: SupportedType;
            description?: string;
            default?: string | number | boolean | string[] | number[];
            validators?: Array<(value: unknown) => string | null>;
          }
        >,
        argumentDefs as Array<
          {
            name: string;
            type: SupportedType;
            description?: string;
            default?: string | number | boolean | string[] | number[];
            validators?: Array<(value: unknown) => string | null>;
            rest?: boolean;
            rawRest?: boolean;
          }
        >,
        options,
        subCommands,
        options?.name || "cli",
        "",
      );
      handleHelpDisplay(helpText, options);
      return result;
    } else if (subCommands.has(options.defaultCommand)) {
      // Execute the default subcommand
      const subCommand = subCommands.get(options.defaultCommand)!;

      if (
        "parse" in subCommand.commandClass &&
        typeof (subCommand.commandClass as {
            parse?: (args: string[]) => unknown;
          }).parse === "function"
      ) {
        // Subcommand extends Args, use its parse method
        result[options.defaultCommand] = (subCommand.commandClass as {
          parse: (args: string[]) => unknown;
        }).parse([]);
      } else {
        // Plain subcommand class, use instance-based parsing and return typed instance
        const subInstance = new subCommand.commandClass() as Record<
          string,
          unknown
        >;

        // Get subcommand's own options from its metadata
        const subCommandMetadata = (subCommand.commandClass as unknown as {
          [Symbol.metadata]?: Record<string | symbol, unknown>;
        })[Symbol.metadata];
        const subCommandOptions = subCommandMetadata?.__cliOptions as
          | ParseOptions
          | undefined;

        // Inherit parent's error handling options but not defaultCommand
        const mergedOptions = subCommandOptions || (options
          ? {
            ...options,
            defaultCommand: undefined,
          }
          : undefined);

        const parsedValues = parseInstanceBased(
          subInstance,
          [],
          mergedOptions,
        );

        // Create a new instance and assign the parsed values to it
        const typedResult = new subCommand.commandClass();
        Object.assign(typedResult as Record<string, unknown>, parsedValues);
        result[options.defaultCommand] = typedResult;
      }
      return result;
    }
  }

  // Simple argument parsing (basic implementation)
  let i = 0;
  let positionalIndex = 0;
  let rawRestStarted = false;

  while (i < args.length) {
    const arg = args[i];

    // If rawRest has started, capture everything
    if (rawRestStarted && rawRestArg) {
      const currentValues = result[rawRestArg.name] as string[] || [];
      currentValues.push(arg);
      result[rawRestArg.name] = currentValues;
      i++;
      continue;
    }

    if (arg === "--") {
      // Handle -- separator - everything after this goes to positional args
      i++;
      // Process remaining args as positional
      while (i < args.length) {
        const positionalArg = args[i];
        const positionalDef = regularArgDefs[positionalIndex];

        if (positionalDef) {
          if (positionalDef.rest) {
            // Rest argument - collect all remaining
            const currentValues = result[positionalDef.name] as string[] || [];
            currentValues.push(positionalArg);
            result[positionalDef.name] = currentValues;
          } else {
            // Regular positional argument
            result[positionalDef.name] = positionalArg;
            positionalIndex++;
          }
        }
        i++;
      }
      break;
    } else if (arg.startsWith("--")) {
      // Handle flag
      let flagName: string;
      let flagValue: string | undefined;

      // Check for --flag=value format
      if (arg.includes("=")) {
        const parts = arg.split("=", 2);
        flagName = parts[0].slice(2);
        flagValue = parts[1];
      } else {
        flagName = arg.slice(2);
      }

      const argDef = argMap.get(`--${flagName}`);

      if (!argDef) {
        // Handle help flags specially
        if (flagName === "help" || flagName === "h") {
          const helpText = printHelp(
            parsedArgs as Array<
              {
                name: string;
                type: SupportedType;
                description?: string;
                default?: string | number | boolean | string[] | number[];
                validators?: Array<(value: unknown) => string | null>;
              }
            >,
            argumentDefs as Array<
              {
                name: string;
                type: SupportedType;
                description?: string;
                default?: string | number | boolean | string[] | number[];
                validators?: Array<(value: unknown) => string | null>;
                rest?: boolean;
                rawRest?: boolean;
              }
            >,
            options || {},
            subCommands,
            options?.name || "cli",
            "",
          );
          handleHelpDisplay(helpText, options || {});
          return result;
        }

        // Check if it's a subcommand
        if (subCommands.has(flagName)) {
          // This shouldn't happen as subcommands don't start with --
          i++;
          continue;
        }

        // If rawRest is present, unknown flags should be captured by it
        if (rawRestArg && !rawRestStarted) {
          rawRestStarted = true;
          const currentValues = result[rawRestArg.name] as string[] || [];
          currentValues.push(arg);
          result[rawRestArg.name] = currentValues;
          i++;
          continue;
        }

        try {
          handleParsingError(
            `Unknown argument: --${flagName}`,
            options,
            "unknown_argument",
            { argumentName: `--${flagName}` },
            1,
          );
        } catch (error) {
          throw error;
        }
        // If custom handler doesn't throw/exit, continue parsing
        i++;
        continue;
      }

      if (argDef.type === "boolean") {
        if (flagValue !== undefined) {
          result[flagName] = parseValue(flagValue, "boolean");
        } else {
          result[flagName] = true;
        }
        i++;
      } else {
        let value: string;
        if (flagValue !== undefined) {
          value = flagValue;
          i++;
        } else {
          // Expect next argument as value
          i++;
          if (i >= args.length) {
            try {
              handleParsingError(
                `Missing value for argument: --${flagName}`,
                options,
                "missing_value",
                { argumentName: `--${flagName}` },
                1,
              );
            } catch (error) {
              throw error;
            }
            // If custom handler doesn't throw/exit, use empty string as fallback
            value = "";
          } else {
            value = args[i];
            i++;
          }
        }
        result[flagName] = parseValue(
          value,
          argDef.type,
          options,
          `--${flagName}`,
        );
      }
    } else if (subCommands.has(arg)) {
      // Handle subcommand
      const subCommand = subCommands.get(arg)!;
      const remainingArgs = args.slice(i + 1);

      // Recursively parse subcommand
      if (
        "parse" in subCommand.commandClass &&
        typeof (subCommand.commandClass as {
            parse?: (args: string[]) => unknown;
          }).parse === "function"
      ) {
        // Subcommand extends Args, use its parse method
        result[arg] = (subCommand.commandClass as {
          parse: (args: string[]) => unknown;
        }).parse(remainingArgs);
      } else {
        // Plain subcommand class, use instance-based parsing and return typed instance
        const subInstance = new subCommand.commandClass() as Record<
          string,
          unknown
        >;

        // Get subcommand's own options from its metadata
        const subCommandMetadata = (subCommand.commandClass as unknown as {
          [Symbol.metadata]?: Record<string | symbol, unknown>;
        })[Symbol.metadata];
        const subCommandOptions = subCommandMetadata?.__cliOptions as
          | ParseOptions
          | undefined;

        // Inherit parent's error handling options but not defaultCommand
        const mergedOptions = subCommandOptions || (options
          ? {
            ...options,
            defaultCommand: undefined,
          }
          : undefined);

        const parsedValues = parseInstanceBased(
          subInstance,
          remainingArgs,
          mergedOptions,
        );

        // Create a new instance and assign the parsed values to it
        const typedResult = new subCommand.commandClass();
        Object.assign(typedResult as Record<string, unknown>, parsedValues);
        result[arg] = typedResult;
      }
      break; // Stop processing after subcommand
    } else {
      // Handle positional argument
      if (positionalIndex < regularArgDefs.length) {
        const argDef = regularArgDefs[positionalIndex];
        if (argDef.rest) {
          // Collect remaining non-flag arguments
          const remainingPositionals: string[] = [];
          for (let j = i; j < args.length; j++) {
            if (!args[j].startsWith("--")) {
              remainingPositionals.push(args[j]);
            } else {
              // Stop collecting when we hit a flag
              break;
            }
          }
          result[argDef.name] = remainingPositionals.map((val) =>
            parseValue(val, argDef.type.replace("[]", ""), options, argDef.name)
          );
          // Skip past the positional arguments we just processed
          i += remainingPositionals.length;
        } else {
          result[argDef.name] = parseValue(
            arg,
            argDef.type,
            options,
            argDef.name,
          );
          positionalIndex++;
          i++;
        }
      } else if (rawRestArg && !rawRestStarted) {
        // All regular positionals satisfied, start rawRest capture
        rawRestStarted = true;
        const currentValues = result[rawRestArg.name] as string[] || [];
        currentValues.push(arg);
        result[rawRestArg.name] = currentValues;
        i++;
      } else {
        // Unknown positional argument - only error if no rawRest
        if (!rawRestArg) {
          throw new Error(`Unknown argument: ${arg}`);
        } else {
          // Start rawRest capture for unknown positionals
          if (!rawRestStarted) {
            rawRestStarted = true;
          }
          const currentValues = result[rawRestArg.name] as string[] || [];
          currentValues.push(arg);
          result[rawRestArg.name] = currentValues;
        }
        i++;
      }
    }
  }

  // Validate required fields for flag arguments
  for (const arg of parsedArgs) {
    if (arg.validators) {
      for (const validator of arg.validators) {
        const error = validator(result[arg.name]);
        if (error) {
          try {
            handleParsingError(
              `Validation error for --${arg.name}: ${error}`,
              options,
              "validation_error",
              {
                argumentName: arg.name,
                validationMessage: error,
              },
              1,
            );
          } catch (parseError) {
            throw parseError;
          }
          // If custom handler doesn't throw/exit, continue
          break;
        }
      }
    }
  }

  // Validate required fields for positional arguments
  for (const argDef of argumentDefs) {
    if (argDef.validators) {
      for (const validator of argDef.validators) {
        const error = validator(result[argDef.name]);
        if (error) {
          try {
            handleParsingError(
              `Validation error for argument '${argDef.name}': ${error}`,
              options,
              "validation_error",
              {
                argumentName: argDef.name,
                validationMessage: error,
              },
              1,
            );
          } catch (parseError) {
            throw parseError;
          }
          // If custom handler doesn't throw/exit, continue
          break;
        }
      }
    }
  }

  return result;
}

/**
 * Parse a string value to the specified type.
 */
function parseValue(
  value: string,
  type: string,
  options?: ParseOptions,
  argName?: string,
): unknown {
  switch (type) {
    case "number": {
      const num = Number(value);
      if (isNaN(num)) {
        const errorMsg = argName
          ? `Invalid number for ${
            argName.startsWith("--") ? argName : argName
          }: ${value}`
          : `Invalid number: ${value}`;
        try {
          handleParsingError(
            errorMsg,
            options,
            "invalid_number",
            { value },
            1,
          );
        } catch (error) {
          throw error;
        }
        // If custom handler doesn't throw/exit, return 0 as fallback
        return 0;
      }
      return num;
    }
    case "boolean": {
      return value.toLowerCase() === "true";
    }
    case "string[]": {
      return value.split(",").map((s) => s.trim());
    }
    case "number[]": {
      return value.split(",").map((s) => {
        const num = Number(s.trim());
        if (isNaN(num)) {
          const errorMsg = argName
            ? `Invalid number in array for ${
              argName.startsWith("--") ? argName : argName
            }: ${s}`
            : `Invalid number in array: ${s}`;
          try {
            handleParsingError(
              errorMsg,
              options,
              "invalid_array_number",
              { value: s },
              1,
            );
          } catch (error) {
            throw error;
          }
          // If custom handler doesn't throw/exit, return 0 as fallback
          return 0;
        }
        return num;
      });
    }
    default: {
      return value;
    }
  }
}

// Export the Args-based CLI API
export { cli };
