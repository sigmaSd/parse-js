// deno-lint-ignore-file no-import-prefix
import { assertEquals, assertThrows } from "jsr:@std/assert@1.0.14";
import {
  argument,
  command,
  description,
  parse,
  subCommand,
  type,
} from "../src/index.ts";

@command
class BuildCommand {
  @argument({ description: "Input directory" })
  static input: string = "";

  @description("Enable production build")
  static production: boolean = false;
}

Deno.test("empty class with no arguments should work", () => {
  @parse([], {
    name: "empty-test",
    description: "Test with no arguments",
    exitOnError: false,
  })
  class EmptyCommand {
    @description("Enable debug mode")
    static debug: boolean = false;
  }

  assertEquals(EmptyCommand.debug, false);
});

Deno.test("unknown flags should error", () => {
  assertThrows(
    () => {
      @parse(["--unknown-flag"], {
        name: "flag-test",
        description: "Test unknown flags",
        exitOnError: false,
      })
      class _FlagTest {
        @description("Enable debug mode")
        static debug: boolean = false;
      }
    },
    Error,
    "Unknown argument: --unknown-flag",
  );
});

Deno.test("unexpected positional arguments should error", () => {
  assertThrows(
    () => {
      @parse(["unexpected"], {
        name: "positional-test",
        description: "Test unexpected positional args",
        exitOnError: false,
      })
      class _PositionalTest {
        @description("Enable debug mode")
        static debug: boolean = false;
      }
    },
    Error,
    "Unknown argument: unexpected",
  );
});

Deno.test("multiple unexpected positional arguments should error on first one", () => {
  assertThrows(
    () => {
      @parse(["first", "second", "third"], {
        name: "multiple-test",
        description: "Test multiple unexpected args",
        exitOnError: false,
      })
      class _MultipleTest {
        @description("Enable debug mode")
        static debug: boolean = false;
      }
    },
    Error,
    "Unknown argument: first",
  );
});

Deno.test("defined positional arguments should work correctly", () => {
  @parse(["input.txt", "output.txt"], {
    name: "file-test",
    description: "Test defined positional args",
    exitOnError: false,
  })
  class FileTest {
    @argument({ description: "Input file" })
    static input: string = "";

    @argument({ description: "Output file" })
    static output: string = "";

    @description("Enable verbose mode")
    static verbose: boolean = false;
  }

  assertEquals(FileTest.input, "input.txt");
  assertEquals(FileTest.output, "output.txt");
  assertEquals(FileTest.verbose, false);
});

Deno.test("too many positional arguments should error", () => {
  assertThrows(
    () => {
      @parse(["input.txt", "output.txt", "extra.txt"], {
        name: "too-many-test",
        description: "Test too many positional args",
        exitOnError: false,
      })
      class _TooManyTest {
        @argument({ description: "Input file" })
        static input: string = "";

        @argument({ description: "Output file" })
        static output: string = "";
      }
    },
    Error,
    "Unknown argument: extra.txt",
  );
});

Deno.test("valid flags should work", () => {
  @parse(["--debug", "--port", "3000"], {
    name: "flag-test",
    description: "Test valid flags",
    exitOnError: false,
  })
  class ValidFlagTest {
    @description("Enable debug mode")
    static debug: boolean = false;

    @description("Port number")
    @type("number")
    static port: number = 8080;
  }

  assertEquals(ValidFlagTest.debug, true);
  assertEquals(ValidFlagTest.port, 3000);
});

Deno.test("mix of valid positional and flags should work", () => {
  @parse(["input.txt", "--verbose", "output.txt"], {
    name: "mixed-test",
    description: "Test mixed args",
    exitOnError: false,
  })
  class MixedTest {
    @argument({ description: "Input file" })
    static input: string = "";

    @argument({ description: "Output file" })
    static output: string = "";

    @description("Enable verbose mode")
    static verbose: boolean = false;
  }

  assertEquals(MixedTest.input, "input.txt");
  assertEquals(MixedTest.output, "output.txt");
  assertEquals(MixedTest.verbose, true);
});

