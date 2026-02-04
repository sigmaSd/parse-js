/**
 * Tokenizer for CLI arguments.
 *
 * Converts a raw string array into a sequence of semantic tokens.
 */

export type Token =
  | { type: "LongFlag"; name: string; value?: string; raw: string }
  | { type: "ShortFlag"; chars: string; raw: string }
  | { type: "Positional"; value: string; raw: string }
  | { type: "Separator"; raw: "--" };

/**
 * Tokenizes an array of command line arguments.
 */
export function tokenize(args: string[]): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let separatorFound = false;

  while (i < args.length) {
    const arg = args[i];

    if (separatorFound) {
      tokens.push({ type: "Positional", value: arg, raw: arg });
      i++;
      continue;
    }

    if (arg === "--") {
      tokens.push({ type: "Separator", raw: "--" });
      separatorFound = true;
      i++;
    } else if (arg.startsWith("--")) {
      if (arg.includes("=")) {
        const [name, value] = arg.slice(2).split("=", 2);
        tokens.push({ type: "LongFlag", name, value, raw: arg });
      } else {
        tokens.push({ type: "LongFlag", name: arg.slice(2), raw: arg });
      }
      i++;
    } else if (arg.startsWith("-") && arg.length > 1) {
      tokens.push({ type: "ShortFlag", chars: arg.slice(1), raw: arg });
      i++;
    } else {
      tokens.push({ type: "Positional", value: arg, raw: arg });
      i++;
    }
  }

  return tokens;
}
