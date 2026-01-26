import { assertEquals } from "@std/assert";
import {
  Args,
  argument,
  cli,
  command,
  rawRest,
  subCommand,
  type,
} from "../src/index.ts";

Deno.test("rawRest - should capture --help as part of rawRest", () => {
  @cli({
    name: "proxy",
    description: "A proxy command test",
    exitOnHelp: false,
  })
  class ProxyCommand extends Args {
    @argument({ description: "Binary name to execute" })
    @type("string")
    binary: string = "";

    @rawRest("Arguments to pass to the binary")
    args: string[] = [];
  }

  const result = ProxyCommand.parse([
    "docker",
    "run",
    "--help",
  ]);

  console.log("Test 1 Result binary:", result.binary);
  console.log("Test 1 Result args:", result.args);

  assertEquals(result.binary, "docker");
  assertEquals(result.args, ["run", "--help"]);
});

Deno.test("rawRest - should capture --help as part of rawRest (no positional args)", () => {
  @cli({
    name: "proxy-no-pos",
    description: "A proxy command test without positionals",
    exitOnHelp: false,
  })
  class ProxyCommandNoPos extends Args {
    @rawRest("Arguments to pass to the binary")
    args: string[] = [];
  }

  const result = ProxyCommandNoPos.parse([
    "docker",
    "run",
    "--help",
  ]);

  console.log("Test 2 Result args:", result.args);

  assertEquals(result.args, ["docker", "run", "--help"]);
});

Deno.test("rawRest - should NOT capture --help if it's the first argument (shows help instead)", () => {
  @cli({
    name: "proxy-first-help",
    description: "A proxy command test with help first",
    exitOnHelp: false,
  })
  class ProxyCommandFirstHelp extends Args {
    @rawRest("Arguments to pass to the binary")
    args: string[] = [];
  }

  // This should throw/exit because it triggers help display
  // We can use a try-catch because handleHelpDisplay with exitOnHelp: false throws a ParseError
  try {
    ProxyCommandFirstHelp.parse([
      "--help",
      "docker",
      "run",
    ]);
  } catch {
    console.log("Test 3 caught expected help display");
    return;
  }
  throw new Error("Should have shown help");
});

Deno.test("rawRest - should capture --help even if positional args are not all satisfied", () => {
  @cli({
    name: "proxy-multi-pos",
    description: "A proxy command test with multiple positionals",
    exitOnHelp: false,
  })
  class ProxyCommandMultiPos extends Args {
    @argument({ description: "Arg 1" })
    @type("string")
    arg1: string = "";

    @argument({ description: "Arg 2" })
    @type("string")
    arg2: string = "";

    @rawRest("Arguments to pass to the binary")
    args: string[] = [];
  }

  const result = ProxyCommandMultiPos.parse([
    "docker",
    "--help",
  ]);

  console.log("Test 4 Result arg1:", result.arg1);
  console.log("Test 4 Result args:", result.args);

  assertEquals(result.arg1, "docker");
  assertEquals(result.args, ["--help"]);
});

Deno.test("rawRest - should capture --help in a subcommand", () => {
  @command
  class DockerCommand {
    @rawRest("Docker args")
    args: string[] = [];
  }

  @cli({
    name: "myapp",
    description: "My app",
    exitOnHelp: false,
  })
  class MyApp extends Args {
    @subCommand(DockerCommand)
    docker?: DockerCommand;
  }

  const result = MyApp.parse([
    "docker",
    "run",
    "--help",
  ]);

  console.log("Test 5 Result docker args:", result.docker?.args);

  assertEquals(result.docker?.args, ["run", "--help"]);
});

Deno.test("rawRest - should capture --help if it follows -- separator", () => {
  @cli({
    name: "proxy-sep",
    description: "A proxy command test with separator",
    exitOnHelp: false,
  })
  class ProxyCommandSep extends Args {
    @rawRest("Arguments to pass to the binary")
    args: string[] = [];
  }

  const result = ProxyCommandSep.parse([
    "--",
    "--help",
    "docker",
    "run",
  ]);

  console.log("Test 6 Result args:", result.args);

  assertEquals(result.args, ["--help", "docker", "run"]);
});
