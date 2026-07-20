/**
 * ID Migration: legacy ID → current ID
 *
 * Cloudflare Codex Quiz は新規アプリのため移行対象の旧IDは存在しない。
 * マップは空だが、SessionRepository が呼び出す関数シグネチャは維持する。
 */

const ID_MIGRATIONS: Record<string, string> = {}

export function migrateQuestionIds(json: string): string {
  let migrated = json
  for (const [oldId, newId] of Object.entries(ID_MIGRATIONS)) {
    migrated = migrated.replace(new RegExp(`"${oldId}"`, 'g'), `"${newId}"`)
  }
  return migrated
}
