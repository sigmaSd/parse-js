/**
 * Decorator functions for configuring CLI argument parsing.
 *
 * This module provides all the decorators used to configure how class
 * properties are parsed as CLI arguments. The decorators use the new
 * TypeScript decorator metadata system to store configuration.
 *
 * Available decorators:
 * - @type() - Explicitly set argument type
 * - @description() - Add help text
 * - @addValidator() - Add validation functions
 * - @required() - Mark as required
 * - @command - Mark class as a command
 * - @subCommand() - Associate property with command class
 * - @argument() - Mark property as positional argument
 *
 * Workflow:
 * 1. Decorators store metadata in Symbol.metadata on classes
 * 2. Metadata collection reads this during parsing setup
 * 3. The stored metadata drives parsing behavior and validation
 */

import type { PropertyMetadata, SupportedType, Validator } from "./types.ts";

/**
 * Decorator context interface for property decorators.
 */
export interface DecoratorContext {
  /** The property name being decorated */
  name: string | symbol;
  /** Metadata storage for the class */
  metadata?: Record<string | symbol, unknown>;
}

/**
 * Type decorator factory to explicitly specify the type of a property.
 *
 * This decorator overrides type inference from default values and ensures
 * the argument is parsed as the specified type. This is especially useful
 * for properties without default values or when you need a specific type
 * that differs from the default value type.
 *
 * @param t - The type to use for parsing this argument
 * @returns A decorator function
 *
 * @example
 * ```ts
 * @parse(Deno.args)
 * class Config {
 *   // Explicit type for property without default
 *   @type("number")
 *   @required()
 *   static timeout: number;
 *
 *   // Override default-inferred type
 *   @type("string[]")
 *   static tags: string[] = [];
 *
 *   // Ensure numeric parsing even with string default
 *   @type("number")
 *   static port: number | string = "8080";
 * }
 * ```
 */
