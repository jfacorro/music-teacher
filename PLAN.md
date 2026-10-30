# Music Teacher — Project Plan

A local piano-learning app in the spirit of Simply Piano: guided lessons and exercises that **listen to what you play** (via MIDI or microphone) and give real-time feedback. Runs entirely on your machine, no accounts, no cloud.

---

## 1. Goals

- Teach piano from zero, with a faster ramp for someone who already knows some music theory.
- Listen to the player and grade in real time: right/wrong notes, timing, (later) dynamics.
- Start with simplified "falling notes" notation and progressively transition to real sheet music.
- Run locally in the browser; optionally package as a desktop app later.
- Lesson content is **data**, not code, so new lessons and songs are easy to add.
- **All user-facing text is localized** — UI, lesson content, feedback, song titles, music terminology (including note-naming systems like C D E vs Do Re Mi).
- From Phase 6, teach singing too: a course of its own, listening through the microphone, in the same app.
- From Phase 7, teach music theory too: a course of its own, answered by playing or singing, linked to the piano and voice lessons.

### Non-goals (for now)

- Accounts, cloud sync, multiplayer, monetization.
- Copyrighted song catalog — only public-domain / self-authored content.
- Mobile support.

---

## 2. Decisions made

| Topic | Decision |
|---|---|
| Primary hardware | Casio CDP-S110 BK — 88 keys, USB-MIDI (class compliant, no driver), velocity sensitive, built-in speakers |
| Input methods | **MIDI** (primary) **and microphone** (single notes; chords need MIDI, see §5.3) |
| Notation | Both: falling notes first, then sheet music with gradual transition |
| Learner level | Piano beginner with some prior music experience |
| Platform | Local web app on `localhost`, Chrome/Edge (Web MIDI support) |
| Desktop packaging | Electron (Phase 3): the same Chromium, so Web MIDI and the microphone work as in the browser; the web version stays as it is |
| Localization | Built in from day one: every written string comes from translation files; English is the source language; additional languages TBD |

---

## 3. Tech stack

| Concern | Choice |
|---|---|
| Language / build | TypeScript, Vite |
| UI | React |
| App state | Zustand |
| Persistence | IndexedDB via Dexie |
| MIDI input | Web MIDI API (`navigator.requestMIDIAccess`) |
| Mic input | Web Audio API (`getUserMedia` + `AudioWorklet`/`AnalyserNode`) |
| Pitch detection (single note) | `pitchy` (McLeod Pitch Method) + custom onset detection |
| Polyphonic detection | Not done: chords are checked with MIDI only (see §5.3) |
| Enumerations | Constant objects with a type of the same name: `export const InputSource = { Midi: 'midi', … } as const`, used as `InputSource.Mic` (no string literals in code; `isValueOf` / `describeValues` in `src/lib/values.ts` check JSON data). Not TypeScript `enum`: `erasableSyntaxOnly` keeps the code plain JavaScript once types are erased, and the values stay plain strings in JSON and IndexedDB |
| Audio output (demos, metronome) | Tone.js + Salamander piano samples |
| MIDI file parsing | `@tonejs/midi` |
| MusicXML import | The browser's `DOMParser`; `.mxl` (ZIP) read with `DecompressionStream`, no ZIP library |
| Sheet music rendering (Phase 2) | OpenSheetMusicDisplay (MusicXML) |
| Falling notes / keyboard | HTML Canvas (custom renderer) |
| Localization | i18next + react-i18next with ICU message format (`i18next-icu`) for plurals/gender; `Intl.*` APIs for numbers, dates, durations, percentages |
| i18n tooling | `eslint-plugin-i18next` (no hard-coded strings), key-parity check script, pseudo-locale for testing |
| Tests | Vitest (unit; jsdom for the MusicXML parser tests), Playwright (smoke/E2E) |
| Desktop wrapper (Phase 3, optional) | Electron + electron-builder (Windows installer) |

---

## 4. Architecture

```
┌──────────────────────── Input layer ────────────────────────┐
│  MidiInput (Web MIDI)                                        │
│  MicInput  (Web Audio → onset + pitch detection)             │
│  DevInput  (computer keyboard / clicking on-screen keys)     │
└──────────────┬───────────────────────────────────────────────┘
               │  NoteEvent { type: on|off, pitch, velocity, time, source }
               ▼
┌──────────────────────── Engine ─────────────────────────────┐
│  Clock / Transport (tempo, count-in, metronome, loop)        │
│  Matcher  (played events ↔ expected notes)                   │
│  Modes    (Wait mode, Tempo mode)                            │
│  Scorer   (accuracy, timing, stars, per-measure stats)       │
└──────────────┬───────────────────────────────────────────────┘
               ▼
┌──────────────────────── UI ─────────────────────────────────┐
│  Keyboard · Falling notes · Sheet music · Feedback · Screens │
└──────────────────────────────────────────────────────────────┘
        ▲                                   ▲
        │ Score model                       │ progress / settings
┌───────┴──────── Content ───────┐   ┌──────┴──── Storage ─────┐
│ Lesson JSON, MusicXML, MIDI    │   │ IndexedDB (Dexie)       │
└────────────────────────────────┘   └─────────────────────────┘
```

**Key principle:** every input source emits the same `NoteEvent`. The engine and UI never know (or care) whether a note came from MIDI or the microphone — except for source-specific tolerances (timing windows, velocity reliability).

### Folder structure

```
src/
  input/
    types.ts            NoteEvent, InputSource interface
    midi/               Web MIDI adapter, device selection, hot-plug
    mic/                audio capture, onset detection, pitch detection, calibration
    dev/                computer-keyboard + on-screen-click input (for development)
  engine/
    score.ts            internal Score model (notes, measures, hands, fingers)
    clock.ts            transport, tempo, metronome, count-in, loop
    matcher.ts          aligns played events to expected notes
    modes/              wait mode, tempo mode
    scoring.ts          accuracy, timing grades, stars
  content/
    lessons/            lesson JSON files (contain translation keys, not text)
    songs/              MusicXML / MIDI files
    courses.json        course/unit tree, unlock rules
    loaders/            inline JSON scores; MusicXML + MIDI files → imported music → Score
  audio/                Tone.js sampler, metronome, demo playback
  i18n/
    index.ts            i18next setup, language detection, fallback
    naming.ts           note-naming systems (English letters, German, fixed-do solfège)
    format.ts           Intl helpers (percent, duration, dates)
  ui/
    components/         Keyboard, FallingNotes, SheetMusic, FeedbackBadge, ...
    screens/            Home, LessonPlayer, Results, FreePlay, Progress, Settings
  storage/              Dexie DB, progress + settings repositories, imported songs
  theory/
    pitch.ts            Pitch type, parse/format of note strings ("Db4"), MIDI ↔ Pitch, default spelling
    intervals.ts        intervals, transposition
    chords.ts           chord identification (locale-independent; names via i18n)

locales/
  en/
    common.json         buttons, navigation, generic messages
    screens.json        per-screen strings
    feedback.json       grades, encouragement, errors
    theory.json         music terms (chord qualities, note values, clefs, ...)
    courses.json        unit/course titles and descriptions
    songs.json          song titles and descriptions
    lessons/
      u1-l03-rh-five-finger.json   one file per lesson
  <other languages>/    same structure
  glossary.md           approved terminology per language
```

### Pitch representation

Pitches are **strings in authored content** and **numbers + spelling in code**:

| Where | Representation | Why |
|---|---|---|
| Lesson JSON (hand-written) | Note string, e.g. `"C4"`, `"F#3"`, `"Db4"` | Readable; keeps the spelling (D♭ vs C♯) |
| Score model (`ScoreNote`) | `Pitch` = MIDI number + spelling (step, alter, octave) | Number for matching/arithmetic/layout; spelling for sheet music and note names; mirrors MusicXML |
| Played notes (`NoteEvent`) | MIDI number only | MIDI and the mic only know which key was played, not how it's spelled |

**Note string format** (canonical, never shown to the user):

- `<step><accidental?><octave>` — step `A`–`G` (uppercase), accidental `#`, `##`, `b`, `bb`, octave as an integer.
- **Scientific pitch notation: `C4` = middle C = MIDI 60.** (Some manufacturers label middle C as C3; this project always uses C4.)
- Regex: `^([A-G])(##|#|bb|b)?(-?\d)$`.
- Octave belongs to the letter, not the sounding key: `B#3` = MIDI 60, `Cb4` = MIDI 59.
- Parsed and validated **once at load time**; invalid strings (e.g. `"H4"`, `"c4"`, `"C♯4"`) fail with an error naming the lesson and step.
- Note strings written in code and tests have the type `NoteString` (step + accidental + octave as a template-literal type), so a typo such as `"H4"` or `"C#"` is a compile error. `pitchOf` / `pitchesOf` turn them into `Pitch`es. Middle C as a number is `MIDDLE_C`.

**Rules:**

- Matching only ever compares MIDI numbers (`note.pitch.midi === event.pitch`), so spelling never affects grading.
- Arithmetic (transpose, intervals, keyboard position, falling-note lanes) uses MIDI numbers.
- Display names come from `Pitch` + the user's note-naming system (§8.3). When there's no authored spelling (played notes in free play), `theory/pitch.ts` picks one from context: the current key signature if known, otherwise sharps.
- MusicXML `<pitch><step/><alter/><octave/></pitch>` maps 1:1 onto `Pitch`; MIDI-file imports get a default spelling.

### Core types (sketch)

```ts
type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

type Pitch = {
  midi: number;                 // 61 — matching, arithmetic, layout
  step: Step;                   // 'D'
  alter: -2 | -1 | 0 | 1 | 2;   // -1 = flat, 1 = sharp
  octave: number;               // 4 (scientific pitch notation, C4 = 60)
};

// theory/pitch.ts
declare function parseNote(s: string): Pitch;               // "Db4" → { midi: 61, step: 'D', alter: -1, octave: 4 }
declare function pitchOf(s: NoteString): Pitch;             // the same, for notes written in code (checked by the compiler)
declare function formatNote(p: Pitch): string;               // → "Db4" (canonical, for files/debugging)
declare function pitchFromMidi(midi: number, ctx?: SpellingContext): Pitch;  // default spelling

type NoteEvent = {
  type: 'on' | 'off';
  pitch: number;        // MIDI note number, 60 = middle C
  velocity: number;     // 0–127 (estimated for mic)
  time: number;         // ms, performance.now() timeline, latency-compensated
  source: 'midi' | 'mic' | 'dev';
};

type ScoreNote = {
  pitch: Pitch;
  start: number;        // in beats
  duration: number;     // in beats
  hand: 'L' | 'R';
  finger?: 1 | 2 | 3 | 4 | 5;
};

type Score = {
  tempo: number;                    // default BPM
  timeSignature: [number, number];
  notes: ScoreNote[];
  measures: { start: number; length: number }[];
};
```

---

## 5. Input

### 5.1 MIDI

- Request access with `navigator.requestMIDIAccess()`; list inputs; remember the last selected device.
- Handle hot-plug (`onstatechange`) — reconnect automatically when the Casio is plugged back in.
- Parse Note On / Note Off (Note On with velocity 0 = Note Off), sustain pedal (CC64) for later use.
- Timestamps from `event.timeStamp` (same clock as `performance.now()`).
- The piano produces its own sound, so the app does **not** echo played notes through speakers.
- **Windows caveat:** legacy Windows MIDI drivers usually allow one app per device. If the device isn't visible, close DAWs or other MIDI apps.

### 5.2 Microphone — single notes (Phase 1)

Pipeline:

1. `getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })` — processing that's designed for voice calls distorts musical tones.
2. Frames of ~2048 samples (≈43 ms at 48 kHz) with a hop of ~512 samples (≈11 ms).
3. **Onset detection** — sudden rise in RMS / spectral flux above the noise floor → candidate note start. Allows repeated presses of the same key to be detected.
4. **Pitch detection** — McLeod method (`pitchy`), with clarity threshold.
5. **Stabilizer** — a pitch must persist for 2–3 frames before emitting Note On; handles octave errors common with piano harmonics.
6. **Note Off** — energy decays below threshold or pitch is lost for N frames.
7. **Velocity** — estimated from onset loudness (approximate; dynamics exercises are MIDI-only).
8. **Latency compensation** — subtract calibrated latency from event times.

Supported range for mic detection: roughly **C2–C7** (very low notes need longer analysis windows; the curriculum stays within this range).

### 5.3 Microphone — chords

**Decided (2026-10-16): no chord detection through the microphone.** The learner practices on a MIDI keyboard, which reports every key of a chord exactly. Detecting chords from audio was prototyped (guided by the expected notes: FFT, harmonic attribution) and would be unreliable where it matters: semitones in the bass can't be told apart without ~0.5 s windows, a lower note's harmonics land exactly on octaves and fifths, and ringing or pedaled notes blur it. Open transcription (Spotify Basic Pitch, TF.js) would add several MB and ~0.5–1 s of delay for a rough result.

Instead, the microphone stays a single-note input, and with it **any note of a chord counts for the whole chord** (wait mode moves on, tempo mode grades the chord by that note). Exercises with chords show a tip while listening through the microphone: connect a MIDI keyboard to check every note.

### 5.4 Mic calibration

- **Noise floor:** record ~3 s of silence, set the onset threshold above it.
- **Latency:** user plays along with metronome clicks (8–16 taps); the median offset becomes the compensation value.
- **Sensitivity slider** for manual adjustment; live level meter + live detected note display.
- **Bleed:** the app's own metronome/demo audio can be picked up by the mic → recommend headphones; optionally suppress detection while demo playback is active.

### 5.5 Dev input

- Computer keyboard mapped like a DAW (`A W S E D F T G Y H U J K` → one octave, `Z`/`X` to shift octaves).
- Click/tap on the on-screen keyboard.
- Lets the app be developed and tested without the piano attached.

---

## 6. Lesson engine

### 6.1 Modes

| Mode | Behavior |
|---|---|
| **Wait mode** | The cursor stops at each note/chord until the correct key(s) are pressed. No timing pressure. Wrong notes are flagged but don't advance. |
| **Tempo mode** | Music plays at a fixed tempo with count-in and metronome. Notes are graded for correctness and timing. |
| **Play it for me** (autoplay, 🤖) | The app plays the selected hands by itself (and the other hand if chosen), at the chosen speed, lighting the keys as they sound, in either view; loops repeat. Nothing is graded and no result is saved. Songs only: lessons use the graded modes (`GradedMode`). |
| **Loop** (Phase 2) | Repeat a selected range of measures. |
| **Slow-down** (Phase 2) | Tempo slider 40–100%. |
| **Hand selection** | Right only / left only / both. The non-selected hand can be auto-played as accompaniment (Phase 2+). |

### 6.2 Matching

- Expected notes are grouped by start time (a "chord group" = notes starting together).
- Matching compares MIDI numbers only (`ScoreNote.pitch.midi` vs `NoteEvent.pitch`); spelling is display-only.
- **Wait mode:** a group is satisfied when all its pitches are pressed within a chord tolerance (~150 ms MIDI, ~250 ms mic) or are held simultaneously.
- **Tempo mode:** each played Note On is matched to the nearest unmatched expected note of the same pitch within the timing window. Unmatched played notes = **extra**; unmatched expected notes = **missed**.

### 6.3 Scoring

| Grade | MIDI window | Mic window |
|---|---|---|
| Perfect | ±50 ms | ±80 ms |
| Good | ±100 ms | ±140 ms |
| OK | ±150 ms | ±200 ms |
| Miss | outside | outside |

- Accuracy = weighted hits / expected notes, penalized by extra notes.
- Stars: ★ ≥ 60%, ★★ ≥ 80%, ★★★ ≥ 95%.
- Per-measure stats are stored to show where the player struggled.

---

## 7. Content format

Lessons are JSON files. Short exercises define notes inline; songs reference MusicXML/MIDI files. Everything is converted into the internal `Score` model.

Lesson files contain **no written text** — only translation keys, resolved against `locales/<lang>/lessons/<lesson-id>.json`.

