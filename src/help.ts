/**
 * Help text generation for CLI applications.
 *
 * This module provides comprehensive help text generation including:
 * - Usage syntax with positional arguments
 * - Command hierarchies and subcommands
 * - Option descriptions with type hints
 * - Proper formatting and alignment
 * - Context-aware help for nested commands
 *
 * The help system automatically generates user-friendly documentation
 * based on the argument definitions, decorators, and command structure.
 *
 * Workflow:
 * 1. Analyze the current command context (main app vs subcommand)
 * 2. Generate usage syntax with proper argument ordering
 * 3. List available subcommands if any
 * 4. Display positional arguments with requirements
 * 5. Show all options with type hints and descriptions
 * 6. Format everything with consistent alignment
 */

import type { ArgumentDef, ParsedArg, SubCommand } from "./types.ts";

/**
 * Generates and prints comprehensive help text for a command.
 *
 * This function creates user-friendly help documentation that includes:
 * - Application name and description
 * - Usage syntax showing argument order
 * - Available subcommands with descriptions
 * - Positional arguments with requirements
 * - CLI options with type hints and help text
 * - Context-sensitive formatting for nested commands
 *
 * The help text follows common CLI conventions and provides clear
 * guidance on how to use the application or command.
 *
 * @param parsedArgs - CLI options available for this command
 * @param argumentDefs - Positional arguments for this command
 * @param appName - Application name to display
 * @param appDescription - Application description to display
 * @param subCommands - Available subcommands (if any)
 * @param commandName - Current command name (for subcommands)
 * @param commandPath - Full command path (e.g., "git commit")
 *
 * @example
 * ```ts
 * // For main application:
 * printHelp(parsedArgs, argumentDefs, "myapp", "A sample CLI tool");
 * // Output:
 * // myapp
 * //
 * // A sample CLI tool
 * //
 * // Usage:
 * //   myapp [input] [output] [options]
 * //
 * // Arguments:
 * //   input
 * //       Input file to process
 * //   output (required)
 * //       Output file path
 * //
 * // Options:
 * //   --port <number>
 * //       Port number to listen on
 * //   --debug
 * //       Enable debug mode
 * //   --help
 * //       Show this help message
 * ```
 */
export function printHelp(
  parsedArgs: ParsedArg[],
  argumentDefs: Map<number, ArgumentDef>,
  appName?: string,
  appDescription?: string,
  subCommands?: Map<string, SubCommand>,
  commandName?: string,
  commandPath?: string,
): void {
  // Print application header if available
  if (appName && appDescription) {
    console.log(`${appName}`);
    console.log("");
    console.log(appDescription);
    console.log("");
  }

  // Generate and print usage section
  printUsageSection(
    argumentDefs,
    appName,
    subCommands,
    commandName,
    commandPath,
  );

  // Print available subcommands if any
  if (subCommands && subCommands.size > 0) {
    printSubCommandsSection(subCommands);
  }

  // Print positional arguments if any
  if (argumentDefs.size > 0) {
    printArgumentsSection(argumentDefs);
  }

  // Print options section
  printOptionsSection(parsedArgs, subCommands, commandName);
}

/**
 * Prints the usage section showing command syntax.
 *
 * Generates usage lines like:
 * - `myapp [input] <output> [options]`
 * - `git commit --message "fix" [options]`
 * - `docker container ls <command> [options]`
 */
function printUsageSection(
  argumentDefs: Map<number, ArgumentDef>,
  appName?: string,
  subCommands?: Map<string, SubCommand>,
  commandName?: string,
  commandPath?: string,
): void {
  // Build the usage syntax with positional arguments
  const usageArgs = buildUsageArguments(argumentDefs);
  const baseCommand = appName || "[runtime] script.js";

  console.log("Usage:");

  if (commandName) {
    // This is help for a specific subcommand
    const fullCommandPath = commandPath || commandName;
    const hasSubCommands = subCommands && subCommands.size > 0;

    if (hasSubCommands) {
      console.log(
        `  ${baseCommand} ${fullCommandPath}${usageArgs} <command> [options]`,
      );
    } else {
      console.log(`  ${baseCommand} ${fullCommandPath}${usageArgs} [options]`);
    }
  } else if (subCommands && subCommands.size > 0) {
    // Main command with subcommands
    console.log(`  ${baseCommand}${usageArgs} <command> [options]`);
  } else {
    // Simple command without subcommands
    console.log(`  ${baseCommand}${usageArgs} [options]`);
  }

  console.log("");
}

