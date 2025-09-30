import { Args, cli } from "@sigma/parse";

@cli({
  name: "calculator",
  description: "a simple calculator",
  defaultCommand: "help",
})
class calculator extends Args {
}

// parse command line arguments
const _args = calculator.parse(Deno.args);
