/** @type {import('prettier').Config & import('prettier-plugin-tailwindcss').PluginOptions} */
const config = {
  // Tailwind CSS plugin for class sorting
  plugins: ["prettier-plugin-tailwindcss"],

  // Code formatting settings
  semi: false, // Use semicolons
  trailingComma: "es5", // Trailing commas where valid in ES5 (objects, arrays, etc.)
  singleQuote: false, // Use double quotes
  printWidth: 80, // Line width
  tabWidth: 2, // Indent with 2 spaces
  useTabs: false, // Use spaces instead of tabs
  arrowParens: "always", // Always include parens around arrow function parameters
  endOfLine: "lf", // Use LF line endings (consistent across platforms)
  bracketSpacing: true, // Print spaces between brackets in object literals
  bracketSameLine: false, // Put > of multi-line elements on new line
}

export default config
