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
  argumentDefs: Map<number, ArgumentDef>;
} {
  const parsedArgs: ParsedArg[] = [];
  const argumentDefs = new Map<number, ArgumentDef>();

  // Get all static property names from the class
  const propertyNames = Object.getOwnPropertyNames(klass);

  // Access the metadata storage where decorators store their information
  const classMetadata = klass[Symbol.metadata] as
    | Record<string | symbol, unknown>
    | undefined;

  // Process each property to determine its role and configuration
  for (const propName of propertyNames) {
    // Skip built-in class properties that we don't want to parse
    if (propName === "length" || propName === "prototype") {
      continue;
    }

    // Get the property descriptor to access default values
    const descriptor = Object.getOwnPropertyDescriptor(klass, propName);
    if (!descriptor || typeof descriptor.value === "function") continue;

    // Skip the built-in class name property (it's a getter, not a static value)
    if (propName === "name") {
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
      // For positional arguments, allow missing type/default if we have argument metadata
      if (metadata?.argument) {
        // TODO: require @type for undetermined array types
        // Use string as default type for positional arguments without explicit types
        type = "string";
      } else {
        // Re-throw the error for regular options that need explicit types
        throw error;
      }
    }

    // Categorize the property based on its metadata
    if (metadata?.argument) {
      // This is a positional argument - store it by index
      argumentDefs.set(metadata.argument.index, {
        name: propName,
        type,
        default: descriptor.value,
        validators: metadata.validators,
        rest: metadata.argument.rest,
        description: metadata.argument.description,
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
 * - Positional argument indices are sequential (0, 1, 2, ...)
 * - Only the last positional argument can be marked as "rest"
 * - There are no gaps in the sequence
 *
 * @param argumentDefs - Map of positional arguments indexed by position
 * @throws Error if validation fails
 */
function validatePositionalArguments(
  argumentDefs: Map<number, ArgumentDef>,
): void {
  const sortedArgDefs = Array.from(argumentDefs.entries()).sort(([a], [b]) =>
    a - b
  );
  let hasRest = false;

  for (let i = 0; i < sortedArgDefs.length; i++) {
    const [index, argDef] = sortedArgDefs[i];

    // Check for sequential indices (must be 0, 1, 2, ...)
    if (index !== i) {
      throw new Error(
        `Argument positions must be sequential starting from 0. Missing argument at position ${i}.`,
      );
    }

    // Check that rest arguments only appear at the end
    if (hasRest) {
      throw new Error(
        `Only the last argument can be marked as rest. Found argument at position ${index} after rest argument.`,
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
    // TODO: require @type for undetermined array types
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
  throw new Error(
    `Property '${propertyName}' in class '${className}' has no default value and no @type decorator. ` +
      `Either provide a default value like 'static ${propertyName}: number = 0' or use @type("number").`,
  );
}
