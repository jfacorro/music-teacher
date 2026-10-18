# Ideas

Larger ideas, worked out enough to plan from later. None is scheduled: an idea becomes a phase in [PLAN.md](PLAN.md) once it's chosen.

---

## Singing

**Goal:** learn to sing in tune and in time the way the app teaches the piano. Lessons listen through the microphone and give feedback, from matching a single note to singing songs with lyrics and reading melodies from the staff.

### What carries over

- **The microphone:** a pitch reading every ~11 ms (McLeod pitch method via `pitchy`, `input/mic/detector.ts`), with how many cents it is off the nearest note. Calibration of background noise, sensitivity and delay works for a voice too.
- **The music:** the score format, sheet music, falling notes, solfège note names, and transposition (as for imported songs).
- **Practice:** wait, play-along and autoplay modes, the metronome, and the app playing the melody or an accompaniment.
- **The rest:** ear training, the sight-reading generator, recordings with Listen and Compare, and lessons with units, stars, skills and daily suggestions.

### Scope

**S.1 Voice tuner**

- A voice mode for the detector. A pitch line, not separate notes: a voice starts softly without an attack, slides into notes, wobbles with vibrato (pitch averaged over ~150 ms), and holds long notes. Range from about E2 (a low bass) to C6 (a high soprano).
- A tuner page: sing, and see the note, how many cents sharp or flat, and a trace of the last few seconds.
- Recordings of your voice as test fixtures, like the piano's (`fixtures/mic/`, kept local).
- Done first because it's small, and it shows early whether detection works with your microphone and voice.

**S.2 Graded singing**

- A voice matcher next to the piano's (`TempoMatcher`, `WaitMatcher`). For each written note, it measures:
  - how much of its time was in tune: within ±50 cents, ±25 at higher levels;
  - whether it started within the timing window;
  - how steady it stayed.

  Any octave counts, with an option to require the written one.

- "Wait for me" waits until the note is held in tune for about 0.3 s. Play-along keeps going.
- A singing view:
  - note bars in a horizontal lane, with your voice as a live line through them;
  - a small tuner;
  - in the sheet music, notes colored by how in tune they were;
  - Compare draws your pitch line over the written notes.
- Results: in tune and on time, and the notes to work on (and whether they tend flat or sharp).

**S.3 Your range**

- A range test: slide down to your lowest comfortable note and up to your highest. It's kept in the settings. Voice types (bass to soprano) are named only as a guide.
- Exercises and songs move into your range automatically: by whole octaves first, then by key if needed.

**S.4 Singing by ear and from the staff**

- Ear training: "sing it back" answers for single notes, intervals and short melodies.
- Sight-singing levels in sight-reading: drills in your range, with solfège.

**S.5 Lyrics and songs**

- Score format: a lyric syllable per note (`"lyric": "Twin-"`), with hyphens and extensions. Lyrics are read from and written to MusicXML (`<lyric>`), and drawn under the staff.
- Lyrics in English and Spanish for the public-domain songs. The original lyrics are public domain too; the translations are our own, made to be sung.
- Songs in your range, with the piano accompaniment playing.

**S.6 A singing course**

- Units:
  1. posture and breathing (explained, not graded);
  2. matching one note;
  3. slides and sirens;
  4. steps (do-re-mi);
  5. leaps;
  6. the major scale, then minor;
  7. reading from the staff;
  8. songs.

  Each lesson starts with a warm-up.

- Choosing what to learn: piano, voice, or both, each with its own learning path. The sidebar and the Today card follow the choice.

### Limits

- The app can check pitch, rhythm, steadiness and loudness. It can't judge technique: breath support, tension, vowels, a healthy sound. Lessons say so; a teacher, or listening back to your recordings, covers it.
- Never push your range: short sessions, warm-ups first.
- Singing along with the app through speakers, the microphone hears both: singing along needs headphones. Call-and-response works without them, since the microphone already ignores the app while it plays.

### Open questions

- One app with a choice of piano or voice, or two separate apps? The suggestion is one app.
- The name: _Cantabile_ ("in a singing style") fits piano and voice; _Crescendo_ and _Da Capo_ are neutral; _Tecla_, _Pianova_ and _Ivories_ tie it to the piano.
- Does the browser's echo cancellation let you sing along through speakers, or does it distort the pitch? Try it in S.1.

### Done when

- [ ] Singing a note shows which note it is and how far off, reliably, with your microphone.
- [ ] Singing exercises are graded for pitch and timing, waiting and playing along.
- [ ] Exercises and songs fit the singer's range.
- [ ] Ear training and sight-reading can be answered by singing.
- [ ] Songs show and keep their lyrics, in English and Spanish.
- [ ] A singing course from one note to songs, in English and Spanish.
- [ ] Verified with your voice and microphone.
