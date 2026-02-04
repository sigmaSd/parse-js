/**
 * Help text generation for CLI applications.
 */

import type {
  OptionDef,
  ParseOptions,
  PositionalDef,
  SubCommand,
} from "./types.ts";
import { createColors } from "./colors.ts";
import { captureHelpText } from "./error-handling.ts";

/**
 * Generates and prints comprehensive help text for a command.
 */
export function printHelp(
  optionDefs: OptionDef[],
  positionalDefs: PositionalDef[],
  options?: ParseOptions,
  subCommands?: Map<string, SubCommand>,
  commandName?: string,
  commandPath?: string,
): string {
  return captureHelpText(() => {
    const colors = createColors(options?.color);
    const showDefaults = options?.showDefaults ?? true;

    if (options?.name && options?.description) {
      console.log(colors.bold(colors.brightBlue(options.name)));
      console.log("");
      console.log(colors.dim(options.description));
      console.log("");
    }

    printUsageSection(
      positionalDefs,
      colors,
      options?.name,
      subCommands,
      commandName,
      commandPath,
    );

    if (subCommands && subCommands.size > 0) {
      printSubCommandsSection(subCommands, colors);
    }

    if (positionalDefs.length > 0) {
      printArgumentsSection(positionalDefs, colors, showDefaults);
    }

    printOptionsSection(
      optionDefs,
      colors,
      showDefaults,
      subCommands,
      commandName,
    );
  });
}

function printUsageSection(
  positionalDefs: PositionalDef[],
  colors: ReturnType<typeof createColors>,
  appName?: string,
  subCommands?: Map<string, SubCommand>,
  commandName?: string,
  commandPath?: string,
): void {
  const usageArgs = buildUsageArguments(positionalDefs);
  const baseCommand = appName || "[runtime] script.js";

  console.log(colors.bold(colors.brightYellow("Usage:")));

  if (commandName) {
    const fullCommandPath = commandPath || commandName;
    const hasSubCommands = subCommands && subCommands.size > 0;

    if (hasSubCommands) {
      console.log(
        `  ${colors.cyan(baseCommand)} ${colors.brightCyan(fullCommandPath)}${
          colors.green(usageArgs)
        } ${colors.yellow("<command>")} ${colors.dim("[options]")}`,
      );
    } else {
      console.log(
        `  ${colors.cyan(baseCommand)} ${colors.brightCyan(fullCommandPath)}${
          colors.green(usageArgs)
        } ${colors.dim("[options]")}`,
      );
    }
  } else if (subCommands && subCommands.size > 0) {
    console.log(
      `  ${colors.cyan(baseCommand)}${colors.green(usageArgs)} ${
        colors.yellow("<command>")
      } ${colors.dim("[options]")}`,
    );
  } else {
    console.log(
      `  ${colors.cyan(baseCommand)}${colors.green(usageArgs)} ${
        colors.dim("[options]")
      }`,
    );
  }

  console.log("");
}

function buildUsageArguments(positionalDefs: PositionalDef[]): string {
  const rawRestDef = positionalDefs.find((def) => def.rawRest);
  const regularPositionalDefs = positionalDefs.filter((def) => !def.rawRest);

  let usageArgs = "";

  for (const argDef of regularPositionalDefs) {
    const isRequired = !argDef.default && !isRequiredByValidator(argDef);

    if (argDef.rest) {
      usageArgs += isRequired ? ` <${argDef.name}...>` : ` [${argDef.name}...]`;
    } else {
      usageArgs += isRequired ? ` <${argDef.name}>` : ` [${argDef.name}]`;
    }
  }

  if (rawRestDef) {
    const isRequired = !rawRestDef.default &&
      !isRequiredByValidator(rawRestDef);
    usageArgs += isRequired
      ? ` <${rawRestDef.name}...>`
      : ` [${rawRestDef.name}...]`;
  }

  return usageArgs;
}

function isRequiredByValidator(argDef: PositionalDef): boolean {
  return argDef.validators?.some((v) =>
    v.toString().includes("is required") ||
    v.toString().includes("required")
  ) ?? false;
}

