import { assertEquals, assertThrows } from "@std/assert";
import {
  Args,
  argument,
  cli,
  command,
  description,
  rawRest,
  subCommand,
  type,
} from "../src/index.ts";

Deno.test("rawRest - basic functionality", () => {
  @cli({
    name: "proxy",
    description: "A proxy command test",
    exitOnError: false,
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
    "--rm",
    "-it",
    "ubuntu",
    "bash",
  ]);
  assertEquals(result.binary, "docker");
  assertEquals(result.args, ["run", "--rm", "-it", "ubuntu", "bash"]);
});

Deno.test("rawRest - multiple positional args then rawRest", () => {
  @cli({
    name: "chef",
    description: "Chef command runner",
    exitOnError: false,
  })
  class ChefCommand extends Args {
    @argument({ description: "Command to run" })
    @type("string")
    command: string = "";

    @argument({ description: "Binary name" })
    @type("string")
    binary: string = "";

    @rawRest("Arguments for the binary")
    binArgs: string[] = [];
  }

  const result = ChefCommand.parse([
    "chef",
    "run",
    "irust",
    "--version",
    "--debug",
  ]);
  assertEquals(result.command, "chef");
  assertEquals(result.binary, "run");
  assertEquals(result.binArgs, ["irust", "--version", "--debug"]);
});

Deno.test("rawRest - with no remaining args", () => {
  @cli({
    name: "npm-test",
    description: "NPM test",
    exitOnError: false,
  })
  class NpmCommand extends Args {
    @argument({ description: "Command" })
    @type("string")
    cmd: string = "";

    @argument({ description: "Script name" })
    @type("string")
    script: string = "start";

    @rawRest("Script arguments")
    scriptArgs: string[] = [];
  }

  const result = NpmCommand.parse(["npm", "run"]);
  assertEquals(result.cmd, "npm");
  assertEquals(result.script, "run");
  assertEquals(result.scriptArgs, []);
});

Deno.test("rawRest - captures flags that would normally be parsed", () => {
  @cli({
    name: "deno-test",
    description: "Deno test",
    exitOnError: false,
  })
  class DenoCommand extends Args {
    @argument({ description: "Runtime" })
    @type("string")
    runtime: string = "";

    @argument({ description: "Subcommand" })
    @type("string")
    subcommand: string = "";

    @rawRest("Script and arguments")
    scriptArgs: string[] = [];
  }

  const result = DenoCommand.parse([
    "deno",
    "run",
    "--allow-net",
    "script.ts",
    "--script-flag",
    "value",
  ]);
  assertEquals(result.runtime, "deno");
  assertEquals(result.subcommand, "run");
  assertEquals(result.scriptArgs, [
    "--allow-net",
    "script.ts",
    "--script-flag",
    "value",
  ]);
});

Deno.test("rawRest - empty command line uses defaults", () => {
  @cli({
    name: "empty-test",
    description: "Empty test",
    exitOnError: false,
  })
  class EmptyCommand extends Args {
    @argument({ description: "Optional command" })
    @type("string")
    cmd: string = "default";

    @rawRest("Optional arguments")
    args: string[] = [];
  }

  const result = EmptyCommand.parse([]);
  assertEquals(result.cmd, "default");
  assertEquals(result.args, []);
});

Deno.test("rawRest - with regular options mixed in", () => {
  @cli({
    name: "mixed-test",
    description: "Test with mixed options",
    exitOnError: false,
  })
  class MixedCommand extends Args {
    @argument({ description: "Tool name" })
    @type("string")
    tool: string = "";

    @description("Enable verbose output")
    verbose: boolean = false;

    @rawRest("Subcommand and its arguments")
    subArgs: string[] = [];
  }

  const result = MixedCommand.parse([
    "tool",
    "--verbose",
    "subcmd",
    "--proxy-flag",
    "value",
  ]);
  assertEquals(result.tool, "tool");
  assertEquals(result.verbose, true);
  assertEquals(result.subArgs, ["subcmd", "--proxy-flag", "value"]);
});

Deno.test("rawRest - single argument before rawRest", () => {
  @cli({
    name: "exec-test",
    description: "Execute command test",
    exitOnError: false,
  })
  class ExecCommand extends Args {
    @argument({ description: "Command to execute" })
    @type("string")
    command: string = "";

    @rawRest("Command arguments")
    cmdArgs: string[] = [];
  }

  const result = ExecCommand.parse(["exec", "ls", "-la", "/tmp"]);
  assertEquals(result.command, "exec");
  assertEquals(result.cmdArgs, ["ls", "-la", "/tmp"]);
});

Deno.test("rawRest - with subcommands", () => {
  @command
  class RunCommand {
    @argument({ description: "Binary to execute" })
    @type("string")
    binary: string = "";

    @rawRest("Arguments for the binary")
    binArgs: string[] = [];

    @description("Run in background")
    background: boolean = false;
  }

  @cli({
    name: "chef",
    description: "Chef development tool",
    exitOnError: false,
  })
  class ChefApp extends Args {
    @description("Enable debug mode")
    debug: boolean = false;

    @description("Run a command with arguments")
    @subCommand(RunCommand)
    run?: RunCommand;
  }

  const result = ChefApp.parse(["run", "docker", "ps", "-a"]);
  assertEquals(result.debug, false);
  assertEquals(!!result.run, true);
  assertEquals(result.run!.binary, "docker");
  assertEquals(result.run!.binArgs, ["ps", "-a"]);
  assertEquals(result.run!.background, false);
});

Deno.test("rawRest - complex real-world example", () => {
  @cli({
    name: "container-proxy",
    description: "Container execution proxy",
    exitOnError: false,
  })
  class ContainerProxy extends Args {
    @argument({ description: "Container runtime" })
    @type("string")
    runtime: string = "";

    @argument({ description: "Runtime command" })
    @type("string")
    runtimeCmd: string = "";

    @rawRest("All container and command arguments")
    containerArgs: string[] = [];

    @description("Enable debug logging")
    debug: boolean = false;
  }

  const result = ContainerProxy.parse([
    "docker",
    "run",
    "--rm",
    "-it",
    "--volume",
    "/host:/container",
    "ubuntu:20.04",
    "bash",
    "-c",
    "echo hello",
  ]);
  assertEquals(result.runtime, "docker");
  assertEquals(result.runtimeCmd, "run");
  assertEquals(result.containerArgs, [
    "--rm",
    "-it",
    "--volume",
    "/host:/container",
    "ubuntu:20.04",
    "bash",
    "-c",
    "echo hello",
  ]);
  assertEquals(result.debug, false);
});

Deno.test("unexpected positional arguments should error", () => {
  @cli({
    name: "empty-test",
    description: "Test with no defined positional args",
    exitOnError: false,
  })
  class EmptyCommand extends Args {
    @description("Enable debug mode")
    debug: boolean = false;
  }

  assertThrows(
    () => {
      EmptyCommand.parse(["unexpected", "positional", "args"]);
    },
    Error,
    "Unknown argument: unexpected",
  );
});

Deno.test("unexpected positional arguments with defined args should error", () => {
  @cli({
    name: "file-processor",
    description: "Test with defined positional args",
    exitOnError: false,
  })
  class FileProcessor extends Args {
    @argument({ description: "Input file" })
    @type("string")
    input: string = "";

    @argument({ description: "Output file" })
    @type("string")
    output: string = "";

    @description("Enable verbose mode")
    verbose: boolean = false;
  }

  assertThrows(
    () => {
      FileProcessor.parse(["input.txt", "output.txt", "unexpected"]);
    },
    Error,
    "Unknown argument: unexpected",
  );
});
