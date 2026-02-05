// deno-lint-ignore-file no-import-prefix
import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { Args, cli, opt, ParseError } from "../mod.ts";

Deno.test("Short Flag - explicit definition", () => {
  @cli({ name: "test" })
  class Config extends Args {
    @opt({ description: "Output file", short: "o" })
    output: string = "";

    @opt({ description: "Force mode", short: "f" })
    force: boolean = false;
  }

  const result = Config.parse(["-o", "result.txt", "-f"]);
  assertEquals(result.output, "result.txt");
  assertEquals(result.force, true);
});

Deno.test("Short Flag - implicit definition (first character)", () => {
  @cli({ name: "test" })
  class Config extends Args {
    // Should auto-assign 'v'
    @opt({ short: true })
    verbose: boolean = false;

    // Should auto-assign 'u'
    @opt({ short: true })
    user: string = "";
  }

  const result = Config.parse(["-v", "-u", "admin"]);
  assertEquals(result.verbose, true);
  assertEquals(result.user, "admin");
});

Deno.test("Short Flag - combined boolean flags (bundling)", () => {
  @cli({ name: "test" })
  class Config extends Args {
    @opt({ short: "a" })
    all: boolean = false;

    @opt({ short: "b" })
    build: boolean = false;

    @opt({ short: "c" })
    clean: boolean = false;
  }

  // Test bundling -abc
  const result = Config.parse(["-abc"]);
  assertEquals(result.all, true);
  assertEquals(result.build, true);
  assertEquals(result.clean, true);

  // Test bundling with different order
  const result2 = Config.parse(["-cba"]);
  assertEquals(result2.all, true);
  assertEquals(result2.build, true);
  assertEquals(result2.clean, true);
});

Deno.test("Short Flag - mixed bundled flags and values", () => {
  @cli({ name: "test" })
  class Config extends Args {
    @opt({ short: "x" })
    exclude: boolean = false;

    @opt({ short: "y" })
    yes: boolean = false;

    @opt({ short: "n" })
    name: string = "";
  }

  // -xy is bundled boolean, -n takes the next value
  const result = Config.parse(["-xy", "-n", "project"]);
  assertEquals(result.exclude, true);
  assertEquals(result.yes, true);
  assertEquals(result.name, "project");
});

Deno.test("Short Flag - validation error: duplicate short flags", () => {
  // This should throw because 'o' is used twice
  @cli({ name: "test", exitOnError: false })
  class Config extends Args {
    @opt({ short: "o" })
    output: string = "";

    @opt({ short: "o" })
    other: string = "";
  }

  assertThrows(
    () => {
      Config.parse([]);
    },
    Error,
    "Duplicate short flag '-o' used by both 'output' and 'other'",
  );
});

Deno.test("Short Flag - validation error: definition must be single char", () => {
  // The decorator throws immediately upon class definition logic
  assertThrows(
    () => {
      @cli({ name: "test" })
      class Config extends Args {
        @opt({ short: "xx" }) // Invalid length
        flag: boolean = false;
      }
      Config.parse([]);
    },
    Error,
    'Short flag must be a single alphanumeric character, got: "xx"',
  );
});

Deno.test("Short Flag - validation error: definition must be alphanumeric", () => {
  assertThrows(
    () => {
      @cli({ name: "test" })
      class Config extends Args {
        @opt({ short: "-" }) // Invalid char
        flag: boolean = false;
      }
      Config.parse([]);
    },
    Error,
    'Short flag must be a single alphanumeric character, got: "-"',
  );
});

Deno.test("Short Flag - parsing error: unknown short flag", () => {
  @cli({ name: "test", exitOnError: false })
  class Config extends Args {
    @opt({ short: "a" })
    a: boolean = false;
  }

  assertThrows(
    () => {
      Config.parse(["-z"]); // Unknown flag
    },
    ParseError,
    "Unknown argument: -z",
  );
});

Deno.test("Short Flag - parsing error: unknown short flag in bundle", () => {
  @cli({ name: "test", exitOnError: false })
  class Config extends Args {
    @opt({ short: "a" })
    a: boolean = false;
  }

  assertThrows(
    () => {
      Config.parse(["-az"]); // 'a' is valid, 'z' is not
    },
    ParseError,
    "Unknown argument: -z",
  );
});

Deno.test("Short Flag - parsing error: bundling non-boolean flags", () => {
  @cli({ name: "test", exitOnError: false })
  class Config extends Args {
    @opt({ short: "s", type: "string" })
    str: string = "";

    @opt({ short: "b" })
    bool: boolean = false;
  }

  // Bundling is only allowed for booleans.
  assertThrows(
    () => {
      Config.parse(["-bs"]);
    },
    ParseError,
    "Combined short flag -s must be boolean (found in -bs)",
  );
});

Deno.test("Short Flag - help output generation", () => {
  @cli({ name: "testapp", exitOnHelp: false })
  class Config extends Args {
    @opt({ description: "Output path", short: "o" })
    output: string = "dist";

    @opt({ description: "Verbose mode", short: "v" })
    verbose: boolean = false;
  }

  // With exitOnHelp: false, parse throws a ParseError containing the help text
  let helpText = "";
  try {
    Config.parse(["--help"]);
  } catch (error) {
    if (error instanceof ParseError) {
      helpText = error.message;
    } else {
      throw error;
    }
  }

  // Check if short flags are displayed in the options section
  const hasOutputFlag = helpText.includes("-o, --output");
  const hasVerboseFlag = helpText.includes("-v, --verbose");

  assertEquals(hasOutputFlag, true, "Help text should contain '-o, --output'");
  assertEquals(
    hasVerboseFlag,
    true,
    "Help text should contain '-v, --verbose'",
  );
});

Deno.test("Short Flag - implicit duplicates across properties", () => {
  // implicit 'a' for apple, explicit 'a' for alpha
  @cli({ name: "test", exitOnError: false })
  class Config extends Args {
    @opt({ short: true }) // implicitly 'a'
    apple: boolean = false;

    @opt({ short: "a" }) // explicitly 'a'
    alpha: boolean = false;
  }

  assertThrows(
    () => {
      Config.parse([]);
    },
    Error,
    "Duplicate short flag '-a' used by both 'apple' and 'alpha'",
  );
});
