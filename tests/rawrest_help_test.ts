import { assertEquals } from "@std/assert";
import { arg, Args, cli, command, subCommand } from "../mod.ts";

Deno.test("rawRest - should capture --help as part of rawRest", () => {
  @cli({
    name: "proxy",
    description: "A proxy command test",
    exitOnHelp: false,
  })
  class ProxyCommand extends Args {
    @arg({ description: "Binary name to execute", type: "string" })
    binary: string = "";

    @arg({ description: "Arguments to pass to the binary", raw: true })
    args: string[] = [];
  }

  const result = ProxyCommand.parse([
    "docker",
    "run",
    "--help",
  ]);

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
    @arg({ description: "Arguments to pass to the binary", raw: true })
    args: string[] = [];
  }

  const result = ProxyCommandNoPos.parse([
    "docker",
    "run",
    "--help",
  ]);

  assertEquals(result.args, ["docker", "run", "--help"]);
});

Deno.test("rawRest - should NOT capture --help if it's the first argument (shows help instead)", () => {
  @cli({
    name: "proxy-first-help",
    description: "A proxy command test with help first",
    exitOnHelp: false,
  })
  class ProxyCommandFirstHelp extends Args {
    @arg({ description: "Arguments to pass to the binary", raw: true })
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
    @arg({ description: "Arg 1", type: "string" })
    arg1: string = "";

    @arg({ description: "Arg 2", type: "string" })
    arg2: string = "";

    @arg({ description: "Arguments to pass to the binary", raw: true })
    args: string[] = [];
  }

  const result = ProxyCommandMultiPos.parse([
    "docker",
    "--help",
  ]);

  assertEquals(result.arg1, "docker");
  assertEquals(result.args, ["--help"]);
});

Deno.test("rawRest - should capture --help in a subcommand", () => {
  @command
  class DockerCommand {
    @arg({ description: "Docker args", raw: true })
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

  assertEquals(result.docker?.args, ["run", "--help"]);
});

Deno.test("rawRest - should capture --help if it follows -- separator", () => {
  @cli({
    name: "proxy-sep",
    description: "A proxy command test with separator",
    exitOnHelp: false,
  })
  class ProxyCommandSep extends Args {
    @arg({ description: "Arguments to pass to the binary", raw: true })
    args: string[] = [];
  }

  const result = ProxyCommandSep.parse([
    "--",
    "--help",
    "docker",
    "run",
  ]);

  assertEquals(result.args, ["--help", "docker", "run"]);
});