/**
 * Builds the usage argument string from positional argument definitions.
 *
 * Creates strings like:
 * - `<input> [output]` - required and optional args
 * - `<files...>` - rest arguments
 * - `[input] [output...]` - optional with rest
 */
function buildUsageArguments(argumentDefs: Map<number, ArgumentDef>): string {
  const sortedArgDefs = Array.from(argumentDefs.entries()).sort(([a], [b]) =>
    a - b
  );
  let usageArgs = "";

  for (const [_index, argDef] of sortedArgDefs) {
    const isRequired = !argDef.default && !isRequiredByValidator(argDef);

    if (argDef.rest) {
      usageArgs += isRequired ? ` <${argDef.name}...>` : ` [${argDef.name}...]`;
    } else {
      usageArgs += isRequired ? ` <${argDef.name}>` : ` [${argDef.name}]`;
    }
  }

  return usageArgs;
}

/**
 * Checks if an argument is marked as required by its validators.
 */
function isRequiredByValidator(argDef: ArgumentDef): boolean {
  return argDef.validators?.some((v) =>
    v.toString().includes("is required") ||
    v.toString().includes("required")
  ) ?? false;
}

/**
 * Prints the subcommands section.
 */
function printSubCommandsSection(subCommands: Map<string, SubCommand>): void {
  console.log("Commands:");

  for (const [name, subCommand] of subCommands) {
    console.log(`  ${name}`);
    if (subCommand.description) {
      console.log(`      ${subCommand.description}`);
    }
  }

  console.log("");
}

/**
 * Prints the positional arguments section.
 */
function printArgumentsSection(argumentDefs: Map<number, ArgumentDef>): void {
  console.log("Arguments:");

  const sortedArgDefs = Array.from(argumentDefs.entries()).sort(([a], [b]) =>
    a - b
  );

  for (const [_index, argDef] of sortedArgDefs) {
    const isRequired = !argDef.default && !isRequiredByValidator(argDef);
    const requiredText = isRequired ? " (required)" : "";
    const restText = argDef.rest ? " (rest)" : "";

    console.log(`  ${argDef.name}${requiredText}${restText}`);

    if (argDef.description) {
      console.log(`      ${argDef.description}`);
    }
  }

  console.log("");
}

/**
 * Prints the options section with all CLI flags.
 */
function printOptionsSection(
  parsedArgs: ParsedArg[],
  subCommands?: Map<string, SubCommand>,
  commandName?: string,
): void {
  // Determine section title based on context
  if (commandName) {
    console.log("Options:");
  } else if (subCommands && subCommands.size > 0) {
    console.log("Global Options:");
  } else {
    console.log("Options:");
  }

  // Print each option with type hint and description
  for (const arg of parsedArgs) {
    const longFlag = `--${arg.name}`;
    const typeHint = generateTypeHint(arg.type);
    const description = arg.description || "";

    console.log(`  ${longFlag}${typeHint}`);
    if (description) {
      console.log(`      ${description}`);
    }
  }

  // Always include help option
  console.log("  --help");
  console.log("      Show this help message");
}

/**
 * Generates type hints for option flags.
 *
 * Creates hints like:
 * - `--port <number>`
 * - `--tags <string,string,...>`
 * - `--debug` (no hint for boolean)
 */
function generateTypeHint(type: string): string {
  if (type === "boolean") {
    return "";
  }

  if (type === "string[]") {
    return " <string,string,...>";
  }

  if (type === "number[]") {
    return " <number,number,...>";
  }

  return ` <${type}>`;
}
