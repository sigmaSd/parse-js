/**
 * Args-based CLI argument parser for Deno
 *
 * A powerful, type-safe command line argument parser using decorators and inheritance.
 *
 * @example Basic usage
 * ```ts
 * import { Args, cli, option } from "./mod.ts";
 *
 * @cli({ name: "calculator", description: "A simple calculator" })
 * class Calculator extends Args {
 *   @option({ description: "First number", type: "number", required: true })
 *   a!: number;
 *
 *   @option({ description: "Second number", type: "number", required: true })
 *   b!: number;
 *
 *   @option({ description: "Operation to perform" })
 *   operation = "add";
 * }
 *
 * const args = Calculator.parse(["--a", "10", "--b", "5"]);
 * console.log(`${args.a} ${args.operation} ${args.b} = ${args.a + args.b}`);
 * ```
 *
 * @example With subcommands
 * ```ts
 * import { Args, cli, command, option, subCommand } from "./mod.ts";
 *
 * @command
 * class ServeCommand {
 *   @option({ description: "Port to serve on" })
 *   port = 3000;
 * }
 *
 * @cli({ name: "myapp", description: "My application" })
 * class MyApp extends Args {
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
  arg,
  command,
  option,
  subCommand,
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
  ArgOptions,
  ArgumentMetadata,
  CommandInstance,
  CommonOptions,
  OptionDef,
  OptionOptions,
  ParseOptions,
  ParseResult,
  PositionalDef,
  PositionalDef as ArgumentDef,
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
