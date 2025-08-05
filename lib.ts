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

interface ArgumentMetadata {
  index: number;
  description?: string;
  rest?: boolean;
}

interface ArgumentDef {
  name: string;
  type: "string" | "number" | "boolean" | "string[]" | "number[]";
  default?: unknown;
  validators?: Validator[];
  rest?: boolean;
  description?: string;
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
  argument?: ArgumentMetadata;
}

function collectArgumentDefs(
  klass: new () => unknown,
): {
  parsedArgs: ParsedArg[];
  argumentDefs: Map<number, ArgumentDef>;
} {
  const parsedArgs: ParsedArg[] = [];
  const argumentDefs = new Map<number, ArgumentDef>();

  const propertyNames = Object.getOwnPropertyNames(klass);
  const classMetadata = klass[Symbol.metadata] as
    | Record<string | symbol, unknown>
    | undefined;

  for (const propName of propertyNames) {
    if (propName === "length" || propName === "prototype") {
      continue;
    }

    const descriptor = Object.getOwnPropertyDescriptor(klass, propName);
    if (!descriptor || typeof descriptor.value === "function") continue;

    // Skip the built-in class name property
    if (propName === "name") {
      continue;
    }

    const metadata = classMetadata?.[propName] as PropertyMetadata | undefined;

    // Skip subcommand properties - they'll be handled separately
    if (metadata?.subCommand) {
      continue;
    }

    // Skip properties without metadata and without default values
    // These will be caught by extractTypeFromDescriptor and throw appropriate errors
    if (!metadata && descriptor.value === undefined) {
      // Try to extract type to trigger the error for properties without defaults/types
      try {
        extractTypeFromDescriptor(
          descriptor,
          {},
          propName,
          klass.name,
        );
      } catch (error) {
        throw error; // Re-throw the error from extractTypeFromDescriptor
      }
      continue; // This line should never be reached due to the error above
    }

    let type: "string" | "number" | "boolean" | "string[]" | "number[]";
    try {
      type = extractTypeFromDescriptor(
        descriptor,
        metadata || {},
        propName,
        klass.name,
      );
    } catch (_error) {
      // For positional arguments, allow missing type/default if we have argument metadata
      if (metadata?.argument) {
        // Try to infer type from property name or use string as default
        type = "string";
      } else {
        throw new Error(
          `Property '${propName}' in class '${klass.name}' has no default value and no @type decorator. ` +
            `Either provide a default value like 'static ${propName}: number = 0' or use @type("number").`,
        );
      }
    }

    // Handle positional arguments
    if (metadata?.argument) {
      argumentDefs.set(metadata.argument.index, {
        name: propName,
        type,
        default: descriptor.value,
        validators: metadata.validators,
        rest: metadata.argument.rest,
        description: metadata.argument.description,
      });
    } else {
      // Regular option
      parsedArgs.push({
        name: propName,
        type,
        description: metadata?.description,
        default: descriptor.value,
        validators: metadata?.validators || [],
      });
    }
  }

  // Validate argument definitions
  const sortedArgDefs = Array.from(argumentDefs.entries()).sort(([a], [b]) =>
    a - b
  );
  let hasRest = false;
  for (let i = 0; i < sortedArgDefs.length; i++) {
    const [index, argDef] = sortedArgDefs[i];
    if (index !== i) {
      throw new Error(
        `Argument positions must be sequential starting from 0. Missing argument at position ${i}.`,
      );
    }
    if (hasRest) {
      throw new Error(
        `Only the last argument can be marked as rest. Found argument at position ${index} after rest argument.`,
      );
    }
    if (argDef.rest) {
      hasRest = true;
    }
  }

  return { parsedArgs, argumentDefs };
}

