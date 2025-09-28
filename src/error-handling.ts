/**
 * Error handling utilities for the CLI argument parsing library.
 *
 * This module provides centralized error handling that respects the
 * exitOnError and exitOnHelp configuration options. It allows applications
 * to control whether the library should exit the process or handle errors
 * gracefully through callbacks or exceptions.
 *
 * Key features:
 * - Configurable exit behavior via ParseOptions
 * - Custom error and help handlers
 * - Graceful error handling for integration scenarios
 * - Consistent error reporting across the library
 */

import process from "node:process";
import type { ParseOptions } from "./types.ts";

/**
 * Error types that can occur during CLI parsing.
 */
export type ParseErrorType =
  | "unknown_argument"
  | "missing_value"
  | "invalid_number"
  | "invalid_array_number"
  | "validation_error"
  | "missing_required_argument"
  | "missing_type_information";

/**
 * Represents a parsing error with context information.
 */
export class ParseError extends Error {
  /** The specific type of parsing error that occurred. */
  public readonly type: ParseErrorType;
  /** The exit code that should be used when exiting the process. */
  public readonly exitCode: number;
  /** Additional context information about the error. */
  public readonly context?: {
    argumentName?: string;
    value?: string;
    validationMessage?: string;
  };

  /**
   * Creates a new ParseError instance.
   *
   * @param type - The type of parsing error
   * @param message - The error message
   * @param exitCode - The exit code to use (default: 1)
   * @param context - Additional context about the error
   */
  constructor(
    type: ParseErrorType,
    message: string,
    exitCode: number = 1,
    context?: {
      argumentName?: string;
      value?: string;
      validationMessage?: string;
    },
  ) {
    super(message);
    this.name = "ParseError";
    this.type = type;
    this.exitCode = exitCode;
    this.context = context;
  }
}

/**
 * Handles parsing errors according to the configuration.
 *
 * This function provides centralized error handling that respects the
 * exitOnError setting. When exitOnError is true (default), it prints
 * the error and exits. When false, it either calls the custom error
 * handler or throws a ParseError.
 *
 * @param message - The error message to display
 * @param options - Parse options containing error handling configuration
 * @param errorType - The type of parsing error that occurred
 * @param context - Additional context about the error
 * @param exitCode - Exit code to use (default: 1)
 *
 * @example
 * ```ts
 * // With default behavior (exits process)
 * handleParsingError("Unknown argument: --invalid", options);
 *
 * // With custom error handler
 * const options = {
 *   exitOnError: false,
 *   onError: (error, code) => console.error(`Parse error: ${error}`)
 * };
 * handleParsingError("Validation failed", options);
 * ```
 */
export function handleParsingError(
  message: string,
  options?: ParseOptions,
  errorType: ParseErrorType = "validation_error",
  context?: ParseError["context"],
  exitCode: number = 1,
): void {
  if (options?.onError) {
    // Custom error handler provided - has complete control
    options.onError(message, exitCode);
    // Custom handler decides whether to throw, exit, or continue
    return;
  }

  const shouldExit = options?.exitOnError ?? true;
  if (shouldExit) {
    // Default behavior: print error and exit
    console.error(message);
    process.exit(exitCode);
  } else {
    // No custom handler and exit disabled: throw error for caller to handle
    throw new ParseError(errorType, message, exitCode, context);
  }
}

/**
 * Handles help display according to the configuration.
 *
 * This function provides centralized help handling that respects the
 * exitOnHelp setting. When exitOnHelp is true (default), it prints
 * help and exits with code 0. When false, it either calls the custom
 * help handler or throws a special help error.
 *
 * @param helpText - The formatted help text to display
 * @param options - Parse options containing help handling configuration
 *
 * @example
 * ```ts
 * // With default behavior (prints help and exits)
 * handleHelpDisplay(helpText, options);
 *
 * // With custom help handler
 * const options = {
 *   exitOnHelp: false,
 *   onHelp: (text) => myCustomHelpDisplay(text)
 * };
 * handleHelpDisplay(helpText, options);
 * ```
 */
export function handleHelpDisplay(
  helpText: string,
  options?: ParseOptions,
): void {
  if (options?.onHelp) {
    // Custom help handler provided - has complete control
    options.onHelp(helpText);
    // Custom handler decides whether to throw, exit, or continue
    return;
  }

  const shouldExit = options?.exitOnHelp ?? true;
  if (shouldExit) {
    // Default behavior: print help and exit with success
    console.log(helpText);
    process.exit(0);
  } else {
    // No custom handler and exit disabled: throw error with the help text
    throw new ParseError("validation_error", helpText, 0);
  }
}

