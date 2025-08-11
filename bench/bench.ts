import { parseArgs } from "jsr:@std/cli/parse-args";
import { argument, parse, subCommand, type } from "@sigma/parse";
import { Command } from "jsr:@cliffy/command@1.0.0-rc.8";

const args = ["deno", "run", "-A", "script.ts", "hello world"];

Deno.bench("std parseArgs", { group: "parse" }, () => {
  parseArgs(args);
});

Deno.bench("sigma parse", { group: "parse" }, () => {
  class RunCommand {
    @argument(0, "script to run")
    @type("string")
    static script: string;

    static A: boolean = false;

    @argument(1, "script arguments", { rest: true })
    @type("string[]")
    static args: string[];
  }
  @parse(args.slice(1))
  class _Args {
    @subCommand(RunCommand)
    static run: RunCommand;
  }
});

Deno.bench("cliffy command", { group: "parse" }, async () => {
  const command = new Command()
    .name("deno")
    .command("run", "Run a script")
    .option("-A, --allow-all", "Allow all permissions")
    .arguments("<script:string> [...args:string]");

  await command.parse(args.slice(1));
});
