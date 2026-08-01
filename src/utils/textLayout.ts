export function splitLines(text: string, maxCharsPerLine: number): string[] {
  const chars = Array.from(text);
  const lines: string[] = [];
  let current = "";
  for (const ch of chars) {
    if (current.length >= maxCharsPerLine) {
      lines.push(current);
      current = "";
    }
    current += ch;
  }
  if (current.length > 0) lines.push(current);
  return lines;
}