function parsePositionalArguments(
  args: string[],
  argumentDefs: Map<number, ArgumentDef>,
  result: Record<
    string,
    string | number | boolean | string[] | number[] | unknown
  >,
  argMap: Map<string, ParsedArg>,
): string[] {
  const remainingArgs: string[] = [];
  const sortedArgDefs = Array.from(argumentDefs.entries()).sort(([a], [b]) =>
    a - b
  );

  let argIndex = 0;
  let positionalIndex = 0;

  while (argIndex < args.length) {
    const arg = args[argIndex];

    // Skip flags and their values
    if (arg.startsWith("--") || arg.startsWith("-")) {
      remainingArgs.push(arg);
      argIndex++;

      // Check if this flag expects a value
      const flagName = arg.startsWith("--")
        ? (arg.includes("=") ? arg.split("=")[0].slice(2) : arg.slice(2))
        : arg.slice(1);

      const argDef = argMap.get(flagName);
      if (
        argDef && argDef.type !== "boolean" && !arg.includes("=") &&
        argIndex < args.length
      ) {
        // This flag expects a value, skip the next argument too
        remainingArgs.push(args[argIndex]);
        argIndex++;
      }
      continue;
    }

    // This is a positional argument
    if (positionalIndex < sortedArgDefs.length) {
      const [, argDef] = sortedArgDefs[positionalIndex];

      if (argDef.rest) {
        // Collect all remaining non-flag arguments for rest parameter
        const restValues: string[] = [];
        while (argIndex < args.length && !args[argIndex].startsWith("-")) {
          if (argDef.type === "string[]") {
            restValues.push(args[argIndex]);
          } else if (argDef.type === "number[]") {
            const num = parseFloat(args[argIndex]);
            if (isNaN(num)) {
              console.error(
                `Invalid number in rest arguments for ${argDef.name}: ${
                  args[argIndex]
                }`,
              );
              process.exit(1);
            }
            restValues.push(args[argIndex]);
          }
          argIndex++;
        }

        if (argDef.type === "number[]") {
          result[argDef.name] = restValues.map((v) => parseFloat(v));
        } else {
          result[argDef.name] = restValues;
        }

        // Validate rest argument
        if (argDef.validators) {
          const validationError = validateValue(
            result[argDef.name],
            argDef.validators,
          );
          if (validationError) {
            console.error(
              `Validation error for positional argument ${argDef.name}: ${validationError}`,
            );
            process.exit(1);
          }
        }

        // Continue processing remaining arguments (which should be flags)
        positionalIndex++; // Move past the rest argument
      } else {
        // Single positional argument
        let value: string | number = arg;

        if (argDef.type === "number") {
          const num = parseFloat(arg);
          if (isNaN(num)) {
            console.error(
              `Invalid number for positional argument ${argDef.name}: ${arg}`,
            );
            process.exit(1);
          }
          value = num;
        }

        result[argDef.name] = value;

        // Validate single argument
        if (argDef.validators) {
          const validationError = validateValue(value, argDef.validators);
          if (validationError) {
            console.error(
              `Validation error for positional argument ${argDef.name}: ${validationError}`,
            );
            process.exit(1);
          }
        }

        positionalIndex++;
        argIndex++;
      }
    } else {
      // No more positional arguments expected, add to remaining
      remainingArgs.push(arg);
      argIndex++;
    }
  }

  return remainingArgs;
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
  argumentDefs: Map<number, ArgumentDef>,
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
        argumentDefs,
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

  // Collect both regular options and positional arguments
  const { parsedArgs, argumentDefs } = collectArgumentDefs(
    commandClass,
  );

  // Get all static properties from the command class
  const propertyNames = Object.getOwnPropertyNames(klass);
  const classMetadata = klass[Symbol.metadata] as
    | Record<string | symbol, unknown>
    | undefined;

  // Collect subcommands from metadata (for nested subcommands)
  const subCommands = new Map<string, SubCommand>();
  for (const propName of propertyNames) {
    if (propName === "length" || propName === "prototype") {
      continue;
    }

    const descriptor = Object.getOwnPropertyDescriptor(klass, propName);

    // Skip the built-in class name property (which is a getter, not a value)
    if (propName === "name" && descriptor && !("value" in descriptor)) {
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
    argumentDefs,
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

  // Set positional argument values on the command class
  for (const [_index, argDef] of argumentDefs) {
    if (Object.prototype.hasOwnProperty.call(parsed, argDef.name)) {
      klass[argDef.name] = parsed[argDef.name];
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
  argumentDefs: Map<number, ArgumentDef>,
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

  let remainingArgsAfterPositional: string[];

  if (subCommandIndex >= 0) {
    // We have a subcommand, so only parse positional args from before the subcommand
    const argsBeforeSubcommand = args.slice(0, subCommandIndex);
    remainingArgsAfterPositional = parsePositionalArguments(
      argsBeforeSubcommand,
      argumentDefs,
      result,
      argMap,
    );
    // Add the subcommand and args after it
    remainingArgsAfterPositional.push(...args.slice(subCommandIndex));
  } else {
    // No subcommand, parse all args for positional arguments
    remainingArgsAfterPositional = parsePositionalArguments(
      args,
      argumentDefs,
      result,
      argMap,
    );
  }

  // If we found a subcommand, split remaining args into global and subcommand parts
  if (subCommandIndex >= 0) {
    // Find the subcommand position in the remaining args
    let adjustedSubCommandIndex = -1;
    for (let i = 0; i < remainingArgsAfterPositional.length; i++) {
      if (remainingArgsAfterPositional[i] === subCommandName) {
        adjustedSubCommandIndex = i;
        break;
      }
    }

    if (adjustedSubCommandIndex >= 0) {
      const globalArgs = remainingArgsAfterPositional.slice(
        0,
        adjustedSubCommandIndex,
      );
      const subCommandArgs = remainingArgsAfterPositional.slice(
        adjustedSubCommandIndex + 1,
      );
      const subCommand = subCommands!.get(subCommandName)!;

      // Parse global options
      parseGlobalOptions(
        globalArgs,
        parsedArgs,
        result,
        argMap,
        argumentDefs,
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
  }

  // No subcommand found, parse remaining args as global options
  parseGlobalOptions(
    remainingArgsAfterPositional,
    parsedArgs,
    result,
    argMap,
    argumentDefs,
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

  // Validate positional arguments
  for (const [index, argDef] of argumentDefs) {
    if (result[argDef.name] === undefined && argDef.default !== undefined) {
      result[argDef.name] = argDef.default;
    }
    // Check if required positional arguments are missing
    if (result[argDef.name] === undefined && !argDef.rest) {
      console.error(
        `Missing required positional argument at position ${index}: ${argDef.name}`,
      );
      process.exit(1);
    }
  }

  return result;
}

function printHelp(
  parsedArgs: ParsedArg[],
  argumentDefs: Map<number, ArgumentDef>,
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

  // Generate usage string with positional arguments
  const sortedArgDefs = Array.from(argumentDefs.entries()).sort(([a], [b]) =>
    a - b
  );
  let usageArgs = "";
  for (const [_index, argDef] of sortedArgDefs) {
    if (argDef.rest) {
      usageArgs += ` <${argDef.name}...>`;
    } else {
      const isRequired = !argDef.default &&
        argDef.validators?.some((v) => v.toString().includes("required"));
      usageArgs += isRequired ? ` <${argDef.name}>` : ` [${argDef.name}]`;
    }
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
        } ${fullCommandPath}${usageArgs} <command> [options]`,
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
    } else {
      console.log(
        `  ${
          appName || "[runtime] script.js"
        } ${fullCommandPath}${usageArgs} [options]`,
      );
      console.log("");
    }

    // Show positional arguments if any
    if (argumentDefs.size > 0) {
      console.log("Arguments:");
      for (const [_index, argDef] of sortedArgDefs) {
        const isRequired = !argDef.default &&
          argDef.validators?.some((v) => v.toString().includes("required"));
        const requiredText = isRequired ? " (required)" : "";
        const restText = argDef.rest ? " (rest)" : "";
        console.log(`  ${argDef.name}${requiredText}${restText}`);
        if (argDef.description) {
          console.log(`      ${argDef.description}`);
        }
      }
      console.log("");
    }

    console.log("Options:");
  } else if (subCommands && subCommands.size > 0) {
    console.log(
      `  ${appName || "[runtime] script.js"}${usageArgs} <command> [options]`,
    );
    console.log("");

    // Show positional arguments if any
    if (argumentDefs.size > 0) {
      console.log("Arguments:");
      for (const [_index, argDef] of sortedArgDefs) {
        const isRequired = !argDef.default &&
          argDef.validators?.some((v) => v.toString().includes("required"));
        const requiredText = isRequired ? " (required)" : "";
        const restText = argDef.rest ? " (rest)" : "";
        console.log(`  ${argDef.name}${requiredText}${restText}`);
        if (argDef.description) {
          console.log(`      ${argDef.description}`);
        }
      }
      console.log("");
    }

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
    console.log(`  ${appName || "[runtime] script.js"}${usageArgs} [options]`);
    console.log("");

    // Show positional arguments if any
    if (argumentDefs.size > 0) {
      console.log("Arguments:");
      for (const [_index, argDef] of sortedArgDefs) {
        const isRequired = !argDef.default &&
          argDef.validators?.some((v) => v.toString().includes("required"));
        const requiredText = isRequired ? " (required)" : "";
        const restText = argDef.rest ? " (rest)" : "";
        console.log(`  ${argDef.name}${requiredText}${restText}`);
        if (argDef.description) {
          console.log(`      ${argDef.description}`);
        }
      }
      console.log("");
    }

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

      // Collect both regular options and positional arguments
      const { parsedArgs, argumentDefs } = collectArgumentDefs(klass);

      // Collect subcommands from metadata
      const subCommands = new Map<string, SubCommand>();
      const propertyNames = Object.getOwnPropertyNames(klass);
      const classMetadata = klass[Symbol.metadata] as
        | Record<string | symbol, unknown>
        | undefined;

      for (const propName of propertyNames) {
        if (propName === "length" || propName === "prototype") {
          continue;
        }

        const descriptor = Object.getOwnPropertyDescriptor(klass, propName);

        // Skip the built-in class name property (which is a getter, not a value)
        if (propName === "name" && descriptor && !("value" in descriptor)) {
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
        argumentDefs,
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

      // Set positional argument values on the class
      for (const [_index, argDef] of argumentDefs) {
        if (Object.prototype.hasOwnProperty.call(parsed, argDef.name)) {
          (klass as unknown as Record<string, unknown>)[argDef.name] =
            parsed[argDef.name];
        }
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

/**
 * Argument decorator to mark a property as a positional argument.
 *
 * @param index - The zero-based position index of the argument
 * @param description - Optional description for help text
 * @param options - Optional configuration object
 * @returns A decorator function
 *
 * @example
 * ```ts
 * @parse(Deno.args)
 * class Config {
 *   @argument(0, "Input file")
 *   static input: string;
 *
 *   @argument(1, "Output file")
 *   static output: string = "default.txt";
 *
 *   @argument(2, "Additional files", { rest: true })
 *   @type("string[]")
 *   static files: string[] = [];
 * }
 * ```
 */
export function argument(
  index: number,
  description?: string,
  options?: { rest?: boolean },
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

    propertyMetadata.argument = {
      index,
      description,
      rest: options?.rest,
    };

    if (description) {
      propertyMetadata.description = description;
    }

    context.metadata[context.name] = propertyMetadata;
  };
}
