/**
 * Args-based CLI argument parser for Deno
 *
 * A powerful, type-safe command line argument parser using decorators and inheritance.
 *
 * @example Basic usage
 * ```ts
 * import { Args, cli, description, required, type } from "./mod.ts";
 *
 * @cli({ name: "calculator", description: "A simple calculator" })
 * class Calculator extends Args {
 *   @description("First number")
 *   @type("number")
 *   @required()
 *   a!: number;
 *
 *   @description("Second number")
 *   @type("number")
 *   @required()
 *   b!: number;
 *
 *   @description("Operation to perform")
 *   operation = "add";
 * }
 *
 * const args = Calculator.parse(["--a", "10", "--b", "5"]);
 * console.log(`${args.a} ${args.operation} ${args.b} = ${args.a + args.b}`);
 * ```
 *
 * @example With subcommands
 * ```ts
 * import { Args, cli, command, description, subCommand } from "./mod.ts";
 *
 * @command
 * class ServeCommand {
 *   @description("Port to serve on")
 *   port = 3000;
 * }
 *
 * @cli({ name: "myapp", description: "My application" })
 * class MyApp extends Args {
 *   @description("Start development server")
 *   @subCommand(ServeCommand)
 *   serve?: ServeCommand;
 * }
 *
 * const args = MyApp.parse(["serve", "--port", "8080"]);
 * if (args.serve) {
 *   console.log(args.serve.port); // 8080 - Perfect type safety!
 * }
 * ```
 */

// Export the core Args base class and CLI decorator
export { Args, cli } from "./src/index.ts";

// Export all decorator functions
export {
  addValidator,
  argument,
  command,
  description,
  rawRest,
  required,
  short,
  subCommand,
  type,
  validate,
} from "./src/decorators.ts";

// Export validation functions
export {
  arrayLength,
  custom,
  integer,
  length,
  max,
  min,
  oneOf,
  pattern,
  range,
  validateValue,
} from "./src/validation.ts";

// Export types
export type {
  ArgumentDef,
  ArgumentMetadata,
  CommandInstance,
  ParseOptions,
  ParseResult,
  PropertyMetadata,
  SubCommand,
  SupportedType,
  Validator,
} from "./src/types.ts";

// Export error handling utilities
export {
  captureHelpText,
  ErrorHandlers,
  ErrorMessages,
  handleHelpDisplay,
  handleParsingError,
  isParseError,
  ParseError,
  type ParseErrorType,
} from "./src/error-handling.ts";

// Export help generation
export { printHelp } from "./src/help.ts";
