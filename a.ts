import { Args, cli } from "@sigma/parse";
import { command, subCommand } from "./src/index.ts";

@command({ defaultCommand: "help" })
class A {
  n = 0;
}

@cli({
  name: "calculator",
  description: "a simple calculator",
  defaultCommand: "help",
})
class calculator extends Args {
  @subCommand(A)
  add?: A;
}

// parse command line arguments
const _args = calculator.parse(Deno.args);
