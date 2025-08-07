/**
 * Command and subcommand parsing for hierarchical CLI interfaces.
 *
 * This module handles the complex logic of parsing subcommands and building
 * nested command structures. It supports commands like:
 * - `git commit --message "fix"`
 * - `docker container ls --all`
 * - `npm run build --production`
 *
 * Key features:
 * - Recursive command parsing for nested subcommands
 * - Proper argument separation between parent and child commands
 * - Command-specific help generation
 * - Integration with positional arguments and global options
 *
 * Workflow:
 * 1. Identify subcommand position in argument list
 * 2. Split arguments into global (before subcommand) and command-specific
 * 3. Parse global arguments with parent command context
 * 4. Recursively parse subcommand with its own argument definitions
 * 5. Build command path for proper help display
 */

import process from "node:process";
import type {
  ArgumentDef,
  ParsedArg,
  ParseOptions,
  ParseResult,
  SubCommand,
} from "../types.ts";
import { collectArgumentDefs } from "../metadata.ts";
import { parsePositionalArguments } from "./positional.ts";
import { parseGlobalOptions } from "./options.ts";
import { validateValue } from "../validation.ts";

/**
 * Parses a command class and its arguments recursively.
 *
 * This function handles the complete parsing of a command class, including:
 * - Collecting argument definitions from the class
 * - Finding and parsing subcommands
 * - Applying parsed values to class properties
 * - Building the command hierarchy
 *
 * The parsing process:
 * 1. Analyze the command class to extract argument definitions
 * 2. Scan for subcommand properties in the class metadata
 * 3. Call parseArguments to handle the actual parsing logic
 * 4. Apply parsed values back to the class properties
 * 5. Return an instance of the command class
 *
 * @param commandClass - The class constructor to parse arguments for
 * @param args - Raw command line arguments for this command
 * @param appName - Application name for help text
 * @param commandName - Name of this specific command
 * @param commandPath - Full path to this command (e.g., "git commit")
 * @returns An instance of the command class with parsed values
 *
 * @example
 * ```ts
 * @command
 * class BuildCommand {
 *   static production: boolean = false;
 *   static output: string = "dist";
 * }
 *
 * const instance = parseCommandClass(
 *   BuildCommand,
 *   ["--production", "--output", "build"],
 *   "myapp",
 *   "build",
 *   "myapp build"
 * );
 * ```
 */
export function parseCommandClass(
  commandClass: new () => unknown,
  args: string[],
  appName?: string,
  commandName?: string,
  commandPath?: string,
): unknown {
  // Cast to access static properties and metadata
  const klass = commandClass as unknown as {
    [Symbol.metadata]?: Record<string | symbol, unknown>;
    name: string;
    [key: string]: unknown;
  };

  // Collect argument definitions from the command class
  const { parsedArgs, argumentDefs } = collectArgumentDefs(commandClass);

  // Extract subcommand definitions from class metadata
  const subCommands = collectSubCommands(klass);

  // Parse arguments with potential subcommand handling
  const parsed = parseArguments(
    args,
    parsedArgs,
    argumentDefs,
    { name: appName },
    subCommands.size > 0 ? subCommands : undefined,
    commandName,
    commandPath,
  );

  // Apply parsed values to the command class
  applyParsedValues(klass, parsedArgs, argumentDefs, subCommands, parsed);

  // Return an instance of the command class
  return new commandClass();
}

/**
 * Main argument parsing orchestrator with subcommand support.
 *
 * This is the core parsing function that coordinates between different
 * types of arguments and handles subcommand detection and delegation.
 *
 * Algorithm:
 * 1. Scan arguments to find the first subcommand
 * 2. If subcommand found, split arguments at that point
 * 3. Parse positional arguments before the subcommand
 * 4. Parse global options before the subcommand
 * 5. Recursively parse the subcommand with its arguments
 * 6. If no subcommand, parse all arguments as global
 *
 * @param args - Raw command line arguments
 * @param parsedArgs - Expected CLI options for this command
 * @param argumentDefs - Expected positional arguments for this command
 * @param options - App configuration (name, description)
 * @param subCommands - Available subcommands
 * @param commandName - Current command name
 * @param commandPath - Full command path for help
 * @returns Parsed values object
 */
export function parseArguments(
  args: string[],
  parsedArgs: ParsedArg[],
  argumentDefs: Map<number, ArgumentDef>,
  options?: ParseOptions,
  subCommands?: Map<string, SubCommand>,
  commandName?: string,
  commandPath?: string,
): ParseResult {
  const result: ParseResult = {};
  const argMap = new Map(parsedArgs.map((arg) => [arg.name, arg]));

  // Find subcommand position in arguments
  const subCommandInfo = findSubCommand(args, subCommands);

  if (subCommandInfo) {
    // Subcommand found - parse in sections
    return parseWithSubCommand(
      args,
      parsedArgs,
      argumentDefs,
      argMap,
      result,
      subCommandInfo,
      options,
      subCommands!,
      commandName,
      commandPath,
    );
  } else {
    // No subcommand - parse all arguments as global
    return parseWithoutSubCommand(
      args,
      parsedArgs,
      argumentDefs,
      argMap,
      result,
      options,
      subCommands,
      commandName,
      commandPath,
    );
  }
}

