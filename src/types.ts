/**
 * Core type definitions for the CLI argument parsing library.
 *
 * This module contains all the fundamental types and interfaces used throughout
 * the parsing system, including validation functions, argument definitions,
 * and metadata structures.
 */

/**
 * A function that validates a value and returns an error message or null if valid.
 *
 * Validators are used to enforce constraints on parsed values, such as:
 * - Required fields
 * - Numeric ranges
 * - String patterns
 * - Custom business logic
 *
 * @param value - The value to validate (can be any type)
 * @returns Error message string if validation fails, null if validation passes
 *
 * @example
 * ```ts
 * const minValue: Validator = (value: unknown) => {
 *   if (typeof value === "number" && value < 10) {
 *     return "Value must be at least 10";
 *   }
 *   return null;
 * };
 * ```
 */
export type Validator = (value: unknown) => string | null;

/**
 * Supported primitive types for CLI arguments.
 *
 * The parsing system supports these basic types with automatic conversion:
 * - string: Raw string values
 * - number: Parsed floating-point numbers
 * - boolean: True/false flags
 * - string[]: Comma-separated string arrays
 * - number[]: Comma-separated numeric arrays
 */
export type SupportedType =
  | "string"
  | "number"
  | "boolean"
  | "string[]"
  | "number[]";

/**
 * Parsed argument definition used internally during parsing.
 *
 * This represents a single CLI option (like --port or --debug) after
 * metadata has been collected from class properties and decorators.
 */
export interface ParsedArg {
  /** The property name / CLI flag name */
  name: string;
  /** The data type for parsing and validation */
  type: SupportedType;
  /** Optional help description shown in usage */
  description?: string;
  /** Default value if not provided on command line */
  default?: string | number | boolean | string[] | number[];
  /** Array of validation functions to apply */
  validators?: Validator[];
}

/**
 * Metadata for positional arguments (non-flag arguments).
 *
 * Positional arguments appear in a specific order on the command line,
 * like: `myapp input.txt output.txt`
 */
export interface ArgumentMetadata {
  /** Zero-based position index (0 = first argument, 1 = second, etc.) */
  index: number;
  /** Optional help description */
  description?: string;
  /** Whether this argument captures all remaining positional args */
  rest?: boolean;
}

/**
 * Complete definition for a positional argument.
 *
 * Combines the basic argument metadata with type information
 * and validation rules.
 */
export interface ArgumentDef {
  /** The property name */
  name: string;
  /** The data type for parsing */
  type: SupportedType;
  /** Default value if not provided */
  default?: unknown;
  /** Array of validation functions */
  validators?: Validator[];
  /** Whether this captures remaining args */
  rest?: boolean;
  /** Whether this captures all remaining args without parsing flags */
  rawRest?: boolean;
  /** Help description */
  description?: string;
}

/**
 * Definition for a subcommand.
 *
 * Subcommands allow hierarchical CLI structures like:
 * `git commit --message "fix bug"`
 * where "commit" is a subcommand with its own options.
 */
export interface SubCommand {
  /** The subcommand name as it appears on CLI */
  name: string;
  /** Optional help description */
  description?: string;
  /** The class constructor that handles this subcommand */
  commandClass: new () => unknown;
}

/**
 * Property metadata collected from decorators.
 *
 * This is the internal structure used to store decorator metadata
 * on class properties via Symbol.metadata.
 */
export interface PropertyMetadata {
  /** Explicitly set type via @type() decorator */
  type?: SupportedType;
  /** Validation functions from @required(), @addValidator(), etc. */
  validators?: Validator[];
  /** Description text from @description() decorator */
  description?: string;
  /** Subcommand class from @subCommand() decorator */
  subCommand?: new () => unknown;
  /** Positional argument config from @argument() decorator */
  argument?: ArgumentMetadata;
  /** Raw rest argument config from @rawRest() decorator */
  rawRest?: {
    description?: string;
  };
}

/**
 * Configuration options for the main parse function.
 */
export interface ParseOptions {
  /** Application name shown in help text */
  name?: string;
  /** Application description shown in help text */
  description?: string;
  /** Enable colored help output (respects NO_COLOR environment variable) */
  color?: boolean;
  /** Show default values in help text */
  showDefaults?: boolean;
  /** Default command to run when no arguments are provided */
  defaultCommand?: string | "help";
  /** Whether to call process.exit() on parsing errors (default: true) */
  exitOnError?: boolean;
  /** Whether to call process.exit() when help is shown (default: true) */
  exitOnHelp?: boolean;
  /** Custom error handler called instead of process.exit() when exitOnError is false */
  onError?: (error: string, exitCode: number) => void;
  /** Custom help handler called instead of process.exit() when exitOnHelp is false */
  onHelp?: (helpText: string) => void;
}

/**
 * Result type for parsed arguments.
 *
 * This flexible type allows for any combination of parsed values,
 * including nested command instances for subcommands.
 */
export type ParseResult = Record<
  string,
  string | number | boolean | string[] | number[] | unknown
>;

/**
 * Context object passed to decorator functions.
 *
 * This matches the TypeScript decorator context interface for
 * property decorators in the new decorator proposal.
 */
export interface DecoratorContext {
  /** The property name being decorated */
  name: string | symbol;
  /** Metadata storage for the class */
  metadata?: Record<string | symbol, unknown>;
}
