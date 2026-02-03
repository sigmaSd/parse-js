import type { ArgumentDef, ParsedArg, SubCommand } from "./types.ts";
import { collectInstanceArgumentDefs } from "./metadata.ts";

/**
 * Generates fish shell completions for a command.
 */
export function generateFishCompletions(
  appName: string,
  parsedArgs: ParsedArg[],
  _argumentDefs: ArgumentDef[],
  subCommands?: Map<string, SubCommand>,
): string {
  const lines: string[] = [];

  // Disable file completion for the command by default
  lines.push(`complete -c ${appName} -f`);

  // Add completions for global options
  // These should be available when NO subcommand has been selected yet
  for (const arg of parsedArgs) {
    const shortFlag = arg.short ? ` -s ${arg.short}` : "";
    const desc = arg.description ? ` -d "${arg.description}"` : "";
    lines.push(
      `complete -c ${appName} -n "__fish_use_subcommand" -l ${arg.name}${shortFlag}${desc}`,
    );
  }

  // Add completions for subcommands
  if (subCommands && subCommands.size > 0) {
    for (const [name, subCommand] of subCommands) {
      const desc = subCommand.description
        ? ` -d "${subCommand.description}"`
        : "";
      // Only suggest subcommand if we haven't seen one yet
      lines.push(
        `complete -c ${appName} -n "__fish_use_subcommand" -a "${name}"${desc}`,
      );

      // Generate completions for the subcommand
      // We need to instantiate it to get its arguments
      const instance = new subCommand.commandClass() as Record<string, unknown>;
      const { parsedArgs: subParsedArgs } = collectInstanceArgumentDefs(
        instance,
        { strict: false },
      );

      // For subcommand options, we check if the subcommand is present in the command line
      for (const arg of subParsedArgs) {
        const shortFlag = arg.short ? ` -s ${arg.short}` : "";
        const desc = arg.description ? ` -d "${arg.description}"` : "";
        // Condition: __fish_seen_subcommand_from <subcommand>
        lines.push(
          `complete -c ${appName} -n "__fish_seen_subcommand_from ${name}" -l ${arg.name}${shortFlag}${desc}`,
        );
      }
    }
  }

  return lines.join("\n");
}
