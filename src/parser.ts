import type { Token } from "./tokenizer.ts";
import type {
  OptDef,
  ParseOptions,
  ParseResult,
  PositionalDef,
  SubCommand,
  SupportedType,
} from "./types.ts";
import { handleParsingError } from "./error-handling.ts";

export type ParseStatus =
  | { type: "success"; result: ParseResult }
  | { type: "help" }
  | {
    type: "subcommand";
    name: string;
    args: string[];
    parentResult: ParseResult;
  };

/**
 * Processes tokens according to argument definitions.
 */
export function parseTokens(
  tokens: Token[],
  optDefs: OptDef[],
  positionalDefs: PositionalDef[],
  subCommands?: Map<string, SubCommand>,
  options?: ParseOptions,
): ParseStatus {
  const result: ParseResult = {};
  const argMap = new Map<string, OptDef>();
  const shortFlagMap = new Map<string, OptDef>();

  for (const arg of optDefs) {
    argMap.set(arg.name, arg);
    if (arg.short) {
      shortFlagMap.set(arg.short, arg);
    }
  }

  const regularPositionalDefs = positionalDefs.filter((def) => !def.raw);
  const rawRestDef = positionalDefs.find((def) => def.raw);

  let positionalIndex = 0;
  let i = 0;
  let rawRestStarted = false;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token.type === "Separator") {
      i++;
      // All remaining tokens are positional/rawRest
      while (i < tokens.length) {
        processPositional(tokens[i].raw, true);
        i++;
      }
      break;
    }

    if (token.type === "LongFlag") {
      // Help detection
      if (token.name === "help" || token.name === "h") {
        if (rawRestDef && (positionalIndex > 0 || rawRestStarted)) {
          // Capture as rawRest
          processRawRest(token.raw);
          i++;
          continue;
        } else {
          return { type: "help" };
        }
      }

      const argDef = argMap.get(token.name);
      if (!argDef) {
        if (rawRestDef) {
          processRawRest(token.raw);
        } else {
          handleParsingError(
            `Unknown argument: --${token.name}`,
            options,
            "unknown_argument",
            { argumentName: `--${token.name}` },
            1,
          );
        }
        i++;
        continue;
      }

      if (argDef.type === "boolean") {
        result[argDef.name] = token.value !== undefined
          ? coerceValue(token.value, "boolean", options, `--${token.name}`)
          : true;
        i++;
      } else {
        let value: string;
        if (token.value !== undefined) {
          value = token.value;
          i++;
        } else {
          i++;
          if (i >= tokens.length || tokens[i].type !== "Positional") {
            handleParsingError(
              `Missing value for argument: --${token.name}`,
              options,
              "missing_value",
              { argumentName: `--${token.name}` },
              1,
            );
            value = "";
          } else {
            value = tokens[i].raw;
            i++;
          }
        }
        result[argDef.name] = coerceValue(
          value,
          argDef.type,
          options,
          `--${token.name}`,
        );
      }
    } else if (token.type === "ShortFlag") {
      // Help detection
      if (token.chars === "h") {
        if (rawRestDef && (positionalIndex > 0 || rawRestStarted)) {
          // Capture as rawRest
          processRawRest(token.raw);
          i++;
          continue;
        } else {
          return { type: "help" };
        }
      }

      if (token.chars.length === 1) {
        const char = token.chars;
        const argDef = shortFlagMap.get(char);
        if (!argDef) {
          if (rawRestDef) {
            processRawRest(token.raw);
          } else {
            handleParsingError(
              `Unknown argument: -${char}`,
              options,
              "unknown_argument",
              { argumentName: `-${char}` },
              1,
            );
          }
          i++;
          continue;
        }

        if (argDef.type === "boolean") {
          result[argDef.name] = true;
          i++;
        } else {
          i++;
          let value: string;
          if (i >= tokens.length || tokens[i].type !== "Positional") {
            handleParsingError(
              `Missing value for argument: -${char}`,
              options,
              "missing_value",
              { argumentName: `-${char}` },
              1,
            );
            value = "";
          } else {
            value = tokens[i].raw;
            i++;
          }
          result[argDef.name] = coerceValue(
            value,
            argDef.type,
            options,
            `-${char}`,
          );
        }
      } else {
        // Combined short flags (-abc)
        let allValid = true;
        for (const char of token.chars) {
          const argDef = shortFlagMap.get(char);
          if (!argDef || argDef.type !== "boolean") {
            allValid = false;
            break;
          }
        }

        if (allValid) {
          for (const char of token.chars) {
            const argDef = shortFlagMap.get(char)!;
            result[argDef.name] = true;
          }
          i++;
        } else if (rawRestDef) {
          processRawRest(token.raw);
          i++;
        } else {
          // Standard bundle processing with errors
          for (const char of token.chars) {
            const argDef = shortFlagMap.get(char);
            if (!argDef) {
              handleParsingError(
                `Unknown argument: -${char}`,
                options,
                "unknown_argument",
                { argumentName: `-${char}` },
                1,
              );
              continue;
            }
            if (argDef.type !== "boolean") {
              handleParsingError(
                `Combined short flag -${char} must be boolean (found in -${token.chars})`,
                options,
                "unknown_argument",
                { argumentName: `-${char}` },
                1,
              );
              continue;
            }
            result[argDef.name] = true;
          }
          i++;
        }
      }
    } else if (token.type === "Positional") {
      // Subcommand detection
      if (subCommands?.has(token.value)) {
        const remainingArgs = tokens.slice(i + 1).map((t) => t.raw);
        return {
          type: "subcommand",
          name: token.value,
          args: remainingArgs,
          parentResult: result,
        };
      }
      processPositional(token.value);
      i++;
    }
  }

  function processPositional(value: string, fromSeparator = false) {
    if (positionalIndex < regularPositionalDefs.length) {
      const argDef = regularPositionalDefs[positionalIndex];
      if (argDef.rest) {
        const currentValues = (result[argDef.name] as unknown[]) || [];
        currentValues.push(
          coerceValue(
            value,
            argDef.type.replace("[]", "") as SupportedType,
            options,
            argDef.name,
          ),
        );
        result[argDef.name] = currentValues;
      } else {
        result[argDef.name] = coerceValue(
          value,
          argDef.type,
          options,
          argDef.name,
        );
        positionalIndex++;
      }
    } else if (rawRestDef) {
      processRawRest(value);
    } else if (!fromSeparator) {
      throw new Error(`Unknown argument: ${value}`);
    }
  }

  function processRawRest(value: string) {
    if (rawRestDef) {
      rawRestStarted = true;
      const currentValues = (result[rawRestDef.name] as string[]) || [];
      currentValues.push(value);
      result[rawRestDef.name] = currentValues;
    }
  }

  return { type: "success", result };
}

/**
 * Coerces a string value to the specified type.
 */
function coerceValue(
  value: string,
  type: SupportedType,
  options?: ParseOptions,
  argName?: string,
): unknown {
  switch (type) {
    case "number": {
      const num = Number(value);
      if (isNaN(num)) {
        handleParsingError(
          `Invalid number for ${argName}: ${value}`,
          options,
          "invalid_number",
          { value },
          1,
        );
        return 0;
      }
      return num;
    }
    case "boolean": {
      return value.toLowerCase() === "true" || value === "1";
    }
    case "string[]": {
      return value.split(",").map((s) => s.trim());
    }
    case "number[]": {
      return value.split(",").map((s) => {
        const num = Number(s.trim());
        if (isNaN(num)) {
          handleParsingError(
            `Invalid number in array for ${argName}: ${s}`,
            options,
            "invalid_array_number",
            { value: s },
            1,
          );
          return 0;
        }
        return num;
      });
    }
    default: {
      return value;
    }
  }
}
