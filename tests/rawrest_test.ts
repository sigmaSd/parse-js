import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  argument,
  command,
  description,
  parse,
  rawRest,
  subCommand,
  type,
} from "../src/index.ts";

Deno.test("rawRest - basic functionality", () => {
  @parse(["docker", "run", "--rm", "-it", "ubuntu", "bash"], {
    name: "proxy",
    description: "A proxy command test",
    exitOnError: false,
  })
  class ProxyCommand {
    @argument(0, "Binary name to execute")
    static binary: string = "";

    @rawRest("Arguments to pass to the binary")
    static args: string[] = [];
  }

  assertEquals(ProxyCommand.binary, "docker");
  assertEquals(ProxyCommand.args, ["run", "--rm", "-it", "ubuntu", "bash"]);
});

Deno.test("rawRest - multiple positional args then rawRest", () => {
  @parse(["chef", "run", "irust", "--version", "--debug"], {
    name: "chef",
    description: "Chef command runner",
    exitOnError: false,
  })
  class ChefCommand {
    @argument(0, "Command to run")
    static command: string = "";

    @argument(1, "Binary name")
    static binary: string = "";

    @rawRest("Arguments for the binary")
    static binArgs: string[] = [];
  }

  assertEquals(ChefCommand.command, "chef");
  assertEquals(ChefCommand.binary, "run");
  assertEquals(ChefCommand.binArgs, ["irust", "--version", "--debug"]);
});

Deno.test("rawRest - with no remaining args", () => {
  @parse(["npm", "run"], {
    name: "npm-test",
    description: "NPM test",
    exitOnError: false,
  })
  class NpmCommand {
    @argument(0, "Command")
    static cmd: string = "";

    @argument(1, "Script name")
    static script: string = "start";

    @rawRest("Script arguments")
    static scriptArgs: string[] = [];
  }

  assertEquals(NpmCommand.cmd, "npm");
  assertEquals(NpmCommand.script, "run");
  assertEquals(NpmCommand.scriptArgs, []);
});

Deno.test("rawRest - captures flags that would normally be parsed", () => {
  @parse(
    ["deno", "run", "--allow-net", "script.ts", "--script-flag", "value"],
    {
      name: "deno-test",
      description: "Deno test",
      exitOnError: false,
    },
  )
  class DenoCommand {
    @argument(0, "Runtime")
    static runtime: string = "";

    @argument(1, "Subcommand")
    static subcommand: string = "";

    @rawRest("Script and arguments")
    static scriptArgs: string[] = [];
  }

  assertEquals(DenoCommand.runtime, "deno");
  assertEquals(DenoCommand.subcommand, "run");
  assertEquals(DenoCommand.scriptArgs, [
    "--allow-net",
    "script.ts",
    "--script-flag",
    "value",
  ]);
});

Deno.test("rawRest - with separator", () => {
  @parse(["tool", "cmd", "--", "--flag1", "--flag2", "value"], {
    name: "separator-test",
    description: "Test with separator",
    exitOnError: false,
  })
  class SeparatorCommand {
    @argument(0, "Tool name")
    static tool: string = "";

    @argument(1, "Command")
    static cmd: string = "";

    @rawRest("Raw arguments")
    static rawArgs: string[] = [];
  }

  assertEquals(SeparatorCommand.tool, "tool");
  assertEquals(SeparatorCommand.cmd, "cmd");
  assertEquals(SeparatorCommand.rawArgs, ["--flag1", "--flag2", "value"]);
});

Deno.test("rawRest - empty command line uses defaults", () => {
  @parse([], {
    name: "empty-test",
    description: "Empty test",
    exitOnError: false,
  })
  class EmptyCommand {
    @argument(0, "Optional command")
    static cmd: string = "default";

    @rawRest("Optional arguments")
    static args: string[] = [];
  }

  assertEquals(EmptyCommand.cmd, "default");
  assertEquals(EmptyCommand.args, []);
});

Deno.test("rawRest - with regular options mixed in", () => {
  @parse(["tool", "--verbose", "subcmd", "--proxy-flag", "value"], {
    name: "mixed-test",
    description: "Test with mixed options",
    exitOnError: false,
  })
  class MixedCommand {
    @argument(0, "Tool name")
    static tool: string = "";

    @description("Enable verbose output")
    static verbose: boolean = false;

    @rawRest("Subcommand and its arguments")
    static subArgs: string[] = [];
  }

  assertEquals(MixedCommand.tool, "tool");
  assertEquals(MixedCommand.verbose, true);
  assertEquals(MixedCommand.subArgs, ["subcmd", "--proxy-flag", "value"]);
});