```json
{
  "id": "u1-l03-rh-five-finger",
  "unit": "u1",
  "title": "title",
  "inputs": ["midi", "mic"],
  "defaultView": "falling",
  "steps": [
    {
      "type": "explain",
      "text": "steps.placeThumb",
      "textVars": { "thumbNote": { "note": "C4" } },
      "highlightKeys": ["C4", "D4", "E4", "F4", "G4"],
      "showFingers": true
    },
    {
      "type": "exercise",
      "mode": "wait",
      "score": {
        "tempo": 60,
        "timeSignature": [4, 4],
        "notes": [
          { "note": "C4", "start": 0, "duration": 1, "hand": "R", "finger": 1 },
          { "note": "D4", "start": 1, "duration": 1, "hand": "R", "finger": 2 },
          { "note": "E4", "start": 2, "duration": 1, "hand": "R", "finger": 3 },
          { "note": "F4", "start": 3, "duration": 1, "hand": "R", "finger": 4 },
          { "note": "G4", "start": 4, "duration": 4, "hand": "R", "finger": 5 }
        ]
      },
      "pass": { "minAccuracy": 0.8 }
    },
    {
      "type": "exercise",
      "mode": "tempo",
      "scoreRef": "songs/ode-to-joy-rh-simple.musicxml",
      "pass": { "minStars": 1 }
    }
  ]
}
```

`locales/en/lessons/u1-l03-rh-five-finger.json`:

```json
{
  "title": "Right hand: five-finger position",
  "steps": {
    "placeThumb": "Place your right thumb on {thumbNote}. Each finger rests on the next white key."
  }
}
```

Note names are never written into translated text. Lesson steps pass notes as variables (`textVars`), and they're rendered with the user's note-naming system (see §8.3), so the same sentence shows "C" or "Do" without separate translations.

All pitches in lesson files (`note`, `highlightKeys`, `textVars`) use the canonical note-string format from §4 and are parsed into `Pitch` when the lesson loads.

Step types (growing over phases): `explain`, `exercise`, `quiz` (note naming), `rhythm` (tap along), `demo` (app plays, user listens); for the voice, `warmUp`, `match` (sing back a note) and `sing` (sing a melody, 6.3).

`courses.json` defines units, their order, and unlock rules (e.g. unit unlocks when all previous lessons have ≥ 1 star).

**Content licensing:** only public-domain melodies (folk songs, classical pieces) and self-written exercises.

---

## 8. Localization

Every piece of written text the user sees is translatable. Building this in from the first commit is cheap; retrofitting it later means touching every screen and lesson.

### 8.1 What gets localized

| Area | Examples | Where it lives |
|---|---|---|
| UI chrome | buttons, menus, settings labels, tooltips, error messages | `common.json`, `screens.json` |
| Feedback | "Perfect!", "A bit late", streak messages, star summaries | `feedback.json` |
| Lesson content | lesson titles, explanations, hints, quiz prompts | `lessons/<lesson-id>.json` |
| Courses | unit titles, descriptions, unlock messages | `courses.json` |
| Songs | titles, composer attributions, short descriptions | `songs.json` |
| Music terminology | note values (quarter note / negra), clefs, chord qualities, intervals | `theory.json` |
| Note names | C D E… / Do Re Mi… / H vs B | note-naming system (§8.3) |
| Numbers & dates | accuracy %, practice time, streak dates | `Intl.NumberFormat`, `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat` |
| Accessibility text | `aria-label`s, screen-reader announcements | same namespaces as the UI they belong to |
| Page metadata | document title | `common.json` |

**Not localized:** Italian performance markings in scores (*Allegro*, *p*, *f*, *cresc.*) — these are international — but their tooltips/explanations are. Finger numbers (1–5) are universal.

### 8.2 Language selection

- Default from `navigator.languages`; falls back to English.
- Language switcher in Settings (and on first launch); choice saved in IndexedDB.
- Switching applies instantly, no reload.
- Missing keys fall back to English and are logged in development.
- Translation files are lazy-loaded per language and namespace (lesson files only load when the lesson opens).

### 8.3 Note-naming systems

Note names differ by language, so the naming system is its **own setting**, defaulted from the language but independently changeable (e.g. English UI with solfège note names).

| System | Names | Typical languages |
|---|---|---|
| English letters | C D E F G A B | English, Dutch, … |
| German letters | C D E F G A H (B = B♭) | German, Scandinavian, Central European |
| Fixed-do solfège | Do Re Mi Fa Sol La Si | Spanish, French, Italian, Portuguese, … |

- Accidentals localized too: C♯ / Do♯ / Cis; B♭ / Si♭ / B.
- Octave numbers optional (C4 vs "middle C" / "Do central").
- Used everywhere names appear: keyboard labels, falling-note labels, noteheads in sheet music, free-play display, quiz prompts, chord names (C major → Do mayor), lesson text placeholders.
- `theory/` works with `Pitch` values (MIDI number + spelling); names are produced only at display time by `i18n/naming.ts`, which maps `step` + `alter` to the selected system (e.g. `{ step: 'D', alter: -1 }` → D♭ / Re♭ / Des).
- Because spelling is preserved from the lesson file or MusicXML, the displayed name matches the written note (D♭ stays D♭, never becomes C♯). For played notes without an authored spelling, the default spelling from `theory/pitch.ts` is used.

### 8.4 Authoring rules

- No hard-coded user-facing strings in components — enforced by `eslint-plugin-i18next`.
- Use ICU messages for plurals and variables: `"{count, plural, one {# star} other {# stars}}"` — never concatenate strings.
- Keys are semantic (`results.retryButton`), not English text.
- Layouts must tolerate ~40% longer text (German, Spanish) — no fixed-width buttons with text.
- Use CSS logical properties (`margin-inline-start`) so right-to-left languages stay possible later.
- `locales/glossary.md` keeps music terminology consistent per language.
- Musical content (scores) is shared across languages; only text differs.

---

## 9. Screens

1. **Learning path** (Learn, `/learn`) — course map with units and lessons, lock/unlock state, stars earned, "continue" button. Units in progress are open; finished and locked units fold to one line (finished: done count and stars; locked: what unlocks them), which opens them.
2. **Lesson player** — the core screen:
   - Top: falling notes **or** sheet music (toggle).
   - Bottom: on-screen keyboard (zoomed to the lesson range; full 88 keys available), lighting expected keys and showing played keys.
   - Live feedback: green/red notes, timing badges (early / perfect / late), streak counter.
   - Controls: play/pause, restart, mode, tempo, hand selection, loop (Phase 2), view toggle.
   - Indicator showing active input (MIDI / mic) and connection status.
