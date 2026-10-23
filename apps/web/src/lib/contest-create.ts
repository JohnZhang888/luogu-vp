export interface PickerProblem {
  pid: string;
  title: string;
  fullScore: number;
}

export const MAX_PROBLEMS = 26;

export function letterFor(index: number): string {
  if (index < 26) return String.fromCharCode(65 + index);
  return `#${index + 1}`;
}
