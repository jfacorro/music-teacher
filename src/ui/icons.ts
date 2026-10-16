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
  autoplay: String.fromCodePoint(0x1f916), // 🤖 the app plays by itself
  L: String.fromCodePoint(0x1faf2), // 🫲 leftwards hand
  both: String.fromCodePoint(0x1f64c), // 🙌 both hands raised
  R: String.fromCodePoint(0x1faf1), // 🫱 rightwards hand
  settings: String.fromCodePoint(0x2699, 0xfe0f), // ⚙️ gear
  volume: String.fromCodePoint(0x1f50a), // 🔊 speaker
  listen: String.fromCodePoint(0x1f3a7), // 🎧 headphones
  stop: textStyle(0x23f9), // ⏹
  compare: String.fromCodePoint(0x1f50d), // 🔍 a closer look
  newDrill: String.fromCodePoint(0x1f3b2), // 🎲 fresh music, by chance
} as const;
