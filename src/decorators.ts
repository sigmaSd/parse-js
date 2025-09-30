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

import type {
  CommandOptions,
  PropertyMetadata,
  SupportedType,
  Validator,
} from "./types.ts";

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
 * import { Args, cli, type, required } from "@sigma/parse";
 *
 * @cli({ name: "config" })
 * class Config extends Args {
 *   // Explicit type for property without default
 *   @type("number")
 *   @required()
 *   timeout!: number;
 *
 *   // Override default-inferred type
 *   @type("string[]")
 *   tags: string[] = [];
 *
 *   // Ensure numeric parsing even with string default
 *   @type("number")
 *   port = "8080";
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
 * import { Args, cli, description, argument, type, required } from "@sigma/parse";
 *
 * @cli({ name: "config" })
 * class Config extends Args {
 *   @description("The port number to listen on")
 *   port = 8080;
 *
 *   @description("Enable verbose logging output")
 *   verbose = false;
 *
 *   @argument({ description: "Input file to process" })
 *   @type("string")
 *   @required()
 *   input!: string;
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
 * ```ts ignore
 * import { Args, cli, type, required, addValidator } from "@sigma/parse";
 *
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
 * @cli({ name: "config" })
 * class Config extends Args {
 *   @type("number")
 *   @required()
 *   @addValidator(min(1))
 *   port?: number;
 *
 *   @type("string")
 *   @required()
 *   @addValidator(email())
 *   adminEmail?: string;
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
 * import { Args, cli, type, required } from "@sigma/parse";
 *
 * @cli({ name: "config" })
 * class Config extends Args {
 *   // Required with explicit type
 *   @type("string")
 *   @required()
 *   apiKey!: string;
 *
 *   // Required with default (makes the default required if not overridden)
 *   @required()
 *   environment = "development";
 *
 *   // Optional with default
 *   port = 3000;
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
 * Validate decorator for custom validation logic.
 *
 * This decorator creates a validator using a predicate function and custom error message.
 * It's a convenient wrapper around addValidator(custom(...)).
 *
 * @param predicate - Function that returns true if value is valid
 * @param message - Error message to show when validation fails
 * @returns A decorator function
 *
 * @example
 * ```ts
 * import { Args, cli, validate } from "@sigma/parse";
 *
 * @cli({ name: "example" })
 * class Config extends Args {
 *   @validate((value: string) => value.includes("@"), "must be a valid email")
 *   email = "user@example.com";
 *
 *   @validate((value: number) => value % 2 === 0, "must be an even number")
 *   threads = 4;
 *
 *   @validate((value: string) => value.length >= 8, "must be at least 8 characters")
 *   @type("string")
 *   @required()
 *   password!: string;
 * }
 * ```
 */
export function validate<T>(
  predicate: (value: T) => boolean,
  message: string,
): (
  _target: unknown,
  context: DecoratorContext,
) => void {
  return addValidator((value: unknown) => {
    if (!predicate(value as T)) {
      return message;
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
 * import { command, description, argument, type } from "@sigma/parse";
 *
 * @command
 * class BuildCommand {
 *   @description("Enable production build optimizations")
 *   production = false;
 *
 *   @description("Output directory for built files")
 *   output = "dist";
 *
 *   @argument({ description: "Project directory to build" })
 *   @type("string")
 *   project = ".";
 * }
 *
 * @command
 * class ServeCommand {
 *   @description("Port to serve on")
 *   port = 3000;
 *
 *   @description("Enable development mode")
 *   dev = false;
 * }
 * ```
 */
/**
 * Command decorator to mark a class as a CLI subcommand.
 *
 * This decorator can optionally accept configuration options such as
 * `defaultCommand` to control subcommand behavior.
 *
 * @param options - Optional configuration for the subcommand
 * @returns A class decorator function
 *
 * @example
 * ```ts
 * // Simple subcommand without options
 * @command
 * class BuildCommand {
 *   production: boolean = false;
 * }
 *
 * // Subcommand that shows help when called without arguments
 * @command({ defaultCommand: "help" })
 * class ServeCommand {
 *   port: number = 3000;
 * }
 * ```
 */
export function command(
  options?: CommandOptions,
): <T extends new () => unknown>(
  target: T,
  ctx: ClassDecoratorContext,
) => T;
export function command<T extends new () => unknown>(
  target: T,
  ctx: ClassDecoratorContext,
): T;
export function command<T extends new () => unknown>(
  optionsOrTarget?: CommandOptions | T,
  _maybeCtx?: ClassDecoratorContext,
): T | ((target: T, ctx: ClassDecoratorContext) => T) {
  // Handle both @command and @command({ ... }) syntax
  if (typeof optionsOrTarget === "function") {
    // Called as @command (without parentheses)
    return optionsOrTarget;
  }

  // Called as @command({ ... }) (with options)
  const options = optionsOrTarget as CommandOptions | undefined;

  return function <T extends new () => unknown>(
    target: T,
    ctx: ClassDecoratorContext,
  ): T {
    // Store command options in class metadata if provided
    if (options && ctx.metadata) {
      ctx.metadata.__cliOptions = options;
    }
    return target;
  };
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
 * ```ts ignore
 * import { Args, cli, description, subCommand } from "@sigma/parse";
 *
 * @cli({ name: "myapp" })
 * class MyApp extends Args {
 *   @description("Build the project")
 *   @subCommand(BuildCommand)
 *   build?: BuildCommand;
 *
 *   @description("Start the development server")
 *   @subCommand(ServeCommand)
 *   serve?: ServeCommand;
 *
 *   @description("Run tests")
 *   @subCommand(TestCommand)
 *   test?: TestCommand;
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
 * @param options - Optional configuration object
 * @param options.description - Optional description for help text
 * @param options.rest - Whether this argument captures all remaining values
 * @returns A decorator function
 *
 * @example
 * ```ts
 * import { Args, cli, argument, type, required, description } from "@sigma/parse";
 *
 * @cli({ name: "processor" })
 * class FileProcessor extends Args {
 *   // Required first argument
 *   @argument({ description: "Input file to process" })
 *   @type("string")
 *   @required()
 *   input!: string;
 *
 *   // Optional second argument
 *   @argument({ description: "Output file" })
 *   @type("string")
 *   output?: string;
 *
 *   // Rest argument captures remaining files
 *   @argument({ description: "Additional files to include", rest: true })
 *   @type("string[]")
 *   includes?: string[];
 *
 *   // Regular options still work
 *   @description("Enable verbose output")
 *   verbose = false;
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
  options?: { rest?: boolean; description?: string },
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
      description: options?.description,
      rest: options?.rest,
    };

    if (options?.description) {
      propertyMetadata.description = options.description;
    }

    context.metadata[context.name] = propertyMetadata;
  };
}

/**
 * Raw rest decorator to capture all remaining arguments without parsing flags.
 *
 * This decorator creates a special argument that captures all remaining
 * command line arguments after the last defined positional argument,
 * without attempting to parse any flags. This is perfect for proxy
 * commands that need to pass arguments to other tools.
 *
 * Key differences from @argument(n, { rest: true }):
 * - Captures flags as raw strings instead of parsing them
 * - Doesn't require sequential indexing
 * - Always captures everything remaining
 * - Perfect for proxy/wrapper commands
 *
 * @param description - Optional description for help text
 * @returns A decorator function
 *
 * @example
 * ```ts
 * import { Args, cli, argument, rawRest, type, required } from "@sigma/parse";
 *
 * @cli({ name: "myproxy" })
 * class ProxyCommand extends Args {
 *   @argument({ description: "Binary name to execute" })
 *   @type("string")
 *   @required()
 *   binary!: string;
 *
 *   @rawRest("Arguments to pass to the binary")
 *   @type("string[]")
 *   args?: string[];
 * }
 *
 * // Usage: myproxy docker run --rm -it ubuntu bash
 * // binary = "docker"
 * // args = ["run", "--rm", "-it", "ubuntu", "bash"]
 * ```
 */
export function rawRest(description?: string): (
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

    propertyMetadata.rawRest = {
      description,
    };

    if (description) {
      propertyMetadata.description = description;
    }

    context.metadata[context.name] = propertyMetadata;
  };
}
