// deno-lint-ignore-file no-import-prefix
import { parseArgs } from "jsr:@std/cli@1/parse-args";
import { arg, Args, cli, command, opt, subCommand } from "../src/index.ts";
import { Command } from "jsr:@cliffy/command@1.0.0-rc.8";

const args = ["deno", "run", "-A", "script.ts", "hello world"];

Deno.bench("std parseArgs", { group: "parse" }, () => {
  parseArgs(args);
});

Deno.bench("Args API", { group: "parse" }, () => {
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
