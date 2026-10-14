/**
 * Button icons: Unicode symbols and emoji, so they need no image files. Play, pause and start
 * over ask for the plain text style (U+FE0E), so they take the button's color; the views use
 * their emoji.
 */
const textStyle = (codePoint: number) => String.fromCodePoint(codePoint, 0xfe0e);

export const ICONS = {
  play: textStyle(0x25b6), // ▶
  pause: textStyle(0x23f8), // ⏸
  restart: textStyle(0x21bb), // ↻
  falling: String.fromCodePoint(0x1f3b9), // 🎹 notes falling onto the keyboard
  sheet: String.fromCodePoint(0x1f3bc), // 🎼 musical score
  wait: String.fromCodePoint(0x23f3), // ⏳ the music takes its time
  tempo: String.fromCodePoint(0x23f1, 0xfe0f), // ⏱️ timed
  L: String.fromCodePoint(0x1faf2), // 🫲 leftwards hand
  both: String.fromCodePoint(0x1f64c), // 🙌 both hands raised
  R: String.fromCodePoint(0x1faf1), // 🫱 rightwards hand
} as const;