3. **Results** — accuracy, timing breakdown, stars, per-measure heatmap, "retry" / "practice weak spots" / "next".
4. **Song practice** (`/songs`) — the built-in songs and My songs (imported), with their best stars; each opens the practice screen.
4. **Free play** — shows notes played (names on keys and staff), identifies chords; note-naming quiz.
5. **Progress** — the home screen (`/`, also opened from the app's name in the header): streak, practice time per day, lessons completed, skill mastery; a big “Let’s Go!” button leads to the learning path.
6. **Settings** — **language**, **note-naming system** (English / German / solfège), input source (MIDI / Mic / Auto), MIDI device picker, mic picker + level meter + calibration, latency offset, note labels on/off, metronome and piano volume (also from the 🔊 button on the practice screen; by default the click sits under the music), theme.
7. **First launch** — pick language and note-naming system, then connect an input.
8. **My songs** — import a MIDI or MusicXML file (file picker or drop), set it up (title, which hand plays each track, transposition, tempo), practice it like any song; its settings screen changes or deletes it.

All text on every screen comes from translation files (§8); note names and chord names follow the selected naming system.

---

## 10. Curriculum

Pace assumes some prior music knowledge — theory basics go quickly; the focus is on hands and reading.

| Unit | Topic | Phase |
|---|---|---|
| 1 | **Finding your way** — keyboard geography, middle C, finger numbers, five-finger position, one hand at a time | 1 |
| 2 | **Rhythm with real notes** — quarter/half/whole notes, rests, eighth notes, steady tempo | 1 |
| 3 | **Reading the treble clef** — landmark notes, note-naming drills, melodies from notation | 2 |
| 4 | **Bass clef & the left hand** — landmark notes, LH melodies, the grand staff | 2 |
| 5 | **Hands together** — parallel/contrary motion, melody over single bass notes | 3 |
| 6 | **Chords** — triads, inversions, I–IV–V–I, accompaniment patterns | 3 |
| 7 | **Scales & fingering** — C, G, F major; thumb-under technique | 3 |
| 8 | **Sharps, flats & naturals** — black keys' two names, accidentals, the natural sign, A minor, neighbor notes | 4 |
| 9 | **Touch** — legato and slurs, staccato, ties, accents | 5 |
| 10 | **The sustain pedal** — when to press and lift, pedal marks, connecting chords | 5 |
| 11 | **Around the keyboard** — position shifts, octave jumps, arpeggios, crossing over | 5 |
| 12 | **More keys** — D and B♭ major, minor scales (A, E, D), key signatures up to two sharps or flats | 5 |
| 13 | **Rhythm & form** — sixteenth notes, 6/8, syncopation, repeats and endings, ritardando and fermata | 5 |
| 14 | **Two hands, two lines** — hand independence: a melody in each hand | 5 |
| — | **Songs** — public-domain pieces interleaved at each level | all |

Units are grouped in four levels: **Beginner** (Units 1–4), **Elementary** (5–8), **Late elementary** (9–11) and **Early intermediate** (12–14). Each unit names its level (`courses.json` › `level`); the Learn page and Song practice list units under their level, and Your progress shows the level of the unit being worked on ("Beginner, Unit 3 of 8"). A level shows once it has units.

---

## 11. Phases

### Phase 1 — MVP: hear the piano, play first lessons

**Goal:** a playable app where you can connect the Casio (or use the mic), play guided lessons in falling-notes view, get graded, and have progress saved.

#### Milestones

**1.1 Project setup** — ✔ done
- Vite + React + TypeScript scaffold, ESLint/Prettier, Vitest.
- App shell with routing between screens (placeholders).
- `git init`, README with how to run.

**1.1b Localization foundation** (before any real UI text is written) — ✔ done (English + Spanish)
- i18next + react-i18next + ICU setup; namespaces; lazy loading; English fallback.
- Language detection from the browser + switcher in Settings, persisted.
- `i18n/naming.ts`: English, German and fixed-do solfège naming systems, with accidentals and optional octave numbers; naming-system setting.
- `Intl` formatting helpers (percent, durations, dates).
- `eslint-plugin-i18next` rule blocking hard-coded strings.
- Key-parity check script (every language has the same keys as English).
- Pseudo-locale (`en-XA`: accented, ~40% longer text) to spot untranslated strings and layout overflow.
- English + one second language set up from the start to prove the pipeline.

**1.2 MIDI input** — ✔ done
- `MidiInput` adapter: device list, selection, hot-plug, Note On/Off parsing.
- Settings screen: device picker + "press any key" live test.
- Dev input: computer keyboard (on-screen clicks moved to 1.3, with the on-screen keyboard).
- ✅ *Checkpoint passed (2026-10-12): Casio CDP-S110 is detected and key presses show up live.*

**1.3 Keyboard & falling notes** — ✔ done
- Canvas on-screen keyboard (configurable range, highlights, note labels, finger numbers); clicking/touching keys plays notes (dev input).
- Falling-notes renderer driven by a basic transport (play/pause/seek at the score tempo); notes colored by hand, aligned with the keyboard lanes.
- `theory/pitch.ts`: `Pitch` type, `parseNote` / `formatNote`, MIDI ↔ `Pitch`, default spelling — with exhaustive unit tests. ✔ done early, in 1.1b (note naming needed it).
- Score model + inline JSON score loader (parses note strings, reports invalid ones with lesson/step location).
- Demo practice screen (falling notes + keyboard + play/pause) with a public-domain song; free play shows the keyboard and held notes.

**1.4 Engine** — ✔ done
- Transport clock: extend the 1.3 transport with count-in and metronome (Tone.js).
- Wait mode and tempo mode (plus hand selection: right / left / both).
- Matcher + scorer (timing grades, accuracy, stars).
- Unit tests driven by scripted `NoteEvent` streams.

**1.5 Microphone input (single notes)** — ✔ done (checkpoint pending)
- Audio capture with processing disabled; onset detection; `pitchy` pitch detection; stabilizer; note-off detection.
- Calibration: noise floor, latency tap-along, sensitivity slider, level meter, live note display.
- Input selector: MIDI / Mic / Auto.
- Mic-specific timing windows in the scorer.
- ✅ *Checkpoint: test the mic against the Casio's speakers, comparing mic detections with MIDI ground truth for the same keys.* Tool: Settings → "Microphone check" (needs MIDI and the microphone on).

**1.6 Content: Units 1–2 (~10 lessons)** — ✔ done
- Unit 1: meet the keyboard; middle C & neighbors; RH five-finger position; first RH melody; LH five-finger position; first LH melody.
- Unit 2: quarter & half notes; whole notes & rests; eighth notes; first song in tempo mode.
- `courses.json` with unlock rules (enforced with saved progress in 1.7).
- Lesson player: explain, find-the-keys and exercise steps; pass rules; lesson stars = weakest graded step.
- All lesson, course and song text written as translation files in every supported language.
- `locales/glossary.md` started with Unit 1–2 terminology.

**1.7 Progress, home & free play** — ✔ done
- Dexie DB: lesson and song results (best stars, best accuracy, attempts), settings, and a practice log.
- Home screen with learning path and "continue"; unlock rules enforced.
- Progress screen: lessons completed, stars, practice streak, practice time, recent practice (pulled forward from 2.4).
- Basic results screen (accuracy, stars, retry/next).
- Free play: note names; chord names (MIDI only in this phase), both in the selected naming system.
- First-launch flow: language, naming system, input.

#### Fixes from hardware testing (2026-10-13)
- Metronome clicks were heard ~50–100 ms late on Windows (the browser under-reports output delay): tap-along **timing correction** in Settings → Sound and timing. Re-check for any remaining drift.
- Microphone in lessons marked correct notes as wrong (octave / harmonic confusions): **expected-note-guided matching** — near an expected note, a mic note an octave, two octaves or an octave + fifth away counts as that note.
- Microphone check was 70–90%: **recording tool** in the Microphone check saves the mic audio + MIDI ground truth; recordings in `fixtures/mic/` are replayed by `fixtures.test.ts` to tune the detector.
- Tuned on the first Casio recording (100 notes, C3–E5): 87% with 20 extra detections → **97% (91/94 single notes), 0 octave/wrong notes, 3 extra** at a 12 dB threshold. Fixes: no new onset within ~100 ms (a real piano's attack builds for tens of ms), more evidence for unsure or still-ringing pitches, no re-trigger of a fading note, same-pitch-first pairing in the check, notes played together left out of the score. The recording is a regression test (≥ 92%).

#### Phase 1 done when
- [x] Casio connects over USB and every key is detected correctly. (verified 2026-10-12)
- [x] Mic mode reliably detects single notes in the C3–C6 range after calibration. (verified 2026-10-15: threshold 12 dB and "Correct the delay" give ≥ 90% heard correctly live in the Microphone check; middle C is recognized reliably in lessons)
- [x] All Unit 1–2 lessons are playable in wait and tempo modes, with either input. (verified 2026-10-16)
- [x] Scores and stars persist across browser restarts.
- [x] Engine has unit tests for matching and scoring.
- [x] The whole app works in every supported language: no hard-coded strings (lint passes), key parity passes, pseudo-locale shows no untranslated text or broken layouts.
- [x] Switching naming system changes note names everywhere (keyboard, falling notes, lesson text, free play).

---

### Phase 2 — Reading music

**Goal:** transition from falling notes to real sheet music, and make practice more effective.

#### Scope

**2.1 Sheet music view** — ✔ done
- OpenSheetMusicDisplay integration rendering MusicXML.
- Cursor synchronized with the transport clock; current notes highlighted; played notes colored green/red on the staff.
- Inline JSON scores converted to MusicXML (`src/content/musicxml.ts`: grand staff by hand, rests, ties across bar lines, chords, finger numbers) so every lesson can use either view.
- View toggle in the lesson player and song practice; per-exercise default view (`"view": "sheet"` in lesson JSON). OSMD is loaded on demand (own chunk).

**2.2 Notation ramp** — ✔ done
- Level A ("Note names"): the staff of the hand being played, with each note's name (selected naming system, no octave) written under it as a lyric — readable at any zoom, unlike labels inside noteheads.
- Level B ("No names"): the same staff without names. A wrong key shows a hint with the notes to play ("Wrong key · play C, E"; in wait mode only the chord keys not already held).
- Level C ("Both staves"): grand staff, treble and bass, whatever hand is selected.
- "Sheet music starts with" setting (Settings → Language and notes) plus a per-exercise `"notation"` in lesson JSON; a Notation menu next to the view toggle changes it for the current run.
- Sheet rendered at 90% with default spacing so names fit and the keyboard stays on a 1280×720 screen; the printed tempo mark is dropped (it's in the header).

**2.3 Practice tools** — ✔ done (song practice; lesson exercises keep their set tempo, hands and pass rule)
- Loop a range of measures: "Repeat bars [from] to [to]", or drag across bars on the sheet music or the falling notes while stopped. Out-of-loop notes are greyed and the loop is shaded. Tempo mode counts in during the bar before the loop and jumps back at its end keeping the beat (metronome included); wait mode jumps back once the last notes are played. Each time through shows its accuracy ("3 times through · last time 92%"); loops never end in results, so they aren't recorded.
- Speed slider (40–100%, shows the resulting BPM): changes the tempo on the fly, without starting over.
- "Play the other hand" when practicing one hand: the other hand is played by Tone.js (a softer synth), scheduled ahead like the metronome. In wait mode it waits too: notes where the music stops sound once the learner plays on. With the microphone, a tip suggests headphones (the other hand's keys never count as wrong).
- "Practice the weak spot" on the results: loops the worst measure plus weak neighbors (below 90%), up to 4 bars.
- Choosing bars that are already repeated (a click inside the loop, or the same bars again) stops repeating them.
- Shortcuts while practicing (songs and lessons): Space plays and pauses, Escape starts over.
- Play/pause (▶ ⏸) and start over (↻) are icon buttons; the views and modes are emoji-only toggles (🎹 falling notes, 🎼 sheet music; ⏳ wait for me, ⏱️ play along) and the hands are three icon buttons instead of a dropdown (🫲 left · 🙌 both · 🫱 right). Every button around the exercises has a tooltip saying what it does, with its key where it has one ("Play (Space)").
- Settings page: sections stacked one after another; the live test keeps the last 20 events in a scrolling list.

**2.4 Richer results & progress** — ✔ done
- Results (tempo mode): timing breakdown — a dot per note on an early ↔ late line over the perfect / good / OK windows, with early / on-time / late counts and the average offset ("On average 14 ms early").
- Results: "Bar by bar" heatmap, colored like the stars each bar would earn (dashed: no notes); in song practice, clicking a bar repeats it.
- Results float in a window over the dimmed page (a modal dialog). Closing it (✕, Escape or a click outside) leaves the music with its colored notes to look over; a "Results" button next to Start over opens it again. Try again, Continue, "Practice the weak spot" and the bar buttons work from inside it.
- Practice time is now measured while playing or waiting for a key (idle gaps count up to a minute), so loops and unfinished runs count too. It is saved per day (Dexie v3 `practiceDays`, filled from the existing log on upgrade); streaks come from it.
- Progress screen: best streak next to the current one, skills, and practice per day over the last year as an activity calendar like GitHub's (weeks as columns from the language's first weekday, months on top, 5 shades: none, under 5 / 15 / 30 minutes, 30+; scrolls on narrow screens).
- The header's input badge is now a picker, always visible: Automatic / MIDI keyboard / Microphone, each with its live status; choosing MIDI or the microphone turns it on if needed.
- Skill tags per lesson in `courses.json` (`keyboard`, `finger-numbers`, `rh-position`, `lh-position`, `note-values`, `rests`, `eighth-notes`, `steady-tempo`; names in `locales/*/courses.json`). Mastery = average best accuracy of the skill's lessons (unplayed = 0); level Learning / Good (≥ 80%) / Mastered (≥ 95%), like the stars.

**2.5 New exercise types** — ✔ done
- `quiz` step: flash cards with one note on a treble or bass staff (`"clef": "auto"` picks treble from middle C up); play its key. Wrong keys are named with their octave ("That was F4. Try again."); after two misses the right key lights up; the microphone's octave/harmonic mix-ups count as right. Scored by first-try answers, like the stars. The keyboard has no labels (it's a reading exercise). Cards are drawn by OSMD, cropped to the staff so every card has the same size.
- Free play has a "Note quiz" mode: 10 cards on the treble clef (C4–G5), bass clef (G2–C4) or both.
- `rhythm` step: a pattern written as counted (`"q q h | e e q rq q"`: w h q e s, "." dotted, "r" rest; every bar must be full). Any key counts and only timing is graded (taps when nothing is due are "Extra taps"); shown on a one-line percussion staff (stems up) or as a single falling lane, with a big tap pad instead of the keyboard. Tempo mode with count-in and metronome; results include the timing breakdown.
- Unit 2 lessons 1–3 start with a tap-the-rhythm step before playing the same kind of rhythm on keys.

**2.6 Content: Units 3–4** — ✔ done
- Unit 3, reading the treble clef (5 lessons): the staff and the treble clef; landmark notes (middle C, G4, C5); lines and spaces (note quizzes); steps and skips, read from the staff with names, then without, then in time; songs `au-clair-de-la-lune` and `lightly-row`.
- Unit 4, the bass clef and the left hand (5 lessons): the bass clef and its landmarks (C3, F3, middle C); lines and spaces; left-hand melodies in C position; the grand staff (picture, a quiz across both staves, the hands taking turns); songs `hot-cross-buns` and `mary-had-a-little-lamb` (left hand). Units 3 and 4 unlock like Unit 2 (every lesson of the previous unit with ≥ 1 star).
- Explain steps can show notes on a staff (`"staff": { "clef": "treble" | "bass" | "grand", "notes": [...], "names": true }`), drawn by OSMD without bar lines or rests (`StaticStaff`, shared with the quiz cards).
- Italian markings: scores can list `"markings"` (tempo words adagio … allegro, dynamics pp … ff); they're shown as chips next to the song info and in lesson exercises, with a localized explanation on hover or focus (`theory.json` › `markings`). Every song has its markings. (Grading dynamics comes with MIDI velocity in Phase 3.)
- "Both staves" now always shows both staves, even for music in one hand.
- New skills: treble clef, bass clef, grand staff. All text in English and Spanish; glossary extended (staff, clefs, grand staff, ledger line, steps and skips, accidentals, markings, quiz and rhythm terms).

#### Phase 2 done when
- [x] Any lesson can be played in either falling-notes or sheet-music view with a synced cursor. (verified 2026-10-15 on the Casio)
- [x] Loop, slow-down and hand selection work in tempo mode. (verified 2026-10-15 on the Casio)
- [x] Note-naming quiz works with both inputs and in every naming system. (verified 2026-10-15 on the Casio)
- [x] Units 3–4 are complete and playable in every supported language. (verified 2026-10-15 on the Casio)
- [x] Sheet-music note labels follow the selected naming system. (verified 2026-10-15 on the Casio)

---

### Phase 3 — Both hands, chords, songs & desktop

**Goal:** full two-handed playing, chords (checked with MIDI), bring-your-own songs, and optional desktop packaging.

#### Scope

**3.1 Chords and the microphone** — ✔ done (reduced scope, see §5.3)
- ~~Guided chord verification, Basic Pitch transcription, free play chords with the mic~~: dropped after prototyping; chords are checked with MIDI.
- With the microphone, any note of a chord counts for the whole chord, in wait and tempo modes (`WaitMatcher.press(…, anyNote)`, `TempoMatcher.takeChord`); MIDI still needs every note.
- Practice shows a tip when listening through the microphone to music with chords.

**3.2 Song import** — ✔ done
- Import `.mid`, `.musicxml` / `.xml` and `.mxl` files (file picker or drag and drop, up to 10 MB), told apart by their content (`content/loaders/importFile.ts`). MIDI: one track per channel and instrument, drum tracks left out, notes spelled from the key signature. MusicXML: one track per staff of each part, written spelling and fingering kept, ties joined, grace/cue/unpitched notes left out.
- Track/staff → hand assignment UI: right, left, both (split at middle C) or not played. Suggested: a part on two staves → right/left; otherwise the highest track → right, the lowest → left; a single track is split if it has notes on both sides of middle C.
- Transpose ±12 semitones (respelled in the new key; notes that would leave the 88 keys are left out and counted); tempo override (20–300 BPM).
- Imported songs stored in IndexedDB (`mySongs`, database version 4) and shown in "My songs" on the Learn screen; practiced with all the practice tools, results saved as `mySong:<id>`. Their settings screen changes them or deletes them (the practice history is kept, shown as "Deleted song").
- Imported song titles are kept as-is (user content, not translated); all import UI is localized (English, Spanish), and the glossary has the new terms.
- Simplifications, shown as notes when they apply: timing is rounded to sixteenth notes (the sheet-music writer's grid, so triplets and played-in MIDI are approximated); the first tempo and time signature are used; repeats are played once, as written. A pickup bar is padded to a whole bar. The key signature now reaches the sheet music (`Score.keyFifths`).

**3.3 Dynamics (MIDI only)** — ✔ done (verified 2026-10-15 on the Casio: the grading matches its touch, and the pedal indicator follows the pedal)
- Scores can mark levels (`"dynamics": [{ "beat": 0, "mark": "p" }]`, pp … ff) and hairpins (`"hairpins": [{ "from": 4, "to": 8, "kind": "crescendo" }]`). The sheet music draws them under the top staff, and MusicXML import keeps them (`<dynamics>`, `<wedge>`).
- Grading (`engine/dynamics.ts`), MIDI only: the velocity of each note played on a MIDI keyboard is kept. A passage is right if its average velocity is in the level's band (generous, overlapping bands, since keyboards differ in touch) or clearly louder/softer (≥ 10) than the passage before, as written. A hairpin is right if its last notes are ≥ 10 louder (crescendo) or softer (diminuendo) than its first. Hairpin notes don't count towards the passages around them.
- Results show each passage and hairpin with a loudness meter and a verdict ("Just right", "Too loud", "Got louder"…); through the microphone they say dynamics need a MIDI keyboard. Stars stay about the notes; a lesson exercise can also require the dynamics (`"pass": { "minStars": 1, "dynamics": true }`).
- While playing, a box next to the controls shows the level or hairpin now and how hard the last MIDI note was played against the level's band.
- Content: lesson u4-l6 "Loud and soft" (p then f, crescendo/diminuendo, Ode to Joy with mf, p, cresc. and f); new skill "dynamics"; Ode to Joy has dynamics.
- Sustain pedal (CC64): a "Pedal" indicator on the practice screen and in free play, lit while the pedal is down (shown when a MIDI keyboard is connected).

**3.4 Content: Units 5–7** — ✔ done
- Unit 5, hands together (4 lessons): same direction (parallel), mirror image (contrary motion), melody over bass notes, songs for both hands.
- Unit 6, chords (5 lessons): major triads (C, F, G), minor triads (C minor, D/E/A minor), inversions and close chord shapes, I–IV–V–I in the left hand, accompaniment patterns (block, broken, Alberti bass, with a melody on top).
- Unit 7, scales and fingering (5 lessons): C major right and left hand (thumb under / crossing over), G major (key signature, F♯), F major (B♭, its own right-hand fingering), C major with both hands; the opening of "Joy to the World" as a scale in a song.
- Songs combining both hands: bass lines added to "Lightly Row", "Au clair de la lune" and "When the Saints" (lessons that play them with one hand are unchanged), and a new "Jingle Bells" with I, IV and V in the left hand.
- Engine: lesson text variables can name a chord (`{ "chord": "C4", "quality": "major" }`) or a scale (`{ "scale": "G4", "quality": "major" }`) in the user's naming system; explain-step keys can belong to either hand (`"hand": "L"`); inline scores take a key signature (`"keyFifths"`); results show each hand's accuracy when both are played (a wrong key counts against the hand playing the nearest note at that moment); the practice keyboard spans the hands being practiced.
- All new text in English and Spanish; scale names in `theory.json` (`scales`), new skills (hands together, chords, accompaniment, scales, thumb under), glossary terms.

**3.5 Desktop packaging (optional)** — ✔ done (verified 2026-10-16: installed with the installer, practiced with the Casio, and progress moved over from the browser)
- Electron wrapper (`electron/main.js`): loads the built app (`dist/`) from `app://music-teacher/`, a secure origin served by the app itself (pages such as `/learn` get `index.html`), so it works offline without a server. MIDI and the microphone are allowed without asking, sound plays without a first click, links to other sites open in the browser, and a second launch focuses the open window. Data (IndexedDB) lives in the app's profile.
- Native menu (Music Teacher: reload, full screen, quit; View: zoom, developer tools), hidden until Alt is pressed, in the app's language (`locales/<lang>/desktop.json`; the page tells the menu when the language changes). The window title is the page's. The installer offers English and Spanish.
- Windows installer via electron-builder (`npm run desktop:dist` → `release/Music-Teacher-Setup-<version>.exe`, unsigned); `npm run desktop` opens the app from a fresh build. The web version is unchanged (`npm run dev`).
- The browser and the app keep separate data: **Settings → Your data** exports everything (settings, results, practice history, imported songs) to a file and imports it back, replacing what's there (`storage/backup.ts`).
- CI (`.github/workflows/ci.yml`): every pull request and merge runs `npm run check` on Linux; after a merge into `main`, a Windows job builds the installer (version `0.1.<run number>`) and publishes it as the **Latest build** release (`latest-build` tag, `Music-Teacher-Setup.exe`), replacing the previous one.
- `MUSIC_TEACHER_SMOKE=1 npx electron .` opens the app hidden and reports what works (secure page, MIDI inputs, microphone permission, storage), then quits.

#### Phase 3 done when
- [x] Two-handed lessons grade both hands independently. (verified 2026-10-16 on the Casio: each hand's score includes its own misses and wrong keys)
- [x] In mic mode, chord exercises can be played through (any note of a chord counts) and say that MIDI checks every note. (verified 2026-10-16 with the microphone, lesson u6-l1)
- [x] A user-provided MIDI/MusicXML file can be imported and practiced. (verified 2026-10-15 on the Casio)
- [x] Chord names (e.g. C major / Do mayor / C-Dur) display correctly in every language and naming system. (`i18n/chordNames.test.ts`, and lesson texts checked in English and Spanish)
- [x] (Optional) App runs as a standalone Windows desktop app. (verified 2026-10-16 on the Casio; the web version still runs on localhost)

---

### Phase 4 — Practicing well

**Goal:** help decide what to practice each day, let the learner hear and see their own playing, and train reading and listening with endless fresh material.

#### Scope

**4.1 Practice suggestions** — ✔ done (verified 2026-10-16 with real progress: the suggestions fit, and playing one ticks it off)
- A **Today** card on the home screen (Progress) with a short session of 3–5 suggestions, each one tap away:
  - the next lesson on the learning path;
  - a **review**: a finished lesson due again, spaced by how well it went (e.g. 1★ after 3 days, 2★ after 7, 3★ after 14; doubling after each good review);
  - a **weak spot**: the bars to loop from a recent run that went badly, opening the song or lesson with those bars repeating;
  - a **song** not played for a while, at the learner's level;
  - the **skill** with the lowest mastery, through one of its lessons.
- Only what the learner has reached is suggested: never a locked lesson, a song above their level (see 4.6), or a skill they haven't started; reviews and weak spots come only from lessons and songs already played.
- The suggestions change as the learner plays; finished ones are ticked for the day.
- Storage: each result keeps its review schedule (`reviewDays`, `reviewDue`; results saved before get one from their best stars) and, for songs, the weak bars of its latest run; today's plan is saved in the settings table (key `today`). No new tables, so the database stays at version 4; all of it is in backups.
- Built as: `content/review.ts` (the schedule), `content/suggestions.ts` (what to suggest; pure, tested), `storage/todayPlan.ts` (the day's plan; an item is done once played since it was suggested — a finished run, or three times through a weak spot's bars), `ui/screens/TodayCard.tsx`. Songs know their level (`SONG_UNITS`: the unit whose lessons first use them, kept in step by a test). A song opens with bars repeating from its address (`/practice/<song>?bars=5-6`).
- Fixed 2026-10-25 (Juan: a weak spot practiced didn't tick off, and nothing said what would): the Today row says how many times through the bars tick it off ("play it through 3 times"); in the song, while those bars repeat, the hint counts the times so far ("1 of 3") and then says it's ticked off. The count keeps going across modes and hands (it used to start over with each new run), and only times through the weak spot's bars count. Today's rows wrap their details instead of cutting them off, below the title on a phone.

**4.2 Record and play back** — ✔ done (verified 2026-10-16 on the Casio: Listen and Compare with MIDI and with the microphone)
- Every practice run is recorded (the notes played: time, key, velocity, input).
- After a run: **Listen** plays it back with the app's piano, in time with the falling notes or the sheet music cursor; **Compare** draws the played notes over the written ones, so rushing, dragging, wrong keys and (with MIDI) uneven dynamics show at a glance.
- The latest recording of each lesson and song is kept (and exported with the backup); older ones are dropped.
- Wait and play-along runs are recorded (not "Play it for me", nor rhythm steps); in a loop, each time through is kept. Keys are placed on the music's timeline (beats), so playback follows the tempo chosen; the microphone's notes are kept as the session read them (an octave off counts as the note expected).
- Compare grades the keys the way the run was graded, with the same matchers, so it agrees with the results: right, early, late (tempo mode), wrong keys, missed notes; keys of the other hand and the count-in are shown but not graded. With MIDI, a strip below shows how hard each key was played.
- Storage: a `recordings` table keyed by song or lesson step (`song:<id>`, `mySong:<id>`, `lesson:<id>:<step>`), so the database is at version 5; backups made before it still import.
- Built as: `engine/recording.ts` (the recorder and the comparison; pure, tested), `storage/recordings.ts`, `ui/screens/practice/useRunRecording.ts` (records, keeps and plays back) and `CompareChart.tsx`. Listen and Compare sit in the controls between runs and on the results card. While a run plays back, a playback bar (`PlaybackBar.tsx`: what is playing, how far along, Pause/Resume (Space) and Stop (Esc)) takes the place of the practice controls, and the practice settings (mode, hands, metronome, speed, bars) wait, dimmed; the view and the volume can still be changed. Playing back has no metronome and lights up the keys played.

**4.3 Sight-reading drills**
- A generator of short melodies (2–4 bars) using only what the learner has been taught: the notes and clefs of finished units, note values up to their level (quarters and halves first; then rests, eighths; then the left hand, both hands, key signatures).
- Musical rules: mostly steps with a few small leaps, phrases that end on the key note, no unplayable stretches for the hand position; a seed per drill, so a drill can be replayed exactly.
- A **Sight-reading** page: a new drill each time, shown in sheet music only, in wait or play-along mode; results feed a new "sight-reading" skill.
- Levels, each opening when the unit that teaches it is finished: right hand with quarter and half notes, then with rests and eighth notes (Unit 3); left hand in the bass clef (Unit 4); both hands, a melody over a bass note per bar chosen to fit it (I, IV or V; Unit 5); G major and F major with their key signatures, either hand (Unit 7). Until Unit 3 is finished, the page says what it takes. A test checks every level against the notes (per hand), note values and keys the lessons up to its unit teach.
- Drills are four bars of 4/4 in a five-finger position, the first note's finger written as in method books: mostly steps, leaps of a fourth at most (never a tritone), a step back after a leap, ending on the key note on a long note, approached by step. Each comes from a seed in the address (`/sight-reading?level=bass&seed=123`), so "Try again" and reloading replay it; a new drill is checked against the last 50 of its level, so it's never one of them.
- While reading, the keyboard doesn't light up the keys to play, and only its Cs are labeled. Listen and Compare work as for songs; only the latest drill's recording is kept.
- Storage: results by level (`drill:<level>`, with the practice log); the level chosen and the recent drills in the settings table (key `sightReading`). The database stays at version 5. The skill's mastery is the average accuracy of the last 10 drills. The Today card suggests a drill at the highest level open when none was played for 2 days.
- Built as: `content/sightReading.ts` (levels and the generator; pure, tested), `lib/random.ts` (seeded random numbers), `storage/sightReading.ts`, `ui/screens/sightReading/`.

**4.4 Ear training** — ✔ done (verified 2026-10-17 on the Casio, with MIDI and with the microphone)
- Exercises that play something and ask for it back on the keyboard: a single note (after hearing middle C as a reference), an interval above a given note, a short melody (3–5 notes), major or minor chord (answered by playing it or by choosing).
- Levels follow the curriculum; the answer is checked like any played note, with MIDI or the microphone (the microphone stops listening while the app plays, so it doesn't hear itself).
- Results feed a new "ear training" skill.
- Levels, each opening when the unit that teaches its keys is finished: single notes, and two notes in a row from the lit one (Unit 1); short melodies of 3 to 5 notes, growing over an exercise, from the lit first note (Unit 2); major or minor chords on a lit root, C to A plus C minor (Unit 6).
- The keys grow with the course, in the octave from middle C: the right hand's first position C–G (Unit 1), up to the C above (Unit 3), E♭ (Unit 6), F♯ and B♭ (Unit 7). Intervals go up to a fifth, never a tritone; melodies move along C major, and G or F major once their scales are taught. A test checks every level, at every stage of the course, against the keys the lessons up to then use.
- Single notes come after middle C as a reference (relative pitch); "Play middle C first" can be turned off for a harder challenge, and is remembered.
- "All 12 notes" (off by default, remembered) asks single notes and intervals over every key from middle C to the C above, and intervals up to an octave, whatever the course has reached; melodies stay in the scales taught.
- An exercise is 10 questions (6 melodies), each played once by itself and again on "Hear it again"; keys wait while it plays. Wrong keys say which note they were; after two misses the answer lights up. A right answer names what was heard ("C up to E, a major third", "D minor") and the next question plays. Scored like the note quiz: questions right without a miss. Chords can be played (any voicing, once three notes are down) or chosen; with the microphone, which hears one note at a time, they're chosen.
- The microphone drops notes that start while the app is playing a question, until its sound has died away (`ignoreMicUntil`).
- Storage: results by level (`ear:<level>`, with the practice log); the level chosen last and both choices in the settings table (key `earTraining`). The skill's mastery is the average accuracy of the last 10 exercises. The Today card suggests ear training at the highest level open when none was done for 2 days.
- To fit the new item on one line, Settings became a gear at the end of the top bar.
- Built as: `content/earTraining.ts` (levels, questions, answers; pure, tested), `storage/earTraining.ts`, `ui/screens/earTraining/`.

**4.5 Appearance and comfort** — ✔ done (verified 2026-10-17 in the browser and the desktop app)
- Theme: light, dark, or follow the system (now it always follows the system).
- Keyboard size: taller or shorter keys, and how many keys around the music to show.
- Both remembered, and applied in every view (including the desktop app).
- Built as an **Appearance** card in Settings (between Sound and Language): Theme (System, Light, Dark), Key height (Short, Normal, Tall: keys 4, 5 or 6.5 times as tall as wide) and Keys shown (Fit the music: whole octaves around the notes, at least two; Wider: at least four; Whole piano: all 88), with a keyboard showing the result. No new controls elsewhere: every on-screen keyboard follows (song practice, lessons, sight-reading, ear training, the note quiz; free play already shows the whole piano), and falling-note lanes with it.
- The theme is set on the page (`data-theme`), dark colors keyed to it in `styles.css`; canvases redraw from `useColorScheme`. A copy in the browser's storage lets `index.html` set it before the app loads, so the page never flashes the wrong colors. The desktop app's window frame follows through `window.desktop.setTheme` (Electron `nativeTheme.themeSource`).
- The on-screen keyboard sits on a dark keybed, as a piano's keys do (a dark edge on top, dark gaps between white keys, a darker lip at their front), so the keys stand out in the light theme too.
- Stored with the other settings (`theme`, `keyHeight`, `keysShown`), so backups include them. Built as `ui/appearance.ts`, `ui/keyboard/layout.ts › keyboardRange`, `ui/screens/settings/AppearanceSettings.tsx`.

**4.6 Content: more songs** — ✔ done (verified 2026-10-17 on the Casio: the new songs sound right and fit the hands)
- Six or more public-domain songs spread over the levels, several for both hands (e.g. "Minuet in G", "Für Elise" opening, "Brahms' Lullaby", "Amazing Grace", "Greensleeves", "Twinkle, Twinkle"), each with fingering, markings and dynamics.
- Song practice shows each song's level (the unit it fits after) and sorts by it.
- All titles and texts translated; new terms in the glossary.
- Unit 8, sharps, flats and naturals (5 lessons), added so the songs that need more black keys are taught first: the half step and each black key's two names (find them as sharps and as flats, a chromatic climb); accidentals in the music (treble and bass quizzes); the natural sign (an accidental lasts to the end of the bar; a one-bar staff picture shows it, `"bar": true`); A minor and its raised seventh, G♯ (a tune, then "Greensleeves"); neighbor notes (E–D♯–E, slowly then flowing, then "Für Elise"). New skills: accidentals, minor keys. Ear training's notes reach all 12 after it.
- Six songs, each closing a lesson of its unit (the unit a song first appears in is its level): "Twinkle, Twinkle, Little Star" (Unit 3, right hand), "Brahms' Lullaby" (Unit 5, after a 3/4 warm-up that introduces dotted notes), "Amazing Grace" and "Minuet in G" (Unit 7, G major; "Amazing Grace" fits better there than in Unit 6, as its tune in C dips below middle C), "Greensleeves" and "Für Elise", the opening, written in 3/4 (Unit 8). Melodies checked against public-domain transcriptions; the arrangements and their fingering are our own. Checked again (2026-10-23) against the Mutopia Project's public-domain editions: "Für Elise" now has Beethoven's E2 E3 G♯3 in its E-major bars (it had E3 G♯3 B3); the simplified left hand of "Minuet in G" now follows Petzold's bass in bars 9–16 (it repeated bars 1–8's), its eighth-note bars 8 and 12 still one long note. "Jingle Bells" (Unit 6), checked against two ABC transcriptions of the chorus: bar 13 now repeats bar 5's F F F. F rhythm.
- Song practice lists the songs by unit ("Unit 3: Reading the treble clef"), in course order. A test checks that every song uses only the black keys, time signatures and key signatures its unit has taught by then.

#### Phase 4 done when
- [x] The home screen suggests a daily session that follows progress, including reviews of lessons due again and a weak spot to loop.
- [x] A run can be played back and compared with the written music, with MIDI and with the microphone.
- [x] Sight-reading drills only use what has been taught, and are never the same twice.
  - [x] Verified 2026-10-22 on the Casio (MIDI), with the two right-hand levels open after Unit 3: the drills read well from the sheet, sound like little tunes and fit under the hand; "New drill", "Try again" and switching levels work. The bass, both-hands and key levels open with Units 4, 5 and 7.
- [x] Ear-training exercises can be answered on the keyboard, with MIDI and with the microphone.
- [x] Theme and keyboard size can be chosen and are remembered, in the browser and the desktop app.
- [x] All new text is in English and Spanish.
  - [ ] TODO (user): once Unit 7 is finished, go through Unit 8's lessons on the Casio (the black keys' names, accidental quizzes, the natural sign, A minor with "Greensleeves", neighbor notes with "Für Elise").

---

### Phase 5 — Playing musically

**Goal:** go past the first method book: shape the sound (touch, pedal), move freely around the keyboard, read more keys and rhythms, and let each hand play its own line. Each unit ends in songs that need what it teaches, as in Units 1–8.

#### Scope

Built one area at a time, each with the engine work it needs and the unit that uses it, so every step can be played and checked on the piano. Units 9–14 stay locked until Unit 8 is finished: their songs, always open in Song practice, are how each area is checked early.

**5.1 Touch: Unit 9** — ✔ done (verified 2026-10-18 on the Casio: touch graded with MIDI in "Can-Can" and "Aura Lee", the microphone says it needs MIDI)
- Score format: articulation per note (`"articulations": ["staccato"]`: staccato, accent, tenuto) and slurs (`"slurs": [{ "from": 0, "to": 4, "hand": "R" }]`: the notes of that hand starting from `from` to `to`). Sheet music draws them (MusicXML `<articulations>`, `<slur>`), and MusicXML import keeps them. Ties are already drawn; the unit explains them.
- Grading, MIDI only (the microphone can't tell when a key is let go), on the real time each key is held, so it works waiting or playing along: staccato notes let go before half their length, slurred notes held until the next one goes down (no gap), accents louder than the notes around them, tenuto notes held their full length. Results show each kind ("7 of 8 short") and the bars to work on; stars stay about the notes, and a lesson exercise can require it (`"pass": { "touch": true }`). With the microphone, results say touch needs a MIDI keyboard.
- Unit 9, touch (5 lessons): legato and slurs; staccato; staccato and legato together; accents and tenuto; ties. Songs: "Can-Can" (Offenbach, staccato) and "Aura Lee" (legato). New skill: touch.
- Built as: the thresholds are staccato let go within half the note's written length; slurred notes connected when a key comes up no more than 40 ms before the next goes down (a key played again isn't checked: it has to come up first); accents at least 10 (MIDI velocity) harder than the unaccented notes either side; tenuto held at least 85% of its length. A kind passes when three in four of its notes are right. Results get a **Touch** section under the stars: each kind ("7 of 8 short") and the bars to work on.
- Explanations can show a few bars of music (`"music"`, an inline score) above the keyboard, so each mark is pictured where it's explained.
- Unit 9 (late elementary): legato and slurs (a scale under one slur, then phrases, then "Aura Lee"); staccato; both together (then "Can-Can"); accents and tenuto; ties (three held over bar lines, with tenuto lines as reminders). The lessons' own exercises require the touch (`"touch": true`); the songs don't.
- "Aura Lee" (George R. Poulton, 1861) in G major, four phrases each under a slur. "Can-Can" (the chorus of Offenbach's galop) in C: staccato quarter notes, slurred runs of eighth notes, accented long notes; the octave leap in its fourth bar is simplified to one quarter note. The song test now also checks that every articulation and slur a song uses has been taught. Both checked (2026-10-23) against ABC transcriptions of the tunes, and they match.
- Built as `engine/touch.ts` (checks and summary; pure, tested), `engine/score.ts` (`Articulation`, `Slur`), the session keeping each key's down, up and velocity (MIDI only), `content/musicxml.ts` and `loaders/musicXmlFile.ts` (out and in), `ui/screens/practice/TouchBreakdown.tsx`, `ui/sheet/StaffPicture.tsx › MusicPicture`.

**5.2 The pedal: Unit 10** — built (the check on the Casio waits until you reach Unit 10)
- Pedal marks in the score (`"pedal": [{ "down": 0, "up": 4 }]`), drawn and imported (MusicXML `<pedal>`); graded with MIDI (CC64): down and up within a window of each mark. Compare gets a pedal strip.
- Unit 10, the sustain pedal (4 lessons): what it does and the marks; changing it just after a new chord ("legato pedaling"); with broken chords; when not to pedal. Song: "Gymnopédie No. 1" (Satie, the opening).
- Built as: a mark that starts where the one before ends is a pedal change. Sheet music draws the marks as a bracket line under the bottom staff, notched at each change (MusicXML `<pedal type="start|change|stop" line="yes">`); MusicXML import reads the same.
- Grading, MIDI only (only changes of CC64 count, so a pedal sending values in between doesn't add presses), in real time, so it works waiting or playing along. **Pressed:** from a quarter of a beat before the mark to half a beat after it, or until the next note if that comes sooner; at a change, also after the new notes are played (legato pedaling). **Lifted:** in the same window around the mark's end; an end at the end of the music isn't checked, so the last notes can ring. **Without pedal:** notes outside the marks (and away from where the pedal goes down or up) start with the pedal up. A kind passes when three in four are right. Results get a **Pedal** section under Touch, with the bars to work on; when no pedal was heard at all, it asks whether one is plugged in. A lesson exercise can require it (`"pass": { "pedal": true }`); with the microphone, results say the pedal needs a MIDI keyboard.
- Runs record the pedal: Compare shows it in a strip at the bottom (the marks in gray, the pedal as held over them), and listening to a run keeps notes sounding while the pedal held them.
- Unit 10 (late elementary): pressing and lifting (a bar with the pedal, one without, a chord with it); changing the pedal (I–IV–V–I chords, then with a bass note under each); pedal and broken chords (Unit 6's broken chords, then a bass note with the chord above it, then the song); when not to pedal (a scale and staccato notes left clean, then with both hands). The lessons' own exercises require the pedal; the song doesn't. New skill: sustain pedal.
- "Gymnopédie No. 1" (Erik Satie, 1888), the first 18 bars, a whole step down in C so it needs no new key signature, checked against the Mutopia Project's public-domain edition: four bars of the left hand alone, rocking between F major 7 and C major 7 (Satie's G and D), then the melody, its long note held four bars, and the second phrase, whose last two bars move to E minor and A minor (Satie's F♯ minor and B minor); the pedal changed every bar. Simplified: the left hand keeps each bass note and its chord in one position (no jumps yet), so its chords sit an octave or so lower than Satie's and every other bass note an octave higher. The song test now also checks that a song's pedal marks have been taught.
- Built as `engine/pedal.ts` (checks and summary; pure, tested), `engine/score.ts` (`PedalMark`), pedal events on the input bus (`input/bus.ts › subscribePedal`, sent by `input/midi/midiInput.ts`), the session keeping the pedal's presses, `content/musicxml.ts` and `loaders/musicXmlFile.ts` (out and in), `engine/recording.ts` (the pedal held, `soundingEnd`), `ui/screens/practice/PedalBreakdown.tsx`.

**5.3 Around the keyboard: Unit 11** — built
- Unit 11 (5 lessons): position shifts mid-phrase; octave jumps; arpeggios (C, G and F major, hands separately, the thumb passing under across octaves); crossing over. Song: "Prelude in C" (Bach, BWV 846, the opening), with the pedal.
- Built as: crossing over is one hand crossing over the other (fingers crossing over the thumb came with the scales, in Unit 7). A note can say its hand crosses over to play it (`"crossed": true`): it's written on the other hand's staff, the first of each stretch marked L.H. or R.H. (M.I. / M.D. in Spanish). That staff still has one line, so a crossing hand's notes don't overlap the other hand's there; practicing that hand alone writes them on its own staff.
- Unit 11 (late elementary): moving the hand (a shift during a half note, right hand up, left hand down); octave jumps (a phrase and its echo an octave up; Unit 6's chords over a bass jumping down an octave, with the pedal); arpeggios in C (two octaves up and back, right hand 1 2 3 1 2 3 5, left 5 4 2 1 3 2 1); arpeggios in G and F (the same fingering), then the Prelude; crossing over (hand over hand in C and G, the left hand over the top; then the right hand crossing below). New skills: position shifts, arpeggios.
- "Prelude in C" (Johann Sebastian Bach, BWV 846, 1722), the first four bars: each chord's rising figure twice, written in eighth notes (sixteenths come in Unit 13), so two bars per chord, a new pedal for each. The left hand plays the figure's two lower notes in the bass staff, as Bach wrote them, the right hand the three above. Its notes were checked against the Mutopia Project's public-domain edition; only the left hand's held notes are shortened (the pedal holds them).

**5.4 More keys: Unit 12** — built
- Unit 12 (5 lessons): D major (two sharps) and B♭ major (two flats), their scales and fingerings; relative minors and minor scales (A, E and D minor, natural and harmonic); reading with these key signatures. Songs: "Musette in D" (Notebook for Anna Magdalena Bach), "Scarborough Fair" (D minor).
- Sight-reading: a level in D and B♭ major and minor keys; one with accidentals (Unit 8).
- Built as: Unit 12 (early intermediate): D major (the key signature, the scale with each hand, then "Ode to Joy" in D over a bass note per bar); B♭ major (the right hand starting on finger 4, the left on 3; then "Lightly Row" in B♭); relative minors (A, E and D natural minor); the harmonic minor (the seventh raised, an accidental each time); reading in new keys, with the two songs. New skill: key signatures.
- "Musette in D" (BWV Anh. 126, attributed to Bach) from the Mutopia Project's public-domain edition, written at twice its note values (2/4 becomes 4/4, its sixteenths eighths, as sixteenths come in Unit 13), and played A, B, A, as its da capo asks, without its repeats (Unit 13). "Scarborough Fair", the traditional tune as in Paul Hardy's tunebooks ("Trad."), in D minor with its one B natural, the left hand in open fifths.
- Sight-reading: **Neighbor notes** (opens after Unit 8): one or two neighbor notes in each drill, a key, the one a whole step below raised to a half step below, and the key again (E, D♯, E), written with a sharp, away from the ending, in C major (either hand) or A minor (right hand), with only the sharps Unit 8 plays. **More keys** (opens after Unit 12): D and B♭ major, A, E and D minor, from each key note, either hand; a minor drill starts on a note of the minor chord and ends on its home note.

**5.5 Rhythm and form: Unit 13** — built, in two parts: the engine, then Unit 13
- Score format and playback: repeats with first and second endings (unrolled for playing, Listen and Compare; the sheet shows them once, the cursor jumping back), fermatas (the music holds), and `rit.` / `a tempo` (a tempo change the transport follows); drawn and imported (MusicXML `<repeat>`, `<ending>`, `<fermata>`, `<sound tempo>`).
- Unit 13 (5 lessons): sixteenth notes, and a dotted eighth with a sixteenth; 6/8 time; syncopation; repeats and endings; ritardando and the fermata. Songs: "Morning Mood" (Grieg, 6/8, the opening), "The Entertainer" (Joplin, a simplified opening).
- Sight-reading: a level in 6/8 with sixteenths. Ear training: a rhythm level (hear a rhythm, tap it back).
- Built as (part 1, the engine): a score can have repeats (`"repeats": [{ "from": 0, "to": 16, "endings": [{ "from": 12, "to": 16 }, { "from": 16, "to": 20 }] }]`, at bar lines; the first ending ends at the repeat sign, the second starts there), fermatas (a note's `"fermata": true`) and ritardandos (`"rit": [{ "from": 28, "to": 32 }]`). Loading unrolls the repeats (`engine/form.ts`): every note once per time it's played, with the written score kept, so practice, falling notes, grading, Listen, Compare and loops work on the music as played with nothing new. Sheet music draws it as written (repeat signs, first and second ending brackets, fermatas, "rit." and "a tempo"), OSMD's cursor kept in written order (`CursorIgnoreRepetitions`) while the played position is mapped onto it, so it jumps back at the repeat; each written note shows how it went the last time it was played, and bars chosen on the sheet are practiced where they're first played. A repeat from the very start has no sign there, as in printed music.
- The transport follows a tempo map (`engine/tempoMap.ts`): a fermata holds its notes twice as long; a ritardando slows down in quarter-beat steps to 60% of the tempo by its end, back in tempo after. Playing along, the metronome, the other hand, Listen and falling notes all follow it.
- MusicXML import keeps repeats with first and second endings (`<repeat>`, `<ending>`), fermatas and rit. / rall. up to a tempo; da capo, segno, coda and third endings still play once, as written, with the warning.
- Built as (part 2, Unit 13): compound time (6/8, 9/8, 12/8) is counted in dotted quarters (`engine/score.ts › countedBeat`): the metronome clicks two beats a bar in 6/8 and the count-in shows 1, 2. Sheet music beams 6/8 in groups of three eighths, sixteenths with a second beam (written into the MusicXML, as OSMD's automatic beams don't group compound time); explanation pictures now show their time signature and beams.
- Unit 13 (early intermediate): sixteenth notes, and the dotted eighth with a sixteenth (each tapped, then played); 6/8 (tapped, a tune, then "Morning Mood"); syncopation (tapped, then played, the metronome clicking the beats not played); repeats and endings ("Ode to Joy" written as it's built, its same three bars twice with two endings; then "The Entertainer"); ritardando and the fermata (played along, the app slowing down and waiting). New skills: 6/8 time, syncopation, repeats and endings.
- "Morning Mood" (Edvard Grieg, Peer Gynt, 1875): only its first four bars, the flute's theme, as the only public-domain text source found (the Norwegian Wikipedia article's engraving; Mutopia and the ABC archives have none) gives just those; a major third down in C, its grace notes left out, the left hand holding a fifth (our own). "The Entertainer" (Scott Joplin, 1902), after the Mutopia Project's public-domain edition: the introduction's last bar, then the first strain with its repeat and two endings; simplified: the melody in single notes (Joplin doubles it in octaves), the left hand Joplin's bass notes on the beats without the chords between, and the second ending closing on C instead of leading on to the next strain.
- Sight-reading: **6/8 with sixteenth notes** (after Unit 13): four bars of 6/8 in groups of three eighths, with some sixteenths in every drill, either hand. Ear training: **Rhythms** (after Unit 13): a bar of rhythm played on one key, tapped back on any key at the learner's own speed; right when every tap falls within a fifth of a beat of where the rhythm puts it, at the speed tapped (eight per exercise, easier first: then sixteenths and dotted rhythms, then syncopation); after two misses, how many notes it has.

**5.6 Two lines: Unit 14** — built
- Unit 14 (4 lessons): the melody in the left hand, chords in the right; two melodies at once, first in contrary motion, then independent. Songs: "Minuet in G" with Petzold's own left hand (a second version), "Minuet in G minor" (Petzold).
- Ear training: major or minor scales by ear.
- Built as: Unit 14 (early intermediate): the melody in the left hand ("Ode to Joy" low in the left hand alone, then under one soft chord a bar in the right); contrary motion (out from the thumbs and back with the same fingers, then the C scale an octave out and back, both thumbs passing under together); two melodies at once (the right hand holding while the left moves, then the other way round, then "Minuet in G" as written); "Minuet in G minor". New skill: hand independence.
- "Minuet in G (as written)" (Christian Petzold, BWV Anh. 114): Unit 7's right hand with Petzold's whole left hand, after the Mutopia Project's public-domain edition: the opening chord, the eighth notes in bars 8 and 12, and the repeat. "Minuet in G minor" (Petzold, BWV Anh. 115), after Mutopia's edition: its first part, ending in B♭ major, with the repeat; the ornaments are left out. Both are the first part of their minuet (16 bars); the second parts are left out.
- Ear training: **Major or minor scales** (after Unit 12): a scale going up an octave from the lit key note, one note after another (C, D or B♭ major; A, E or D minor, natural or harmonic), answered by choosing Major or Minor, with a keyboard too; ten per exercise.
- Fixed on the way: a repeat or second ending closing at the end of the music was drawn closing a bar early ("The Entertainer" and Unit 13's "Ode to Joy" second endings).

Every new song passes the "only what's taught" test, extended to articulation, slurs, pedal marks and repeats.

#### Phase 5 done when
- [x] Units 9–14 are playable in English and Spanish, each ending in songs that need what it teaches.
- [ ] With a MIDI keyboard, touch (staccato, legato, accents) and the pedal are checked and reported; with the microphone, lessons explain them without grading them.
  - [x] Touch (5.1).
  - [ ] TODO (user): once Unit 8 is finished, go through Unit 9’s lessons on the Casio (legato and slurs with "Aura Lee", staccato, both together with "Can-Can", accents and tenuto, ties).
  - [x] The pedal (5.2), built.
  - [ ] TODO (user): play "Gymnopédie No. 1" on the Casio from Song practice (sheet music, both hands, waiting), without the pedal: notes, fingering and the pedal lines read well.
  - [ ] TODO (user): play "Prelude in C" on the Casio from Song practice (sheet music, both hands, waiting): the figures, fingering and pedal lines read well.
  - [ ] TODO (user): at Unit 11, go through its lessons on the Casio (shifts, octave jumps, the arpeggios, crossing over with its L.H. and R.H. marks).
  - [ ] TODO (user): play "Musette in D" and "Scarborough Fair" on the Casio from Song practice (sheet music, both hands, waiting): notes, fingering and accidentals read well.
  - [ ] TODO (user): once Unit 8 is finished, try a few **Neighbor notes** sight-reading drills (the sharps and the natural signs after them read well); at Unit 12, the **More keys** drills.
  - [ ] TODO (user): play "Morning Mood" and "The Entertainer" on the Casio from Song practice (sheet music, both hands; the Entertainer's repeat and endings, waiting and playing along).
  - [ ] TODO (user): at Unit 13, go through its lessons, the **6/8 with sixteenth notes** drills and the **Rhythms** ear training (tapping back on the Casio).
  - [ ] TODO (user): play both of Petzold's minuets on the Casio from Song practice (sheet music, both hands, waiting): the left hand's own line, the repeat; at Unit 14, go through its lessons (the left-hand melody, contrary motion, two lines). Once Unit 12 is finished, try the **Major or minor scales** ear training.
  - [ ] TODO (user): at Unit 10, go through its lessons on the Casio with the pedal plugged in (pressing and lifting, changing it, broken chords and "Gymnopédie No. 1", when not to pedal), and say whether the pedal changes are judged fairly.
- [x] Sheet music shows slurs, staccato dots, ties, pedal marks, repeats with endings and fermatas, and MusicXML import keeps them.
- [x] Repeats play back as written, in practice, Listen and Compare (checked in the browser with a test piece: the cursor goes back at the repeat sign, on to the second ending, slows through rit. and holds the fermata).
- [x] Sight-reading and ear training gain levels for the new units: Neighbor notes, More keys and 6/8 with sixteenth notes; Rhythms and Major or minor scales.
- [ ] Verified on the Casio, with MIDI and (where it applies) the microphone.

### Phase 6 — Singing

**Goal:** learn to sing in tune and in time the way the app teaches the piano. Lessons listen through the microphone and give feedback, from matching one note to singing songs with lyrics and reading melodies from the staff. The design and its mockups are in IDEAS.md › Singing. Its first pieces, the vocal range test and the Tuner, were built between phases.

#### Scope

One app, as IDEAS.md suggests: a switch between piano and voice, the piano screens barely changing, and the voice getting a course, progress and stars of its own. Built one area at a time, each with the engine work it needs and the voice units that use it, so every step can be sung and checked with the microphone.

What singing can be graded on: pitch, timing, steadiness and loudness. The app can't judge technique (breath support, tension, vowels, a healthy sound), and lessons say so: a teacher, or listening back to your recordings, covers it. Exercises stay in your range, and lessons are short, with a warm-up first.

**6.1 Match the note** — built (the check with your voice is still to do)
- On the Tuner page: the app plays a note from your saved range, and you sing it and hold it in tune (within ±50 cents, any octave) for half a second. Ten notes a run, scored like the other exercises (accuracy and stars), with the notes to work on and whether they went flat or sharp. Without a saved range, it asks for the range test first.
- The first graded singing, small and on its own like the range test and the Tuner: it shows early whether held notes are judged fairly with your voice. Recordings of your voice become test fixtures, kept local like the piano's (`fixtures/mic/`).
- The app plays, then listens, so it works without headphones.
- Built as `engine/matchNote.ts` (the notes of a run, the matcher and the summary; pure, tested) and `ui/screens/MatchTheNote.tsx`, a card on the Tuner page between the tuner and the range. The notes come from the saved range, a whole step short of each end when it spans at least an octave and a major third, each as evenly as possible and never twice in a row. Each is played on the piano for 1.2 s, and the microphone is ignored until it has stopped ringing.
- A note is matched when it's held within ±50 cents of any of its octaves for half a second (gaps up to 150 ms allowed, as in the range test). It counts when it's matched within six seconds of being heard; **Hear it again** starts those over, and a later match moves on without counting. While singing, the card shows the note to sing (also marked on the range's keyboard), a bar filling as it's held, and a hint: Higher, Lower, or In tune: hold it. **Skip** moves on.
- Results: stars from the notes matched in time (60, 80 and 95%, as elsewhere), and the notes to work on, low to high: those not matched in time (saying whether they were sung too low or too high), and those held outside the tuner's ±25-cent zone (how many cents flat or sharp). Runs are saved (`voice:matchNote`) and count toward practice time; Recent practice lists them as "Match the note".
- Recordings: the results can save the run as a WAV file that plays anywhere, with the notes asked and when the app listened for each in a `json` chunk after the audio (`input/mic/voiceRecording.ts`), into `fixtures/voice/` (kept local, like the piano's). `input/mic/voiceFixtures.test.ts` replays them through the detector and the matcher and prints how many notes match in time; a `<name>.min.json` beside one (`{ "minMatched": 8 }`) makes that a check.

**6.2 Piano or voice: Voice Units 1–2** — in two parts: the switch and Voice Unit 1, then Voice Unit 2 (both built)
- An `instrument` setting, and the switch in the top bar as the first part of the path ("Music Teacher / Voice / Learn / Unit 1 · Matching one note"), on every page, even with the sidebar collapsed or on a phone. Its list says where you are in each ("Unit 9 of 14", "Not started · find your range first").
- The sections follow it: Sight-reading becomes Sight-singing, Free play becomes the Tuner, and Home, Learn and Song practice show that instrument's course and practice. Separate for each instrument: the course, progress, stars, skills, reviews and the Today plan (results, skills and the plan tagged with their instrument). Shared: the practice calendar and streak, settings, the song library and the note names.
- The input follows the instrument: MIDI (or the microphone) for the piano, the microphone for the voice.
- The welcome screen asks Piano, Voice or Both. Adding the other one later is a click on the switch, and starts with the range test.
- A second course file, for the voice. Voice Unit 1, posture and breathing (explained, not graded); Unit 2, matching one note (6.1's exercise as lesson steps, from your comfortable note outward). Each voice lesson starts with a warm-up.
- Built as (part 1, the switch): the courses are `Course.Piano` and `Course.Voice` (not "instrument", which the code already uses for MIDI or the microphone), the voice's units in `content/voiceCourse.json` beside `courses.json`. Lesson ids are unique across both, and a lesson's next one stays in its course. The `course` setting picks one. The switch (`ui/components/CourseSwitch.tsx`) is the top bar's first part: a list of both, each saying where you are ("Unit 1 of 1", "Not started", "Not started · find your range first"). Choosing the voice turns the microphone on and, without a saved range, opens the range test; otherwise the page stays in the same section when the other course has it, and goes Home when it doesn't.
- Each course's sections (`ui/sections.ts › COURSE_SECTIONS`): the piano's as before, without the Tuner; the voice's Home, Learn, the Tuner and Settings for now (ear training, sight-singing and songs join it in 6.4–6.6). Learn, Home's course line, the skills (a new Singing area), Recent practice and Today (saved apart, `today:voice`) follow the course; the calendar and the streak count both. With the voice, the app listens to the microphone whatever the piano's input setting says, and the top bar's picker shows it (a click turns it on).
- The welcome screen asks Piano, Voice or Both after the language. The piano then connects an instrument and tries a key; the voice turns the microphone on (with a hint for singing) and finds its range; both do all of it, starting with the piano.
- Voice Unit 1 (beginner), explained and not graded: standing to sing (what the app can and can't hear, short sessions without pushing, the feet, shoulders and head, sitting) and breathing for singing (low and wide, named as diaphragmatic or belly breathing, hands on the belly and ribs, a hiss for 4, 8 and 12, even and without squeezing). Explanations in the voice course show no keyboard unless they point at keys. New skills: posture, breathing.
- Built as (part 2, Voice Unit 2): two new lesson step types. `warmUp` (text only, not graded: Continue is always there) shows the vocal warm-up (`ui/screens/lesson/steps/WarmUpStepView.tsx`): breathe low and hiss for 8, twice; hum the comfortable note (a button plays it); a siren on "ng" or a lip trill; and a five-note pattern on "mah" (do re mi re do, `engine/warmUp.ts`, pure, tested) with Play and Stop. The pattern starts a whole step below the comfortable note (lower when it wouldn't fit under the top of the range, never under its bottom), goes up a half step at a time three times while it fits, then back down; each time the app plays it (0.5 s a note), then leaves as long silent to sing it back, so it works without headphones, and the card says Listen… or Your turn. `match` is 6.1's exercise as a graded step: `within` semitones either side of the comfortable note (0–24, kept inside the range; left out = the whole range, as on the Tuner page, `engine/matchNote.ts › matchTargetsNear`), `count` notes (1–50, ten by default, as quiz cards) and `pass.minStars`. `ui/screens/MatchTheNote.tsx` is shared: a lesson passes how to pick the notes, what to do with the result (the Tuner saves `voice:matchNote`, a lesson its step's try, shown in the step's history) and a Continue button. The microphone is on while a match step is shown. A match step also shows the Tuner page's pictures, measured against the note to sing (`ui/screens/TunerParts.tsx`, shared with the Tuner): a needle over ±100 cents with the ±50 that counts in green, and the last five seconds as a line, centered on the note in the octave nearest the singing. The Tuner page doesn't show them in its card, as its own tuner sits above it. Both steps need a saved range, and link to the range test without one. `isGraded(step)` (all but explanations and warm-ups) decides which steps count toward a lesson's stars.
- Voice Unit 2 (beginner), matching one note, each lesson starting with the warm-up: your note (how matching works and sliding toward In tune, then the comfortable note five times, then within 2 semitones), notes nearby (within 2, hearing the note inside first and starting softly, then within 4 — a major third) and further out (more breath at the top, relaxing at the bottom, skipping a strained note; within 7 — a fifth — then the whole range). The last match of each lesson needs a star to pass. New skill: pitch matching.

**6.3 Singing a melody: Voice Units 3–4** — built (the check with your voice is still to do)
- A voice matcher next to the piano's (`TempoMatcher`, `WaitMatcher`). For each written note it measures how much of its time was in tune (within ±50 cents, ±25 at higher levels), whether it started within the timing window, and how steady it stayed. Any octave counts, with an option to require the written one. Wait for me waits until a note is held in tune for about 0.3 s; Sing along keeps going; Listen first plays it, then you sing.
- The singing view: note bars in a horizontal lane, on rows named with the note names (solfège if chosen); your voice as a live line through them, green in tune and amber off; a small tuner beside it; switches for the guide melody and the metronome. In sheet music, notes are colored by how in tune they were.
- Results: in tune, on time and steady, as percentages; the notes to work on (flat or sharp, and by how much); Listen and Compare as for the piano, Compare drawing your pitch line over the written notes.
- Exercises move into your range by themselves: by whole octaves first, then by key if needed.
- Singing along through speakers, the microphone hears the app too. Try whether the browser's echo cancellation lets you sing along without bending the pitch; if not, singing along asks for headphones (Listen first works without them).
- Voice Unit 3, slides and sirens; Unit 4, steps (do-re-mi).
- Built as: the voice's matcher is `engine/singing.ts` (pure, tested). Singing along, `SungTake` grades each note from the readings over it: the share of its time in tune (within ±50 cents, or ±25 with `strict`; any octave unless `octave`), the first 150 ms slid into not counting against it; when it started (first in tune for two readings in a row, from 250 ms before its beat, or from its beat after a note on the same pitch), on time within ±250 ms; and how steady (the share of its sung time that stays within 20 cents of where it sat, averaged over four readings so vibrato doesn't count). A note counts in full when in tune for 80% of its time, three quarters when started late, nothing when never in tune. Waiting, `WaitSinger` finds a note once it's held in tune for 0.3 s (gaps up to 150 ms allowed), counting in full when found within six seconds of being due and half after, as in Match the note; Skip moves on without it. `singSummary`: accuracy (the notes' credit) and stars as elsewhere, in tune, on time (singing along) and steady as percentages, and the notes to work on, low to high: in tune less than 60% of the time, or more than 25 cents flat or sharp on average.
- `engine/singSession.ts` drives a run like `PracticeSession`: Wait for me stops at each note (with the guide on, the app plays it for 1 s and listens once it has stopped ringing, so it works without headphones; Hear it again and Skip); Sing along counts in a bar, then keeps going, the guide melody playing along if chosen; Listen first plays the melody, then counts in a bar and it's sung without the guide. The microphone now also passes each pitch reading with the time it was sung (`subscribeMicReadings`, timed like its note events), which the session grades.
- `engine/transpose.ts › fitToRange` moves a melody into the saved range: the whole octaves that fit, the middle of the melody nearest the comfortable note; when none fits, the key that does (or overflows least), spelled in its key (`transposeScore`). Moved low, it's on the bass staff. A melody beyond the range says so (sing what's easy, skip what strains).
- The view (`ui/screens/singing/SingRun.tsx`): the notes in a lane (`SingLane.tsx`, a canvas), moving right to left onto a line, on rows named with the note names in the user's system; the voice as a line through them, green in tune and amber off (drawn in the octave of the note when near it, so any octave lines up), a dot where it is now. Beside it (under it on a phone), a small tuner: the note to sing, the needle against it, how many cents off, and while waiting, how far into the hold. Switches for the guide melody and the metronome. In sheet music, notes are colored as they're graded: green mostly in tune, amber partly, red hardly. Results: stars, accuracy, in tune, on time and steady, and the notes to work on (`SingResults.tsx`); Listen plays the run's recording (the microphone's audio), and Compare (singing along) draws the voice over the written notes (`SingCompare.tsx`).
- Lessons have a `sing` step: `mode` (`wait`, `along` or `listenFirst`), an inline `score` (one note at a time, no hands, no repeats; written in any key and octave), `view`, `strict`, `octave`, `guide` (on by default), `metronome`, `pass.minStars`. It needs a saved range.
- Singing along through speakers: the microphone hears the guide. The run says so (use headphones, or turn off the guide; Listen first works without them), and Settings → Voice has an option to take the app's sound out of the microphone (the browser's echo cancellation, off by default, as it may bend the pitch it hears), to find out whether singing along works without headphones.
- Voice Unit 3 (beginner), slides and sirens: Sirens (what a siren and a slide are; the lane; slides up a third and a fifth, waiting), Slides in time (listening first: up three notes and back, then long slides), Singing along (with the guide: up and down; then holding each note steady). Voice Unit 4 (beginner), steps: Do, re, mi (steps, do as the first note wherever it falls; waiting, then listening first), Up to sol (waiting, listening first, singing along) and Step melodies (Hot Cross Buns, listening first, and the first phrase of the Ode to Joy, singing along, as in the songs' transcriptions). Every lesson starts with the warm-up; the last steps need a star to pass. New skills: slides and sirens, singing by steps.
- Follow-up (2026-10-25), a quicker guide in Wait for me: playing each note for a second before listening (about 1.6 s of silence per note, and long notes couldn't be sung with it) was too slow. Now, with the guide on, the app first plays the whole melody once at 1.5× speed (`PREVIEW_SPEED`, the lane moving with it), then the music waits at each note with the microphone listening at once; Hear it again plays the note on request (always, guide or not) and listens once it has stopped ringing. Settings → Voice › I sing with headphones (`headphones`, off by default): with the guide on, the app plays each note as it comes, for its written length, and listens while it sounds, so you can sing and hold it together with it; singing along no longer shows the headphones notice.
- Follow-up (2026-10-25), which way you lean: the results of a sung run and of Match the note say when most notes leaned the same way, flat or sharp, and by how much ("9 of 10 notes were sharp, by 35 cents on average"), with what usually helps: singing sharp often comes from pushing, singing flat from too little energy. A lean takes at least three notes sung, three in five of them 10 cents or more off the same way; notes over 100 cents off weren't aimed at and don't count (`engine/tuner.ts › pitchLean`, `ui/components/PitchLeanLine.tsx`).

**6.4 Leaps, scales and singing by ear: Voice Units 5–6** — built (the check with your voice is still to do)
- Voice Unit 5, leaps; Unit 6, the major scale, then minor.
- Ear training: "sing it back" answers for single notes, intervals and short melodies; the keyboard still answers if you choose.
- Built as: the voice gets Ear training in its sections (between Learn and the Tuner). Its levels are single notes, intervals and short melodies, placed in the saved range (`content/voiceEar.ts`, pure, tested): single notes from the range, a whole step short of each end when it's wide enough, as in Match the note; intervals up or down (a half step to a fifth, no tritone, and the octave) from within a fifth of the comfortable note, the first note shown; melodies of three to five notes along the major scale (and the natural minor too once Unit 6 is finished) whose octave sits around the comfortable note, the first note shown. Single notes open after Voice Unit 2, melodies after Unit 4, intervals after Unit 5. Without a saved range, it links to the range test.
- Singing back (`engine/singBack.ts`, pure, tested): the notes one after another, in any octave; a note is found once held in tune (±50 cents) for 0.3 s, as when a sung melody waits. Another note held steadily for 0.6 s is a wrong answer and says which note it was (once, until the voice moves on); still holding the note just found, or sliding through notes on the way, doesn't count. After two wrong answers, the note to sing lights up. The view (`ui/screens/earTraining/SingBackExercise.tsx`): a circle for each note, named once sung (or shown), how long it's been held, and the keyboard with the notes found and the note being sung. Hear it again, and Skip (shows the answer and moves on). Scored like the keyboard's: the questions sung back without a miss.
- **Answer by** Singing or Playing the keyboard (remembered, as is each course's level): the keyboard uses the same questions in the singer's range, answered on the on-screen keyboard as the piano's are. Results are the voice's own (`voiceEar:<level>`): Recent practice, Today (now suggesting the voice's ear training now and then) and a new skill, singing by ear, count them.
- Voice Unit 5 (elementary), leaps: Do, mi, sol (hearing the next note before leaping; waiting, listening first, singing along), Fourths and fifths (do up to fa and sol, then leaps down; a fifth up and steps back down, singing along) and The octave (do, mi, sol, high do and back, waiting; the first phrase of "Twinkle, Twinkle, Little Star", listening first and singing along, as in the song's transcription). Voice Unit 6 (elementary), the scales: The major scale (whole and half steps; up from do to do waiting, then up and down listening first and singing along), The minor scale (the lower third, sixth and seventh; five notes waiting, the whole natural minor scale listening first and singing along) and Major or minor (do-mi-sol in both, waiting; five notes in major then minor, listening first; both arpeggios singing along). The last steps need a star to pass. New skills: singing leaps, singing scales (and singing by ear, from ear training).

**6.5 Reading from the staff: Voice Unit 7** — built (the check with your voice is still to do)
- Voice Unit 7, reading melodies from the staff, with solfège.
- Sight-singing: the sight-reading generator's drills, in your range, sung, with solfège; levels from steps to leaps, as for the piano.
- Decided (2026-10-25), after trying both: **it follows the note names**, so the learner never has to choose. With letter note names (English's default, and German), sung sheet music starts with **do, re, mi from the key note** (movable do: do is the key note of wherever the melody was moved, ti in English), and a line under it says the whole melody was moved to fit the range and which note do is there ("here, do is G"); the English lessons speak of do-re-mi, as English courses usually do. With solfège note names (Spanish's default), do is C, so notes always show their real names (Sol, La, Si) and movable do isn't offered: the Spanish lessons speak of the key note (*la tónica*) and the scale's notes by number (1, 3, 5), Voice Units 4–6 reworded the same way ("1, 2, 3", "Hasta el quinto grado", "1, 3, 5"). An English user who picks solfège names sees the real names too (the English texts still say do-re-mi).
- Built as: `theory/solfa.ts` (pure, tested): a note's degree in the major key of its signature, and how far it's raised or lowered from the key's own note (a note outside the key keeps its letter's syllable with a ♯ or ♭); `i18n/useSolfa.ts` names it (`screens.json › solfa`). `theory/keys.ts`: a signature's key note and how it alters each letter, and `keyNoteNear`, the key note nearest the middle of a melody. A sheet notation for singing only, `syllables`: sung sheet music offers it (letter names only, `ui/screens/singing/singNotation.ts › singNotations`), note names and no names; the piano's levels and Settings are unchanged. `sing` steps take a `notation` to start with (`startNotation`: the step's, or else do, re, mi with letter names and the note names with solfège ones; a step's do, re, mi shows the note names with solfège ones).
- **Play the key note** (`ui/screens/singing/KeyNoteButton.tsx`, "Play G"): plays it for 1.5 s, in the octave nearest the middle of the melody, so a melody can be found without hearing it. Shown on a sing step when the guide melody is off (except Listen first), and always in sight-singing.
- Sight-singing (`content/sightSinging.ts`, pure, tested), its own section for the voice (`/sight-singing`, between Learn and Ear training; the piano keeps Sight-reading). It reuses the sight-reading generator (`melody`, now with the moves to use and ending on the nearer key note when the notes span an octave; the piano's drills are unchanged): four bars of 4/4 in C, G, F or D major, ending on the key note approached by step, no tritone leaps, moved into the range with `fitToRange`. Levels: **Steps over five notes** (from the key note, steps only, quarter, half and whole notes); **Leaps up to a fifth** (over an octave from the key note, or from the fifth below); **Leaps, with rests and eighth notes**. They open once Voice Unit 7 is finished. The drill is in the address (`?level=leaps&seed=123`), with New drill and Next drill as for the piano, the recent ones remembered so new ones differ (`storage/sightReading.ts › voiceLevel`, `voiceRecent`). Wait for me or Sing along (with the metronome), the guide melody off by default, sheet music starting as above (do, re, mi or the note names). Results are the voice's own (`ResultKind.VoiceDrill`): Recent practice, Today (now suggesting sight-singing now and then, tagged “Sight-singing”) and a new skill, sight-singing.
- Voice Unit 7 (elementary), reading from the staff, each lesson with the warm-up: Do on the staff (in Spanish, Grados conjuntos en el pentagrama: lines and spaces, a step from one to the next; the melody moved to the voice, maybe into another key or the bass staff; steps waiting with do, re, mi or the names under the notes, the guide on, then off with the key note to start from, then without them), Skips on the staff (line to line is a third; do-mi-sol, or 1-3-5, with them, steps and skips without them, then in time with the metronome) and Reading a melody (how to read a tune you haven't heard: hear the key note, look at its shape, keep the beat; the first phrase of “Au clair de la lune”, waiting then in time, and “Mary Had a Little Lamb”, in time, both as in the songs' transcriptions, Mary an octave up). The last steps need a star to pass. New skills: reading melodies (and sight-singing, from the drills).

**6.6 Lyrics and songs: Voice Unit 8** — built (the check with your voice is still to do)
- Score format: a lyric syllable per note, with hyphens and extensions. Lyrics are read from and written to MusicXML (`<lyric>`), and drawn under the staff and in the lane.
- Lyrics in English and Spanish for the public-domain songs: the original lyrics transcribed from public-domain sources, the translations our own, made to be sung.
- Song practice for the voice: the same songs, with lyrics, moved into your range, the piano accompaniment playing.
- Voice Unit 8, songs.
- Built as: the words are written per song and language as text, as in ABC's `w:` lines (`engine/lyrics.ts › parseLyrics`, pure, tested): spaces part words and hyphens syllables, one per note; `_` holds a syllable over the next note (a melisma, drawn with a line), `~` joins two words sung on one note (Spanish's "que‿a"), `\-` keeps a word's own hyphen ("prête-moi"), `|` checks that a syllable starts a bar and `/` ends a line. A song's JSON has `"lyrics": { "en": …, "es": … }` (and `"lyricsHand": "L"` when the left hand has the tune); loading puts each syllable on its note (`ScoreNote.lyrics`, by language) and keeps the words as lines (`Score.lyrics`), and a mistake (too many syllables, a bar that doesn't line up) names the song and language. MusicXML: written under the notes, above any note names (`scoreToMusicXml › lyrics`); a file's first line of words is read (syllabic, extend, elision) and shown in the piano's sheet music for imported songs. Built-in songs show no words on the piano.
- Nine songs have words (`content/songs › VOICE_SONG_IDS`, a test keeps them in English and Spanish): “Hot Cross Buns”, “Mary Had a Little Lamb”, “Twinkle, Twinkle, Little Star”, “Au clair de la lune”, “When the Saints Go Marching In”, “Lightly Row”, “Ode to Joy”, “Jingle Bells” (the chorus) and “Amazing Grace” (the first verse). The original words were checked (2026-10-25) against public-domain sources: Jane Taylor's “The Star” (1806); Hale's 1830 poem and the song form with its repeats (Wikipedia); the street-cry “Hot Cross Buns”; the traditional “Saints” (CPDL); Mason and Webb's “Lightly Row” (1854); Schiller's “An die Freude” as Beethoven set it; the chorus of “Jingle Bells” as sung since at least 1898 (without the pickup “Oh!”, which the arrangement doesn't have); Newton's “Amazing Grace” (1779, “sav'd” spelled “saved”). “Au clair de la lune” and “Ode to Joy” also keep their French and German words. The translations are our own, made to fit each note and its accent: English ones for the French and German songs, Spanish for all (with the Spanish titles in mind: “María…”, “A la luz de luna”, “Himno a la alegría”, “Sublime gracia”). “Brahms' Lullaby” has none yet: lining its German words up with the arrangement's notes needs a public-domain score that has them, to check against. Aura Lee, Greensleeves and Scarborough Fair could follow.
- The language of the words follows the app's (Settings stores a choice, `lyricsLanguage`): a **Words** menu on the song page and on a lesson's song steps, when a song has more than one, names each language in its own (English, Español, Français).
- Song practice for the voice (`/songs` with the voice course, now in its sidebar; each song at `/sing/<id>`, `ui/screens/singing/VoiceSongScreen.tsx`): the songs with words, easiest first, always open, with their stars (`ResultKind.VoiceSong`, in Recent practice; Today suggests them once a Voice Unit 8 lesson is done). Sing along (the default) or Wait for me; the lane or sheet music, the words under the notes; the guide melody on; **Piano**: the song's other notes play along, softer (velocity 0.45), moved into the melody's new key but kept within half an octave of where they're written (`moveAccompaniment`), so a lower voice doesn't drag the bass down into a rumble; the metronome off, the piano keeping time. Through speakers, a notice asks for headphones, or to turn off the piano and the guide. The words are written out under the music, a line at a time.
- Sing steps can take a song (`"song": "amazing-grace"`, and a `tempo`): its melody with its words, and the piano part playing along (a **Piano** checkbox).
- Voice Unit 8 (elementary), songs with words, each lesson with the warm-up: Words on the notes (one syllable per note, a hyphen going on to the next; “Hot Cross Buns” waiting, then along with the piano, and “Au clair de la lune” from Unit 7), Phrases and breaths (a line of the words is a phrase on one breath, breathing where it ends; “Twinkle, Twinkle” and “Ode to Joy”) and One syllable, two notes (melismas; “Amazing Grace” waiting, on the staff, then along). The last steps need a star to pass. New skill: singing songs.

The app's name is **Music Teacher**, now that it teaches singing too, in everything: the database, the desktop app's folder, `app://` address and app id, and the backup format. The renamed database starts empty, so progress moves over with an exported file (Settings → Import / Export); files exported as Piano Teacher still import.

- [ ] TODO (user): uninstall the old Piano Teacher desktop app, install the next build and import your exported file: there should be one app, called Music Teacher, with your progress.

#### Phase 6 done when
- [x] Singing a note shows which note it is and how far off, reliably, with your microphone (the Tuner, verified 2026-10-22).
- [x] Piano and voice each have their own course and progress, behind one switch (6.2).
- [x] Singing exercises are graded for pitch and timing, waiting and singing along (6.3).
- [ ] Exercises and songs fit the singer's range.
- [ ] Ear training and sight-reading can be answered by singing.
  - [x] Ear training (6.4).
  - [x] Sight-reading (6.5).
- [x] Songs show and keep their lyrics, in English and Spanish (6.6).
- [x] A singing course from one note to songs (Voice Units 1–8), in English and Spanish (6.6).
- [ ] Verified with your voice and microphone.
  - [ ] TODO (user): sing a run of **Match the note** (Tuner page): are notes matched when in tune and not when off, is six seconds enough, do Higher and Lower point the right way? Then save a recording into `fixtures/voice/`.
  - [ ] TODO (user): go through Voice Unit 2: does the warm-up's pattern sit well in your voice (start, top, speed, time to sing back), and are the match steps' notes about right for each lesson?
  - [ ] TODO (user): go through Voice Units 3–4 with headphones: do the lane and the line of your voice follow your singing without lag, are notes graded fairly (in tune, on time, steady), and are the melodies moved to a comfortable place in your voice?
  - [ ] TODO (user): Wait for me with the guide on (Voice Unit 3 › Sirens): is the quick preview at 1.5× easy to follow, and is the wait at each note short enough now? Then turn on Settings → Voice › I sing with headphones and try it with headphones: can you start singing as each note sounds, and hold it with the guide?
  - [ ] TODO (user): go through Voice Units 5–6 with headphones: do the leaps land fairly (the octave in particular, moved into your range), and do the major and minor scales sit well in your voice?
  - [ ] TODO (user): go through Voice Unit 7 with headphones, then try **Sight-singing** at each level: is hearing the key note enough to find the first note, do do, re, mi (in English) and the note names (in Spanish) help, and are the drills singable (the leaps of a fifth in particular)? Then read Voice Units 4–6 in Spanish, which now speak of la tónica and the notes by number (1, 3, 5): is it clear?
  - [ ] TODO (user): try **Ear training** with the voice, singing back single notes, intervals and melodies: are notes found when sung in tune, are wrong notes caught without counting slides or the note still held, and is 0.6 s right before a wrong note counts?
  - [ ] TODO (user): go through Voice Unit 8 with headphones, then a few songs in Song practice: do the words line up with the notes in the lane and on the staff, is the piano's part a help at a comfortable volume (and in a good register, after the melody moves to your voice), and are the held syllables of “Amazing Grace” clear? Then read the Spanish words of each song aloud and sung: do they sound natural and fall on the right beats (in particular “Oh, al llegar los santos ya” and “Sublime gracia”)? And try the piano through speakers: does the microphone mistake it for your voice?
  - [ ] TODO (user): sing along with the guide melody through speakers, with Settings → Voice › Take the app’s sound out of the microphone off, then on: does the app grade its own sound as your singing, and does echo cancellation fix that without bending your pitch? Then decide whether singing along asks for headphones.

---

### Phase 7 — Music theory

**Goal:** understand why the music works: intervals, keys, chords, harmony, meter and form. A course of its own, answered by playing or singing, that connects with the piano and voice lessons and with your songs.

#### Scope

A third course beside Piano and Voice, behind the same switch. The lessons already teach the theory each piece needs: chords and I, IV and V in Unit 6, relative minors in Unit 12, 6/8 and repeats in Unit 13, do, re, mi and scales in Voice Units 4–6. What's missing is what ties it together (the tonic and the dominant as ideas, cadences, the circle of fifths, seventh chords, transposing) and one place to find and review it. It's one course rather than theory inside each, because pianists and singers need the same theory.

- **It never blocks.** Nothing in the piano and voice courses depends on it, and anyone can start it. A lesson you've already played only shortens what theory explains.
- **Mostly doing.** Answers are played or sung wherever they can be, with no more than two explanations in a row.
- **As far as the app's music goes.** Up to seventh chords and the forms of the songs in the app: no part writing, counterpoint or jazz harmony.

Eight units of about three lessons each, in the same levels as the other courses:

| Unit | Topic | Builds on |
|---|---|---|
| 1 | **Intervals** — half and whole steps, naming intervals by number and quality, hearing them | Voice Units 4–5, Unit 8 |
| 2 | **Scales and keys** — the major pattern, the tonic, scale degrees, why a melody feels at home, minor | Unit 7, Voice Units 4 and 6 |
| 3 | **Key signatures** — the order of sharps and flats, the circle of fifths, relative minors, transposing | Units 8 and 12 |
| 4 | **Chords** — triads and their qualities, inversions, seventh chords | Unit 6 |
| 5 | **Harmony** — I, IV and V, Roman numerals, the dominant's pull, cadences | Unit 6 |
| 6 | **Meter** — time signatures, strong and weak beats, simple and compound time, syncopation | Units 2 and 13 |
| 7 | **Form** — phrases, repeats, sections, verse and chorus | Unit 13, Voice Unit 8 |
| 8 | **Reading a song** — the key, chords, cadences and form of songs you know | Song practice (7.4) |

**7.1 The Theory course: Unit 1, Intervals** — built (the check with your piano and voice is still to do)
- `Course.Theory`, its units in `content/theoryCourse.json`, its lessons `t1-l1` and so on. The switch lists all three ("Music Teacher / Theory / Learn / Unit 1 · Intervals"). Separate, as for the voice: units, progress, stars, skills, reviews and the Today plan (`today:theory`). Shared: the calendar and streak, settings and note names. Its skills are a new Theory area of their own, so piano and voice mastery don't change.
- Its sections are Home, Learn and Settings. Ear training stays with Piano and Voice, and lessons link there (7.2). The welcome screen doesn't change: Theory is added from the switch.
- **Play or sing:** a setting with those two choices, on the course's Learn page and in a lesson. It starts as the course you came from, the piano if you've used both. Playing works with MIDI, the microphone or the on-screen keyboard, so the course needs no instrument. Singing uses the microphone and needs a saved range, as in the voice course.
- Two new lesson step types, both graded, counted in a lesson's stars and kept in its history:
  - `question`: cards with a choice of answers, like a note quiz. They're generated by `engine/theoryQuestions.ts` (pure, tested) by kind and level, shown on the staff or the keyboard, or played. Stars come from those right the first time.
  - `build`: "Find a major third above D". Playing: the keys in any octave, together or in turn as the step says. Singing: one note at a time, matched as in 6.1 (±50 cents, any octave). One step, written once, for both.
- Intervals spelled properly in `theory/` (a major third above D is F♯, above E♭ it's G), since quiz answers are written notes. Grading stays by MIDI number.
- Unit 1 in English and Spanish, with new terms in `locales/glossary.md` and `theory.json`.
- Built as: `theory/intervals.ts` (`intervalAbove`, spelled from the letters an interval spans, and `numberAbove`, the note a number lands on without sharps or flats) and `engine/theoryQuestions.ts`, three kinds of question (a half or whole step, an interval's number, its full name). A step lists its answers and the notes it starts from (`answers`, `roots`), and the parser checks every pairing can be spelled. Half and whole steps use the default spelling, so C to C♯ reads as in Unit 8. `quizCards` became `deal`, for dealing anything evenly. A question offers up to four answers, smallest first; `keysFor` keeps the keyboard in place between cards.
- `theoryAnswer` is null until Theory is first opened, when `chooseCourse` sets it from the course you came from; `sings(settings)` then decides what the app listens to (the voice course, or Theory by singing). `ui/components/AnswerChoice.tsx` is the choice, on Learn and in a lesson. `ui/quiz/QuestionQuiz.tsx` and `BuildQuiz.tsx` are the two steps, and `QuizResults.tsx` is shared with the note quiz. Singing reuses `MatchTheNote` with a `clue` for each note: what's played and said instead of the note and its name, with the tuner's needle but not its line, which would name the note.
- `build` asks for single notes for now: keys together or in turn come with the chords (7.3). When singing, an octave isn't asked: any octave counts, so the note given would match it. Theory's Today plan has its lessons and reviews.
- Unit 1 (beginner): Half and whole steps, Counting intervals, Major, minor and perfect, and Hearing intervals, which recalls intervals from the openings of “Amazing Grace”, “When the Saints Go Marching In” and “Twinkle, Twinkle, Little Star” (checked against the song files). New skills: half and whole steps, counting intervals, major, minor and perfect intervals, hearing intervals.
- **Every scored step asks for a star:** a lesson earns its weakest step's stars, but a step with no pass rule let you go on with none, so a lesson could say "Lesson complete!" and stay not done (found trying Unit 1: 8 Theory steps and 24 Voice steps had no rule, while every Piano step did). `pass.minStars` is now 1 to 3, and 1 by default. Earlier tries are judged by what the step asks for now, so a lesson left this way reopens at the step with no stars. The only way to end with none is to skip a step, and that screen now says "Lesson not complete yet".

**7.2 Links between the courses**
- Theory lessons list the lessons they build on (`builds` in `theoryCourse.json`), so the piano and voice course files don't change. The links back are worked out from that, and a test checks that every lesson named exists.
- **Recap:** an explanation marked `recap` shrinks to one line ("You met this in Unit 6 · Major chords") once a lesson it builds on is finished, and opens to read in full. Graded steps stay.
- **Why does this work?** A piano or voice lesson's finished screen links to its theory lesson. It's only a link: Enter still goes on to the next lesson.
- **Try it:** a theory lesson's finished screen offers the lessons it builds on and a song or ear training level, only those already open in that course.
- **The way back:** opening a lesson switches to its course, so a theory lesson reached from Piano or Voice ends with Back to that lesson or Today, on Enter.

**7.3 Theory Units 2–5**
- The units above, in English and Spanish, with the `question` kinds each needs: scale degrees, key signatures, the circle of fifths, chord qualities, inversions, Roman numerals and cadences.
- `build` steps can ask for the same shape in a key chosen at random, so a review isn't the same as the first time.

**7.4 Theory in your songs**
- A song's analysis as data, in its file: the key, a chord for each bar or beat as a degree (`V7`, its name worked out from the key), cadences and sections. Written by hand, not computed: `identifyChord` can't be trusted with melodies, broken chords and passing notes, and a lesson mustn't teach a wrong answer. A test checks each chord against the notes in its bar.
- A handful to start with (about six built-in songs used in lessons). Imported songs aren't part of this phase.
- On the sheet music, a **Harmony** toggle shows them above the bars, placed like the loop's shading. Moved to a singer's range, the degrees stay and the chord names move with the key.

**7.5 Theory Units 6–8, and Today**
- The remaining units, in English and Spanish. Unit 8's lessons open songs with the analysis on, and ask about them.
- Once Theory is started, the Piano and Voice Today plans add one short theory item: a review that's due, or the next lesson. It's the one place the courses mix, and it counts in the day's total.

#### Phase 7 done when
- [x] Theory is a third course behind the switch, with its own progress, and nothing in Piano or Voice depends on it (7.1).
- [x] Theory lessons can be answered by playing or singing, from one set of steps (7.1).
- [ ] Theory and the other courses link both ways, and what you've played shortens what's explained (7.2).
- [ ] A theory course from intervals to reading a song (Theory Units 1–8), in English and Spanish (7.1, 7.3, 7.5).
- [ ] Songs can show their chords, cadences and sections on the sheet music (7.4).
- [ ] Today can offer a theory item alongside Piano or Voice (7.5).
- [ ] Verified with your piano and voice.
  - [ ] TODO (user): go through Theory Unit 1 playing, then singing: are the questions clear, are answers graded fairly either way, and is six seconds enough to work out a note before singing it?
  - [ ] TODO (user): read the Spanish of the theory units: do the terms sound the way a teacher would say them?

---

### Between phases

**Lesson step history** — ✔ done
- Every finished try of a lesson's exercises, note quizzes and rhythm steps is kept (`stepRuns` table, database version 6, in backups; keyed `lesson:<id>:<step>`, so new steps are appended to lessons, never inserted, to keep each step's history). Until then only a lesson's overall best was saved, so histories start from this change.
- Each graded step shows a line under the step dots: the best try and the last (with its date when it wasn't today), the last five as small bars (height = accuracy, color = stars, oldest first), and "N tries", which opens every try with its date, newest first.

**Skipping a step done before** — ✔ done
- A lesson step passed on an earlier visit counts when skipped: its dot shows as done, it offers Continue rather than Skip, and its best try counts in the lesson's stars (before, a skipped step scored zero, so replaying a lesson and skipping one step ended with no stars and set its review sooner). Tries keep whether they passed the step, and finding the keys counts as a try too. For a lesson finished before tries were kept, its own best stands in for the steps not tried since (steps added to it later count as done as well).

**Opening a lesson where it was left** — built
- Explanations and warm-ups read on an earlier visit show as done in the step dots: a lesson finished before has read them all, and one left halfway has read those before a step that was tried. Moving on from one counts as reading it. (Before, only graded steps counted, so going back in Sirens left the explanation after the current step dark although every step was done.)
- A lesson started before opens at its first step not done; a lesson not started, or done throughout, opens at the beginning. A voice lesson opens on its warm-up, and Continue there jumps to that step. Back still goes through every step. The lesson's earlier tries load with it, so it knows where to open (`content/lessons/result.ts › earlierDone`, `resumeAt`).

**Metronome fixes** — ✔ done
- The first click of a count-in sounds: a run now starts a quarter of a second before it, so it's scheduled ahead like the others (before, it was due the instant playback started, already late for the speakers, and skipped). Clicks only as late as the output delay still play; only truly late ones (a throttled background tab) are dropped.
- "Wait for me" with the metronome on counts in a measure first, as when playing along, and clicks up to where the music waits: the click on the waiting note's beat says when it's due. Nothing clicks during the wait, and that beat isn't clicked again when the music goes on.

**Top bar and sidebar** — ✔ done (verified 2026-10-18 in the browser)
- The app’s icon sits before its name in the top bar and in the browser tab: the desktop app’s icon redrawn as an SVG (`public/icon.svg`).
- The sections moved from the top bar to a sidebar on the left: Home, Learn, Song practice, Sight-reading, Ear training and Free play, with Settings at the bottom, each with a line icon (Tabler Icons, `@tabler/icons-react`, MIT). The top bar keeps ☰, the icon and name, where you are ("Music Teacher / Song practice": a lesson is part of Learn, a song’s practice and imported songs part of Song practice; `ui/sections.ts`), and the input picker. It stays at the top while the page scrolls.
- ☰ shrinks the sidebar to its icons (names on hover) and back, remembered (`sidebarCollapsed` setting). Below 760 px wide there’s no sidebar: ☰ slides it over the page, and choosing a section, Esc or a click outside closes it; the top bar shows just where you are, and the input picker only its dot (the same choices open from it).
- After the section, the page adds what’s on it: the lesson ("Learn / Unit 9 · Staccato"), the song or imported song ("Song practice / Can-Can"), "Import a song", the sight-reading or ear-training level. The section then leads back to its page. Pages set it with `useTopBarDetail` (`ui/topBar.ts`), and the browser tab’s title follows ("Staccato · Music Teacher"); a narrow window shows only the detail.

**Late clicks with Bluetooth** — ✔ done (verified 2026-10-18 on the Casio with Bluetooth headphones)
- Bluetooth headphones and speakers play sound 150–250 ms late, and browsers can’t tell, so the clicks come after the beat and notes played with them look late (or, past the window, wrong). After a run with the metronome on, when most notes came in late by a similar amount (the middle one at least 60 ms late, two in three at least 30 ms; `engine/timing.ts › steadyLatenessMs`), the results say so, with a link to measure the timing.
- The timing correction is kept for each sound output, by its name (`soundTimings` setting), and followed when sound moves to another, so switching between headphones and speakers needs no new measurement. While the metronome is on, sound going to an output not measured yet (when another was) gets a notice. Browsers name the outputs once the microphone has been allowed; the desktop app always does (`audio/output.ts`).
- Settings → Sound and timing names Bluetooth, and shows where sound goes and whether it was measured for it; the notices link straight to it (`/settings#sound`).

**Metronome in exercises** — ✔ done (verified 2026-10-18 in the browser)
- Settings → Sound and timing → **Metronome in exercises**: Automatic (as before: on when playing along, and when a lesson asks for it), Always on, or Always off. It sets how every exercise starts (lesson exercises and rhythm steps, song practice, sight-reading drills, and switching modes there); the checkbox on each still switches it for the moment. Stored as `exerciseMetronome` (`ui/metronomeChoice.ts`).

**Vocal range** — ✔ done (verified 2026-10-19 with your voice and microphone)
- The first piece of singing (IDEAS.md › Singing), on its own: Settings → **Your vocal range**. Three steps with the microphone: a comfortable note (moves on by itself once held), then sliding down and up, each ended with a button (“That’s my lowest”, “That’s my highest”). A note counts when it’s held for half a second (gaps up to 150 ms allowed), from the microphone’s existing pitch readings; no new voice detection yet.
- The result: the lowest and highest notes, the span, a keyboard (E2–C6) with the range and the comfortable note, and the closest voice type, as a guide. Only the latest is kept, with its date (`vocalRange` setting). The test turns the microphone on for itself, without changing the input setting, and off again if it was off.
- Built as `engine/vocalRange.ts` (the held note and voice types; pure, tested) and `ui/screens/settings/VoiceSettings.tsx`.

**Settings index** — built
- Settings’ eleven cards are grouped (Keyboard and microphone; Sound and voice; Look and language; Your data, whose card is now named “Import / Export”), with an index beside them: it follows the scroll, highlighting the card under the top bar, and a click jumps to a card. Below 1000 px wide it becomes a “Jump to” menu that stays at the top. Cards showing nothing (the microphone check without a microphone and MIDI) are left out of both. Computer keyboard moved up into the first group.
- Each card keeps its place at an address (`/settings#sound`, `#voice`, …). There’s room after the last card, so every card can scroll up to the top bar.

**Page indexes** — built
- The Settings index became a shared `IndexedPage` (`ui/components/IndexedPage.tsx`), used by every page with several sections: Settings; Home (Today, Practice in the last year, Skills, Recent practice); Learn (Up next, then each level’s units); Song practice (My songs first, as it grows with every import, then each unit with songs, by level). My songs also gets a filter (by title or composer, ignoring case and accents) and a list that scrolls past ten songs, each shown with its composer after a dash. Pages with one focus (sight-reading, ear training, free play, a lesson, a song) have none.
- The same behavior everywhere: the highlight follows the scroll, a click jumps (a folded unit on Learn opens, and any other opened one folds back, so at most one is open), long names show whole on hover, sections showing nothing are left out, and a link to a section (`#id`) shows it. Below 1000 px wide, a “Jump to” menu. The room after the content is measured, so the last section too can scroll up to the top bar.

**Voice tuner** — ✔ done (verified 2026-10-22 with your voice and microphone)
- The second piece of singing (IDEAS.md › Singing, S.1), on its own page: **Tuner**, in the sidebar after Free play. Sing anything: the note (with its octave) and how far off in cents, averaged over the last 4 readings (about a sixth of a second); a needle with the in-tune zone (±25 cents, as planned for singing exercises); the last 5 seconds as a line over the semitones around the note, breaking where nothing was heard; and the saved vocal range on a keyboard, with the note sung.
- The page keeps the furthest notes held steadily (half a second, as in the range test) beyond the saved range since it was opened (“New high: F4”, “New low: E2”), offering **Add to my range** until it’s pressed: one press adds both; without a saved range, the page links to the range test. Like the range test, the page turns the microphone on for itself and off again if it was off, leaving the input setting alone.
- Built as `engine/tuner.ts` (the averaged note and the in-tune rule; pure, tested) and `ui/screens/TunerScreen.tsx`.

**Reading the sheet ahead** — ✔ done (verified 2026-10-22 in the browser)
- The sheet music kept snapping back to its cursor before a run started: the playback position sits a little before the first note (where the count-in begins), so every frame reset the cursor and scrolled to it. Now a cursor already at the start doesn’t count as moving, so the sheet can be scrolled to read the whole piece before starting, or while paused; when the music starts, it comes back to the cursor, and it follows the music while playing as before.

**Home: the year first, and skills as bars** — built
- “Practice in the last year” moved to the top of Home (and of its index).
- Home fits the year, Today and the course on one laptop screen: Today shows one line per suggestion (its kind as a tag, the title, the reason), the whole row a link; the “Let’s Go!” button is gone, and the title “Progress” became a greeting (“Welcome back!”, or “Welcome!” before any practice); the five number boxes became one “Your course” line (level and unit, lessons, stars, and a bar for lessons completed), with the streak joining the year card (“3 days in a row (best: 5)”) next to the time practiced.
- Skills show as bars in four areas: Keys and hands, Rhythm, Reading, Musicianship (`content/skills.ts › SKILL_AREAS`; a test keeps every skill in exactly one area). Within an area, skills keep the course’s order. Each bar is as long as the skill’s mastery, in one accent color, darker for Learning, Good and Mastered, with thin marks at the 1, 2 and 3-star levels (60, 80, 95%), labeled ★, ★★, ★★★ once above the bars (each showing its percentage on hover); a skill not started has an empty bar and “—”. A legend explains the shades; the level and lessons played show on hover and to screen readers.

**Microphone and speakers** — built (the check on your devices is still to do)
- Settings → Sound and voice → **Microphone and speakers**, the first card of the group: which microphone the app listens to and which output it plays through, each “System default” or a device by name, for the piano and for singing alike. The piano’s Microphone card picks the microphone from the same choice.
- Browsers name devices only once the microphone is allowed; until then the card offers **Show device names** (asks for the microphone once, without listening). A chosen device that isn’t connected is kept, shown as “Your choice (not connected)”, and the default is used until it’s back: the microphone falls back when it can’t be opened, sound when the output isn’t listed.
- Built as: `micDeviceId` (already saved) and a new `soundOutputId` setting. `audio/output.ts` lists the devices to choose from (`devicesToChoose`, without the browser’s “default” and “communications” stand-ins), works out where sound goes (`outputDeviceIdOf`) and names it, so the click timing measured per output follows the choice; `audio.ts › setSoundOutputDevice` moves the app’s audio context there (`AudioContext.setSinkId`), and a singing run’s recording plays through it too. Firefox and Safari can’t choose an output, so the card says so. The desktop app also allows `speaker-selection`. Fixed on the way: with Windows’ communications device the same as the default, the output was named “Communications - …”, so its timing wasn’t found.
- [ ] TODO (user): in the desktop app and in Chrome, pick another microphone (e.g. a USB one or the webcam’s) and check that the Tuner and a singing run hear it; then pick Bluetooth headphones while the speakers stay the system default, and check that the metronome, the piano, the guide melody and Listen on a run’s results all play through them. Unplug the chosen device: does the app fall back to the default, and come back to it when plugged in again?

**What raises a skill** — built
- Juan (2026-10-25): from Home › Skills, know which lessons to play, finish or play better to raise a skill. Three mockups shown first (an opening row, a "Next" line per skill, a side panel); he picked the opening row.
- A skill's name opens it under its bar (one at a time; ▸ turns to ▾). It lists the skill's lessons open now, those that add most first: a tag (Not played, To improve, 3 stars), the title and unit, the best stars and accuracy, what 3 stars in it would add to the skill (“up to +5%”), and Start or Redo. A line above says what reaches the next level: “To reach Good, get 3 stars in the first 2 lessons below” (those in bold), or, when the lessons open now aren't enough, how much they add and that later units are needed too; a mastered skill says to replay now and then. Lessons in units not open yet are summed up below (“1 more lesson for this skill in Unit 8”). Skills practiced by exercises of their own (sight-reading, ear training, singing by ear, sight-singing) say their last 10 exercises count, with a Practice button to their page.
- Built as `content/skills.ts › skillPlan` (pure, tested: a lesson adds what it's short of 95% over the lessons and exercises counted; `SkillProgress` now also says how many exercises it counted) and `ui/screens/SkillPlanPanel.tsx`. The mastery itself is unchanged: lessons in later units still count as 0%, so most skills can't reach Good early on (offered to count only the lessons open so far; not decided).

### Future ideas (unscheduled)

- Backing tracks / accompaniment for songs.
- More languages, including right-to-left ones; movable-do solfège option.

---

## 12. Testing strategy

| Layer | Approach |
|---|---|
| Pitch parsing | Round-trip `parseNote` ↔ `formatNote` for all spellings; MIDI numbers for every note A0–C8; enharmonics (`C#4`/`Db4` → 61); octave edge cases (`B#3` → 60, `Cb4` → 59); rejection of invalid strings |
| Theory / Score model / loaders | Unit tests (Vitest) with small fixtures; a test that loads every lesson file so invalid note strings fail CI |
| Matcher & scorer | Unit tests with scripted `NoteEvent` sequences (on time, early, late, wrong, extra, chords) |
| Mic detection | Recorded WAV fixtures of the Casio (single notes, repeated notes, chords) with known ground truth; accuracy reported as a test metric |
| MIDI ↔ mic agreement | Manual/semi-automated sessions: play with MIDI and mic active at once, compare streams |
| UI flows | Playwright smoke tests using the dev input (start lesson → play → see results) |
| Localization | Lint rule for hard-coded strings; key-parity script across languages; ICU message syntax validation; unit tests for every naming system (all 12 pitch classes, accidentals, octaves); Playwright smoke run in each language and the pseudo-locale |

---

## 13. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Mic accuracy (octave errors, room noise, harmonics) | Stabilizer, calibration, expected-note-guided verification, wider timing windows; MIDI remains the reference |
| Mic latency varies by device | Tap-along latency calibration, stored per input device |
| App audio bleeding into the mic | Headphone recommendation; suppress detection during demo playback |
| Browser under-reports audio output delay | Tap-along timing correction for clicks (Settings → Sound and timing) |
| Windows MIDI exclusive access | Clear error message: "device busy — close other MIDI apps" |
| Web MIDI browser support | Target Chrome/Edge; show a notice on unsupported browsers |
| Sheet music cursor sync complexity (OSMD) | Spike early in Phase 2; fall back to rendering from the internal Score model if needed |
| Content creation effort | JSON format + reusable MusicXML; author lessons incrementally per unit |
| Copyright | Public-domain and original material only |
| Octave-numbering confusion (middle C as C3 vs C4) | One canonical convention (C4 = 60) documented in §4; parser tests pin it down |
| Enharmonic bugs (C♯ ≠ D♭ in comparisons) | Matching and arithmetic use MIDI numbers only; spelling is display-only |
| Translation effort grows with every lesson | Lesson text kept short; per-lesson translation files; key-parity check flags missing translations; English fallback so nothing breaks |
| Inconsistent music terminology across languages | `locales/glossary.md` with approved terms per language |
| Longer translations breaking layouts | Pseudo-locale testing; flexible layouts, no fixed-width text containers |

---

## 14. How to run

In the browser:

```bash
npm install
npm run dev
```

Open the printed `localhost` URL in Chrome or Edge, connect the Casio via USB, and allow MIDI (and microphone, if used) when prompted.

As a desktop app: `npm run desktop` opens it in its own window; `npm run desktop:dist` builds the Windows installer into `release/`. The app and the browser keep separate data; move it with Settings → Your data.
