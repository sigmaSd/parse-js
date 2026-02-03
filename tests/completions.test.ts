import { assertEquals, assertStringIncludes } from "@std/assert";

Deno.test("gen-completions fish", async () => {
  const command = new Deno.Command("deno", {
    args: ["run", "examples/example.ts", "gen-completions", "fish"],
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await command.output();
  const output = new TextDecoder().decode(stdout);
  const error = new TextDecoder().decode(stderr);

  assertEquals(code, 0, `Command failed with code ${code}. Stderr: ${error}`);

  // Check for some expected fish completion lines
  assertStringIncludes(output, "complete -c myapp -f");
  assertStringIncludes(
    output,
    'complete -c myapp -n "__fish_use_subcommand" -a "serve" -d "Start the development server"',
  );
  assertStringIncludes(
    output,
    'complete -c myapp -n "__fish_seen_subcommand_from serve" -l port',
  );
  assertStringIncludes(
    output,
    'complete -c myapp -n "__fish_use_subcommand" -l verbose',
  );
});

Deno.test("gen-completions missing shell arg", async () => {
  const command = new Deno.Command("deno", {
    args: ["run", "examples/example.ts", "gen-completions"],
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stderr } = await command.output();
  const error = new TextDecoder().decode(stderr);

  // Should fail because shell is required
  assertEquals(code, 1);
  assertStringIncludes(
    error,
    "Validation error for argument 'shell': is required",
  );
});
