import {
  Args,
  cli,
  command,
  isParseError,
  opt,
  subCommand,
} from "@sigma/parse";
import { assertNotMatch, assertStringIncludes } from "@std/assert";
import { stripAnsiCode } from "@std/fmt/colors";

@command()
class ListCommand extends Args {
  @opt({
    short: "r",
    description: "Specify an installation root of scripts.",
    type: "string",
  })
  root?: string;
}

@cli({
  name: "nub",
  description: "A command-line tool.",
  color: true,
  exitOnHelp: false,
})
class Nub extends Args {
  @subCommand(ListCommand, { description: "List installed scripts." })
  list?: ListCommand;
}

function getHelpOutput(args: string[]): string {
  try {
    Nub.parse(args);
    return "";
  } catch (e) {
    if (isParseError(e)) {
      return e.message;
    }
    throw e;
  }
}

Deno.test("subcommand help shows colors", () => {
  const helpOutput = getHelpOutput(["list", "--help"]);
  assertStringIncludes(helpOutput, "\x1b[");
});

Deno.test("subcommand help shows correct description", () => {
  const helpOutput = getHelpOutput(["list", "--help"]);
  assertStringIncludes(helpOutput, "List installed scripts.");
});

Deno.test("subcommand help does not show gen-completions", () => {
  const helpOutput = getHelpOutput(["list", "--help"]);
  assertNotMatch(helpOutput, /gen-completions/);
});

Deno.test("root help shows gen-completions", () => {
  const helpOutput = getHelpOutput(["--help"]);
  assertStringIncludes(helpOutput, "gen-completions");
});

Deno.test("subcommand usage shows app name and subcommand name", () => {
  const helpOutput = getHelpOutput(["list", "--help"]);
  const plainOutput = stripAnsiCode(helpOutput);
  assertStringIncludes(plainOutput, "Usage:\n  nub list [options]");
});