Deno.test("rest arguments should work", () => {
  @parse(["first.txt", "second.txt", "third.txt"], {
    name: "rest-test",
    description: "Test rest arguments",
    exitOnError: false,
  })
  class RestTest {
    @argument({ description: "First file" })
    static first: string = "";

    @argument({ description: "Additional files", rest: true })
    @type("string[]")
    static files: string[] = [];
  }

  assertEquals(RestTest.first, "first.txt");
  assertEquals(RestTest.files, ["second.txt", "third.txt"]);
});

Deno.test("optional positional arguments should work", () => {
  @parse(["input.txt"], {
    name: "optional-test",
    description: "Test optional positional args",
    exitOnError: false,
  })
  class OptionalTest {
    @argument({ description: "Input file" })
    static input: string = "";

    @argument({ description: "Output file" })
    static output: string = "default.txt";
  }

  assertEquals(OptionalTest.input, "input.txt");
  assertEquals(OptionalTest.output, "default.txt");
});

Deno.test("separator should work correctly", () => {
  @parse(["input.txt", "--", "--not-a-flag"], {
    name: "separator-test",
    description: "Test -- separator",
    exitOnError: false,
  })
  class SeparatorTest {
    @argument({ description: "Input file" })
    static input: string = "";

    @argument({ description: "Extra arg" })
    static extra: string = "";

    @description("Enable verbose mode")
    static verbose: boolean = false;
  }

  assertEquals(SeparatorTest.input, "input.txt");
  assertEquals(SeparatorTest.extra, "--not-a-flag");
  assertEquals(SeparatorTest.verbose, false);
});

Deno.test("subcommands with unexpected positional arguments should error", () => {
  assertThrows(
    () => {
      @parse(["build", "unexpected", "positional"], {
        name: "subcommand-test",
        description: "Test subcommands with unexpected args",
        exitOnError: false,
      })
      class _SubcommandTest {
        @description("Enable debug mode")
        static debug: boolean = false;

        @subCommand(BuildCommand)
        static build: BuildCommand;
      }
    },
    Error,
    "Unknown argument: positional",
  );
});

Deno.test("subcommands with single argument should become positional arg", () => {
  @parse(["build", "src/"], {
    name: "single-arg-test",
    description: "Test single arg becomes positional for subcommand",
    exitOnError: false,
  })
  class _SingleArgTest {
    @description("Enable debug mode")
    static debug: boolean = false;

    @subCommand(BuildCommand)
    static build: BuildCommand;
  }

  assertEquals(_SingleArgTest.debug, false);
  assertEquals(_SingleArgTest.build instanceof BuildCommand, true);
  assertEquals(BuildCommand.input, "src/");
  assertEquals(BuildCommand.production, false);
});

Deno.test("subcommands with unexpected args after valid ones should error", () => {
  assertThrows(
    () => {
      @parse(["build", "src/", "unexpected"], {
        name: "after-valid-test",
        description: "Test unexpected arg after valid ones",
        exitOnError: false,
      })
      class _AfterValidTest {
        @description("Enable debug mode")
        static debug: boolean = false;

        @subCommand(BuildCommand)
        static build: BuildCommand;
      }
    },
    Error,
    "Unknown argument: unexpected",
  );
});

Deno.test("subcommands with valid arguments should work", () => {
  @parse(["build", "src/", "--production"], {
    name: "valid-subcommand-test",
    description: "Test valid subcommand args",
    exitOnError: false,
  })
  class ValidSubcommandTest {
    @description("Enable debug mode")
    static debug: boolean = false;

    @subCommand(BuildCommand)
    static build: BuildCommand;
  }

  assertEquals(ValidSubcommandTest.debug, false);
  assertEquals(ValidSubcommandTest.build instanceof BuildCommand, true);
  assertEquals(BuildCommand.input, "src/");
  assertEquals(BuildCommand.production, true);
});

Deno.test("unknown subcommands should error", () => {
  assertThrows(
    () => {
      @parse(["unknown-subcommand", "arg1"], {
        name: "unknown-subcommand-test",
        description: "Test unknown subcommand behavior",
        exitOnError: false,
      })
      class _UnknownSubcommandTest {
        @description("Enable debug mode")
        static debug: boolean = false;

        @subCommand(BuildCommand)
        static build: BuildCommand;
      }
    },
    Error,
    "Unknown argument: unknown-subcommand",
  );
});
