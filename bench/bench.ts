import { parseArgs } from "@std/cli/parse-args";
import { arg, Args, cli, command, opt, subCommand } from "../src/index.ts";
import { Command } from "@cliffy/command";

const args = ["deno", "run", "-A", "script.ts", "hello world"];

Deno.bench("std parseArgs", { group: "parse" }, () => {
  parseArgs(args);
});

Deno.bench("Parse API", { group: "parse" }, () => {
  @command
  class RunCommand {
    @arg({ description: "script to run", type: "string" })
    script?: string;

    @opt({ short: "A", type: "boolean" })
    A?: boolean;

    @arg({ description: "script arguments", rest: true, type: "string[]" })
    args?: string[];
  }

  @cli({ name: "deno" })
  class DenoArgs extends Args {
    @subCommand(RunCommand)
    run?: RunCommand;
  }

  DenoArgs.parse(args.slice(1));
});

Deno.bench("cliffy command", { group: "parse" }, async () => {
  const command = new Command()
    .name("deno")
    .command("run", "Run a script")
    .option("-A, --allow-all", "Allow all permissions")
    .arguments("<script:string> [...args:string]");

  await command.parse(args.slice(1));
});