/**
 * Finds the first subcommand in the argument list.
 *
 * @param args - Command line arguments
 * @param subCommands - Available subcommands map
 * @returns Subcommand info if found, null otherwise
 */
function findSubCommand(
  args: string[],
  subCommands?: Map<string, SubCommand>,
): { index: number; name: string; command: SubCommand } | null {
  if (!subCommands) return null;

  // Look for the first non-flag argument that matches a known subcommand
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--") && !arg.startsWith("-") && subCommands.has(arg)) {
      return {
        index: i,
        name: arg,
        command: subCommands.get(arg)!,
      };
    }
  }

  return null;
}

/**
 * Parses arguments when a subcommand is present.
 *
 * This function handles the complex case where arguments need to be
 * split between the parent command and the subcommand.
 */
function parseWithSubCommand(
  args: string[],
  parsedArgs: ParsedArg[],
  argumentDefs: Map<number, ArgumentDef>,
  argMap: Map<string, ParsedArg>,
  result: ParseResult,
  subCommandInfo: { index: number; name: string; command: SubCommand },
  options?: ParseOptions,
  subCommands?: Map<string, SubCommand>,
  commandName?: string,
  commandPath?: string,
): ParseResult {
  // Split arguments at subcommand boundary
  const argsBeforeSubcommand = args.slice(0, subCommandInfo.index);
  const subCommandArgs = args.slice(subCommandInfo.index + 1);

  // Parse positional arguments before the subcommand
  const remainingArgsAfterPositional = parsePositionalArguments(
    argsBeforeSubcommand,
    argumentDefs,
    result,
    argMap,
  );

  // Parse global options before the subcommand
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

  // Parse the subcommand recursively
  const newCommandPath = commandPath
    ? `${commandPath} ${subCommandInfo.name}`
    : subCommandInfo.name;

  const commandInstance = parseCommandClass(
    subCommandInfo.command.commandClass,
    subCommandArgs,
    options?.name,
    subCommandInfo.name,
    newCommandPath,
  );

  result[subCommandInfo.name] = commandInstance;
  return result;
}

/**
 * Parses arguments when no subcommand is present.
 *
 * This is the simpler case where all arguments are processed
 * as global options and positional arguments.
 */
function parseWithoutSubCommand(
  args: string[],
  parsedArgs: ParsedArg[],
  argumentDefs: Map<number, ArgumentDef>,
  argMap: Map<string, ParsedArg>,
  result: ParseResult,
  options?: ParseOptions,
  subCommands?: Map<string, SubCommand>,
  commandName?: string,
  commandPath?: string,
): ParseResult {
  // Parse positional arguments first
  const remainingArgsAfterPositional = parsePositionalArguments(
    args,
    argumentDefs,
    result,
    argMap,
  );

  // Parse global options from remaining arguments
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

  // Validate and set default values
  validateAndSetDefaults(result, parsedArgs, argumentDefs);

  return result;
}

/**
 * Collects subcommand definitions from a class.
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
    if (propName === "length" || propName === "prototype") {
      continue;
    }

    const descriptor = Object.getOwnPropertyDescriptor(klass, propName);

    // Skip the built-in class name property
    if (propName === "name" && descriptor && !("value" in descriptor)) {
      continue;
    }

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
 * Applies parsed values to the command class properties.
 *
 * @param klass - The command class to modify
 * @param parsedArgs - Regular CLI options
 * @param argumentDefs - Positional arguments
 * @param subCommands - Subcommand definitions
 * @param parsed - Parsed values object
 */
function applyParsedValues(
  klass: { [key: string]: unknown },
  parsedArgs: ParsedArg[],
  argumentDefs: Map<number, ArgumentDef>,
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

/**
 * Validates arguments and sets default values where needed.
 *
 * @param result - Parsed values object
 * @param parsedArgs - Regular CLI options with defaults
 * @param argumentDefs - Positional arguments with defaults
 */
function validateAndSetDefaults(
  result: ParseResult,
  parsedArgs: ParsedArg[],
  argumentDefs: Map<number, ArgumentDef>,
): void {
  // Set defaults and validate regular options
  for (const argDef of parsedArgs) {
    if (result[argDef.name] === undefined) {
      if (argDef.default !== undefined) {
        result[argDef.name] = argDef.default;
      }
      // Validate the value (whether it's default or undefined)
      if (argDef.validators) {
        const validationError = validateValue(
          result[argDef.name],
          argDef.validators,
        );
        if (validationError) {
          console.error(
            `Validation error for --${argDef.name}: ${validationError}`,
          );
          process.exit(1);
        }
      }
    }
  }

  // Validate and set defaults for positional arguments
  for (const [index, argDef] of argumentDefs) {
    if (result[argDef.name] === undefined) {
      if (argDef.default !== undefined) {
        result[argDef.name] = argDef.default;
      } else if (!argDef.rest) {
        console.error(
          `Missing required positional argument at position ${index}: ${argDef.name}`,
        );
        process.exit(1);
      }
      // Validate positional arguments after setting defaults
      if (argDef.validators && result[argDef.name] !== undefined) {
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
    }
  }
}
