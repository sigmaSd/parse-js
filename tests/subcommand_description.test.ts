import { assertEquals } from "@std/assert";
import { Args, cli, command, ParseError, subCommand } from "../mod.ts";

Deno.test("Subcommand - should show its own description in help", () => {
  @command
  class BuildCommand {
  }

  @cli({
    name: "myapp",
    description: "Main app description",
    exitOnHelp: false,
  })
  class MyApp extends Args {
    @subCommand(BuildCommand, { description: "Build the project" })
    build?: BuildCommand;
  }

  let helpText = "";
  try {
    MyApp.parse(["build", "--help"]);
  } catch (error) {
    if (error instanceof ParseError) {
      helpText = error.message;
    }
  }

  assertEquals(helpText.includes("Build the project"), true);
  assertEquals(helpText.includes("Main app description"), false);
});

Deno.test("Nested subcommand - should show its own description in help", () => {
  @command
  class StartCommand {
  }

  @command
  class DatabaseCommand {
    @subCommand(StartCommand, { description: "Start the database" })
    start?: StartCommand;
  }

  @cli({
    name: "myapp",
    description: "Main app description",
    exitOnHelp: false,
  })
  class MyApp extends Args {
    @subCommand(DatabaseCommand, { description: "Database operations" })
    db?: DatabaseCommand;
  }

  let helpText = "";
  try {
    MyApp.parse(["db", "start", "--help"]);
  } catch (error) {
    if (error instanceof ParseError) {
      helpText = error.message;
    }
  }

  assertEquals(helpText.includes("Start the database"), true);
  assertEquals(helpText.includes("Database operations"), false);
  assertEquals(helpText.includes("Main app description"), false);
});

Deno.test("Subcommand - should show description from @cli if provided", () => {
  @cli({
    description: "Build description from @cli",
    exitOnHelp: false,
  })
  @command
  class BuildCommand {
  }

  @cli({
    name: "myapp",
    description: "Main app description",
    exitOnHelp: false,
  })
  class MyApp extends Args {
    @subCommand(BuildCommand)
    build?: BuildCommand;
  }

  let helpText = "";
  try {
    MyApp.parse(["build", "--help"]);
  } catch (error) {
    if (error instanceof ParseError) {
      helpText = error.message;
    }
  }

  assertEquals(helpText.includes("Build description from @cli"), true);
  assertEquals(helpText.includes("Main app description"), false);
});

Deno.test("Subcommand - should NOT inherit parent description if none provided", () => {
  @command
  class BuildCommand {
  }

  @cli({
    name: "myapp",
    description: "Main app description",
    exitOnHelp: false,
  })
  class MyApp extends Args {
    @subCommand(BuildCommand)
    build?: BuildCommand;
  }

  let helpText = "";
  try {
    MyApp.parse(["build", "--help"]);
  } catch (error) {
    if (error instanceof ParseError) {
      helpText = error.message;
    }
  }

  assertEquals(helpText.includes("Main app description"), false);
});