export function type(
  t: SupportedType,
): (
  _target: unknown,
  context: DecoratorContext,
) => void {
  return function (
    _target: unknown,
    context: DecoratorContext,
  ): void {
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
 * The description text is displayed in help output and provides users
 * with information about what the argument does and how to use it.
 *
 * @param text - The description text to show in help
 * @returns A decorator function
 *
 * @example
 * ```ts
 * @parse(Deno.args)
 * class Config {
 *   @description("The port number to listen on")
 *   static port: number = 8080;
 *
 *   @description("Enable verbose logging output")
 *   static verbose: boolean = false;
 *
 *   @argument(0, "Input file to process")
 *   static input: string;
 * }
 * ```
 */
export function description(text: string): (
  _target: unknown,
  context: DecoratorContext,
) => void {
  return function (
    _target: unknown,
    context: DecoratorContext,
  ): void {
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
 * This is the building block for creating validators. It adds a validator
 * function to the property's metadata, which will be called during parsing
 * to ensure the value meets specified criteria.
 *
 * @param validator - The validation function to apply
 * @returns A decorator function
 *
 * @example
 * ```ts
 * // Create custom validators
 * function min(minValue: number) {
 *   return addValidator((value: unknown) => {
 *     if (typeof value === "number" && value < minValue) {
 *       return `must be at least ${minValue}`;
 *     }
 *     return null;
 *   });
 * }
 *
 * function email() {
 *   return addValidator((value: unknown) => {
 *     if (typeof value === "string" && !value.includes("@")) {
 *       return "must be a valid email address";
 *     }
 *     return null;
 *   });
 * }
 *
 * @parse(Deno.args)
 * class Config {
 *   @type("number")
 *   @addValidator(min(1))
 *   static port: number;
 *
 *   @type("string")
 *   @addValidator(email())
 *   static adminEmail: string;
 * }
 * ```
 */
export function addValidator(validator: Validator): (
  _target: unknown,
  context: DecoratorContext,
) => void {
  return function (
    _target: unknown,
    context: DecoratorContext,
  ): void {
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
 *
 * This is a convenience decorator that uses addValidator internally to
 * create a required field validator. Required fields must be provided
 * via command line arguments or they will cause a validation error.
 *
 * @returns A decorator function
 *
 * @example
 * ```ts
 * @parse(Deno.args)
 * class Config {
 *   // Required with explicit type
 *   @type("string")
 *   @required()
 *   static apiKey: string;
 *
 *   // Required with default (makes the default required if not overridden)
 *   @required()
 *   static environment: string = "development";
 *
 *   // Optional with default
 *   static port: number = 3000;
 * }
 * ```
 */
export function required(): (
  _target: unknown,
  context: DecoratorContext,
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
 * This decorator serves as a marker to identify command classes. It doesn't
 * add any functionality itself, but indicates that a class is designed to
 * be used as a subcommand handler.
 *
 * @param target - The class being decorated
 * @param _ctx - Decorator context (unused)
 * @returns The original class unchanged
 *
 * @example
 * ```ts
 * @command
 * class BuildCommand {
 *   @description("Enable production build optimizations")
 *   static production: boolean = false;
 *
 *   @description("Output directory for built files")
 *   static output: string = "dist";
 *
 *   @argument(0, "Project directory to build")
 *   static project: string = ".";
 * }
 *
 * @command
 * class ServeCommand {
 *   @description("Port to serve on")
 *   static port: number = 3000;
 *
 *   @description("Enable development mode")
 *   static dev: boolean = false;
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
 * This decorator creates a subcommand relationship where the decorated
 * property will hold an instance of the specified command class after
 * parsing. The property name becomes the subcommand name on the CLI.
 *
 * @param commandClass - The command class to associate with this subcommand
 * @returns A decorator function
 *
 * @example
 * ```ts
 * @parse(Deno.args)
 * class MyApp {
 *   @description("Build the project")
 *   @subCommand(BuildCommand)
 *   static build: BuildCommand;
 *
 *   @description("Start the development server")
 *   @subCommand(ServeCommand)
 *   static serve: ServeCommand;
 *
 *   @description("Run tests")
 *   @subCommand(TestCommand)
 *   static test: TestCommand;
 * }
 *
 * // Usage: myapp build --production
 * // Usage: myapp serve --port 8080
 * // Usage: myapp test --coverage
 * ```
 */
export function subCommand<T extends new () => unknown>(
  commandClass: T,
): (
  _target: unknown,
  context: DecoratorContext,
) => void {
  return function (
    _target: unknown,
    context: DecoratorContext,
  ): void {
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
 * Positional arguments appear in a specific order on the command line
 * without flag names. This decorator configures the position, description,
 * and whether the argument captures remaining values (rest).
 *
 * Key features:
 * - Sequential positioning (0, 1, 2, ...)
 * - Optional vs required based on default values
 * - Rest arguments that capture multiple values
 * - Integration with type inference and validation
 *
 * @param index - The zero-based position index of the argument
 * @param description - Optional description for help text
 * @param options - Optional configuration object
 * @param options.rest - Whether this argument captures all remaining values
 * @returns A decorator function
 *
 * @example
 * ```ts
 * @parse(Deno.args)
 * class FileProcessor {
 *   // Required first argument
 *   @argument(0, "Input file to process")
 *   static input: string;
 *
 *   // Optional second argument with default
 *   @argument(1, "Output file (defaults to input.out)")
 *   static output: string = "";
 *
 *   // Rest argument captures remaining files
 *   @argument(2, "Additional files to include", { rest: true })
 *   @type("string[]")
 *   static includes: string[] = [];
 *
 *   // Regular options still work
 *   @description("Enable verbose output")
 *   static verbose: boolean = false;
 * }
 *
 * // Usage: processor input.txt output.txt file1.txt file2.txt --verbose
 * // input = "input.txt"
 * // output = "output.txt"
 * // includes = ["file1.txt", "file2.txt"]
 * // verbose = true
 * ```
 */
export function argument(
  index: number,
  description?: string,
  options?: { rest?: boolean },
): (
  _target: unknown,
  context: DecoratorContext,
) => void {
  return function (
    _target: unknown,
    context: DecoratorContext,
  ): void {
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
