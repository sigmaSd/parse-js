/**
 * Validation system for CLI argument parsing.
 *
 * This module provides the core validation infrastructure and common
 * validators for ensuring parsed arguments meet specified criteria.
 *
 * Workflow:
 * 1. Validators are attached to properties via decorators
 * 2. During parsing, validateValue() runs all validators on parsed values
 * 3. If any validator returns an error message, parsing stops with an error
 * 4. Validation happens after type conversion but before assignment
 */

import type { Validator } from "./types.ts";

/**
 * Validates a value against an array of validator functions.
 *
 * This is the core validation function that orchestrates running
 * multiple validators against a single value. It stops at the first
 * validation error and returns that error message.
 *
 * @param value - The value to validate (after type conversion)
 * @param validators - Array of validator functions to apply
 * @returns Error message string if validation fails, null if all validators pass
 *
 * @example
 * ```ts ignore
 * const validators = [requiredValidator(), min(10)];
 * const error = validateValue(5, validators);
 * console.log(error); // "must be at least 10"
 * ```
 */
export function validateValue(
  value: unknown,
  validators: Validator[] = [],
): string | null {
  // Run each validator in sequence, stopping at first error
  for (const validator of validators) {
    const error = validator(value);
    if (error) {
      return error;
    }
  }
  return null;
}

/**
 * Creates a validator that ensures a value is not empty or undefined.
 *
 * This validator checks for:
 * - undefined values
 * - null values
 * - empty strings
 * - empty arrays
 *
 * @returns A validator function
 *
 * @example
 * ```ts ignore
 * import { Args, cli, type, required, addValidator } from "@sigma/parse";
 *
 * @cli({ name: "example" })
 * class Config extends Args {
 *   @type("string")
 *   @addValidator(requiredValidator())
 *   @required()
 *   name?: string;
 * }
 * ```
 */
export function requiredValidator(): Validator {
  return (value: unknown) => {
    if (value === undefined || value === null) {
      return "is required";
    }
    if (typeof value === "string" && value.trim() === "") {
      return "cannot be empty";
    }
    if (Array.isArray(value) && value.length === 0) {
      return "cannot be empty";
    }
    return null;
  };
}

/**
 * Creates a validator for minimum numeric values.
 *
 * @param minValue - The minimum allowed value (inclusive)
 * @returns A validator function
 *
 * @example
 * ```ts
 * import { Args, cli, type, addValidator } from "@sigma/parse";
 *
 * @cli({ name: "example" })
 * class Config extends Args {
 *   @type("number")
 *   @addValidator(min(0))
 *   port = 3000;
 * }
 * ```
 */
export function min(minValue: number): Validator {
  return (value: unknown) => {
    if (typeof value === "number" && value < minValue) {
      return `must be at least ${minValue}`;
    }
    return null;
  };
}

/**
 * Creates a validator for maximum numeric values.
 *
 * @param maxValue - The maximum allowed value (inclusive)
 * @returns A validator function
 *
 * @example
 * ```ts
 * import { Args, cli, type, addValidator } from "@sigma/parse";
 *
 * @cli({ name: "example" })
 * class Config extends Args {
 *   @type("number")
 *   @addValidator(max(65535))
 *   port = 3000;
 * }
 * ```
 */
export function max(maxValue: number): Validator {
  return (value: unknown) => {
    if (typeof value === "number" && value > maxValue) {
      return `must be at most ${maxValue}`;
    }
    return null;
  };
}

/**
 * Creates a validator for string length constraints.
 *
 * @param minLength - Minimum string length
 * @param maxLength - Optional maximum string length
 * @returns A validator function
 *
 * @example
 * ```ts
 * import { Args, cli, type, required, addValidator } from "@sigma/parse";
 *
 * @cli({ name: "example" })
 * class Config extends Args {
 *   @type("string")
 *   @required()
 *   @addValidator(length(3, 20))
 *   username?: string;
 * }
 * ```
 */
export function length(minLength: number, maxLength?: number): Validator {
  return (value: unknown) => {
    if (typeof value === "string") {
      if (value.length < minLength) {
        return `must be at least ${minLength} characters long`;
      }
      if (maxLength !== undefined && value.length > maxLength) {
        return `must be at most ${maxLength} characters long`;
      }
    }
    return null;
  };
}

