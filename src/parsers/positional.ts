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

import type {
  ArgumentDef,
  ParsedArg,
  ParseOptions,
  ParseResult,
} from "../types.ts";
import { validateValue } from "../validation.ts";
import { ErrorHandlers } from "../error-handling.ts";

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
 * @param options - Parse options for error handling configuration
 * @returns Array of remaining arguments that weren't consumed as positional
 *
 * @example
 * ```ts ignore
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
  argumentDefs: ArgumentDef[],
  result: ParseResult,
  argMap: Map<string, ParsedArg>,
  options?: ParseOptions,
): string[] {
  const remainingArgs: string[] = [];

  // Separate rawRest from regular positional arguments
  const rawRestArg = argumentDefs.find((def) => def.rawRest);
  const regularArgDefs = argumentDefs.filter((def) => !def.rawRest);

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

  // For rawRest commands, we need to identify which args are positional vs flags
  // that should be captured by rawRest
  let rawRestCaptureStarted = false;
  const rawRestValues: string[] = [];

  // Process the mixed section (before "--")
  let flagIndex = 0;

  while (flagIndex < flagArgs.length) {
    const arg = flagArgs[flagIndex];

    // If rawRest capture has started, capture everything
    if (rawRestCaptureStarted && rawRestArg) {
      rawRestValues.push(arg);
      flagIndex++;
      continue;
    }

    // Handle flag arguments and their values
    if (arg.startsWith("--") || arg.startsWith("-")) {
      // Check if this is a known flag that should be processed globally
      const flagName = arg.startsWith("--")
        ? (arg.includes("=") ? arg.split("=")[0].slice(2) : arg.slice(2))
        : arg.slice(1);

      const argDef = argMap.get(flagName);
      if (argDef) {
        // This is a known flag - add to remaining for global processing
        remainingArgs.push(arg);
        flagIndex++;

        // If it expects a value, include that too
        if (
          argDef.type !== "boolean" && !arg.includes("=") &&
          flagIndex < flagArgs.length && !flagArgs[flagIndex].startsWith("-")
        ) {
          remainingArgs.push(flagArgs[flagIndex]);
          flagIndex++;
        }
      } else if (rawRestArg && positionalIndex >= regularArgDefs.length) {
        // Unknown flag and all positionals satisfied - start rawRest capture
        rawRestCaptureStarted = true;
        rawRestValues.push(arg);
        flagIndex++;
      } else {
        // Unknown flag - add to remaining for global options parser to handle
        remainingArgs.push(arg);
        flagIndex++;

        // If this flag might expect a value, include that too
        if (
          !arg.includes("=") &&
          flagIndex < flagArgs.length && !flagArgs[flagIndex].startsWith("-")
        ) {
          remainingArgs.push(flagArgs[flagIndex]);
          flagIndex++;
        }
      }
      continue;
    }

    // This is a positional argument from the mixed section
    if (positionalIndex < regularArgDefs.length) {
      const argDef = regularArgDefs[positionalIndex];

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
        processRestArgument(argDef, restValues, result, options);

        // Rest argument consumes everything, so we're done with positional processing
        positionalIndex++;
        break;
      } else {
        // Single positional argument
        processSingleArgument(argDef, arg, result, options);
        positionalIndex++;
        flagIndex++;
      }
    } else {
      // This is a positional argument
      if (positionalIndex < regularArgDefs.length) {
        const argDef = regularArgDefs[positionalIndex];

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
          processRestArgument(argDef, restValues, result, options);

          // Rest argument consumes everything, so we're done with positional processing
          positionalIndex++;
          break;
        } else {
          // Single positional argument
          processSingleArgument(argDef, arg, result, options);
          positionalIndex++;
          flagIndex++;
        }
      } else if (rawRestArg) {
        // All regular positionals satisfied - start rawRest capture
        rawRestCaptureStarted = true;
        rawRestValues.push(arg);
        flagIndex++;
      } else {
        // No more positional arguments expected - this is an error
        ErrorHandlers.unknownArgument(arg, options);
        // If error handler returned (didn't exit/throw), skip processing
        return remainingArgs;
      }
    }
  }

  // If rawRest was active, finalize it
  if (rawRestArg && (rawRestCaptureStarted || rawRestValues.length > 0)) {
    // Add any remaining args from pure positional section
    rawRestValues.push(...positionalArgs);

    // Store the raw rest values
    result[rawRestArg.name] = rawRestValues;

    // Validate if needed
    if (rawRestArg.validators) {
      const validationError = validateValue(
        rawRestValues,
        rawRestArg.validators,
      );
      if (validationError) {
        ErrorHandlers.validationError(
          rawRestArg.name,
          validationError,
          options,
        );
        return remainingArgs;
      }
    }
  }

  // Process pure positional arguments (after "--")
  // Handle rawRest first if we have remaining args and all regular positionals are satisfied
  if (
    rawRestArg && positionalIndex >= regularArgDefs.length &&
    positionalArgs.length > 0
  ) {
    // If rawRest already has values, append to them, otherwise create new array
    const existingValues = result[rawRestArg.name] as string[] || [];
    result[rawRestArg.name] = [...existingValues, ...positionalArgs];

    // Validate the combined values
    if (rawRestArg.validators) {
      const validationError = validateValue(
        result[rawRestArg.name],
        rawRestArg.validators,
      );
      if (validationError) {
        ErrorHandlers.validationError(
          rawRestArg.name,
          validationError,
          options,
        );
        return remainingArgs;
      }
    }
  } else if (
    positionalIndex < regularArgDefs.length && positionalArgs.length > 0
  ) {
    const argDef = regularArgDefs[positionalIndex];

    if (argDef.rest) {
      // Rest argument gets all remaining positional args
      processRestArgument(argDef, positionalArgs, result, options);
    } else {
      // Process remaining positional args one by one
      for (
        let i = 0;
        i < positionalArgs.length && positionalIndex < regularArgDefs.length;
        i++
      ) {
        const currentArgDef = regularArgDefs[positionalIndex];
        processSingleArgument(
          currentArgDef,
          positionalArgs[i],
          result,
          options,
        );
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
  options?: ParseOptions,
): void {
  let convertedValue: string | number = value;

  // Type conversion
  if (argDef.type === "number") {
    const num = parseFloat(value);
    if (isNaN(num)) {
      ErrorHandlers.invalidNumber(argDef.name, value, options);
      // If error handler returned (didn't exit/throw), skip processing
      return;
    }
    convertedValue = num;
  }

  // Store the converted value
  result[argDef.name] = convertedValue;

  // Validate the value
  if (argDef.validators) {
    const validationError = validateValue(convertedValue, argDef.validators);
    if (validationError) {
      ErrorHandlers.validationError(argDef.name, validationError, options);
      // If error handler returned (didn't exit/throw), skip processing
      return;
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
  options?: ParseOptions,
): void {
  if (argDef.type === "number[]") {
    // Convert all values to numbers
    const numbers: number[] = [];
    for (const val of values) {
      const num = parseFloat(val);
      if (isNaN(num)) {
        ErrorHandlers.invalidArrayNumber(argDef.name, val, options);
        // If error handler returned (didn't exit/throw), skip processing
        return;
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
      ErrorHandlers.validationError(argDef.name, validationError, options);
      // If error handler returned (didn't exit/throw), skip processing
      return;
    }
  }
}
