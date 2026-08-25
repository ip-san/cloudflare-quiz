import { execFileSync } from 'node:child_process'
import { symlinkSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isMidSentenceSplit } from '../quiz-utils.mjs'

/**
 * `quiz:check` に組み込まれている「図の text/sub が文の途中で割れていないか」判定のテスト。
 *
 * この判定はヒューリスティックなので、誤検知と見逃しのどちらにも倒れうる。
 * 誤検知が出ると quiz:check が常時赤になって誰も見なくなり（実際、素朴な実装では
 * 756問中28件すべてが誤検知だった）、見逃すと壊れた図がそのまま公開される。
 * 両方向の実例を固定して、チューニングで片側に倒れたら気づけるようにする。
 */
describe('isMidSentenceSplit', () => {
  describe('分断として検出すべきケース', () => {
    const cases = [
      ['助詞で切れている', 'この設定を有効にすると挙動が変わるので', '注意が必要です'],
      ['「ため」で切れている', 'データを暗号化してから送信するため', '受信側で復号する'],
      ['「ながら」で切れている', '新しい設定を適用しながら', '既存の接続は維持される'],
      ['短くても助詞で切れている', '設定ファイルを', '読み込んで内容を反映する'],
      ['sub が接続形で始まる', 'リクエストをプロキシー', 'してオリジンへ転送'],
      ['英単語が途中で割れている', 'permissionMod', 'e'],
    ]
    for (const [name, text, sub] of cases) {
      it(name, () => {
        expect(isMidSentenceSplit(text, sub), `${text} / ${sub}`).toBe(true)
      })
    }
  })

  describe('分断ではない（誤検知させてはいけない）ケース', () => {
    const cases = [
      // 実データ(756問)から採取した、正常だが素朴な実装では誤検知したもの
      ['体言止め + 短い注記', 'waitUntilで登録した処理を継続', 'ログ/アナリティクス送信など'],
      ['終止形 + 補足', 'max_batch_size件に到達 or max_batch_timeout経過', 'どちらか早い方'],
      ['例示の sub', 'イベント期間: キューイングメソッドを切替', '例: FIFOやReject'],
      ['助詞で終わるが sub は短い独立ラベル', '閾値内なら直接オリジンへ', '通常時'],
      ['コマンド + 日本語ラベル', 'wrangler deploy', 'Cloudflareへ公開'],
      // 「り」で終わる完結した名詞（終わり・代わり・一区切り）
      ['「り」で終わる名詞', 'これでキャッシュ設定の作業はすべて終わり', '詳細はダッシュボードで確認する'],
      // sub が複数語の英語 = 独立したラベル
      ['英字の独立ラベル', 'wrangler dev', 'development server on port 8787'],
    ]
    for (const [name, text, sub] of cases) {
      it(name, () => {
        expect(isMidSentenceSplit(text, sub), `${text} / ${sub}`).toBe(false)
      })
    }
  })

  it('text か sub が空なら判定しない', () => {
    expect(isMidSentenceSplit('', 'あいうえお')).toBe(false)
    expect(isMidSentenceSplit('あいうえお', '')).toBe(false)
    expect(isMidSentenceSplit('あいうえお', undefined)).toBe(false)
  })

  it('句点で終わっていれば分断ではない', () => {
    expect(isMidSentenceSplit('リクエストをオリジンへ転送する。', '補足の説明がここに続く')).toBe(false)
  })
})

/**
 * CLI としての起動経路の回帰テスト。
 *
 * 「テストから import しても副作用を起こさない」ための判定を入れた際、
 * シンボリックリンク経由で起動すると何も実行せず exit 0 で終わる
 * （= コマンドが無言で失敗する）バグを作り込んだことがある。
 * Node はエントリの import.meta.url を realpath 化するが process.argv[1] は
 * しないため、両者を素朴に比較すると一致しないのが原因だった。
 */
describe('CLI 起動判定', () => {
  it('シンボリックリンク経由でもコマンドが実行される', () => {
    const link = join(tmpdir(), `quiz-utils-link-${process.pid}.mjs`)
    try {
      symlinkSync(resolve('scripts/quiz-utils.mjs'), link)
      const out = execFileSync('node', [link, 'check-diagram-text'], { encoding: 'utf8' })
      // 無言で終わらず、実際に検査結果を出していること
      expect(out).toContain('Diagram Text Shape Check')
    } finally {
      try {
        unlinkSync(link)
      } catch {
        /* ignore */
      }
    }
  })

  it('通常のパス指定でもコマンドが実行される', () => {
    const out = execFileSync('node', ['scripts/quiz-utils.mjs', 'check-diagram-text'], { encoding: 'utf8' })
    expect(out).toContain('Diagram Text Shape Check')
  })
})
