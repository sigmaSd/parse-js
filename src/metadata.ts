/**
 * Metadata collection and type extraction for CLI argument parsing.
 *
 * This module handles the complex process of analyzing class properties
 * and their decorators to build the internal argument definitions used
 * during parsing.
 *
 * Workflow:
 * 1. collectArgumentDefs() scans all static properties on a command class
 * 2. For each property, it extracts metadata from Symbol.metadata (set by decorators)
 * 3. extractTypeFromDescriptor() determines the argument type from @type() or default values
 * 4. Properties are categorized as regular options, positional arguments, or subcommands
 * 5. Validation ensures positional arguments have sequential indices
 */

import type {} from "node:process";
import type {
  ArgumentDef,
  ParsedArg,
  PropertyMetadata,
  SupportedType,
} from "./types.ts";

/**
 * Determines if a property is a user-defined static property vs a built-in class property.
 *
 * Built-in properties like `length`, `name`, and `prototype` have specific characteristics:
 * - `writable: false` and `enumerable: false` for built-ins
 * - `writable: true` and `enumerable: true` for user-defined static properties
 *
 * This allows us to reliably distinguish between:
 * ```ts
 * class MyClass {
 *   static length = 42;  // User-defined, should be processed
 * }
 * ```
 * vs the built-in `length` property that exists on all class constructors.
 *
 * @param descriptor - Property descriptor from Object.getOwnPropertyDescriptor()
 * @returns true if this is a user-defined property that should be processed
 */
function isUserDefinedProperty(descriptor: PropertyDescriptor): boolean {
  // User-defined static properties are typically writable and enumerable
  // Built-in properties are typically non-writable and non-enumerable
  return descriptor.writable === true && descriptor.enumerable === true;
}

/**
 * Collects and processes argument definitions from a command class.
 *
 * This function performs the critical task of introspecting a class to
 * build the internal data structures needed for parsing. It separates
 * regular CLI options (--flags) from positional arguments and validates
 * the configuration.
 *
 * The process involves:
 * - Iterating through all static properties
 * - Reading decorator metadata from Symbol.metadata
 * - Extracting types from @type() decorators or default values
 * - Categorizing properties by their role (option, positional, subcommand)
 * - Validating positional argument sequences
 *
 * @param klass - The command class constructor to analyze
 * @returns Object containing parsed options and positional argument definitions
 *
 * @throws Error if positional arguments aren't sequential or have invalid configurations
 *
 * @example
 * ```ts
 * class Config {
 *   static port: number = 8080;
 *   @argument(0) static input: string;
 *   @argument(1) static output: string;
 * }
 *
 * const { parsedArgs, argumentDefs } = collectArgumentDefs(Config);
 * // parsedArgs: [{ name: "port", type: "number", default: 8080 }]
 * // argumentDefs: Map with positional args at indices 0 and 1
 * ```
 */
export function collectArgumentDefs(
  klass: new () => unknown,
): {
  parsedArgs: ParsedArg[];
  argumentDefs: ArgumentDef[];
} {
  const parsedArgs: ParsedArg[] = [];
  const argumentDefs: ArgumentDef[] = [];

  // Get all static property names from the class
  const propertyNames = Object.getOwnPropertyNames(klass);

  // Access the metadata storage where decorators store their information
  const classMetadata = klass[Symbol.metadata] as
    | Record<string | symbol, unknown>
    | undefined;

  // Process each property to determine its role and configuration
  for (const propName of propertyNames) {
    // Get the property descriptor to access default values
    const descriptor = Object.getOwnPropertyDescriptor(klass, propName);
    if (!descriptor || typeof descriptor.value === "function") continue;

    // Skip built-in class properties, but allow user-defined properties with the same names
    if (
      (propName === "length" || propName === "name" ||
        propName === "prototype") &&
      !isUserDefinedProperty(descriptor)
    ) {
      continue;
    }

    // Extract metadata that was set by decorators
    const metadata = classMetadata?.[propName] as PropertyMetadata | undefined;

    // Skip subcommand properties - they're handled separately in the parsing logic
    if (metadata?.subCommand) {
      continue;
    }

    // Determine the argument type from decorators or default values
    let type: SupportedType;
    try {
      type = extractTypeFromDescriptor(
        descriptor,
        metadata || {},
        propName,
        klass.name,
      );
    } catch (error) {
      // All properties without defaults must have explicit @type decorators
      throw error;
    }

    // Categorize the property based on its metadata
    if (metadata?.argument) {
      // This is a positional argument
      argumentDefs.push({
        name: propName,
        type,
        default: descriptor.value,
        validators: metadata.validators,
        rest: metadata.argument.rest,
        optional: metadata.argument.optional,
        description: metadata.argument.description,
      });
    } else if (metadata?.rawRest) {
      // This is a raw rest argument
      argumentDefs.push({
        name: propName,
        type,
        default: descriptor.value,
        validators: metadata.validators,
        rawRest: true,
        description: metadata.rawRest.description,
      });
    } else {
      // This is a regular CLI option (--flag)
      parsedArgs.push({
        name: propName,
        type,
        description: metadata?.description,
        default: descriptor.value,
        validators: metadata?.validators || [],
      });
    }
  }

  // Validate positional argument configuration
  validatePositionalArguments(argumentDefs);

  return { parsedArgs, argumentDefs };
}

