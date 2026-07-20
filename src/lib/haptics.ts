/**
 * Haptic feedback for mobile PWA
 * Uses navigator.vibrate API (Android Chrome, no iOS support)
 */

const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator

export const haptics = {
  /** Light tap — button press, option select */
  light() {
    if (canVibrate) navigator.vibrate(10)
  },
  /** Medium tap — answer submit */
  medium() {
    if (canVibrate) navigator.vibrate(20)
  },
  /** Success — correct answer */
  success() {
    if (canVibrate) navigator.vibrate([15, 50, 15])
  },
  /** Error — wrong answer */
  error() {
    if (canVibrate) navigator.vibrate([30, 50, 30, 50, 30])
  },
}
