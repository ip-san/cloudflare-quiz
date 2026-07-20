/**
 * localStorage / sessionStorage のユーティリティ
 *
 * プライベートブラウジング対応（localStorage → sessionStorage フォールバック）
 */

/** フラグが設定済みか確認する */
export function hasSeenFlag(key: string): boolean {
  try {
    if (localStorage.getItem(key) === '1') return true
  } catch {
    /* ignore */
  }
  try {
    if (sessionStorage.getItem(key) === '1') return true
  } catch {
    /* ignore */
  }
  return false
}

/** フラグを設定する */
export function setSeenFlag(key: string): void {
  try {
    localStorage.setItem(key, '1')
  } catch {
    try {
      sessionStorage.setItem(key, '1')
    } catch {
      /* ignore */
    }
  }
}
