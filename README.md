# Piano Teacher

A local piano-learning app: guided lessons that listen to what you play through MIDI or the
microphone. Runs entirely in your browser on `localhost`, with no accounts and no cloud.

See [PLAN.md](PLAN.md) for the full plan and phases.

## Requirements

- Node.js 22+
- Chrome or Edge (needed for Web MIDI)
- A MIDI keyboard over USB (developed with a Casio CDP-S110). Optional: you can also use the
  computer keyboard as a piano.

## Run

```bash
npm install
npm run dev
```

Open the printed `localhost` URL, go to **Settings**, click **Enable MIDI** and allow access.
Press keys on the piano: they appear under **Live test** with their names.

If the keyboard isn't listed, check the USB cable and that the piano is on. On Windows,
only one app can use a MIDI device at a time, so close any other music software.

## Scripts

| Command              | What it does                                       |
| -------------------- | -------------------------------------------------- |
| `npm run dev`        | Dev server with hot reload                         |
| `npm run build`      | Type-check and build to `dist/`                    |
| `npm test`           | Run all unit tests                                 |
| `npm run lint`       | ESLint, including the no-hard-coded-strings rule   |
| `npm run i18n:check` | Translation checks: keys, ICU syntax, placeholders |
| `npm run check`      | Type-check, lint and test (run before committing)  |
| `npm run format`     | Format everything with Prettier                    |

## Project structure

```
src/
  input/      MIDI and computer-keyboard input; every source emits the same NoteEvent
  theory/     Pitch type and note-string parsing ("C4", "F#3", "Db4")
  i18n/       i18next setup, note-naming systems, Intl formatting, pseudo-locale
  storage/    IndexedDB (Dexie) and settings
  ui/         Layout, components and screens
locales/      Translations, one folder per language
```

## Conventions

**No hard-coded text.** Everything the user reads comes from `locales/<language>/*.json`.
ESLint fails on literal strings in JSX. Messages use
[ICU syntax](https://formatjs.github.io/docs/core-concepts/icu-syntax) (`{device}`,
`{count, plural, one {# star} other {# stars}}`); never build sentences by concatenating.

**Note names are never written into translations.** Pass a pitch and format it with
`useNoteNames()`, so it follows the user's naming system (C D E / Do Re Mi / German letters).
The approved music terms for each language are in [locales/glossary.md](locales/glossary.md).

**Pitches** in content files use canonical note strings: step `A`–`G`, optional `#`, `##`,
`b`, `bb`, then the octave, with **C4 = middle C = MIDI 60**. They're parsed into `Pitch`
(MIDI number + spelling) when loaded. Played notes are plain MIDI numbers. Grading always
compares MIDI numbers.

**Pseudo-locale.** In development, pick "English (Pseudo-Accents)" in Settings. Every
translated string shows accented and ~40% longer, so anything still plain English is
hard-coded and any clipped text is a layout bug.

### Adding a language

1. Copy `locales/en/` to `locales/<code>/` and translate the values.
2. Add the code to `TRANSLATED_LANGUAGES` in `src/i18n/languages.ts`.
3. If it uses solfège or German note names by default, add it to the list in
   `src/i18n/naming.ts`.
4. Run `npm run i18n:check`.
