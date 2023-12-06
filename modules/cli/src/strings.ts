export function cleanString(input: string): string {
  if (input ===undefined) return undefined
  if (typeof input !== 'string') {
    throw new Error(`Input must be a string. It is ${typeof input} / ${input}}`);
  }
  // Limit to 63 characters
  let result = input.slice(0, 63);

  // Replace any non-alphanumeric character with '-'
  // and collapse multiple such characters into one '-'
  result = result.replace(/[^a-zA-Z0-9]+/g, '-');

  // If the result is empty (all non-alphanumeric), provide a default character
  if (result === '' || result === '-') {
    result = 'a';
  }

  // Ensure the string does not start or end with '-'
  result = result.replace(/^-|-$/g, '');

  // In case the replacements made the string empty, provide a default character
  if (result === '') {
    result = 'a';
  }

  return result;
}
export function escapeStringForYaml(str: string): string {
  // For multiline strings, use block style
  if (str.includes('\n')) {
    return `|\n${str.split('\n').map(line => `  ${line}`).join('\n')}`;
  }

  // For single-line strings, check if we need to quote
  // This regex checks for characters that might need the string to be quoted
  if (/[:{}\[\],&*#?|<>=!%@`]/.test(str) || /^(true|false|null|\d+)$/.test(str)) {
    // Escape double quotes inside the string
    return `"${str.replace(/"/g, '\\"')}"`;
  }

  if (str.length === 0) return '""';
  return str;
}

