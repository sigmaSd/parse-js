import { Args, argument, cli, description, required, type } from "@sigma/parse";

@cli({ name: "calculator", description: "a simple calculator" })
class calculator extends Args {
  @argument({ description: "first number" })
  @type("number")
  @required()
  a?: number;

  @argument({ description: "second number" })
  @type("number")
  @required()
  b?: number;

  @description("operation to perform")
  operation = "add";
}

// parse command line arguments
const args = calculator.parse(Deno.args);

// handle potentially undefined values
if (args.a !== undefined && args.b !== undefined) {
  console.log(`${args.a} ${args.operation} ${args.b} = ${args.a + args.b}`);
} else {
  console.error("both numbers are required");
}
