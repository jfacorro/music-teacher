# Piano Teacher — Project Plan

A local piano-learning app in the spirit of Simply Piano: guided lessons and exercises that **listen to what you play** (via MIDI or microphone) and give real-time feedback. Runs entirely on your machine, no accounts, no cloud.

---

## 1. Goals

- Teach piano from zero, with a faster ramp for someone who already knows some music theory.
- Listen to the player and grade in real time: right/wrong notes, timing, (later) dynamics.
- Start with simplified "falling notes" notation and progressively transition to real sheet music.
- Run locally in the browser; optionally package as a desktop app later.
- Lesson content is **data**, not code, so new lessons and songs are easy to add.
- **All user-facing text is localized** — UI, lesson content, feedback, song titles, music terminology (including note-naming systems like C D E vs Do Re Mi).

### Non-goals (for now)

- Accounts, cloud sync, multiplayer, monetization.
- Copyrighted song catalog — only public-domain / self-authored content.
- Mobile support.

---

## 2. Decisions made

| Topic | Decision |
|---|---|
| Primary hardware | Casio CDP-S110 BK — 88 keys, USB-MIDI (class compliant, no driver), velocity sensitive, built-in speakers |
| Input methods | **MIDI** (primary) **and microphone** (single notes in MVP, chords in Phase 3) |
| Notation | Both: falling notes first, then sheet music with gradual transition |
| Learner level | Piano beginner with some prior music experience |
| Platform | Local web app on `localhost`, Chrome/Edge (Web MIDI support) |
| Desktop packaging | Optional, later (Electron — same Chromium, near drop-in; Tauri as a lighter alternative) |
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
| Polyphonic detection (Phase 3) | Template matching against expected notes (FFT/chroma); `@spotify/basic-pitch` (TF.js) for open transcription |
| Audio output (demos, metronome) | Tone.js + Salamander piano samples |
| MIDI file parsing | `@tonejs/midi` |
| Sheet music rendering (Phase 2) | OpenSheetMusicDisplay (MusicXML) |
| Falling notes / keyboard | HTML Canvas (custom renderer) |
| Localization | i18next + react-i18next with ICU message format (`i18next-icu`) for plurals/gender; `Intl.*` APIs for numbers, dates, durations, percentages |
| i18n tooling | `eslint-plugin-i18next` (no hard-coded strings), key-parity check script, pseudo-locale for testing |
| Tests | Vitest (unit), Playwright (smoke/E2E) |
| Desktop wrapper (Phase 3, optional) | Electron |

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
    loaders/            MusicXML + MIDI → Score converters
  audio/                Tone.js sampler, metronome, demo playback
  i18n/
    index.ts            i18next setup, language detection, fallback
    naming.ts           note-naming systems (English letters, German, fixed-do solfège)
    format.ts           Intl helpers (percent, duration, dates)
  ui/
    components/         Keyboard, FallingNotes, SheetMusic, FeedbackBadge, ...
    screens/            Home, LessonPlayer, Results, FreePlay, Progress, Settings
  storage/              Dexie DB, progress + settings repositories
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

### 5.3 Microphone — chords (Phase 3)

- **Guided verification (lessons):** we know what notes are expected, so compute the energy at each expected note's fundamental + harmonics (FFT / chroma) and decide whether the chord was played. Robust and cheap.
- **Open transcription (free play, song import):** Spotify Basic Pitch model via TF.js running locally.

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

Step types (growing over phases): `explain`, `exercise`, `quiz` (note naming), `rhythm` (tap along), `demo` (app plays, user listens).

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

1. **Home / Learning path** — course map with units and lessons, lock/unlock state, stars earned, "continue" button.
2. **Lesson player** — the core screen:
   - Top: falling notes **or** sheet music (toggle).
   - Bottom: on-screen keyboard (zoomed to the lesson range; full 88 keys available), lighting expected keys and showing played keys.
   - Live feedback: green/red notes, timing badges (early / perfect / late), streak counter.
   - Controls: play/pause, restart, mode, tempo, hand selection, loop (Phase 2), view toggle.
   - Indicator showing active input (MIDI / mic) and connection status.
3. **Results** — accuracy, timing breakdown, stars, per-measure heatmap, "retry" / "practice weak spots" / "next".
4. **Free play** — shows notes played (names on keys and staff), identifies chords; note-naming quiz.
5. **Progress** — streak, practice time per day, lessons completed, skill mastery.
6. **Settings** — **language**, **note-naming system** (English / German / solfège), input source (MIDI / Mic / Auto), MIDI device picker, mic picker + level meter + calibration, latency offset, note labels on/off, metronome volume, theme.
7. **First launch** — pick language and note-naming system, then connect an input.

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
| — | **Songs** — public-domain pieces interleaved at each level | all |

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
- [ ] All Unit 1–2 lessons are playable in wait and tempo modes, with either input.
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
- Play/pause (▶ ⏸) and start over (↻) are icon buttons; the views are emoji-only toggles (🎹 falling notes, 🎼 sheet music) and the hands are three icon buttons instead of a dropdown (🫲 left · 🙌 both · 🫱 right). Every button around the exercises has a tooltip saying what it does, with its key where it has one ("Play (Space)").
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

**Goal:** full two-handed playing, chords (including via mic), bring-your-own songs, and optional desktop packaging.

#### Scope

**3.1 Polyphonic mic detection**
- Guided chord verification: FFT/chroma energy at expected pitches + harmonics; threshold tuned by calibration.
- Basic Pitch (TF.js) for open transcription in free play and imported songs; runs in a Web Worker.
- Free play chord identification works with the mic.
- ✅ *Checkpoint: compare mic chord detection against MIDI ground truth on the Casio.*

**3.2 Song import**
- Import `.mid` and `.musicxml` / `.mxl` files from disk.
- Track/staff → hand assignment UI; transpose; tempo override.
- Imported songs stored in IndexedDB and shown in a "My songs" library.
- Imported song titles are kept as-is (user content, not translated); all import UI is localized.

**3.3 Dynamics (MIDI only)**
- Use velocity for `p` / `f` / crescendo exercises; dynamics shown in results.
- Sustain pedal (CC64) support and display.

**3.4 Content: Units 5–7**
- Hands together: parallel and contrary motion, melody + single bass notes, then melody + simple chords.
- Chords: major/minor triads, inversions, I–IV–V–I, common accompaniment patterns (block, broken, Alberti).
- Scales: C, G, F major with thumb-under fingering.
- More songs combining both hands.
- All new text translated; chord-quality and scale names added to `theory.json` and the glossary.

**3.5 Desktop packaging (optional)**
- Electron wrapper: load the built app, grant MIDI/mic permissions automatically, store data in the app profile.
- Native menus, window title and installer text localized.
- Windows installer via electron-builder.

#### Phase 3 done when
- [ ] Two-handed lessons grade both hands independently.
- [ ] Mic mode can verify triads in lessons.
- [ ] A user-provided MIDI/MusicXML file can be imported and practiced.
- [ ] Chord names (e.g. C major / Do mayor / C-Dur) display correctly in every language and naming system.
- [ ] (Optional) App runs as a standalone Windows desktop app.

---

### Future ideas (unscheduled)

- Backing tracks / accompaniment for songs.
- Generated sight-reading exercises at the user's level.
- Record & play back performances; compare with the reference.
- Ear training (play back what you hear).
- Spaced-repetition review of weak skills.
- Theme/appearance options, keyboard size options.
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

## 14. How to run (once built)

```bash
npm install
npm run dev
```

Open the printed `localhost` URL in Chrome or Edge, connect the Casio via USB, and allow MIDI (and microphone, if used) when prompted.
