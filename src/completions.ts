import type { OptionDef, PositionalDef, SubCommand } from "./types.ts";
import { collectInstanceArgumentDefs } from "./metadata.ts";

/**
 * Generates fish shell completions for a command.
 */
export function generateFishCompletions(
  appName: string,
  optionDefs: OptionDef[],
  _positionalDefs: PositionalDef[],
  subCommands?: Map<string, SubCommand>,
): string {
  const lines: string[] = [];

  // Disable file completion for the command by default
  lines.push(`complete -c ${appName} -f`);

  // Add completions for global options
  for (const arg of optionDefs) {
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
      lines.push(
        `complete -c ${appName} -n "__fish_use_subcommand" -a "${name}"${desc}`,
      );

      const instance = new subCommand.commandClass() as Record<string, unknown>;
      const { optionDefs: subOptionDefs } = collectInstanceArgumentDefs(
        instance,
        { strict: false },
      );

      for (const arg of subOptionDefs) {
        const shortFlag = arg.short ? ` -s ${arg.short}` : "";
        const desc = arg.description ? ` -d "${arg.description}"` : "";
        lines.push(
          `complete -c ${appName} -n "__fish_seen_subcommand_from ${name}" -l ${arg.name}${shortFlag}${desc}`,
        );
      }
    }
  }

  return lines.join("\n");
}
