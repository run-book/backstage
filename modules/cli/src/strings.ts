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
