// deno-lint-ignore-file no-import-prefix
import { assertEquals, assertThrows } from "jsr:@std/assert@1.0.14";
import { arg, Args, cli, command, option, subCommand } from "../mod.ts";

@command
class _BuildCommand extends Args {
  @arg({ description: "Input directory", type: "string" })
  input: string = "";

  @option({ description: "Enable production build" })
  production: boolean = false;
}

Deno.test("empty class with no arguments should work", () => {
  @cli({
    name: "empty-test",
    description: "Test with no arguments",
    exitOnError: false,
  })
  class EmptyCommand extends Args {
    @option({ description: "Enable debug mode" })
    debug: boolean = false;
  }

  const result = EmptyCommand.parse([]);
  assertEquals(result.debug, false);
});

Deno.test("unknown flags should error", () => {
  @cli({
    name: "flag-test",
    description: "Test unknown flags",
    exitOnError: false,
  })
  class FlagTest extends Args {
    @option({ description: "Enable debug mode" })
    debug: boolean = false;
  }

  assertThrows(
    () => {
      FlagTest.parse(["--unknown-flag"]);
    },
    Error,
    "Unknown argument: --unknown-flag",
  );
});

Deno.test("unexpected positional arguments should error", () => {
  @cli({
    name: "positional-test",
    description: "Test unexpected positional args",
    exitOnError: false,
  })
  class PositionalTest extends Args {
    @option({ description: "Enable debug mode" })
    debug: boolean = false;
  }

  assertThrows(
    () => {
      PositionalTest.parse(["unexpected"]);
    },
    Error,
    "Unknown argument: unexpected",
  );
});

Deno.test("multiple unexpected positional arguments should error on first one", () => {
  @cli({
    name: "multiple-test",
    description: "Test multiple unexpected args",
    exitOnError: false,
  })
  class MultipleTest extends Args {
    @option({ description: "Enable debug mode" })
    debug: boolean = false;
  }

  assertThrows(
    () => {
      MultipleTest.parse(["first", "second", "third"]);
    },
    Error,
    "Unknown argument: first",
  );
});

Deno.test("defined positional arguments should work correctly", () => {
  @cli({
    name: "file-test",
    description: "Test defined positional args",
    exitOnError: false,
  })
  class FileTest extends Args {
    @arg({ description: "Input file", type: "string" })
    input: string = "";

    @arg({ description: "Output file", type: "string" })
    output: string = "";

    @option({ description: "Enable verbose mode" })
    verbose: boolean = false;
  }

  const result = FileTest.parse(["input.txt", "output.txt"]);
  assertEquals(result.input, "input.txt");
  assertEquals(result.output, "output.txt");
  assertEquals(result.verbose, false);
});

Deno.test("too many positional arguments should error", () => {
  @cli({
    name: "too-many-test",
    description: "Test too many positional args",
    exitOnError: false,
  })
  class TooManyTest extends Args {
    @arg({ description: "Input file", type: "string" })
    input: string = "";

    @arg({ description: "Output file", type: "string" })
    output: string = "";
  }

  assertThrows(
    () => {
      TooManyTest.parse(["input.txt", "output.txt", "extra.txt"]);
    },
    Error,
    "Unknown argument: extra.txt",
  );
});

Deno.test("valid flags should work", () => {
  @cli({
    name: "flag-test",
    description: "Test valid flags",
    exitOnError: false,
  })
  class ValidFlagTest extends Args {
    @option({ description: "Enable debug mode" })
    debug: boolean = false;

    @option({ description: "Port number", type: "number" })
    port: number = 8080;
  }

  const result = ValidFlagTest.parse(["--debug", "--port", "3000"]);
  assertEquals(result.debug, true);
  assertEquals(result.port, 3000);
});

Deno.test("mix of valid positional and flags should work", () => {
  @cli({
    name: "mixed-test",
    description: "Test mixed args",
    exitOnError: false,
  })
  class MixedTest extends Args {
    @arg({ description: "Input file", type: "string" })
    input: string = "";

    @arg({ description: "Output file", type: "string" })
    output: string = "";

    @option({ description: "Enable verbose mode" })
    verbose: boolean = false;
  }

  const result = MixedTest.parse(["input.txt", "--verbose", "output.txt"]);
  assertEquals(result.input, "input.txt");
  assertEquals(result.output, "output.txt");
  assertEquals(result.verbose, true);
});

Deno.test("rest arguments should work", () => {
  @cli({
    name: "rest-test",
    description: "Test rest arguments",
    exitOnError: false,
  })
  class RestTest extends Args {
    @arg({ description: "First file", type: "string" })
    first: string = "";

    @arg({ description: "Additional files", rest: true, type: "string[]" })
    files: string[] = [];
  }

  const result = RestTest.parse(["first.txt", "second.txt", "third.txt"]);
  assertEquals(result.first, "first.txt");
  assertEquals(result.files, ["second.txt", "third.txt"]);
});

