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
 * 6. Validation ensures no duplicate short flags
 */

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

interface CollectionOptions {
  strict?: boolean;
}

/**
 * Collects argument definitions from an instance.
 *
 * This function analyzes the instance properties and their decorator metadata
 * to build the argument definitions. It also validates configuration such as
 * duplicate short flags.
 *
 * @param instance - The class instance to analyze
 * @param options - Configuration options for metadata collection
 * @returns Object containing parsed options and positional argument definitions
 */
export function collectInstanceArgumentDefs(
  instance: Record<string, unknown>,
  options: CollectionOptions = { strict: true },
): {
  parsedArgs: ParsedArg[];
  argumentDefs: ArgumentDef[];
} {
  const parsedArgs: ParsedArg[] = [];
  const argumentDefs: ArgumentDef[] = [];
  const shortFlagMap = new Map<string, string>();

  // Get the constructor to access metadata
  const constructor = instance.constructor as new () => unknown;
  const metadata = (constructor as {
    [Symbol.metadata]?: Record<string | symbol, unknown>;
  })[Symbol.metadata];

  // Get all property names from the instance
  const propertyNames = Object.getOwnPropertyNames(instance);

  for (const propName of propertyNames) {
    const propertyMetadata = metadata?.[propName] as
      | PropertyMetadata
      | undefined;

    // Skip properties handled as subcommands
    if (propertyMetadata?.subCommand) {
      continue;
    }

    // Validate short flag uniqueness
    if (propertyMetadata?.short) {
      const existingProp = shortFlagMap.get(propertyMetadata.short);
      if (existingProp) {
        throw new Error(
          `Duplicate short flag '-${propertyMetadata.short}' used by both '${existingProp}' and '${propName}'`,
        );
      }
      shortFlagMap.set(propertyMetadata.short, propName);
    }

    if (propertyMetadata?.argument) {
      // Positional argument
      if (instance[propName] === undefined && !propertyMetadata.type) {
        if (options.strict) {
          throw new Error(
            `Property '${propName}' has no default value and no @type() decorator. ` +
              `Use @type("string"), @type("number"), etc. to specify the expected type. ` +
              `This is required because TypeScript cannot infer the type from undefined values.`,
          );
        } else {
          // In non-strict mode, skip properties with undetermined types
          continue;
        }
      }

      argumentDefs.push({
        name: propName,
        type: propertyMetadata.type || getTypeFromValue(instance[propName]),
        default: instance[propName],
        validators: propertyMetadata.validators || [],
        rest: propertyMetadata.argument.rest,
        description: propertyMetadata.description,
      });
    } else if (propertyMetadata?.rawRest) {
      // Raw rest argument
      if (instance[propName] === undefined && !propertyMetadata.type) {
        if (options.strict) {
          throw new Error(
            `Property '${propName}' has no default value and no @type() decorator. ` +
              `Use @type("string[]") or another array type to specify the expected type. ` +
              `This is required because TypeScript cannot infer the type from undefined values.`,
          );
        } else {
          // In non-strict mode, skip properties with undetermined types
          continue;
        }
      }

      argumentDefs.push({
        name: propName,
        type: propertyMetadata?.type || getTypeFromValue(instance[propName]),
        default: instance[propName],
        validators: propertyMetadata?.validators || [],
        rawRest: true,
        description: propertyMetadata.rawRest.description,
      });
    } else {
      // Regular option
      if (instance[propName] === undefined && !propertyMetadata?.type) {
        if (options.strict) {
          throw new Error(
            `Property '${propName}' has no default value and no @type() decorator. ` +
              `Use @type("string"), @type("number"), etc. to specify the expected type. ` +
              `This is required because TypeScript cannot infer the type from undefined values.`,
          );
        } else {
          // In non-strict mode, skip properties with undetermined types
          continue;
        }
      }

      parsedArgs.push({
        name: propName,
        type: propertyMetadata?.type || getTypeFromValue(instance[propName]),
        default: instance[propName] as
          | string
          | number
          | boolean
          | string[]
          | number[],
        validators: propertyMetadata?.validators || [],
        description: propertyMetadata?.description,
        short: propertyMetadata?.short,
      });
    }
  }

  // Validate positional argument configuration
  validatePositionalArguments(argumentDefs);

  return { parsedArgs, argumentDefs };
}

/**
 * Get type string from a value.
 */
function getTypeFromValue(value: unknown): SupportedType {
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === "number") {
      return "number[]";
    }
    return "string[]";
  }
  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean") {
    return type;
  }
  // Default to string for unknown types (null, undefined, object, symbol, etc.)
  // Note: The calling logic usually ensures we have a value or explicit type before getting here.
  return "string";
}

/**
 * Validates that positional arguments are properly configured.
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

  if (hasRest && hasRawRest) {
    throw new Error(
      `Cannot use both @argument(n, {rest: true}) and @rawRest() in the same command. Use @rawRest() for proxy commands or regular rest arguments for typed arrays.`,
    );
  }

  // Then validate regular positional arguments positions
  hasRest = false;
  for (let i = 0; i < argumentDefs.length; i++) {
    const argDef = argumentDefs[i];

    if (argDef.rawRest) {
      continue;
    }

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
 * Collects argument definitions from a command class (static properties).
 * Note: This is maintained for static properties support but instance properties are preferred.
 */
export function collectArgumentDefs(
  klass: new () => unknown,
): {
  parsedArgs: ParsedArg[];
  argumentDefs: ArgumentDef[];
} {
  const parsedArgs: ParsedArg[] = [];
  const argumentDefs: ArgumentDef[] = [];

  // Track short flags for duplicate detection
  const shortFlagMap = new Map<string, string>();

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

    // Validate short flag uniqueness
    if (metadata?.short) {
      const existingProp = shortFlagMap.get(metadata.short);
      if (existingProp) {
        throw new Error(
          `Duplicate short flag '-${metadata.short}' used by both '${existingProp}' and '${propName}'`,
        );
      }
      shortFlagMap.set(metadata.short, propName);
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
        short: metadata?.short,
      });
    }
  }

  // Validate positional argument configuration
  validatePositionalArguments(argumentDefs);

  return { parsedArgs, argumentDefs };
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
 * import { Args, cli, type, required } from "@sigma/parse";
 *
 * @cli({ name: "example" })
 * class Config extends Args {
 *   // From explicit @type() decorator
 *   @type("number")
 *   @required()
 *   timeout!: number; // → "number"
 *
 *   // From default value
 *   port = 3000; // → "number"
 *   debug = false; // → "boolean"
 *   tags = ["dev", "test"]; // → "string[]"
 * }
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
