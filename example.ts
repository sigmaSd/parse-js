import { addValidator, parse } from "./lib.ts";

////////////////
// User-defined validation decorators
//

function inferior_to_10(target: any, context: any) {
  addValidator("MyArgs", context.name, (value: number) => {
    if (value >= 10) return `must be inferior to 10, got ${value}`;
    return null;
  });
}

function min(minValue: number) {
  return function (target: any, context: any) {
    addValidator("MyArgs", context.name, (value: number) => {
      if (value < minValue) return `must be at least ${minValue}, got ${value}`;
      return null;
    });
  };
}

function max(maxValue: number) {
  return function (target: any, context: any) {
    addValidator("MyArgs", context.name, (value: number) => {
      if (value > maxValue) return `must be at most ${maxValue}, got ${value}`;
      return null;
    });
  };
}

function oneOf(choices: string[]) {
  return function (target: any, context: any) {
    addValidator("MyArgs", context.name, (value: string) => {
      if (!choices.includes(value)) {
        return `must be one of: ${choices.join(", ")}, got ${value}`;
      }
      return null;
    });
  };
}

function required(target: any, context: any) {
  addValidator("MyArgs", context.name, (value: any) => {
    if (value === undefined || value === null || value === "") {
      return `is required`;
    }
    return null;
  });
}

////////////////
// Usage example
//

@parse
class MyArgs {
  @oneOf(["red", "blue", "green", "yellow"])
  static color: string = "red";

  @inferior_to_10
  @min(1)
  static size: number = 5;

  @max(100)
  @min(10)
  static timeout: number = 30;

  static debug: boolean = false;
}

// Example usage:
// deno run example.ts --color blue --size 8 --debug
// deno run example.ts --color=green --size=3 --timeout=50
// deno run example.ts --size 15  (will fail validation)
// deno run example.ts --color purple  (will fail validation)
// deno run example.ts --timeout 5  (will fail validation)
// deno run example.ts --help

console.log("Parsed arguments:");
console.log("Color:", MyArgs.color);
console.log("Size:", MyArgs.size);
console.log("Timeout:", MyArgs.timeout);
console.log("Debug:", MyArgs.debug);