Deno.test("optional positional arguments should work", () => {
  @cli({
    name: "optional-test",
    description: "Test optional positional args",
    exitOnError: false,
  })
  class OptionalTest extends Args {
    @arg({ description: "Input file", type: "string" })
    input: string = "";

    @arg({ description: "Output file", type: "string" })
    output: string = "default.txt";
  }

  const result = OptionalTest.parse(["input.txt"]);
  assertEquals(result.input, "input.txt");
  assertEquals(result.output, "default.txt");
});

Deno.test("subcommands with unexpected positional arguments should error", () => {
  @command
  class TestBuildCommand {
    @arg({ description: "Input directory", type: "string" })
    input: string = "";

    @option({ description: "Enable production build" })
    production: boolean = false;
  }

  @cli({
    name: "subcommand-test",
    description: "Test subcommands with unexpected args",
    exitOnError: false,
  })
  class SubcommandTest extends Args {
    @option({ description: "Enable debug mode" })
    debug: boolean = false;

    @subCommand(TestBuildCommand)
    build?: TestBuildCommand;
  }

  assertThrows(
    () => {
      SubcommandTest.parse(["build", "unexpected", "positional"]);
    },
    Error,
    "Unknown argument: positional",
  );
});

Deno.test("subcommands with single argument should become positional arg", () => {
  @command
  class SingleArgBuildCommand {
    @arg({ description: "Input directory", type: "string" })
    input: string = "";

    @option({ description: "Enable production build" })
    production: boolean = false;
  }

  @cli({
    name: "single-arg-test",
    description: "Test single arg becomes positional for subcommand",
    exitOnError: false,
  })
  class SingleArgTest extends Args {
    @option({ description: "Enable debug mode" })
    debug: boolean = false;

    @subCommand(SingleArgBuildCommand)
    build?: SingleArgBuildCommand;
  }

  const result = SingleArgTest.parse(["build", "src/"]);
  assertEquals(result.debug, false);
  assertEquals(!!result.build, true);
  assertEquals(result.build!.input, "src/");
  assertEquals(result.build!.production, false);
});

Deno.test("subcommands with unexpected args after valid ones should error", () => {
  @command
  class AfterValidBuildCommand {
    @arg({ description: "Input directory", type: "string" })
    input: string = "";

    @option({ description: "Enable production build" })
    production: boolean = false;
  }

  @cli({
    name: "after-valid-test",
    description: "Test unexpected arg after valid ones",
    exitOnError: false,
  })
  class AfterValidTest extends Args {
    @option({ description: "Enable debug mode" })
    debug: boolean = false;

    @subCommand(AfterValidBuildCommand)
    build?: AfterValidBuildCommand;
  }

  assertThrows(
    () => {
      AfterValidTest.parse(["build", "src/", "unexpected"]);
    },
    Error,
    "Unknown argument: unexpected",
  );
});

Deno.test("subcommands with valid arguments should work", () => {
  @command
  class ValidBuildCommand {
    @arg({ description: "Input directory", type: "string" })
    input: string = "";

    @option({ description: "Enable production build" })
    production: boolean = false;
  }

  @cli({
    name: "valid-subcommand-test",
    description: "Test valid subcommand args",
    exitOnError: false,
  })
  class ValidSubcommandTest extends Args {
    @option({ description: "Enable debug mode" })
    debug: boolean = false;

    @subCommand(ValidBuildCommand)
    build?: ValidBuildCommand;
  }

  const result = ValidSubcommandTest.parse(["build", "src/", "--production"]);
  assertEquals(result.debug, false);
  assertEquals(!!result.build, true);
  assertEquals(result.build!.input, "src/");
  assertEquals(result.build!.production, true);
});

Deno.test("unknown subcommands should error", () => {
  @command
  class UnknownTestBuildCommand {
    @arg({ description: "Input directory", type: "string" })
    input: string = "";

    @option({ description: "Enable production build" })
    production: boolean = false;
  }

  @cli({
    name: "unknown-subcommand-test",
    description: "Test unknown subcommand behavior",
    exitOnError: false,
  })
  class UnknownSubcommandTest extends Args {
    @option({ description: "Enable debug mode" })
    debug: boolean = false;

    @subCommand(UnknownTestBuildCommand)
    build?: UnknownTestBuildCommand;
  }

  assertThrows(
    () => {
      UnknownSubcommandTest.parse(["unknown-subcommand", "arg1"]);
    },
    Error,
    "Unknown argument: unknown-subcommand",
  );
});