/**
 * Creates a validator that checks if a string matches a regular expression.
 *
 * @param pattern - The regular expression pattern to match
 * @param message - Optional custom error message
 * @returns A validator function
 *
 * @example
 * ```ts
 * import { Args, cli, type, required, addValidator } from "@sigma/parse";
 *
 * @cli({ name: "example" })
 * class Config extends Args {
 *   @type("string")
 *   @required()
 *   @addValidator(pattern(/^[a-zA-Z0-9]+$/, "must contain only letters and numbers"))
 *   identifier?: string;
 * }
 * ```
 */
export function pattern(pattern: RegExp, message?: string): Validator {
  return (value: unknown) => {
    if (typeof value === "string" && !pattern.test(value)) {
      return message || `must match pattern ${pattern.source}`;
    }
    return null;
  };
}

/**
 * Creates a validator that checks if a value is one of the allowed options.
 *
 * @param allowedValues - Array of allowed values
 * @returns A validator function
 *
 * @example
 * ```ts
 * import { Args, cli, addValidator } from "@sigma/parse";
 *
 * @cli({ name: "example" })
 * class Config extends Args {
 *   @addValidator(oneOf(["development", "staging", "production"]))
 *   environment = "development";
 * }
 * ```
 */
export function oneOf<T>(allowedValues: T[]): Validator {
  return (value: unknown) => {
    if (!allowedValues.includes(value as T)) {
      return `must be one of: ${allowedValues.join(", ")}`;
    }
    return null;
  };
}

/**
 * Creates a validator for array length constraints.
 *
 * @param minItems - Minimum number of items
 * @param maxItems - Optional maximum number of items
 * @returns A validator function
 *
 * @example
 * ```ts
 * import { Args, cli, type, addValidator } from "@sigma/parse";
 *
 * @cli({ name: "example" })
 * class Config extends Args {
 *   @type("string[]")
 *   @addValidator(arrayLength(1, 5))
 *   tags: string[] = [];
 * }
 * ```
 */
export function arrayLength(minItems: number, maxItems?: number): Validator {
  return (value: unknown) => {
    if (Array.isArray(value)) {
      if (value.length < minItems) {
        return `must have at least ${minItems} items`;
      }
      if (maxItems !== undefined && value.length > maxItems) {
        return `must have at most ${maxItems} items`;
      }
    }
    return null;
  };
}

/**
 * Creates a validator for numeric ranges (combines min and max).
 *
 * @param minValue - Minimum allowed value (inclusive)
 * @param maxValue - Maximum allowed value (inclusive)
 * @returns A validator function
 *
 * @example
 * ```ts
 * import { Args, cli, type, required, addValidator } from "@sigma/parse";
 *
 * @cli({ name: "example" })
 * class Config extends Args {
 *   @type("number")
 *   @required()
 *   @addValidator(range(1, 100))
 *   percentage?: number;
 * }
 * ```
 */
export function range(minValue: number, maxValue: number): Validator {
  return (value: unknown) => {
    if (typeof value === "number") {
      if (value < minValue || value > maxValue) {
        return `must be between ${minValue} and ${maxValue}`;
      }
    }
    return null;
  };
}

/**
 * Creates a validator that ensures a number is an integer.
 *
 * @returns A validator function
 *
 * @example
 * ```ts
 * import { Args, cli, type, required, addValidator } from "@sigma/parse";
 *
 * @cli({ name: "example" })
 * class Config extends Args {
 *   @type("number")
 *   @required()
 *   @addValidator(integer())
 *   count?: number;
 * }
 * ```
 */
export function integer(): Validator {
  return (value: unknown) => {
    if (typeof value === "number" && !Number.isInteger(value)) {
      return "must be an integer";
    }
    return null;
  };
}

/**
 * Creates a custom validator with a predicate function.
 *
 * @param predicate - Function that returns true if value is valid
 * @param message - Error message to show when validation fails
 * @returns A validator function
 *
 * @example
 * ```ts ignore
 * import { Args, cli, type, required, addValidator } from "@sigma/parse";
 *
 * @cli({ name: "example" })
 * class Config extends Args {
 *   @type("number")
 *   @required()
 *   @addValidator(custom((n: number) => n % 2 === 0, "must be even"))
 *   evenNumber?: number;
 * }
 * ```
 */
export function custom<T>(
  predicate: (value: T) => boolean,
  message: string,
): Validator {
  return (value: unknown) => {
    if (!predicate(value as T)) {
      return message;
    }
    return null;
  };
}
