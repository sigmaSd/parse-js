import { addValidator, parse, required, type } from "./lib.ts";
import process from "node:process";

////////////////
// User-defined validation decorators
//

function inferior_to_10() {
  return addValidator((value: unknown) => {
    if (typeof value === "number" && value >= 10) {
      return `must be inferior to 10, got ${value}`;
    }
    return null;
  });
}

function min(minValue: number) {
  return addValidator((value: unknown) => {
    if (typeof value === "number" && value < minValue) {
      return `must be at least ${minValue}, got ${value}`;
    }
    return null;
  });
}

function max(maxValue: number) {
  return addValidator((value: unknown) => {
    if (typeof value === "number" && value > maxValue) {
      return `must be at most ${maxValue}, got ${value}`;
    }
    return null;
  });
}

function oneOf(choices: string[]) {
  return addValidator((value: unknown) => {
    if (typeof value === "string" && !choices.includes(value)) {
      return `must be one of: ${choices.join(", ")}, got ${value}`;
    }
    return null;
  });
}

////////////////
// Usage example
//

@parse(process.argv.slice(2))
class MyArgs {
  @oneOf(["red", "blue", "green", "yellow"])
  static color: string = "red";

  @inferior_to_10()
  @min(1)
  static size: number = 5;

  @type("number")
  @max(100)
  @min(10)
  @required()
  static timeout: number;

  @type("number")
  @min(1)
  @max(10)
  static retries: number; // Optional number property

  @type("string")
  static host: string; // Optional string property

  static debug: boolean = false;
}

// Example usage:
// deno run example.ts --color blue --size 8 --debug
// deno run example.ts --color=green --size=3 --timeout=50
// deno run example.ts --size 15  (will fail validation)
// deno run example.ts --color purple  (will fail validation)
// deno run example.ts --timeout 5  (will fail validation)
// deno run example.ts --timeout 50 --retries 3 --host localhost
// deno run example.ts --help
//
// Can parse custom arguments for testing:
// @parse(customArgs)             // Testing with custom args

console.log("Parsed arguments:");
console.log("Color:", MyArgs.color);
console.log("Size:", MyArgs.size);
console.log("Timeout:", MyArgs.timeout);
console.log("Retries:", MyArgs.retries);
console.log("Host:", MyArgs.host);
console.log("Debug:", MyArgs.debug);
