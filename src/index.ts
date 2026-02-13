import type {
  OptDef,
  ParseOptions,
  ParseResult,
  PositionalDef,
  SubCommand,
} from "./types.ts";
import { printHelp } from "./help.ts";
import { handleHelpDisplay, handleParsingError } from "./error-handling.ts";
import { arg, command, validate } from "./decorators.ts";
import { collectInstanceArgumentDefs } from "./metadata.ts";
import { generateFishCompletions } from "./completions.ts";
import { tokenize } from "./tokenizer.ts";
import { parseTokens } from "./parser.ts";
import process from "node:process";

// @ts-ignore polyfill
if (typeof Symbol !== "undefined" && !Symbol.metadata) {
  // @ts-ignore polyfill
  Symbol.metadata = Symbol("Symbol.metadata");
}

/**
 * Base class for CLI argument classes.
 *
 * Classes that extend Args get a static parse method for parsing command line arguments.
 */
export class Args {
  /**
   * Parse command line arguments and return a typed instance.
   */
  static parse<T extends Args>(this: new () => T, args: string[]): T {
    const instance = new this();

    // Get CLI options from class metadata
    const classMetadata = (this as unknown as {
      [Symbol.metadata]?: Record<string | symbol, unknown>;
    })[Symbol.metadata];

    const cliOptions = classMetadata?.__cliOptions as ParseOptions | undefined;

    const result = parseInstanceBased(
      instance as Record<string, unknown>,
      args,
      cliOptions,
      "",
      "",
    );

    // Create a new instance and copy the parsed values
    const typedResult = new this();
    Object.assign(typedResult, result);

    return typedResult;
  }
}

/**
 * Internal command for generating shell completions.
 */
@command
class GenCompletionsCommand {
  @validate(
    (value: string) => value === "fish",
    "must be one of: fish (currently only fish is supported)",
  )
  @arg({
    description: "The shell to generate completions for (e.g., 'fish')",
    type: "string",
    required: true,
  })
  shell!: string;
}

/**
 * CLI decorator to configure a class for command line parsing.
 */
function cli(
  options: ParseOptions,
): <T extends new () => unknown>(target: T, ctx: ClassDecoratorContext) => T {
  return function <T extends new () => unknown>(
    target: T,
    ctx: ClassDecoratorContext,
  ): T {
    if (!ctx.metadata) {
      throw new Error(
        "Decorator metadata is not available.",
      );
    }
    ctx.metadata.__cliOptions = options;
    return target;
  };
}

// Re-export all public APIs
export * from "./types.ts";
export {
  addValidator,
  arg,
  command,
  type DecoratorContext,
  opt,
  subCommand,
  type SubCommandOptions,
  validate,
} from "./decorators.ts";
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
} from "./validation.ts";
export { printHelp } from "./help.ts";
export {
  collectArgumentDefs,
  collectInstanceArgumentDefs,
  type CollectionOptions,
  extractTypeFromDescriptor,
} from "./metadata.ts";
export {
  captureHelpText,
  ErrorHandlers,
  ErrorMessages,
  handleHelpDisplay,
  handleParsingError,
  isParseError,
  ParseError,
  type ParseErrorType,
} from "./error-handling.ts";

export { cli };

/**
 * New instance-based parsing function that works entirely with instance properties.
 */
