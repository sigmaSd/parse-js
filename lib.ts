////////////////
// CLI Argument Parsing Library
//

interface ParsedArg {
  name: string;
  type: "string" | "number" | "boolean";
  description?: string;
  default?: string | number | boolean;
}

interface ParseOptions {
  helpFlag?: boolean;
  strictMode?: boolean;
}

const PARSED_CLASSES = new Map<typeof Object, ParsedArg[]>();

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
      Deno.exit(0);
    }

    if (arg.startsWith("--")) {
      const [key, value] = arg.includes("=")
        ? arg.slice(2).split("=", 2)
        : [arg.slice(2), args[i + 1]];

      const argDef = argMap.get(key);
      if (!argDef) {
        console.error(`Unknown argument: --${key}`);
        Deno.exit(1);
      }

      if (argDef.type === "boolean") {
        result[key] = value === undefined || value === "true" || value === "1";
        if (value === undefined) continue; // don't skip next arg
      } else {
        if (value === undefined) {
          console.error(`Missing value for argument: --${key}`);
          Deno.exit(1);
        }

        if (argDef.type === "number") {
          const num = parseFloat(value);
          if (isNaN(num)) {
            console.error(`Invalid number for --${key}: ${value}`);
            Deno.exit(1);
          }
          result[key] = num;
        } else {
          result[key] = value;
        }

        if (!arg.includes("=")) i++; // skip next arg since we used it as value
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      // Handle short flags (basic implementation)
      const shortFlag = arg[1];
      const matchingArg = parsedArgs.find((a) => a.name[0] === shortFlag);
      if (matchingArg) {
        if (matchingArg.type === "boolean") {
          result[matchingArg.name] = true;
        } else {
          const value = args[i + 1];
          if (value === undefined) {
            console.error(`Missing value for argument: -${shortFlag}`);
            Deno.exit(1);
          }

          if (matchingArg.type === "number") {
            const num = parseFloat(value);
            if (isNaN(num)) {
              console.error(`Invalid number for -${shortFlag}: ${value}`);
              Deno.exit(1);
            }
            result[matchingArg.name] = num;
          } else {
            result[matchingArg.name] = value;
          }
          i++;
        }
      }
    }
  }

  return result;
}

function printHelp(parsedArgs: ParsedArg[]) {
  console.log("Usage:");
  console.log("  deno run script.ts [options]");
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

export function parse<T extends new () => unknown>(
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
        propName === "length" || propName === "name" || propName === "prototype"
      ) {
        continue; // Skip built-in properties
      }

      const descriptor = Object.getOwnPropertyDescriptor(klass, propName);

      if (descriptor && "value" in descriptor) {
        const type = extractTypeFromDescriptor(descriptor);

        parsedArgs.push({
          name: propName,
          type,
          default: descriptor.value,
        });
      }
    }

    // Store for later reference
    PARSED_CLASSES.set(klass, parsedArgs);

    // Parse Deno.args
    const parsed = parseArguments(Deno.args, parsedArgs);

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
}

////////////////
// usage code
//

@parse
class MyArgs {
  // the color of the brush
  static color: string = "red";
  // the size of the brush
  static size: number = 10;
  // whether to enable debug mode
  static debug: boolean = false;
}

// Example usage:
// deno run --allow-env script.ts --color blue --size 20 --debug
// deno run --allow-env script.ts --color=green --size=15
// deno run --allow-env script.ts -c yellow -s 5 -d
// deno run --allow-env script.ts --help

console.log("Parsed arguments:");
console.log("Color:", MyArgs.color);
console.log("Size:", MyArgs.size);
console.log("Debug:", MyArgs.debug);
