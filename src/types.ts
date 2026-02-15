/**
 * Core type definitions for the CLI argument parsing library.
 */

/**
 * A function that validates a value and returns an error message or null if valid.
 */
export type Validator = (value: unknown) => string | null;

/**
 * Supported primitive types for CLI arguments.
 */
export type SupportedType =
  | "string"
  | "number"
  | "boolean"
  | "string[]"
  | "number[]";

/**
 * Definition for a CLI option (flag).
 */
export interface OptDef {
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
  /** Short flag character for this option (e.g., 'o' for -o) */
  short?: string;
}

/**
 * Metadata for positional arguments.
 */
export interface ArgumentMetadata {
  /** Optional help description */
  description?: string;
  /** Whether this argument captures all remaining positional args */
  rest?: boolean;
  /** Whether this captures all remaining args without parsing flags */
  raw?: boolean;
}

/**
 * Definition for a positional argument.
 */
export interface PositionalDef {
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
  raw?: boolean;
  /** Help description */
  description?: string;
}

/**
 * Common configuration for both arguments and options.
 */
export interface CommonOptions {
  /** Optional help description shown in usage */
  description?: string;
  /** Whether the field is required (convenience for adding a required validator) */
  required?: boolean;
  /** Explicitly set type for parsing and validation */
  type?: SupportedType;
}

/**
 * Configuration options for the @arg decorator.
 */
export interface ArgOptions extends CommonOptions {
  /** Whether this argument captures all remaining positional args */
  rest?: boolean;
  /** Whether this captures all remaining args without parsing flags (proxy mode) */
  raw?: boolean;
}

/**
 * Configuration options for the @opt decorator.
 */
export interface OptOptions extends CommonOptions {
  /** Short flag character (e.g., 'o' for -o). If true, first character of property name is used. */
  short?: string | boolean;
}

/**
 * Definition for a subcommand.
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
 */
export interface PropertyMetadata {
  /** Explicitly set type */
  type?: SupportedType;
  /** Validation functions */
  validators?: Validator[];
  /** Description text */
  description?: string;
  /** Subcommand class from @subCommand() decorator */
  subCommand?: new () => unknown;
  /** Positional argument config from @arg() decorator */
  arg?: ArgOptions;
  /** Option config from @opt() decorator */
  opt?: OptOptions;
}

/**
 * Configuration options for the main parse function.
 */
export interface ParseOptions {
  /** Application name shown in help text */
  name?: string;
  /** Application description shown in help text */
  description?: string;
  /** Enable colored help output (no automatic detection) */
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
 * Configuration options for the @command decorator.
 */
export interface CommandOptions {
  /** Default command to run when no arguments are provided to this subcommand */
  defaultCommand?: string | "help";
}

/**
 * Type for command instances returned by subcommand parsing.
 */
export interface CommandInstance {
  /** The constructor function of the command class */
  constructor: new () => unknown;
}

/**
 * Result type for parsed arguments.
 */
export type ParseResult = Record<
  string,
  string | number | boolean | string[] | number[] | CommandInstance | unknown
>;

/**
 * Context object passed to decorator functions.
 */
export interface DecoratorContext {
  /** The property name being decorated */
  name: string | symbol;
  /** Metadata storage for the class */
  metadata?: Record<string | symbol, unknown>;
}
