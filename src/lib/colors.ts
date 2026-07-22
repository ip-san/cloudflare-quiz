/** Color mapping for category display */
export const COLOR_MAP: Record<string, string> = {
  purple: '#a855f7',
  blue: '#3b82f6',
  green: '#22c55e',
  orange: '#f97316',
  pink: '#ec4899',
  cyan: '#06b6d4',
  yellow: '#eab308',
  emerald: '#10b981',
  indigo: '#6366f1',
  teal: '#14b8a6',
  gray: '#6b7280',
}

export function getColorHex(colorName: string): string {
  return COLOR_MAP[colorName] ?? COLOR_MAP.gray
}