/**
 * Validates that positional arguments are properly configured.
 *
 * This function ensures that:
 * - Only the last positional argument can be marked as "rest"
 *
 * @param argumentDefs - Array of positional arguments
 * @throws Error if validation fails
 */
function validatePositionalArguments(
  argumentDefs: ArgumentDef[],
): void {
  let hasRest = false;
  const hasRawRest = argumentDefs.some((def) => def.rawRest);

  // First, check for rest/rawRest conflicts
  for (const argDef of argumentDefs) {
    if (argDef.rest) {
      hasRest = true;
      break;
    }
  }

  // Validate that rawRest doesn't conflict with rest
  if (hasRest && hasRawRest) {
    throw new Error(
      `Cannot use both @argument(n, {rest: true}) and @rawRest() in the same command. Use @rawRest() for proxy commands or regular rest arguments for typed arrays.`,
    );
  }

  // Filter out rawRest arguments for position validation
  const regularArgs = argumentDefs.filter((def) => !def.rawRest);

  // Validate that only the last argument can be marked as optional
  for (let i = 0; i < regularArgs.length - 1; i++) {
    const argDef = regularArgs[i];
    if (argDef.optional) {
      throw new Error(
        `Only the last positional argument can be marked as optional. Found optional argument '${argDef.name}' at position ${i}, but it's not the last argument.`,
      );
    }
  }

  // Then validate regular positional arguments positions
  hasRest = false; // Reset for position validation
  for (let i = 0; i < argumentDefs.length; i++) {
    const argDef = argumentDefs[i];

    // Skip rawRest arguments in position validation
    if (argDef.rawRest) {
      continue;
    }

    // Check that rest arguments only appear at the end (before rawRest)
    if (hasRest) {
      throw new Error(
        `Only the last argument can be marked as rest. Found argument at position ${i} after rest argument.`,
      );
    }

    if (argDef.rest) {
      hasRest = true;
    }
  }
}

/**
 * Extracts the argument type from a property descriptor and metadata.
 *
 * This function implements the type inference logic that determines what
 * data type a CLI argument should be parsed as. The precedence is:
 * 1. Explicit @type() decorator (highest priority)
 * 2. Type inferred from default value
 * 3. Error if neither is available
 *
 * Type inference from defaults:
 * - string defaults → "string"
 * - number defaults → "number"
 * - boolean defaults → "boolean"
 * - Array defaults → "string[]" or "number[]" based on first element
 * - Empty arrays default to "string[]"
 *
 * @param descriptor - Property descriptor containing the default value
 * @param metadata - Decorator metadata that may contain explicit type
 * @param propertyName - Name of the property (for error messages)
 * @param className - Name of the class (for error messages)
 * @returns The determined argument type
 *
 * @throws Error if type cannot be determined
 *
 * @example
 * ```ts
 * // From explicit @type() decorator
 * @type("number") static timeout: number; // → "number"
 *
 * // From default value
 * static port: number = 3000; // → "number"
 * static debug: boolean = false; // → "boolean"
 * static tags: string[] = ["dev", "test"]; // → "string[]"
 * ```
 */
export function extractTypeFromDescriptor(
  descriptor: PropertyDescriptor,
  metadata: PropertyMetadata,
  propertyName: string,
  className: string,
): SupportedType {
  // First priority: explicitly set type via @type decorator
  if (metadata.type) {
    return metadata.type;
  }

  // Second priority: infer from default value
  if (descriptor?.value !== undefined) {
    const value = descriptor.value;

    // Handle primitive types
    if (typeof value === "string") return "string";
    if (typeof value === "number") return "number";
    if (typeof value === "boolean") return "boolean";

    // Handle array types
    if (Array.isArray(value)) {
      if (value.length === 0) {
        // Empty array defaults to string[] unless type is explicitly specified
        return "string[]";
      }

      // Infer array type from first element
      const firstElement = value[0];
      if (typeof firstElement === "string") return "string[]";
      if (typeof firstElement === "number") return "number[]";

      // If first element is neither string nor number, default to string[]
      return "string[]";
    }
  }

  // No type could be determined - this is an error
  // All properties without defaults must have explicit @type decorators
  // During metadata collection, always throw regular errors regardless of options
  throw new Error(
    `Property '${propertyName}' in class '${className}' has no default value and no @type decorator. ` +
      `Either provide a default value or use @type() to specify the type. ` +
      `Examples: @type("string"), @type("number"), @type("boolean"), @type("string[]"), etc.`,
  );
}
