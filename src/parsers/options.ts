/**
 * Global options parsing for CLI flags and named arguments.
 *
 * This module handles parsing of named command line options like:
 * --port 3000, --debug, --tags=value1,value2, etc.
 *
 * Key features:
 * - Support for different flag formats (--flag value, --flag=value)
 * - Boolean flags that don't require values
 * - Array arguments with comma-separated values
 * - Type conversion and validation
 * - Help flag handling with immediate exit
 * - Respect for "--" separator (only process args before it)
 *
 * Workflow:
 * 1. Stop at "--" separator if present (args after are positional)
 * 2. Process each --flag or -f argument
 * 3. Determine if flag expects a value based on type
 * 4. Parse and convert values according to argument type
 * 5. Validate converted values
 * 6. Handle special cases like help flags
 */

import type {
  ArgumentDef,
  ParsedArg,
  ParseOptions,
  ParseResult,
  SubCommand,
} from "../types.ts";
import { validateValue } from "../validation.ts";
import { printHelp } from "../help.ts";
import { ErrorHandlers, handleHelpDisplay } from "../error-handling.ts";

/**
 * Parses global CLI options from command line arguments.
 *
 * This function processes named arguments (flags) while respecting the
 * "--" separator convention. Arguments after "--" are left for positional
 * argument processing.
 *
 * Flag format support:
 * - Long flags: --port 3000, --port=3000
 * - Boolean flags: --debug (sets to true)
 * - Array flags: --tags=a,b,c or --tags a,b,c
 * - Help flags: --help, -h (exits immediately with help text)
 *
 * @param args - Raw command line arguments
 * @param parsedArgs - Definitions of expected CLI options
 * @param result - Object to store parsed values
 * @param argMap - Map for quick lookup of argument definitions
 * @param argumentDefs - Positional argument definitions (for help)
 * @param options - App configuration (name, description)
 * @param subCommands - Available subcommands (for help)
 * @param commandName - Current command name (for nested help)
 * @param commandPath - Full command path (for nested help)
 *
 * @example
 * ```ts
 * // Command: myapp --port 3000 --debug --tags=web,api
 * parseGlobalOptions(args, parsedArgs, result, argMap, ...);
 * // result.port = 3000
 * // result.debug = true
 * // result.tags = ["web", "api"]
 * ```
 */
export function parseGlobalOptions(
  args: string[],
  parsedArgs: ParsedArg[],
  result: ParseResult,
  argMap: Map<string, ParsedArg>,
  argumentDefs: Map<number, ArgumentDef>,
  options?: ParseOptions,
  subCommands?: Map<string, SubCommand>,
  commandName?: string,
  commandPath?: string,
): void {
  // Check if rawRest is present - if so, we should be more lenient with unknown flags
  const hasRawRest = argumentDefs.has(-1);
  // Only process arguments before "--" separator
  // Arguments after "--" are reserved for positional processing
  const separatorIndex = args.findIndex((arg) => arg === "--");
  const argsToProcess = separatorIndex >= 0
    ? args.slice(0, separatorIndex)
    : args;

  for (let i = 0; i < argsToProcess.length; i++) {
    const arg = argsToProcess[i];

    // Handle help flags specially - show help and potentially exit
    if (arg === "--help" || arg === "-h") {
      const helpText = printHelp(
        parsedArgs,
        argumentDefs,
        options,
        subCommands,
        commandName,
        commandPath,
      );
      handleHelpDisplay(helpText, options);
      // Return early after help display to prevent further processing
      return;
    }

    // Process long flags (--flag)
    if (arg.startsWith("--")) {
      const { key, value, hasEmbeddedValue } = parseLongFlag(
        arg,
        argsToProcess,
        i,
      );

      // Look up the argument definition
      const argDef = argMap.get(key);
      if (!argDef) {
        // If rawRest is present, unknown flags will be captured by it, so don't error
        if (hasRawRest) {
          // Skip this argument - it will be handled by rawRest processing
          continue;
        }
        ErrorHandlers.unknownArgument(`--${key}`, options);
        // If error handler returned (didn't exit/throw), skip this argument
        continue;
      }

      // Process the flag based on its type
      const nextArgIndex = processFlagValue(
        argDef,
        key,
        value,
        hasEmbeddedValue,
        result,
        i,
        argsToProcess,
        options,
      );

      // Skip the next argument if it was consumed as a flag value
      i = nextArgIndex;
    }
    // Short flags (-f) could be added here in the future
  }
}

/**
 * Parses a long flag argument to extract the key and value.
 *
 * Handles both formats:
 * - Separate value: --port 3000
 * - Embedded value: --port=3000
 *
 * @param arg - The flag argument (e.g., "--port" or "--port=3000")
 * @param argsToProcess - Full arguments array for looking ahead
 * @param currentIndex - Current position in arguments array
 * @returns Object with parsed key, value, and format information
 */
function parseLongFlag(
  arg: string,
  argsToProcess: string[],
  currentIndex: number,
): { key: string; value: string | undefined; hasEmbeddedValue: boolean } {
  if (arg.includes("=")) {
    // Format: --key=value
    const [key, value] = arg.slice(2).split("=", 2);
    return { key, value, hasEmbeddedValue: true };
  } else {
    // Format: --key value (potentially)
    const key = arg.slice(2);
    const nextArg = argsToProcess[currentIndex + 1];
    const value = nextArg?.startsWith("--") ? undefined : nextArg;
    return { key, value, hasEmbeddedValue: false };
  }
}

