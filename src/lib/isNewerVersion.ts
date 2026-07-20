/**
 * セマンティックバージョニングで latest が current より新しいか判定する。
 * "v" プレフィックスを許容し、欠落セグメントは 0 として扱う。
 */
export function isNewerVersion(latest: string, current: string): boolean {
  const parse = (v: string): number[] => v.replace(/^v/, '').split('.').map(Number)
  const [lMaj = 0, lMin = 0, lPat = 0] = parse(latest)
  const [cMaj = 0, cMin = 0, cPat = 0] = parse(current)
  if (lMaj !== cMaj) return lMaj > cMaj
  if (lMin !== cMin) return lMin > cMin
  return lPat > cPat
}
