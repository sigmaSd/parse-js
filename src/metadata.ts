/**
 * Metadata collection and type extraction for CLI argument parsing.
 */

import type {
  OptDef,
  PositionalDef,
  PropertyMetadata,
  SubCommand,
  SupportedType,
} from "./types.ts";

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
  optDefs: OptDef[];
  positionalDefs: PositionalDef[];
  subCommands: Map<string, SubCommand>;
} {
  const optDefs: OptDef[] = [];
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

    if (!propertyMetadata) continue;

    // Handle subcommands
    if (propertyMetadata.subCommand) {
      subCommands.set(propName, {
        name: propName,
        commandClass: propertyMetadata.subCommand,
        description: propertyMetadata.description,
      });
      continue;
    }

    // Handle Positional Arguments (@arg)
    if (propertyMetadata.arg) {
      if (instance[propName] === undefined && !propertyMetadata.type) {
        if (options.strict) {
          throw new Error(
            `Property '${propName}' has no default value and no type specified in @arg(). ` +
              `Use @arg({ type: "string" }), etc. to specify the expected type.`,
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
        rest: propertyMetadata.arg.rest,
        raw: propertyMetadata.arg.raw,
        description: propertyMetadata.description,
      });
      continue;
    }

    // Handle Options (@opt)
    if (propertyMetadata.opt) {
      if (instance[propName] === undefined && !propertyMetadata.type) {
        if (options.strict) {
          throw new Error(
            `Property '${propName}' has no default value and no type specified in @opt(). ` +
              `Use @opt({ type: "string" }), etc. to specify the expected type.`,
          );
        } else {
          continue;
        }
      }

      // Validate short flag uniqueness
      const short = propertyMetadata.opt.short;
      if (typeof short === "string") {
        const existingProp = shortFlagMap.get(short);
        if (existingProp) {
          throw new Error(
            `Duplicate short flag '-${short}' used by both '${existingProp}' and '${propName}'`,
          );
        }
        shortFlagMap.set(short, propName);
      }

      optDefs.push({
        name: propName,
        type: propertyMetadata.type || getTypeFromValue(instance[propName]),
        default: instance[propName] as
          | string
          | number
          | boolean
          | string[]
          | number[],
        validators: propertyMetadata.validators || [],
        description: propertyMetadata.description,
        short: typeof short === "string" ? short : undefined,
      });
    }
  }

  // Validate positional argument configuration
  validatePositionalArguments(positionalDefs);

  return { optDefs, positionalDefs, subCommands };
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
  const hasRaw = positionalDefs.some((def) => def.raw);

  for (const argDef of positionalDefs) {
    if (argDef.rest) {
      hasRest = true;
      break;
    }
  }

  if (hasRest && hasRaw) {
    throw new Error(
      `Cannot use both rest: true and raw: true in the same command.`,
    );
  }

  hasRest = false;
  for (let i = 0; i < positionalDefs.length; i++) {
    const argDef = positionalDefs[i];

    if (argDef.raw) {
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
  optDefs: OptDef[];
  positionalDefs: PositionalDef[];
} {
  // NOTE: This function seems to be used for static property based parsing which is older.
  // We'll update it to match the new metadata structure but focus on instance-based parsing.
  const optDefs: OptDef[] = [];
  const positionalDefs: PositionalDef[] = [];

  const shortFlagMap = new Map<string, string>();
  const classMetadata = klass[Symbol.metadata] as
    | Record<string | symbol, unknown>
    | undefined;

  if (!classMetadata) return { optDefs, positionalDefs };

  // For now, we'll assume property names are available in metadata keys.
  const metadataKeys = Object.keys(classMetadata);

  for (const propName of metadataKeys) {
    const metadata = classMetadata[propName] as PropertyMetadata | undefined;
    if (!metadata) continue;

    if (metadata.subCommand) continue;

    const type: SupportedType = metadata.type || "string";

    if (metadata.arg) {
      positionalDefs.push({
        name: propName,
        type,
        validators: metadata.validators || [],
        rest: metadata.arg.rest,
        raw: metadata.arg.raw,
        description: metadata.description,
      });
    } else if (metadata.opt) {
      const short = metadata.opt.short;
      if (typeof short === "string") {
        const existingProp = shortFlagMap.get(short);
        if (existingProp) {
          throw new Error(
            `Duplicate short flag '-${short}' used by both '${existingProp}' and '${propName}'`,
          );
        }
        shortFlagMap.set(short, propName);
      }

      optDefs.push({
        name: propName,
        type: type,
        description: metadata.description,
        validators: metadata.validators || [],
        short: typeof short === "string" ? short : undefined,
      });
    }
  }

  validatePositionalArguments(positionalDefs);

  return { optDefs, positionalDefs };
}

/**
 * Extracts the argument type from a property descriptor and metadata.
 * (Keeping it for internal utility but it might be less used now)
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
    `Property '${propertyName}' in class '${className}' has no type specified.`,
  );
}