/**
 * Processes a flag value based on the argument definition.
 *
 * This function handles:
 * - Type conversion (string, number, boolean, arrays)
 * - Validation of converted values
 * - Special boolean flag behavior
 * - Error handling for invalid values
 *
 * @param argDef - Definition of the expected argument
 * @param key - The flag name
 * @param value - The raw value (may be undefined for boolean flags)
 * @param hasEmbeddedValue - Whether value was embedded with = syntax
 * @param result - Object to store the processed value
 * @param currentIndex - Current position in arguments
 * @param argsToProcess - Full arguments array
 * @returns New index position after processing
 */
function processFlagValue(
  argDef: ParsedArg,
  key: string,
  value: string | undefined,
  hasEmbeddedValue: boolean,
  result: ParseResult,
  currentIndex: number,
  _argsToProcess: string[],
  options?: ParseOptions,
): number {
  if (argDef.type === "boolean") {
    // Boolean flags: --debug (true) or --debug=false
    if (value === undefined) {
      result[key] = true;
      return currentIndex; // Don't consume next argument
    } else {
      result[key] = value === "true" || value === "1";
      return hasEmbeddedValue ? currentIndex : currentIndex + 1;
    }
  }

  // Non-boolean flags must have a value
  if (value === undefined) {
    ErrorHandlers.missingValue(`--${key}`, options);
    // If error handler returned (didn't exit/throw), return current index
    return currentIndex;
  }

  // TypeScript doesn't understand that process.exit never returns
  const nonNullValue = value as string;

  // Process value based on argument type
  if (argDef.type === "string[]") {
    processArrayValue(argDef, key, nonNullValue, "string", result, options);
  } else if (argDef.type === "number[]") {
    processArrayValue(argDef, key, nonNullValue, "number", result, options);
  } else if (argDef.type === "number") {
    processNumericValue(argDef, key, nonNullValue, result, options);
  } else {
    // String type (default)
    processStringValue(argDef, key, nonNullValue, result, options);
  }

  // Return new index position
  return hasEmbeddedValue ? currentIndex : currentIndex + 1;
}

/**
 * Processes array values from comma-separated strings.
 *
 * @param argDef - Argument definition with validation rules
 * @param key - Flag name for error messages
 * @param value - Comma-separated string value
 * @param elementType - Type of array elements ("string" or "number")
 * @param result - Object to store the processed array
 */
function processArrayValue(
  argDef: ParsedArg,
  key: string,
  value: string,
  elementType: "string" | "number",
  result: ParseResult,
  options?: ParseOptions,
): void {
  const arrayValues = value.split(",");

  if (elementType === "number") {
    // Convert to numbers and validate
    const numbers: number[] = [];
    for (const val of arrayValues) {
      const num = parseFloat(val.trim());
      if (isNaN(num)) {
        ErrorHandlers.invalidArrayNumber(`--${key}`, val, options);
        // If error handler returned (didn't exit/throw), skip processing
        return;
      }
      numbers.push(num);
    }

    // Validate the entire array
    const validationError = validateValue(numbers, argDef.validators);
    if (validationError) {
      ErrorHandlers.validationError(`--${key}`, validationError, options);
      // If error handler returned (didn't exit/throw), skip processing
      return;
    }

    result[key] = numbers;
  } else {
    // Keep as strings and validate
    const validationError = validateValue(arrayValues, argDef.validators);
    if (validationError) {
      ErrorHandlers.validationError(`--${key}`, validationError, options);
      // If error handler returned (didn't exit/throw), skip processing
      return;
    }

    result[key] = arrayValues;
  }
}

/**
 * Processes and validates a numeric value.
 *
 * @param argDef - Argument definition with validation rules
 * @param key - Flag name for error messages
 * @param value - String representation of the number
 * @param result - Object to store the processed number
 */
function processNumericValue(
  argDef: ParsedArg,
  key: string,
  value: string,
  result: ParseResult,
  options?: ParseOptions,
): void {
  const num = parseFloat(value);
  if (isNaN(num)) {
    ErrorHandlers.invalidNumber(`--${key}`, value, options);
    // If error handler returned (didn't exit/throw), skip processing
    return;
  }

  // Validate the number
  const validationError = validateValue(num, argDef.validators);
  if (validationError) {
    ErrorHandlers.validationError(`--${key}`, validationError, options);
    // If error handler returned (didn't exit/throw), skip processing
    return;
  }

  result[key] = num;
}

/**
 * Processes and validates a string value.
 *
 * @param argDef - Argument definition with validation rules
 * @param key - Flag name for error messages
 * @param value - String value to validate
 * @param result - Object to store the processed string
 */
function processStringValue(
  argDef: ParsedArg,
  key: string,
  value: string,
  result: ParseResult,
  options?: ParseOptions,
): void {
  // Validate string values
  const validationError = validateValue(value, argDef.validators);
  if (validationError) {
    ErrorHandlers.validationError(`--${key}`, validationError, options);
    // If error handler returned (didn't exit/throw), skip processing
    return;
  }

  result[key] = value;
}
