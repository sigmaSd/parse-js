////////////////
// CLI Argument Parsing Library
//

/**
 * A function that validates a value and returns an error message or null if valid.
 */
import process from "node:process";

/**
 * A function that validates a value and returns an error message or null if valid.
 *
 * @param value - The value to validate
 * @returns Error message string if validation fails, null if validation passes
 */
export type Validator = (value: unknown) => string | null;

interface ParsedArg {
  name: string;
  type: "string" | "number" | "boolean" | "string[]" | "number[]";
  description?: string;
  default?: string | number | boolean | string[] | number[];
  validators?: Validator[];
}

interface SubCommand {
  name: string;
  description?: string;
  commandClass: new () => unknown;
}

interface PropertyMetadata {
  type?: "string" | "number" | "boolean" | "string[]" | "number[]";
  validators?: Validator[];
  description?: string;
  subCommand?: new () => unknown;
}

function extractTypeFromDescriptor(
  descriptor: PropertyDescriptor,
  metadata: PropertyMetadata,
  propertyName: string,
  className: string,
): "string" | "number" | "boolean" | "string[]" | "number[]" {
  // First check if type was explicitly set via @type decorator
  if (metadata.type) {
    return metadata.type;
  }

  // Fall back to inferring from default value
  if (descriptor?.value !== undefined) {
    if (typeof descriptor.value === "string") return "string";
    if (typeof descriptor.value === "number") return "number";
    if (typeof descriptor.value === "boolean") return "boolean";
    if (Array.isArray(descriptor.value)) {
      if (descriptor.value.length === 0) {
        // Empty array, default to string[] unless type is specified
        return "string[]";
      }
      const firstElement = descriptor.value[0];
      if (typeof firstElement === "string") return "string[]";
      if (typeof firstElement === "number") return "number[]";
    }
  }

  // Error if we can't determine the type
  throw new Error(
    `Property '${propertyName}' in class '${className}' has no default value and no @type decorator. ` +
      `Either provide a default value like 'static ${propertyName}: number = 0' or use @type("number").`,
  );
}

function validateValue(
  value: unknown,
  validators: Validator[] = [],
): string | null {
  for (const validator of validators) {
    const error = validator(value);
    if (error) return error;
  }
  return null;
}

function parseGlobalOptions(
  args: string[],
  parsedArgs: ParsedArg[],
  result: Record<
    string,
    string | number | boolean | string[] | number[] | unknown
  >,
  argMap: Map<string, ParsedArg>,
  options?: { name?: string; description?: string },
  subCommands?: Map<string, SubCommand>,
  commandName?: string,
  commandPath?: string,
) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      printHelp(
        parsedArgs,
        options?.name,
        options?.description,
        subCommands,
        commandName,
        commandPath,
      );
      process.exit(0);
    }

    if (arg.startsWith("--")) {
      const [key, value] = arg.includes("=") ? arg.slice(2).split("=", 2) : [
        arg.slice(2),
        args[i + 1]?.startsWith("--") ? undefined : args[i + 1],
      ];

      const argDef = argMap.get(key);
      if (!argDef) {
        console.error(`Unknown argument: --${key}`);
        process.exit(1);
        return; // Never reached, but helps TypeScript
      }

      if (argDef.type === "boolean") {
        if (value === undefined) {
          result[key] = true;
        } else {
          result[key] = value === "true" || value === "1";
        }
        if (value === undefined) {
          continue; // don't skip next arg
        }
      } else {
        if (value === undefined) {
          console.error(`Missing value for argument: --${key}`);
          process.exit(1);
          return; // Never reached, but helps TypeScript
        }

        if (argDef.type === "string[]") {
          const arrayValues = value.split(",");
          const validationError = validateValue(arrayValues, argDef.validators);
          if (validationError) {
            console.error(`Validation error for --${key}: ${validationError}`);
            process.exit(1);
            return; // Never reached, but helps TypeScript
          }

          result[key] = arrayValues;
        } else if (argDef.type === "number[]") {
          const arrayValues = value.split(",");
          const numbers: number[] = [];

          for (const val of arrayValues) {
            const num = parseFloat(val.trim());
            if (isNaN(num)) {
              console.error(`Invalid number in array for --${key}: ${val}`);
              process.exit(1);
              return; // Never reached, but helps TypeScript
            }
            numbers.push(num);
          }

          const validationError = validateValue(numbers, argDef.validators);
          if (validationError) {
            console.error(`Validation error for --${key}: ${validationError}`);
            process.exit(1);
            return; // Never reached, but helps TypeScript
          }

          result[key] = numbers;
        } else if (argDef.type === "number") {
          const num = parseFloat(value);
          if (isNaN(num)) {
            console.error(`Invalid number for --${key}: ${value}`);
            process.exit(1);
            return; // Never reached, but helps TypeScript
          }

          // Validate the number
          const validationError = validateValue(num, argDef.validators);
          if (validationError) {
            console.error(`Validation error for --${key}: ${validationError}`);
            process.exit(1);
            return; // Never reached, but helps TypeScript
          }

          result[key] = num;
        } else {
          // Validate string values
          const validationError = validateValue(value, argDef.validators);
          if (validationError) {
            console.error(`Validation error for --${key}: ${validationError}`);
            process.exit(1);
            return; // Never reached, but helps TypeScript
          }

          result[key] = value;
        }

        if (value !== undefined && !arg.includes("=")) i++; // skip next arg since we used it as value
      }
    }
  }
}