/**
 * Creates standardized error messages for common parsing scenarios.
 */
export const ErrorMessages = {
  unknownArgument: (arg: string): string => `Unknown argument: ${arg}`,

  missingValue: (arg: string): string => `Missing value for argument: ${arg}`,

  invalidNumber: (arg: string, value: string): string =>
    `Invalid number for ${arg}: ${value}`,

  invalidArrayNumber: (arg: string, value: string): string =>
    `Invalid number in array for ${arg}: ${value}`,

  validationError: (arg: string, validationMessage: string): string =>
    `Validation error for ${arg}: ${validationMessage}`,

  missingRequiredArgument: (name: string): string =>
    `Missing required positional argument: ${name}`,

  missingTypeInformation: (property: string, className: string): string =>
    `Property '${property}' in class '${className}' has no default value and no @type decorator. ` +
    `Either provide a default value or use @type() to specify the type. ` +
    `Examples: @type("string"), @type("number"), @type("boolean"), @type("string[]), etc.`,

  sequentialArguments: (missing: number): string =>
    `Argument positions must be sequential starting from 0. Missing argument at position ${missing}.`,

  restArgumentNotLast: (position: number): string =>
    `Only the last argument can be marked as rest. Found argument at position ${position} after rest argument.`,
} as const;

/**
 * Convenience functions for common error scenarios.
 * These provide a consistent interface for error handling throughout the library.
 */
export const ErrorHandlers = {
  unknownArgument: (arg: string, options?: ParseOptions): void =>
    handleParsingError(
      ErrorMessages.unknownArgument(arg),
      options,
      "unknown_argument",
      { argumentName: arg },
    ),

  missingValue: (arg: string, options?: ParseOptions): void =>
    handleParsingError(
      ErrorMessages.missingValue(arg),
      options,
      "missing_value",
      { argumentName: arg },
    ),

  invalidNumber: (arg: string, value: string, options?: ParseOptions): void =>
    handleParsingError(
      ErrorMessages.invalidNumber(arg, value),
      options,
      "invalid_number",
      { argumentName: arg, value },
    ),

  invalidArrayNumber: (
    arg: string,
    value: string,
    options?: ParseOptions,
  ): void =>
    handleParsingError(
      ErrorMessages.invalidArrayNumber(arg, value),
      options,
      "invalid_array_number",
      { argumentName: arg, value },
    ),

  validationError: (
    arg: string,
    validationMessage: string,
    options?: ParseOptions,
  ): void =>
    handleParsingError(
      ErrorMessages.validationError(arg, validationMessage),
      options,
      "validation_error",
      { argumentName: arg, validationMessage },
    ),

  missingRequiredArgument: (
    name: string,
    options?: ParseOptions,
  ): void =>
    handleParsingError(
      ErrorMessages.missingRequiredArgument(name),
      options,
      "missing_required_argument",
      { argumentName: name },
    ),

  missingTypeInformation: (
    property: string,
    className: string,
    options?: ParseOptions,
  ): void =>
    handleParsingError(
      ErrorMessages.missingTypeInformation(property, className),
      options,
      "missing_type_information",
      { argumentName: property },
    ),
} as const;

/**
 * Utility function to capture help text without exiting.
 *
 * This function allows you to get the help text as a string without
 * triggering the normal help display behavior. Useful for testing
 * or when you want to format help text differently.
 *
 * @param helpGeneratorFn - Function that would normally display help
 * @returns The help text as a string
 *
 * @example
 * ```ts
 * const helpText = captureHelpText(() => {
 *   printHelp(parsedArgs, argumentDefs, options);
 * });
 * console.log("Help content:", helpText);
 * ```
 */
export function captureHelpText(helpGeneratorFn: () => void): string {
  const originalLog = console.log;
  let capturedOutput = "";

  console.log = (...args: unknown[]) => {
    capturedOutput += args.join(" ") + "\n";
  };

  try {
    helpGeneratorFn();
    return capturedOutput.trim();
  } finally {
    console.log = originalLog;
  }
}

/**
 * Type guard to check if an error is a ParseError.
 *
 * @param error - The error to check
 * @returns True if the error is a ParseError
 *
 * @example
 * ```ts
 * try {
 *   parseArguments(args);
 * } catch (error) {
 *   if (isParseError(error)) {
 *     console.log(`Parse error of type ${error.type}: ${error.message}`);
 *   }
 * }
 * ```
 */
export function isParseError(error: unknown): error is ParseError {
  return error instanceof ParseError;
}
