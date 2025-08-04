////////////////
// CLI Argument Parsing Library
//

/**
 * A function that validates a value and returns an error message or null if valid.
 */
import process from "node:process";
export type Validator = (value: unknown) => string | null;

interface ParsedArg {
  name: string;
  type: "string" | "number" | "boolean";
  description?: string;
  default?: string | number | boolean;
  validators?: Validator[];
}

const PROPERTY_VALIDATORS = new Map<string, Validator[]>();

function extractTypeFromDescriptor(
  descriptor: PropertyDescriptor,
): "string" | "number" | "boolean" {
  if (descriptor?.value !== undefined) {
    if (typeof descriptor.value === "string") return "string";
    if (typeof descriptor.value === "number") return "number";
    if (typeof descriptor.value === "boolean") return "boolean";
  }
  return "string"; // default fallback
}

function validateValue(
  value: unknown,
  validators: Validator[] = [],
): string | null {
  for (const validator of validators) {
    const error = validator(value);
    if (error) return error;
  }
  return null;
}

function parseArguments(
  args: string[],
  parsedArgs: ParsedArg[],
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  const argMap = new Map(parsedArgs.map((arg) => [arg.name, arg]));

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      printHelp(parsedArgs);
      process.exit(0);
    }

    if (arg.startsWith("--")) {
      const [key, value] = arg.includes("=")
        ? arg.slice(2).split("=", 2)
        : [arg.slice(2), args[i + 1]];

      const argDef = argMap.get(key);
      if (!argDef) {
        console.error(`Unknown argument: --${key}`);
        process.exit(1);
        return result; // Never reached, but helps TypeScript
      }

      if (argDef.type === "boolean") {
        result[key] = value === undefined || value === "true" || value === "1";
        if (value === undefined) continue; // don't skip next arg
      } else {
        if (value === undefined) {
          console.error(`Missing value for argument: --${key}`);
          process.exit(1);
          return result; // Never reached, but helps TypeScript
        }

        if (argDef.type === "number") {
          const num = parseFloat(value);
          if (isNaN(num)) {
            console.error(`Invalid number for --${key}: ${value}`);
            process.exit(1);
            return result; // Never reached, but helps TypeScript
          }

          // Validate the number
          const validationError = validateValue(num, argDef.validators);
          if (validationError) {
            console.error(`Validation error for --${key}: ${validationError}`);
            process.exit(1);
            return result; // Never reached, but helps TypeScript
          }

          result[key] = num;
        } else {
          // Validate string values
          const validationError = validateValue(value, argDef.validators);
          if (validationError) {
            console.error(`Validation error for --${key}: ${validationError}`);
            process.exit(1);
            return result; // Never reached, but helps TypeScript
          }

          result[key] = value;
        }

        if (!arg.includes("=")) i++; // skip next arg since we used it as value
      }
    }
  }

  return result;
}

function printHelp(parsedArgs: ParsedArg[]) {
  console.log("Usage:");
  console.log("  [runtime] script.js [options]");
  console.log("");
  console.log("Options:");

  for (const arg of parsedArgs) {
    const shortFlag = `-${arg.name[0]}`;
    const longFlag = `--${arg.name}`;
    const typeHint = arg.type === "boolean" ? "" : ` <${arg.type}>`;
    const description = arg.description || "";

    console.log(`  ${shortFlag}, ${longFlag}${typeHint}`);
    if (description) {
      console.log(`      ${description}`);
    }
  }

  console.log("  -h, --help");
  console.log("      Show this help message");
}

/**
 * Class decorator factory that enables CLI argument parsing for static class properties.
 *
 * @param args - The array of arguments to parse
 * @returns A decorator function
 *
 * @example
 * ```ts
 * const args = ["--port", "3000", "--debug"];
 * @parse(args)
 * class Config {
 *   static port: number = 8000;
 *   static debug: boolean = false;
 * }
 * ```
 */
export function parse(
  args: string[],
): <T extends new () => unknown>(target: T, ctx: ClassDecoratorContext) => T {
  return function <T extends new () => unknown>(
    target: T,
    ctx: ClassDecoratorContext,
  ): T {
    ctx.addInitializer(function () {
      const klass = this as typeof Object;
      const parsedArgs: ParsedArg[] = [];

      // Get all static properties from the class prototype
      const propertyNames = Object.getOwnPropertyNames(klass);

      for (const propName of propertyNames) {
        if (
          propName === "length" || propName === "name" ||
          propName === "prototype"
        ) {
          continue; // Skip built-in properties
        }

        const descriptor = Object.getOwnPropertyDescriptor(klass, propName);

        if (descriptor && "value" in descriptor) {
          const type = extractTypeFromDescriptor(descriptor);
          const validators =
            PROPERTY_VALIDATORS.get(`${target.name}.${propName}`) || [];

          parsedArgs.push({
            name: propName,
            type,
            default: descriptor.value,
            validators,
          });
        }
      }

      // Parse the provided arguments
      const parsed = parseArguments(args, parsedArgs);

      // Set values on the class
      for (const arg of parsedArgs) {
        if (Object.prototype.hasOwnProperty.call(parsed, arg.name)) {
          // deno-lint-ignore no-explicit-any
          (klass as any)[arg.name] = parsed[arg.name];
        }
        // Keep default values if not provided
      }
    });

    return target;
  };
}

/**
 * Utility function for creating custom validation decorators.
 *
 * @param className - The name of the class the property belongs to
 * @param propertyName - The name of the property to validate
 * @param validator - The validation function to apply
 *
 * @example
 * ```ts
 * function min(minValue: number) {
 *   return function (target: unknown, context: { name: string }) {
 *     addValidator("MyClass", context.name, (value: unknown) => {
 *       if (typeof value === "number" && value < minValue) {
 *         return `must be at least ${minValue}`;
 *       }
 *       return null;
 *     });
 *   };
 * }
 * ```
 */
export function addValidator(
  className: string,
  propertyName: string,
  validator: Validator,
) {
  const key = `${className}.${propertyName}`;
  const existing = PROPERTY_VALIDATORS.get(key) || [];
  existing.push(validator);
  PROPERTY_VALIDATORS.set(key, existing);
}