function parseCommandClass(
  commandClass: new () => unknown,
  args: string[],
  appName?: string,
  commandName?: string,
  commandPath?: string,
): unknown {
  // Create a temporary parse decorator for the command class
  const tempArgs = args.slice(); // Copy args to avoid mutation

  // Apply parse logic to command class
  const klass = commandClass as unknown as {
    [Symbol.metadata]?: Record<string | symbol, unknown>;
    name: string;
    [key: string]: unknown;
  };
  const parsedArgs: ParsedArg[] = [];

  // Get metadata from command class
  const classMetadata = klass[Symbol.metadata] as
    | Record<string | symbol, unknown>
    | undefined;

  // Get all static properties from the command class
  const propertyNames = Object.getOwnPropertyNames(klass);

  for (const propName of propertyNames) {
    if (
      propName === "length" || propName === "name" ||
      propName === "prototype"
    ) {
      continue; // Skip built-in properties
    }

    const descriptor = Object.getOwnPropertyDescriptor(klass, propName);

    if (descriptor && "value" in descriptor) {
      const propertyMetadata =
        (classMetadata?.[propName] as PropertyMetadata) || {};

      // Skip subcommand properties - they'll be handled separately
      if (propertyMetadata.subCommand) {
        continue;
      }

      let type: "string" | "number" | "boolean" | "string[]" | "number[]";
      try {
        type = extractTypeFromDescriptor(
          descriptor,
          propertyMetadata,
          propName,
          klass.name,
        );
      } catch (_error) {
        throw new Error(
          `Property '${propName}' in command class '${klass.name}' has no default value and no @type decorator. ` +
            `Either provide a default value like 'static ${propName}: number = 0' or use @type("number").`,
        );
      }

      parsedArgs.push({
        name: propName,
        type,
        default: descriptor.value,
        validators: propertyMetadata.validators || [],
        description: propertyMetadata.description,
      });
    }
  }

  // Collect subcommands from metadata (for nested subcommands)
  const subCommands = new Map<string, SubCommand>();
  for (const propName of propertyNames) {
    if (
      propName === "length" || propName === "name" ||
      propName === "prototype"
    ) {
      continue;
    }

    const propertyMetadata = classMetadata?.[propName] as PropertyMetadata;
    if (propertyMetadata?.subCommand) {
      subCommands.set(propName, {
        name: propName,
        commandClass: propertyMetadata.subCommand,
        description: propertyMetadata.description,
      });
    }
  }

  // Parse the command arguments with potential nested subcommands
  const parsed = parseArguments(
    tempArgs,
    parsedArgs,
    { name: appName },
    subCommands.size > 0 ? subCommands : undefined,
    commandName,
    commandPath,
  );

  // Apply parsed values to command class
  for (const arg of parsedArgs) {
    if (Object.prototype.hasOwnProperty.call(parsed, arg.name)) {
      klass[arg.name] = parsed[arg.name];
    }
  }

  // Set subcommand instances
  for (const [name, _subCommand] of subCommands) {
    if (Object.prototype.hasOwnProperty.call(parsed, name)) {
      klass[name] = parsed[name];
    }
  }

  // Return an instance of the command class
  return new commandClass();
}