function parseInstanceBased(
  instance: Record<string, unknown>,
  args: string[],
  options?: ParseOptions,
  commandName?: string,
  commandPath?: string,
): ParseResult {
  // 1. Collect metadata
  const { optDefs, positionalDefs, subCommands } = collectInstanceArgumentDefs(
    instance,
  );

  // 2. Inject gen-completions command if at root
  if (!commandPath && !subCommands.has("gen-completions")) {
    subCommands.set("gen-completions", {
      name: "gen-completions",
      commandClass: GenCompletionsCommand,
      description: "Generate shell completions",
    });
  }

  // 3. Handle default command if no args provided
  if (args.length === 0 && options?.defaultCommand) {
    return handleDefaultCommand(
      options.defaultCommand,
      optDefs,
      positionalDefs,
      subCommands,
      options,
      commandName,
      commandPath,
      instance,
    );
  }

  // 4. Tokenize
  const tokens = tokenize(args);

  // 5. Process tokens
  const status = parseTokens(
    tokens,
    optDefs,
    positionalDefs,
    subCommands,
    options,
  );

  if (status.type === "help") {
    const helpText = printHelp(
      optDefs,
      positionalDefs,
      options,
      subCommands,
      commandName || "",
      commandPath || "",
    );
    handleHelpDisplay(helpText, options || {});
    // Return initial result (with defaults) if help handler doesn't exit
    const result: ParseResult = {};
    for (const argDef of optDefs) result[argDef.name] = instance[argDef.name];
    for (const argDef of positionalDefs) {
      result[argDef.name] = instance[argDef.name];
    }
    return result;
  }

  if (status.type === "subcommand") {
    const subName = status.name;
    const sub = subCommands.get(subName)!;

    const finalResult: ParseResult = {};
    // Initialize with parent defaults and parsed values
    for (const argDef of optDefs) {
      finalResult[argDef.name] = status.parentResult[argDef.name] !== undefined
        ? status.parentResult[argDef.name]
        : instance[argDef.name];
    }
    for (const argDef of positionalDefs) {
      finalResult[argDef.name] = status.parentResult[argDef.name] !== undefined
        ? status.parentResult[argDef.name]
        : instance[argDef.name];
    }

    finalResult[subName] = executeSubCommand(
      sub,
      status.args,
      options,
      subName,
      commandPath ? `${commandPath} ${subName}` : subName,
      optDefs,
      positionalDefs,
      subCommands,
    );

    // Validate parent arguments
    validateResult(finalResult, optDefs, positionalDefs, options);

    return finalResult;
  }

  // 6. Merge with defaults from instance
  const finalResult: ParseResult = {};
  for (const argDef of optDefs) {
    finalResult[argDef.name] = status.result[argDef.name] !== undefined
      ? status.result[argDef.name]
      : instance[argDef.name];
  }
  for (const argDef of positionalDefs) {
    finalResult[argDef.name] = status.result[argDef.name] !== undefined
      ? status.result[argDef.name]
      : instance[argDef.name];
  }

  // 7. Validate
  validateResult(finalResult, optDefs, positionalDefs, options);

  return finalResult;
}

function handleDefaultCommand(
  defaultCommand: string,
  optDefs: OptDef[],
  positionalDefs: PositionalDef[],
  subCommands: Map<string, SubCommand>,
  options: ParseOptions,
  commandName: string | undefined,
  commandPath: string | undefined,
  instance: Record<string, unknown>,
): ParseResult {
  if (defaultCommand === "help") {
    const helpText = printHelp(
      optDefs,
      positionalDefs,
      options,
      subCommands,
      commandName || "",
      commandPath || "",
    );
    handleHelpDisplay(helpText, options);
    const result: ParseResult = {};
    for (const argDef of optDefs) result[argDef.name] = instance[argDef.name];
    for (const argDef of positionalDefs) {
      result[argDef.name] = instance[argDef.name];
    }
    return result;
  }

  const sub = subCommands.get(defaultCommand);
  if (sub) {
    const subResult = executeSubCommand(
      sub,
      [],
      options,
      defaultCommand,
      commandPath ? `${commandPath} ${defaultCommand}` : defaultCommand,
      optDefs,
      positionalDefs,
      subCommands,
    );
    const result: ParseResult = {};
    for (const argDef of optDefs) result[argDef.name] = instance[argDef.name];
    for (const argDef of positionalDefs) {
      result[argDef.name] = instance[argDef.name];
    }
    result[defaultCommand] = subResult;
    return result;
  }

  return {};
}

