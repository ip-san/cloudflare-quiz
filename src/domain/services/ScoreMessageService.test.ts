import { describe, expect, it } from 'vitest'
import { getScoreMessage } from './ScoreMessageService'

describe('ScoreMessageService', () => {
  it('returns perfect message for 100%', () => {
    const msg = getScoreMessage(100)
    expect(msg.title).toBe('パーフェクト！')
    expect(msg.color).toBe('text-yellow-600')
  })

  it('returns excellent message for 80-99%', () => {
    expect(getScoreMessage(80).title).toBe('素晴らしい！')
    expect(getScoreMessage(99).title).toBe('素晴らしい！')
  })

  it('returns passing message for 70-79%', () => {
    expect(getScoreMessage(70).title).toBe('着実に成長しています')
    expect(getScoreMessage(79).title).toBe('着実に成長しています')
  })

  it('returns almost message for 50-69%', () => {
    expect(getScoreMessage(50).title).toBe('いい線いってます')
    expect(getScoreMessage(69).title).toBe('いい線いってます')
  })

  it('returns encouragement for below 50%', () => {
    expect(getScoreMessage(0).title).toBe('最初の一歩を踏み出しました')
    expect(getScoreMessage(49).title).toBe('最初の一歩を踏み出しました')
  })

  it('all messages have required fields', () => {
    for (const pct of [0, 25, 50, 70, 80, 100]) {
      const msg = getScoreMessage(pct)
      expect(msg.title).toBeTruthy()
      expect(msg.message).toBeTruthy()
      expect(msg.color).toMatch(/^text-/)
      expect(msg.bgColor).toMatch(/^bg-/)
      expect(msg.borderColor).toMatch(/^border-/)
    }
  })
})
