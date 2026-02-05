/**
 * Decorator functions for configuring CLI argument parsing.
 *
 * This module provides the decorators used to configure how class
 * properties are parsed as CLI arguments. The decorators use the
 * TypeScript decorator metadata system to store configuration.
 *
 * Core decorators:
 * - @option() - Mark property as a flag/option (--flag)
 * - @arg() - Mark property as a positional argument
 * - @command - Mark class as a command
 * - @subCommand() - Associate property with command class
 * - @validate() - Add custom validation logic
 */

import type {
  ArgOptions,
  CommandOptions,
  OptionOptions,
  PropertyMetadata,
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
 * Utility function for creating custom validation decorators.
 *
 * This is the building block for creating validators. It adds a validator
 * function to the property's metadata, which will be called during parsing.
 *
 * @param validator - The validation function to apply
 * @returns A decorator function
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
 * Validate decorator for custom validation logic.
 *
 * This decorator creates a validator using a predicate function and custom error message.
 *
 * @param predicate - Function that returns true if value is valid
 * @param message - Error message to show when validation fails
 * @returns A decorator function
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
 * Command decorator to mark a class as a CLI command or subcommand.
 *
 * @param options - Optional configuration for the command
 * @returns A class decorator function
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
  if (typeof optionsOrTarget === "function") {
    return optionsOrTarget;
  }

  const options = optionsOrTarget as CommandOptions | undefined;

  return function <T extends new () => unknown>(
    target: T,
    ctx: ClassDecoratorContext,
  ): T {
    if (options && ctx.metadata) {
      ctx.metadata.__cliOptions = options;
    }
    return target;
  };
}

/**
 * Configuration options for the @subCommand decorator.
 */
export interface SubCommandOptions {
  /** Optional help description for the subcommand */
  description?: string;
}

/**
 * Subcommand decorator to associate a property with a command class.
 *
 * @param commandClass - The command class to associate with this subcommand
 * @param options - Optional configuration for the subcommand
 * @returns A decorator function
 */
export function subCommand<T extends new () => unknown>(
  commandClass: T,
  options?: SubCommandOptions,
): (
  _target: unknown,
  context: DecoratorContext,
) => void {
  return function (
    _target: unknown,
    context: DecoratorContext,
  ): void {
    if (!context.metadata) {
      throw new Error("Decorator metadata is not available.");
    }

    const propertyMetadata =
      (context.metadata[context.name] as PropertyMetadata) || {};

    propertyMetadata.subCommand = commandClass;
    if (options?.description) {
      propertyMetadata.description = options.description;
    }

    context.metadata[context.name] = propertyMetadata;
  };
}

/**
 * Option decorator to mark a property as a CLI flag/option.
 *
 * @param options - Configuration for the option
 * @returns A decorator function
 *
 * @example
 * ```ts
 * class MyArgs extends Args {
 *   @option({ short: "p", description: "Port", required: true })
 *   port!: number;
 * }
 * ```
 */
export function option(
  options: OptionOptions = {},
): (
  _target: unknown,
  context: DecoratorContext,
) => void {
  return function (
    _target: unknown,
    context: DecoratorContext,
  ): void {
    if (!context.metadata) {
      throw new Error("Decorator metadata is not available.");
    }

    const propertyMetadata =
      (context.metadata[context.name] as PropertyMetadata) || {};

    const optionConfig = { ...options };

    // Handle automatic short flag
    if (optionConfig.short === true) {
      optionConfig.short = String(context.name).charAt(0);
    }

    // Validate short flag
    if (typeof optionConfig.short === "string") {
      if (
        optionConfig.short.length !== 1 ||
        !/^[a-zA-Z0-9]$/.test(optionConfig.short)
      ) {
        throw new Error(
          `Short flag must be a single alphanumeric character, got: "${optionConfig.short}"`,
        );
      }
    }

    propertyMetadata.option = optionConfig;
    if (options.type) propertyMetadata.type = options.type;
    if (options.description) propertyMetadata.description = options.description;

    if (options.required) {
      if (!propertyMetadata.validators) propertyMetadata.validators = [];
      propertyMetadata.validators.push((value: unknown) => {
        if (value === undefined || value === null || value === "") {
          return `is required`;
        }
        return null;
      });
    }

    context.metadata[context.name] = propertyMetadata;
  };
}

/**
 * Arg decorator to mark a property as a positional argument.
 *
 * @param options - Configuration for the positional argument
 * @returns A decorator function
 *
 * @example
 * ```ts
 * class MyArgs extends Args {
 *   @arg({ description: "Input file", required: true })
 *   input!: string;
 * }
 * ```
 */
export function arg(
  options: ArgOptions = {},
): (
  _target: unknown,
  context: DecoratorContext,
) => void {
  return function (
    _target: unknown,
    context: DecoratorContext,
  ): void {
    if (!context.metadata) {
      throw new Error("Decorator metadata is not available.");
    }

    const propertyMetadata =
      (context.metadata[context.name] as PropertyMetadata) || {};

    propertyMetadata.arg = options;
    if (options.type) propertyMetadata.type = options.type;
    if (options.description) propertyMetadata.description = options.description;

    if (options.required) {
      if (!propertyMetadata.validators) propertyMetadata.validators = [];
      propertyMetadata.validators.push((value: unknown) => {
        if (value === undefined || value === null || value === "") {
          return `is required`;
        }
        return null;
      });
    }

    context.metadata[context.name] = propertyMetadata;
  };
}
