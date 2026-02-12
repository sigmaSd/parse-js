/**
 * Args-based CLI argument parser for Deno
 *
 * A powerful, type-safe command line argument parser using decorators and inheritance.
 *
 * @example Basic usage
 * ```ts
 * import { Args, cli, opt } from "./mod.ts";
 *
 * @cli({ name: "calculator", description: "A simple calculator" })
 * class Calculator extends Args {
 *   @opt({ description: "First number", type: "number", required: true })
 *   a!: number;
 *
 *   @opt({ description: "Second number", type: "number", required: true })
 *   b!: number;
 *
 *   @opt({ description: "Operation to perform" })
 *   operation = "add";
 * }
 *
 * const args = Calculator.parse(["--a", "10", "--b", "5"]);
 * console.log(`${args.a} ${args.operation} ${args.b} = ${args.a + args.b}`);
 * ```
 *
 * @example With subcommands
 * ```ts
 * import { Args, cli, command, opt, subCommand } from "./mod.ts";
 *
 * @command
 * class ServeCommand {
 *   @opt({ description: "Port to serve on" })
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
  opt,
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
  CollectionOptions,
  CommandInstance,
  CommandOptions,
  CommonOptions,
  DecoratorContext,
  OptDef,
  OptOptions,
  ParseOptions,
  ParseResult,
  PositionalDef,
  PositionalDef as ArgumentDef,
  PropertyMetadata,
  SubCommand,
  SubCommandOptions,
  SupportedType,
  Validator,
} from "./src/index.ts";

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