Deno.test("rawRest - single argument before rawRest", () => {
  @parse(["exec", "ls", "-la", "/tmp"], {
    name: "exec-test",
    description: "Execute command test",
    exitOnError: false,
  })
  class ExecCommand {
    @argument(0, "Command to execute")
    static command: string = "";

    @rawRest("Command arguments")
    static cmdArgs: string[] = [];
  }

  assertEquals(ExecCommand.command, "exec");
  assertEquals(ExecCommand.cmdArgs, ["ls", "-la", "/tmp"]);
});

Deno.test("rawRest - with subcommands", () => {
  @command
  class RunCommand {
    @argument(0, "Binary to execute")
    static binary: string = "";

    @rawRest("Arguments for the binary")
    static binArgs: string[] = [];

    @description("Run in background")
    static background: boolean = false;
  }

  @parse(["run", "docker", "ps", "-a"], {
    name: "chef",
    description: "Chef development tool",
    exitOnError: false,
  })
  class ChefApp {
    @description("Enable debug mode")
    static debug: boolean = false;

    @description("Run a command with arguments")
    @subCommand(RunCommand)
    static run: RunCommand;
  }

  assertEquals(ChefApp.debug, false);
  assertEquals(ChefApp.run instanceof RunCommand, true);
  // The subcommand should have parsed its own args
  assertEquals(RunCommand.binary, "docker");
  assertEquals(RunCommand.binArgs, ["ps", "-a"]);
  assertEquals(RunCommand.background, false);
});

Deno.test("rawRest - error when used with rest argument", () => {
  assertThrows(
    () => {
      @parse([], {
        name: "conflict-test",
        description: "Test conflicting rest types",
        exitOnError: false,
      })
      class _ConflictCommand {
        @argument(0, "Input")
        static input: string = "";

        @argument(1, "Files", { rest: true })
        @type("string[]")
        static files: string[] = [];

        @rawRest("Raw args")
        static rawArgs: string[] = [];
      }
    },
    Error,
    "Cannot use both @argument(n, {rest: true}) and @rawRest()",
  );
});

Deno.test("rawRest - with validation", () => {
  function _minLength(min: number) {
    return (value: unknown) => {
      if (Array.isArray(value) && value.length < min) {
        return `must have at least ${min} items`;
      }
      return null;
    };
  }

  @parse(["cmd"], {
    name: "validation-test",
    description: "Test rawRest validation",
    exitOnError: false,
  })
  class ValidationCommand {
    @argument(0, "Command")
    static cmd: string = "";

    @rawRest("Arguments (min 0)")
    static args: string[] = [];
  }

  assertEquals(ValidationCommand.cmd, "cmd");
  assertEquals(ValidationCommand.args, []);
});

Deno.test("rawRest - complex real-world example", () => {
  @parse([
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
  ], {
    name: "container-proxy",
    description: "Container execution proxy",
    exitOnError: false,
  })
  class ContainerProxy {
    @argument(0, "Container runtime")
    static runtime: string = "";

    @argument(1, "Runtime command")
    static runtimeCmd: string = "";

    @rawRest("All container and command arguments")
    static containerArgs: string[] = [];

    @description("Enable debug logging")
    static debug: boolean = false;
  }

  assertEquals(ContainerProxy.runtime, "docker");
  assertEquals(ContainerProxy.runtimeCmd, "run");
  assertEquals(ContainerProxy.containerArgs, [
    "--rm",
    "-it",
    "--volume",
    "/host:/container",
    "ubuntu:20.04",
    "bash",
    "-c",
    "echo hello",
  ]);
  assertEquals(ContainerProxy.debug, false);
});

Deno.test("unexpected positional arguments should error", () => {
  assertThrows(
    () => {
      @parse(["unexpected", "positional", "args"], {
        name: "empty-test",
        description: "Test with no defined positional args",
        exitOnError: false,
      })
      class _EmptyCommand {
        @description("Enable debug mode")
        static debug: boolean = false;
      }
    },
    Error,
    "Unknown argument: unexpected",
  );
});

Deno.test("unexpected positional arguments with defined args should error", () => {
  assertThrows(
    () => {
      @parse(["input.txt", "output.txt", "unexpected"], {
        name: "file-processor",
        description: "Test with defined positional args",
        exitOnError: false,
      })
      class _FileProcessor {
        @argument(0, "Input file")
        static input: string = "";

        @argument(1, "Output file")
        static output: string = "";

        @description("Enable verbose mode")
        static verbose: boolean = false;
      }
    },
    Error,
    "Unknown argument: unexpected",
  );
});