function printSubCommandsSection(
  subCommands: Map<string, SubCommand>,
  colors: ReturnType<typeof createColors>,
): void {
  console.log(colors.bold(colors.brightYellow("Commands:")));

  for (const [name, subCommand] of subCommands) {
    console.log(`  ${colors.brightCyan(name)}`);
    if (subCommand.description) {
      console.log(`      ${colors.dim(subCommand.description)}`);
    }
  }

  console.log("");
}

function printArgumentsSection(
  positionalDefs: PositionalDef[],
  colors: ReturnType<typeof createColors>,
  showDefaults: boolean,
): void {
  console.log(colors.bold(colors.brightYellow("Arguments:")));

  const rawRestDef = positionalDefs.find((def) => def.rawRest);
  const regularPositionalDefs = positionalDefs.filter((def) => !def.rawRest);

  for (const argDef of regularPositionalDefs) {
    const isRequired = !argDef.default && !isRequiredByValidator(argDef);
    const requiredText = isRequired ? colors.red(" (required)") : "";
    const restText = argDef.rest ? colors.yellow(" (rest)") : "";
    const defaultText = showDefaults && argDef.default !== undefined
      ? colors.dim(` (default: ${JSON.stringify(argDef.default)})`)
      : "";

    console.log(
      `  ${
        colors.brightGreen(argDef.name)
      }${requiredText}${restText}${defaultText}`,
    );

    if (argDef.description) {
      console.log(`      ${colors.dim(argDef.description)}`);
    }
  }

  if (rawRestDef) {
    const isRequired = !rawRestDef.default &&
      !isRequiredByValidator(rawRestDef);
    const requiredText = isRequired ? colors.red(" (required)") : "";
    const rawRestText = colors.yellow(" (raw rest)");
    const defaultText = showDefaults && rawRestDef.default !== undefined
      ? colors.dim(` (default: ${JSON.stringify(rawRestDef.default)})`)
      : "";

    console.log(
      `  ${
        colors.brightGreen(rawRestDef.name)
      }${requiredText}${rawRestText}${defaultText}`,
    );

    if (rawRestDef.description) {
      console.log(`      ${colors.dim(rawRestDef.description)}`);
    }
  }

  console.log("");
}

function printOptionsSection(
  optionDefs: OptionDef[],
  colors: ReturnType<typeof createColors>,
  showDefaults: boolean,
  subCommands?: Map<string, SubCommand>,
  commandName?: string,
): void {
  if (commandName) {
    console.log(colors.bold(colors.brightYellow("Options:")));
  } else if (subCommands && subCommands.size > 0) {
    console.log(colors.bold(colors.brightYellow("Global Options:")));
  } else {
    console.log(colors.bold(colors.brightYellow("Options:")));
  }

  for (const arg of optionDefs) {
    let flagDisplay = "";
    if (arg.short) {
      flagDisplay = `${colors.brightCyan(`-${arg.short}`)}, ${
        colors.brightCyan(`--${arg.name}`)
      }`;
    } else {
      flagDisplay = `    ${colors.brightCyan(`--${arg.name}`)}`;
    }

    const typeHint = generateTypeHint(arg.type, colors);
    const defaultText = showDefaults && arg.default !== undefined
      ? colors.dim(` (default: ${JSON.stringify(arg.default)})`)
      : "";

    console.log(`  ${flagDisplay}${typeHint}${defaultText}`);
    if (arg.description) {
      console.log(`      ${colors.dim(arg.description)}`);
    }
  }

  console.log(`  ${colors.brightCyan("-h")}, ${colors.brightCyan("--help")}`);
  console.log(`      ${colors.dim("Show this help message")}`);
}

function generateTypeHint(
  type: string,
  colors: ReturnType<typeof createColors>,
): string {
  if (type === "boolean") {
    return "";
  }

  if (type === "string[]") {
    return colors.yellow(" <string,string,...>");
  }

  if (type === "number[]") {
    return colors.yellow(" <number,number,...>");
  }

  return colors.yellow(` <${type}>`);
}
