/**
 * Positional argument parsing for CLI commands.
 *
 * This module handles the complex logic of parsing positional arguments
 * from command line input, including support for:
 * - Sequential positional arguments (arg1 arg2 arg3)
 * - Rest arguments that capture remaining values
 * - Proper separation between flags and positional args
 * - The "--" separator convention for disambiguating args
 *
 * Workflow:
 * 1. Split arguments at "--" separator if present
 * 2. Process flag section first, collecting non-flag args as positional
 * 3. Process dedicated positional section after "--"
 * 4. Handle rest arguments that capture multiple values
 * 5. Validate and convert types for each positional argument
 */

import process from "node:process";
import type { ArgumentDef, ParsedArg, ParseResult } from "../types.ts";
import { validateValue } from "../validation.ts";

/**
 * Parses positional arguments from the command line input.
 *
 * This function implements the complex logic for extracting positional
 * arguments while properly handling flags and their values. The key
 * challenges it solves:
 *
 * - Distinguishing positional args from flag values
 * - Handling the "--" separator that explicitly marks positional args
 * - Supporting rest arguments that capture remaining values
 * - Proper type conversion and validation
 *
 * Algorithm:
 * 1. Look for "--" separator and split arguments accordingly
 * 2. Process arguments before "--" as mixed flag/positional
 * 3. Skip known flags and their values
 * 4. Collect non-flag arguments as positional
 * 5. Process arguments after "--" as pure positional
 * 6. Handle rest arguments specially to capture multiple values
 *
 * @param args - Raw command line arguments array
 * @param argumentDefs - Map of positional argument definitions by index
 * @param result - Object to store parsed values
 * @param argMap - Map of flag names to their definitions (for skipping flag values)
 * @returns Array of remaining arguments that weren't consumed as positional
 *
 * @example
 * ```ts
 * // Command: myapp --verbose file1.txt file2.txt -- extra1 extra2
 * // argumentDefs: { 0: {name: "input", type: "string"}, 1: {name: "files", type: "string[]", rest: true} }
 * const remaining = parsePositionalArguments(args, argumentDefs, result, argMap);
 * // result.input = "file1.txt"
 * // result.files = ["file2.txt", "extra1", "extra2"]
 * // remaining = ["--verbose"]
 * ```
 */