function parseArguments(
  args: string[],
  parsedArgs: ParsedArg[],
  options?: { name?: string; description?: string },
  subCommands?: Map<string, SubCommand>,
  commandName?: string,
  commandPath?: string,
): Record<string, string | number | boolean | string[] | number[] | unknown> {
  const result: Record<
    string,
    string | number | boolean | string[] | number[] | unknown
  > = {};
  const argMap = new Map(parsedArgs.map((arg) => [arg.name, arg]));

  // Parse global options first, then look for subcommands
  let subCommandIndex = -1;
  let subCommandName = "";

  // Find the subcommand position (first non-flag argument that's a known subcommand)
  if (subCommands) {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (
        !arg.startsWith("--") && !arg.startsWith("-") && subCommands.has(arg)
      ) {
        subCommandIndex = i;
        subCommandName = arg;
        break;
      }
    }
  }

  // If we found a subcommand, split args into global and subcommand parts
  if (subCommandIndex >= 0) {
    const globalArgs = args.slice(0, subCommandIndex);
    const subCommandArgs = args.slice(subCommandIndex + 1);
    const subCommand = subCommands!.get(subCommandName)!;

    // Parse global options first
    parseGlobalOptions(
      globalArgs,
      parsedArgs,
      result,
      argMap,
      options,
      subCommands,
      commandName,
      commandPath,
    );

    // Parse subcommand with updated command path
    const newCommandPath = commandPath
      ? `${commandPath} ${subCommandName}`
      : subCommandName;
    const commandInstance = parseCommandClass(
      subCommand.commandClass,
      subCommandArgs,
      options?.name,
      subCommandName,
      newCommandPath,
    );

    result[subCommandName] = commandInstance;
    return result;
  }

  // No subcommand found, parse all args as global options
  parseGlobalOptions(
    args,
    parsedArgs,
    result,
    argMap,
    options,
    subCommands,
    commandName,
    commandPath,
  );

  // Validate all properties after parsing
  // Post validation to handle the case where arguments are completely omitted from the command line
  for (const argDef of parsedArgs) {
    // Only validate properties that weren't already validated during parsing
    if (result[argDef.name] === undefined) {
      const value = argDef.default;
      const validationError = validateValue(value, argDef.validators);
      if (validationError) {
        console.error(
          `Validation error for --${argDef.name}: ${validationError}`,
        );
        process.exit(1);
        return result; // Never reached, but helps TypeScript
      }
    }
  }

  return result;
}

function printHelp(
  parsedArgs: ParsedArg[],
  appName?: string,
  appDescription?: string,
  subCommands?: Map<string, SubCommand>,
  commandName?: string,
  commandPath?: string,
) {
  if (appName && appDescription) {
    console.log(`${appName}`);
    console.log("");
    console.log(appDescription);
    console.log("");
  }

  console.log("Usage:");
  if (commandName) {
    // This is help for a specific subcommand
    const fullCommandPath = commandPath || commandName;
    const hasSubCommands = subCommands && subCommands.size > 0;
    if (hasSubCommands) {
      console.log(
        `  ${
          appName || "[runtime] script.js"
        } ${fullCommandPath} <command> [options]`,
      );
      console.log("");
      console.log("Commands:");
      for (const [name, subCommand] of subCommands) {
        console.log(`  ${name}`);
        if (subCommand.description) {
          console.log(`      ${subCommand.description}`);
        }
      }
      console.log("");
      console.log("Options:");
    } else {
      console.log(
        `  ${appName || "[runtime] script.js"} ${fullCommandPath} [options]`,
      );
      console.log("");
      console.log("Options:");
    }
  } else if (subCommands && subCommands.size > 0) {
    console.log(`  ${appName || "[runtime] script.js"} <command> [options]`);
    console.log("");
    console.log("Commands:");
    for (const [name, subCommand] of subCommands) {
      console.log(`  ${name}`);
      if (subCommand.description) {
        console.log(`      ${subCommand.description}`);
      }
    }
    console.log("");
    console.log("Global Options:");
  } else {
    console.log(`  ${appName || "[runtime] script.js"} [options]`);
    console.log("");
    console.log("Options:");
  }

  for (const arg of parsedArgs) {
    const longFlag = `--${arg.name}`;
    let typeHint = "";
    if (arg.type !== "boolean") {
      if (arg.type === "string[]") {
        typeHint = " <string,string,...>";
      } else if (arg.type === "number[]") {
        typeHint = " <number,number,...>";
      } else {
        typeHint = ` <${arg.type}>`;
      }
    }
    const description = arg.description || "";

    console.log(`  ${longFlag}${typeHint}`);
    if (description) {
      console.log(`      ${description}`);
    }
  }

  console.log("  --help");
  console.log("      Show this help message");
}