function executeSubCommand(
  sub: SubCommand,
  args: string[],
  parentOptions: ParseOptions | undefined,
  name: string,
  path: string,
  parentOptDefs: OptDef[],
  parentPositionalDefs: PositionalDef[],
  parentSubCommands: Map<string, SubCommand>,
): unknown {
  // Handle completions special case
  if (
    name === "gen-completions" && sub.commandClass === GenCompletionsCommand
  ) {
    // Special handling for completion command which needs validation
    const subInstance = new sub.commandClass() as Record<string, unknown>;
    const { optDefs, positionalDefs } = collectInstanceArgumentDefs(
      subInstance,
    );
    const tokens = tokenize(args);
    const status = parseTokens(
      tokens,
      optDefs,
      positionalDefs,
      undefined,
      parentOptions,
    );

    if (status.type === "success") {
      // Merge and Validate
      const finalResult: ParseResult = {};
      for (const argDef of optDefs) {
        finalResult[argDef.name] = status.result[argDef.name] !== undefined
          ? status.result[argDef.name]
          : subInstance[argDef.name];
      }
      for (const argDef of positionalDefs) {
        finalResult[argDef.name] = status.result[argDef.name] !== undefined
          ? status.result[argDef.name]
          : subInstance[argDef.name];
      }

      // Validate manually here for GenCompletionsCommand to catch missing shell
      validateResult(finalResult, optDefs, positionalDefs, parentOptions);
    } else if (status.type === "help") {
      // Should probably just show help for gen-completions
    }

    const completions = generateFishCompletions(
      parentOptions?.name || "app",
      parentOptDefs,
      parentPositionalDefs,
      parentSubCommands,
    );
    console.log(completions);
    process.exit(0);
  }

  const commandConstructor = sub.commandClass as unknown as {
    parse?: (args: string[]) => unknown;
    [Symbol.metadata]?: Record<string | symbol, unknown>;
  };

  if (
    "parse" in commandConstructor &&
    typeof commandConstructor.parse === "function"
  ) {
    return commandConstructor.parse(args);
  }

  const subInstance = new sub.commandClass() as Record<string, unknown>;
  const subMetadata = commandConstructor[Symbol.metadata];
  const subOptions = subMetadata?.__cliOptions as ParseOptions | undefined;

  const mergedOptions = subOptions
    ? { ...parentOptions, ...subOptions }
    : (parentOptions
      ? { ...parentOptions, defaultCommand: undefined }
      : undefined);

  if (mergedOptions) {
    if (sub.description) {
      mergedOptions.description = sub.description;
    } else if (!subOptions?.description) {
      // If neither @subCommand nor @cli provided a description, don't inherit parent's
      mergedOptions.description = undefined;
    }
  }

  const parsedValues = parseInstanceBased(
    subInstance,
    args,
    mergedOptions,
    name,
    path,
  );
  const typedResult = new sub.commandClass() as Record<string, unknown>;
  Object.assign(typedResult, parsedValues);
  return typedResult;
}

function validateResult(
  result: ParseResult,
  optDefs: OptDef[],
  positionalDefs: PositionalDef[],
  options?: ParseOptions,
) {
  // Validate flags
  for (const argDef of optDefs) {
    if (argDef.validators) {
      for (const validator of argDef.validators) {
        const error = validator(result[argDef.name]);
        if (error) {
          handleParsingError(
            `Validation error for --${argDef.name}: ${error}`,
            options,
            "validation_error",
            { argumentName: argDef.name, validationMessage: error },
            1,
          );
          break;
        }
      }
    }
  }
  // Validate positionals
  for (const argDef of positionalDefs) {
    if (argDef.validators) {
      for (const validator of argDef.validators) {
        const error = validator(result[argDef.name]);
        if (error) {
          handleParsingError(
            `Validation error for argument '${argDef.name}': ${error}`,
            options,
            "validation_error",
            { argumentName: argDef.name, validationMessage: error },
            1,
          );
          break;
        }
      }
    }
  }
}
