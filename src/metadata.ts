/**
 * Metadata collection and type extraction for CLI argument parsing.
 */

import type {
  OptionDef,
  PositionalDef,
  PropertyMetadata,
  SubCommand,
  SupportedType,
} from "./types.ts";

/**
 * Determines if a property is a user-defined static property vs a built-in class property.
 */
function isUserDefinedProperty(descriptor: PropertyDescriptor): boolean {
  return descriptor.writable === true && descriptor.enumerable === true;
}

interface CollectionOptions {
  strict?: boolean;
}

/**
 * Collects argument definitions from an instance.
 */
export function collectInstanceArgumentDefs(
  instance: Record<string, unknown>,
  options: CollectionOptions = { strict: true },
): {
  optionDefs: OptionDef[];
  positionalDefs: PositionalDef[];
  subCommands: Map<string, SubCommand>;
} {
  const optionDefs: OptionDef[] = [];
  const positionalDefs: PositionalDef[] = [];
  const subCommands = new Map<string, SubCommand>();
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

    // Handle subcommands
    if (propertyMetadata?.subCommand) {
      subCommands.set(propName, {
        name: propName,
        commandClass: propertyMetadata.subCommand,
        description: propertyMetadata.description,
      });
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
          continue;
        }
      }

      positionalDefs.push({
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
          continue;
        }
      }

      positionalDefs.push({
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
          continue;
        }
      }

      optionDefs.push({
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
  validatePositionalArguments(positionalDefs);

  return { optionDefs, positionalDefs, subCommands };
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
  return "string";
}

/**
 * Validates that positional arguments are properly configured.
 */
function validatePositionalArguments(
  positionalDefs: PositionalDef[],
): void {
  let hasRest = false;
  const hasRawRest = positionalDefs.some((def) => def.rawRest);

  for (const argDef of positionalDefs) {
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

  hasRest = false;
  for (let i = 0; i < positionalDefs.length; i++) {
    const argDef = positionalDefs[i];

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
 */
export function collectArgumentDefs(
  klass: new () => unknown,
): {
  optionDefs: OptionDef[];
  positionalDefs: PositionalDef[];
} {
  const optionDefs: OptionDef[] = [];
  const positionalDefs: PositionalDef[] = [];

  const shortFlagMap = new Map<string, string>();
  const propertyNames = Object.getOwnPropertyNames(klass);
  const classMetadata = klass[Symbol.metadata] as
    | Record<string | symbol, unknown>
    | undefined;

  for (const propName of propertyNames) {
    const descriptor = Object.getOwnPropertyDescriptor(klass, propName);
    if (!descriptor || typeof descriptor.value === "function") continue;

    if (
      (propName === "length" || propName === "name" ||
        propName === "prototype") &&
      !isUserDefinedProperty(descriptor)
    ) {
      continue;
    }

    const metadata = classMetadata?.[propName] as PropertyMetadata | undefined;

    if (metadata?.subCommand) {
      continue;
    }

    if (metadata?.short) {
      const existingProp = shortFlagMap.get(metadata.short);
      if (existingProp) {
        throw new Error(
          `Duplicate short flag '-${metadata.short}' used by both '${existingProp}' and '${propName}'`,
        );
      }
      shortFlagMap.set(metadata.short, propName);
    }

    let type: SupportedType;
    try {
      type = extractTypeFromDescriptor(
        descriptor,
        metadata || {},
        propName,
        klass.name,
      );
    } catch (error) {
      throw error;
    }

    if (metadata?.argument) {
      positionalDefs.push({
        name: propName,
        type,
        default: descriptor.value,
        validators: metadata.validators,
        rest: metadata.argument.rest,
        description: metadata.argument.description,
      });
    } else if (metadata?.rawRest) {
      positionalDefs.push({
        name: propName,
        type,
        default: descriptor.value,
        validators: metadata.validators,
        rawRest: true,
        description: metadata.rawRest.description,
      });
    } else {
      optionDefs.push({
        name: propName,
        type,
        description: metadata?.description,
        default: descriptor.value,
        validators: metadata?.validators || [],
        short: metadata?.short,
      });
    }
  }

  validatePositionalArguments(positionalDefs);

  return { optionDefs, positionalDefs };
}

/**
 * Extracts the argument type from a property descriptor and metadata.
 */
export function extractTypeFromDescriptor(
  descriptor: PropertyDescriptor,
  metadata: PropertyMetadata,
  propertyName: string,
  className: string,
): SupportedType {
  if (metadata.type) {
    return metadata.type;
  }

  if (descriptor?.value !== undefined) {
    const value = descriptor.value;

    if (typeof value === "string") return "string";
    if (typeof value === "number") return "number";
    if (typeof value === "boolean") return "boolean";

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return "string[]";
      }

      const firstElement = value[0];
      if (typeof firstElement === "string") return "string[]";
      if (typeof firstElement === "number") return "number[]";

      return "string[]";
    }
  }

  throw new Error(
    `Property '${propertyName}' in class '${className}' has no default value and no @type decorator. ` +
      `Either provide a default value or use @type() to specify the type. ` +
      `Examples: @type("string"), @type("number"), @type("boolean"), @type("string[]"), etc.`,
  );
}