/**
 * Class decorator factory that enables CLI argument parsing for static class properties.
 *
 * @param args - The array of arguments to parse
 * @param options - Optional app configuration
 * @param options.name - The name of the application (shown in help)
 * @param options.description - A brief description of the application (shown in help)
 * @returns A decorator function
 *
 * @example
 * ```ts
 * const args = ["--port", "3000", "--debug"];
 * @parse(args)
 * class Config {
 *   static port: number = 8000;
 *   static debug: boolean = false;
 * }
 *
 * // With app info
 * @parse(args, { name: "myapp", description: "A simple web server" })
 * class Config {
 *   static port: number = 8000;
 * }
 * ```
 */
export function parse(
  args: string[],
  options?: { name?: string; description?: string },
): <T extends new () => unknown>(target: T, ctx: ClassDecoratorContext) => T {
  return function <T extends new () => unknown>(
    target: T,
    ctx: ClassDecoratorContext,
  ): T {
    ctx.addInitializer(function () {
      const klass = this as typeof Object;
      const parsedArgs: ParsedArg[] = [];

      // Get metadata object from the class
      const classMetadata = (klass as unknown as {
        [Symbol.metadata]?: Record<string | symbol, unknown>;
      })[Symbol.metadata];

      // Get all static properties from the class prototype
      const propertyNames = Object.getOwnPropertyNames(klass);

      for (const propName of propertyNames) {
        if (
          propName === "length" || propName === "name" ||
          propName === "prototype"
        ) {
          continue; // Skip built-in properties
        }

        const descriptor = Object.getOwnPropertyDescriptor(klass, propName);

        if (descriptor && "value" in descriptor) {
          const propertyMetadata =
            (classMetadata?.[propName] as PropertyMetadata) || {};

          // Skip subcommand properties - they'll be handled separately
          if (propertyMetadata.subCommand) {
            continue;
          }

          let type: "string" | "number" | "boolean" | "string[]" | "number[]";
          try {
            type = extractTypeFromDescriptor(
              descriptor,
              propertyMetadata,
              propName,
              target.name,
            );
          } catch (_error) {
            throw new Error(
              `Property '${propName}' in class '${target.name}' has no default value and no @type decorator. ` +
                `Either provide a default value like 'static ${propName}: number = 0' or use @type("number").`,
            );
          }

          parsedArgs.push({
            name: propName,
            type,
            default: descriptor.value,
            validators: propertyMetadata.validators || [],
            description: propertyMetadata.description,
          });
        }
      }

      // Collect subcommands from metadata
      const subCommands = new Map<string, SubCommand>();
      for (const propName of propertyNames) {
        if (
          propName === "length" || propName === "name" ||
          propName === "prototype"
        ) {
          continue;
        }

        const propertyMetadata = classMetadata?.[propName] as PropertyMetadata;
        if (propertyMetadata?.subCommand) {
          subCommands.set(propName, {
            name: propName,
            commandClass: propertyMetadata.subCommand,
            description: propertyMetadata.description,
          });
        }
      }

      // Parse the provided arguments
      const parsed = parseArguments(
        args,
        parsedArgs,
        options,
        subCommands.size > 0 ? subCommands : undefined,
      );

      // Set values on the class
      for (const arg of parsedArgs) {
        if (Object.prototype.hasOwnProperty.call(parsed, arg.name)) {
          (klass as unknown as Record<string, unknown>)[arg.name] =
            parsed[arg.name];
        }
        // Keep default values if not provided
      }

      // Set subcommand instances
      for (const [name, _subCommand] of subCommands) {
        if (Object.prototype.hasOwnProperty.call(parsed, name)) {
          (klass as unknown as Record<string, unknown>)[name] = parsed[name];
        }
      }
    });

    return target;
  };
}

/**
 * Type decorator factory to explicitly specify the type of a property.
 *
 * @param t - The type of the property
 * @returns A decorator function
 *
 * @example
 * ```ts
 * @type("number")
 * @required
 * static timeout: number;
 * ```
 */
export function type(
  t: "string" | "number" | "boolean" | "string[]" | "number[]",
): (
  _target: unknown,
  context: {
    name: string | symbol;
    metadata?: Record<string | symbol, unknown>;
  },
) => void {
  return function (
    _target: unknown,
    context: {
      name: string | symbol;
      metadata?: Record<string | symbol, unknown>;
    },
  ) {
    if (!context.metadata) {
      throw new Error(
        "Decorator metadata is not available. Make sure you're using a compatible TypeScript/JavaScript environment.",
      );
    }

    const propertyMetadata =
      (context.metadata[context.name] as PropertyMetadata) || {};
    propertyMetadata.type = t;
    context.metadata[context.name] = propertyMetadata;
  };
}

