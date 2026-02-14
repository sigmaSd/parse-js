import { assertEquals } from "@std/assert";
import { printHelp } from "../src/help.ts";
import type { OptDef, PositionalDef, SubCommand } from "../src/types.ts";

Deno.test("printHelp - commandName without commandPath", () => {
  const help = printHelp([], [], { name: "app" }, undefined, "serve");
  assertEquals(help.includes("serve"), true);
});

Deno.test("printHelp - optional positional", () => {
  const positionalDefs: PositionalDef[] = [
    { name: "opt", type: "string", default: "def", validators: [] },
  ];
  const help = printHelp([], positionalDefs);
  assertEquals(help.includes("[opt]"), true);
});

Deno.test("printHelp - required validator (short)", () => {
  const requiredValidator = (value: unknown) => value ? null : "required";
  const positionalDefs: PositionalDef[] = [
    { name: "req", type: "string", validators: [requiredValidator] },
  ];
  const help = printHelp([], positionalDefs);
  assertEquals(help.includes("<req>"), true);
});

Deno.test("printHelp - command with subcommands", () => {
  const subCommands = new Map<string, SubCommand>();
  subCommands.set("sub", { name: "sub", commandClass: class {} });
  const help = printHelp([], [], {}, subCommands, "parent", "parent");
  assertEquals(help.includes("<command>"), true);
});

Deno.test("printHelp - optional rest argument", () => {
  const positionalDefs: PositionalDef[] = [
    {
      name: "files",
      type: "string[]",
      rest: true,
      default: [],
      validators: [],
    },
  ];
  const help = printHelp([], positionalDefs);
  assertEquals(help.includes("[files...]"), true);
});

Deno.test("printHelp - optional raw rest", () => {
  const positionalDefs: PositionalDef[] = [
    { name: "raw", type: "string[]", raw: true, default: [], validators: [] },
  ];
  const help = printHelp([], positionalDefs);
  assertEquals(help.includes("[raw...]"), true);
});

Deno.test("printHelp - comprehensive", () => {
  const optDefs: OptDef[] = [
    {
      name: "port",
      type: "number",
      default: 8080,
      description: "Port to listen on",
      validators: [],
    },
    {
      name: "verbose",
      type: "boolean",
      default: false,
      description: "Verbose mode",
      validators: [],
      short: "v",
    },
    { name: "tags", type: "string[]", description: "Tags", validators: [] },
  ];

  const positionalDefs: PositionalDef[] = [
    {
      name: "input",
      type: "string",
      description: "Input file",
      validators: [],
    },
    {
      name: "files",
      type: "string[]",
      rest: true,
      description: "Rest files",
      validators: [],
    },
  ];

  const subCommands = new Map<string, SubCommand>();
  subCommands.set("serve", {
    name: "serve",
    commandClass: class {},
    description: "Serve files",
  });

  const options = {
    name: "myapp",
    description: "My cool app",
    showDefaults: true,
  };

  const help = printHelp(optDefs, positionalDefs, options, subCommands);

  assertEquals(help.includes("myapp"), true);
  assertEquals(help.includes("My cool app"), true);
  assertEquals(help.includes("Usage:"), true);
  assertEquals(help.includes("Commands:"), true);
  assertEquals(help.includes("serve"), true);
  assertEquals(help.includes("Arguments:"), true);
  assertEquals(help.includes("input"), true);
  assertEquals(help.includes("files"), true);
  assertEquals(help.includes("Global Options:"), true);
  assertEquals(help.includes("--port"), true);
  assertEquals(help.includes("8080"), true);
});

Deno.test("printHelp - command specific", () => {
  const help = printHelp(
    [],
    [],
    { name: "app" },
    undefined,
    "serve",
    "app serve",
  );
  assertEquals(help.includes("Usage:"), true);
  assertEquals(help.includes("app serve"), true);
  assertEquals(help.includes("Options:"), true);
});

Deno.test("printHelp - raw positional", () => {
  const positionalDefs: PositionalDef[] = [
    {
      name: "raw",
      type: "string[]",
      raw: true,
      description: "Raw args",
      validators: [],
    },
  ];
  const help = printHelp([], positionalDefs);
  assertEquals(help.includes("(raw rest)"), true);
});

Deno.test("printHelp - required validator", () => {
  const requiredValidator = (value: unknown) => value ? null : "is required";
  const positionalDefs: PositionalDef[] = [
    { name: "req", type: "string", validators: [requiredValidator] },
  ];
  const help = printHelp([], positionalDefs);
  assertEquals(help.includes("<req>"), true);
  assertEquals(help.includes("(required)"), true);
});

Deno.test("printHelp - number array", () => {
  const optDefs: OptDef[] = [
    { name: "nums", type: "number[]", description: "Numbers", validators: [] },
  ];
  const help = printHelp(optDefs, []);
  assertEquals(help.includes("<number,number,...>"), true);
});

Deno.test("printHelp - no defaults", () => {
  const optDefs: OptDef[] = [
    {
      name: "port",
      type: "number",
      default: 8080,
      description: "Port",
      validators: [],
    },
  ];
  const help = printHelp(optDefs, [], { showDefaults: false });
  assertEquals(help.includes("8080"), false);
});

Deno.test("printHelp - with color", () => {
  // Just to cover the color creation branch
  printHelp([], [], { color: true });
  printHelp([], [], { color: false });
});
