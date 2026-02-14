import { assertEquals, assertThrows } from "@std/assert";
import {
  captureHelpText,
  ErrorHandlers,
  ErrorMessages,
  isParseError,
  ParseError,
} from "../src/error-handling.ts";

Deno.test("ErrorMessages - all functions", () => {
  assertEquals(ErrorMessages.unknownArgument("foo"), "Unknown argument: foo");
  assertEquals(
    ErrorMessages.missingValue("foo"),
    "Missing value for argument: foo",
  );
  assertEquals(
    ErrorMessages.invalidNumber("foo", "bar"),
    "Invalid number for foo: bar",
  );
  assertEquals(
    ErrorMessages.invalidArrayNumber("foo", "bar"),
    "Invalid number in array for foo: bar",
  );
  assertEquals(
    ErrorMessages.validationError("foo", "msg"),
    "Validation error for foo: msg",
  );
  assertEquals(
    ErrorMessages.missingRequiredArgument("foo"),
    "Missing required positional argument: foo",
  );
  assertEquals(
    ErrorMessages.missingTypeInformation("prop", "Class"),
    `Property 'prop' in class 'Class' has no default value and no @type decorator. Either provide a default value or use @type() to specify the type. Examples: @type("string"), @type("number"), @type("boolean"), @type("string[]), etc.`,
  );
  assertEquals(
    ErrorMessages.sequentialArguments(1),
    "Argument positions must be sequential starting from 0. Missing argument at position 1.",
  );
  assertEquals(
    ErrorMessages.restArgumentNotLast(1),
    "Only the last argument can be marked as rest. Found argument at position 1 after rest argument.",
  );
});

Deno.test("ErrorHandlers - all functions", () => {
  const options = { exitOnError: false };

  assertThrows(
    () => ErrorHandlers.unknownArgument("foo", options),
    ParseError,
    "Unknown argument: foo",
  );
  assertThrows(
    () => ErrorHandlers.missingValue("foo", options),
    ParseError,
    "Missing value for argument: foo",
  );
  assertThrows(
    () => ErrorHandlers.invalidNumber("foo", "bar", options),
    ParseError,
    "Invalid number for foo: bar",
  );
  assertThrows(
    () => ErrorHandlers.invalidArrayNumber("foo", "bar", options),
    ParseError,
    "Invalid number in array for foo: bar",
  );
  assertThrows(
    () => ErrorHandlers.validationError("foo", "msg", options),
    ParseError,
    "Validation error for foo: msg",
  );
  assertThrows(
    () => ErrorHandlers.missingRequiredArgument("foo", options),
    ParseError,
    "Missing required positional argument: foo",
  );
  assertThrows(
    () => ErrorHandlers.missingTypeInformation("prop", "Class", options),
    ParseError,
    "Property 'prop' in class 'Class'",
  );
});

Deno.test("captureHelpText", () => {
  const helpText = captureHelpText(() => {
    console.log("Line 1");
    console.log("Line 2");
  });
  assertEquals(helpText, "Line 1\nLine 2");
});

Deno.test("isParseError - non-ParseError", () => {
  assertEquals(isParseError(new Error("test")), false);
  assertEquals(isParseError({}), false);
  assertEquals(isParseError(null), false);
});