export function parsePositionalArguments(
  args: string[],
  argumentDefs: Map<number, ArgumentDef>,
  result: ParseResult,
  argMap: Map<string, ParsedArg>,
): string[] {
  const remainingArgs: string[] = [];
  const sortedArgDefs = Array.from(argumentDefs.entries()).sort(([a], [b]) =>
    a - b
  );

  let positionalIndex = 0;

  // Check for -- separator and split arguments into two sections:
  // 1. Mixed section: flags and positional args intermixed
  // 2. Pure positional section: everything after "--" is positional
  let flagArgs: string[] = [];
  let positionalArgs: string[] = [];
  const separatorIndex = args.findIndex((arg) => arg === "--");

  if (separatorIndex >= 0) {
    flagArgs = args.slice(0, separatorIndex);
    positionalArgs = args.slice(separatorIndex + 1); // Skip the -- separator
  } else {
    flagArgs = args;
    positionalArgs = [];
  }

  // Process the mixed section (before "--")
  let flagIndex = 0;

  while (flagIndex < flagArgs.length) {
    const arg = flagArgs[flagIndex];

    // Handle flag arguments and their values
    if (arg.startsWith("--") || arg.startsWith("-")) {
      remainingArgs.push(arg);
      flagIndex++;

      // Determine if this flag expects a value and skip it if so
      const flagName = arg.startsWith("--")
        ? (arg.includes("=") ? arg.split("=")[0].slice(2) : arg.slice(2))
        : arg.slice(1);

      const argDef = argMap.get(flagName);
      if (
        argDef && argDef.type !== "boolean" && !arg.includes("=") &&
        flagIndex < flagArgs.length
      ) {
        // This flag expects a separate value argument, skip it
        remainingArgs.push(flagArgs[flagIndex]);
        flagIndex++;
      }
      continue;
    }

    // This is a positional argument from the mixed section
    if (positionalIndex < sortedArgDefs.length) {
      const [, argDef] = sortedArgDefs[positionalIndex];

      if (argDef.rest) {
        // Rest argument: collect all remaining non-flag values
        const restValues: string[] = [];

        // Collect remaining args from the mixed section
        while (
          flagIndex < flagArgs.length && !flagArgs[flagIndex].startsWith("-")
        ) {
          restValues.push(flagArgs[flagIndex]);
          flagIndex++;
        }

        // Add all pure positional args
        restValues.push(...positionalArgs);

        // Convert and validate the collected values
        processRestArgument(argDef, restValues, result);

        // Rest argument consumes everything, so we're done with positional processing
        positionalIndex++;
        break;
      } else {
        // Single positional argument
        processSingleArgument(argDef, arg, result);
        positionalIndex++;
        flagIndex++;
      }
    } else {
      // No more positional arguments expected, add to remaining
      remainingArgs.push(arg);
      flagIndex++;
    }
  }

  // Process pure positional arguments (after "--")
  // This behavior is intentional and follows the library's design:
  // - Arguments after "--" are still processed through the positional argument schema
  // - This allows rest arguments to capture everything after "--" in a structured way
  // - While this differs from some CLI conventions, it provides more flexibility
  // - Standard CLI tools often pass everything after "--" as raw args to subprocesses
  // - This library processes them through defined positional args for better integration
  if (positionalIndex < sortedArgDefs.length && positionalArgs.length > 0) {
    const [, argDef] = sortedArgDefs[positionalIndex];

    if (argDef.rest) {
      // Rest argument gets all remaining positional args
      processRestArgument(argDef, positionalArgs, result);
    } else {
      // Process remaining positional args one by one
      for (
        let i = 0;
        i < positionalArgs.length && positionalIndex < sortedArgDefs.length;
        i++
      ) {
        const [, currentArgDef] = sortedArgDefs[positionalIndex];
        processSingleArgument(currentArgDef, positionalArgs[i], result);
        positionalIndex++;
      }
    }
  }

  // Collect any remaining flag arguments that weren't processed
  while (flagIndex < flagArgs.length) {
    const arg = flagArgs[flagIndex];

    if (arg.startsWith("--") || arg.startsWith("-")) {
      remainingArgs.push(arg);
      flagIndex++;

      // Check if this flag expects a value
      const flagName = arg.startsWith("--")
        ? (arg.includes("=") ? arg.split("=")[0].slice(2) : arg.slice(2))
        : arg.slice(1);

      const argDef = argMap.get(flagName);
      if (
        argDef && argDef.type !== "boolean" && !arg.includes("=") &&
        flagIndex < flagArgs.length
      ) {
        remainingArgs.push(flagArgs[flagIndex]);
        flagIndex++;
      }
      continue;
    }

    // Unprocessed positional argument
    remainingArgs.push(arg);
    flagIndex++;
  }

  return remainingArgs;
}

/**
 * Processes a single positional argument with type conversion and validation.
 *
 * @param argDef - Definition of the positional argument
 * @param value - Raw string value from command line
 * @param result - Object to store the parsed value
 */
function processSingleArgument(
  argDef: ArgumentDef,
  value: string,
  result: ParseResult,
): void {
  let convertedValue: string | number = value;

  // Type conversion
  if (argDef.type === "number") {
    const num = parseFloat(value);
    if (isNaN(num)) {
      console.error(
        `Invalid number for positional argument ${argDef.name}: ${value}`,
      );
      process.exit(1);
    }
    convertedValue = num;
  }

  // Store the converted value
  result[argDef.name] = convertedValue;

  // Validate the value
  if (argDef.validators) {
    const validationError = validateValue(convertedValue, argDef.validators);
    if (validationError) {
      console.error(
        `Validation error for positional argument ${argDef.name}: ${validationError}`,
      );
      process.exit(1);
    }
  }
}

/**
 * Processes a rest argument that captures multiple values.
 *
 * Rest arguments collect all remaining positional values into an array.
 * They support both string[] and number[] types with appropriate conversion.
 *
 * @param argDef - Definition of the rest argument
 * @param values - Array of raw string values from command line
 * @param result - Object to store the parsed array
 */
function processRestArgument(
  argDef: ArgumentDef,
  values: string[],
  result: ParseResult,
): void {
  if (argDef.type === "number[]") {
    // Convert all values to numbers
    const numbers: number[] = [];
    for (const val of values) {
      const num = parseFloat(val);
      if (isNaN(num)) {
        console.error(
          `Invalid number in rest arguments for ${argDef.name}: ${val}`,
        );
        process.exit(1);
      }
      numbers.push(num);
    }
    result[argDef.name] = numbers;
  } else {
    // Keep as strings (default for rest arguments)
    result[argDef.name] = values;
  }

  // Validate the entire array
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
}