/**
 * Description decorator to add help text for properties.
 *
 * @param text - The description text to show in help
 * @returns A decorator function
 *
 * @example
 * ```ts
 * @description("The port number to listen on")
 * static port: number = 8080;
 * ```
 */
export function description(text: string): (
  _target: unknown,
  context: {
    name: string | symbol;
    metadata?: Record<string | symbol, unknown>;
  },
) => void {
  return function (
    _target: unknown,
    context: {
      name: string | symbol;
      metadata?: Record<string | symbol, unknown>;
    },
  ) {
    if (!context.metadata) {
      throw new Error(
        "Decorator metadata is not available. Make sure you're using a compatible TypeScript/JavaScript environment.",
      );
    }

    const propertyMetadata =
      (context.metadata[context.name] as PropertyMetadata) || {};

    propertyMetadata.description = text;
    context.metadata[context.name] = propertyMetadata;
  };
}

/**
 * Utility function for creating custom validation decorators.
 *
 * @param validator - The validation function to apply
 * @returns A decorator function
 *
 * @example
 * ```ts
 * function min(minValue: number) {
 *   return addValidator((value: unknown) => {
 *     if (typeof value === "number" && value < minValue) {
 *       return `must be at least ${minValue}`;
 *     }
 *     return null;
 *   });
 * }
 *
 * function required() {
 *   return addValidator((value: unknown) => {
 *     if (value === undefined || value === null || value === "") {
 *       return `is required`;
 *     }
 *     return null;
 *   });
 * }
 * ```
 */
export function addValidator(validator: Validator): (
  _target: unknown,
  context: {
    name: string | symbol;
    metadata?: Record<string | symbol, unknown>;
  },
) => void {
  return function (
    _target: unknown,
    context: {
      name: string | symbol;
      metadata?: Record<string | symbol, unknown>;
    },
  ) {
    if (!context.metadata) {
      throw new Error(
        "Decorator metadata is not available. Make sure you're using a compatible TypeScript/JavaScript environment.",
      );
    }

    const propertyMetadata =
      (context.metadata[context.name] as PropertyMetadata) || {};

    if (!propertyMetadata.validators) {
      propertyMetadata.validators = [];
    }

    propertyMetadata.validators.push(validator);
    context.metadata[context.name] = propertyMetadata;
  };
}

/**
 * Required decorator to mark a property as required.
 * This is a convenience function that uses addValidator internally.
 *
 * @example
 * ```ts
 * @type("number")
 * @required
 * static timeout: number;
 * ```
 */
export function required(): (
  _target: unknown,
  context: {
    name: string | symbol;
    metadata?: Record<string | symbol, unknown>;
  },
) => void {
  return addValidator((value: unknown) => {
    if (value === undefined || value === null || value === "") {
      return `is required`;
    }
    return null;
  });
}

/**
 * Command decorator to mark a class as a command class for subcommand parsing.
 *
 * @example
 * ```ts
 * @command
 * class RunCommand {
 *   static force: boolean = false;
 *   static verbose: boolean = false;
 * }
 * ```
 */
export function command<T extends new () => unknown>(
  target: T,
  _ctx: ClassDecoratorContext,
): T {
  // This decorator serves as a marker for command classes
  // No additional setup is needed - the class is identified by being passed to @subCommand()
  return target;
}

/**
 * Subcommand decorator to associate a property with a command class.
 *
 * @param commandClass - The command class to associate with this subcommand
 * @returns A decorator function
 *
 * @example
 * ```ts
 * @parse(Deno.args)
 * class MyArgs {
 *   @subCommand(RunCommand)
 *   static run: RunCommand;
 * }
 * ```
 */
export function subCommand<T extends new () => unknown>(
  commandClass: T,
): (
  _target: unknown,
  context: {
    name: string | symbol;
    metadata?: Record<string | symbol, unknown>;
  },
) => void {
  return function (
    _target: unknown,
    context: {
      name: string | symbol;
      metadata?: Record<string | symbol, unknown>;
    },
  ) {
    if (!context.metadata) {
      throw new Error(
        "Decorator metadata is not available. Make sure you're using a compatible TypeScript/JavaScript environment.",
      );
    }

    const propertyMetadata =
      (context.metadata[context.name] as PropertyMetadata) || {};

    propertyMetadata.subCommand = commandClass;
    context.metadata[context.name] = propertyMetadata;
  };
}
