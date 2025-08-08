/**
 * Color utilities for CLI help output with NO_COLOR environment variable support.
 *
 * This module provides ANSI color codes for terminal output.
 *
 * Features:
 * - Simple boolean-based color control
 * - No automatic detection or environment checks
 * - Users can implement their own color detection logic
 * - Common color functions for CLI output
 */

import process from "node:process";

/**
 * ANSI color codes for terminal output.
 */
const COLORS = {
  // Text colors
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",

  // Bright colors
  brightBlack: "\x1b[90m",
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",
  brightWhite: "\x1b[97m",

  // Text styles
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",

  // Reset
  reset: "\x1b[0m",
} as const;

/**
 * Determines if color output should be enabled.
 *
 * Simply returns the enableColor value - no heuristics or environment checks.
 * Users can wrap their CLI with their own color detection logic if needed.
 *
 * @param enableColor - Explicit color preference
 * @returns true if colors should be used
 */
function shouldUseColors(enableColor?: boolean): boolean {
  return enableColor === true;
}

/**
 * Color function type that may or may not apply colors.
 */
type ColorFunction = (text: string) => string;

/**
 * Creates color functions that respect the color settings.
 *
 * @param enableColor - Whether to enable color output
 * @returns Object with color functions
 */
export function createColors(enableColor?: boolean): {
  // Basic colors
  red: ColorFunction;
  green: ColorFunction;
  yellow: ColorFunction;
  blue: ColorFunction;
  magenta: ColorFunction;
  cyan: ColorFunction;
  white: ColorFunction;

  // Bright colors
  brightBlue: ColorFunction;
  brightGreen: ColorFunction;
  brightYellow: ColorFunction;
  brightCyan: ColorFunction;

  // Styles
  bold: ColorFunction;
  dim: ColorFunction;
  italic: ColorFunction;
  underline: ColorFunction;

  // Utility
  isEnabled: boolean;
} {
  const useColors = shouldUseColors(enableColor);

  const createColorFn = (colorCode: string): ColorFunction => {
    return useColors
      ? (text: string) => `${colorCode}${text}${COLORS.reset}`
      : (text: string) => text;
  };

  return {
    // Basic colors
    red: createColorFn(COLORS.red),
    green: createColorFn(COLORS.green),
    yellow: createColorFn(COLORS.yellow),
    blue: createColorFn(COLORS.blue),
    magenta: createColorFn(COLORS.magenta),
    cyan: createColorFn(COLORS.cyan),
    white: createColorFn(COLORS.white),

    // Bright colors
    brightBlue: createColorFn(COLORS.brightBlue),
    brightGreen: createColorFn(COLORS.brightGreen),
    brightYellow: createColorFn(COLORS.brightYellow),
    brightCyan: createColorFn(COLORS.brightCyan),

    // Styles
    bold: createColorFn(COLORS.bold),
    dim: createColorFn(COLORS.dim),
    italic: createColorFn(COLORS.italic),
    underline: createColorFn(COLORS.underline),

    // Utility
    isEnabled: useColors,
  };
}

/**
 * Default color instance for convenience (colors disabled by default).
 */
export const colors = createColors();
