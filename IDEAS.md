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

---

## Releasing

**Goal:** find out, cheaply, whether other people want the app, without taking time from learning with it. The app is built for its author first; releasing it is a test, not a business plan.

### The market

- People do pay for piano apps. Simply Piano, Flowkey, Skoove, Playground Sessions, Piano Marvel and Yousician charge roughly $10–20 a month or $100–150 a year; Synthesia sells a one-time license for about $40. These prices are approximate and from memory; check them before deciding anything.
- Few users actually pay: free-to-paid conversion is typically a few percent, and most beginners stop within weeks. Retention, not features, decides whether these apps make money.

### What sets it apart

- It runs fully offline: no account, no cloud, no analytics.
- It reads real sheet music early, with sight-reading and ear training.
- It grades in depth: timing, dynamics, touch, and each hand separately.
- It works with any MIDI keyboard, or the microphone, in English and Spanish.

### What paid apps have that it doesn't

- **Mobile and tablet.** Most learners put a phone or iPad on the music stand.
- **Popular, licensed songs.** This app has public-domain melodies only.
- **Depth.** Paid apps have years of content and video lessons; this one has nine units.
- **Testing beyond one piano.** Microphone detection is tuned on the author's Casio.

### Steps

**R.1 Try it without installing**

- Host the web version on a free static host (GitHub Pages, Netlify or Cloudflare Pages). That gives a link that works in Chrome and Edge, with MIDI and the microphone. Data stays in each visitor's browser, so there's no server to run and nothing to maintain.
- The Windows installer already builds on every merge, but the repository is private, so its "Latest build" release isn't public. To share it, make the repository public or publish releases elsewhere.

**R.2 Before sharing**

- **A license:** decide whether it's open source. Without a license, all rights are reserved.
- **Credits:**
  - the songs are public domain, with our own arrangements;
  - the piano and the clicks are synthesized, so there are no sample licenses;
  - the libraries use permissive licenses (OpenSheetMusicDisplay, Tone.js, pitchy, Tabler Icons) and get a credits page.
- **A distinctive name,** checked for conflicts. Singing › Open questions has candidates.
- **Another piano:** at least one other piano and microphone tried.
- **A short README:** what the app is, screenshots or a short video, and "everything stays on your computer".
- **Feedback:** one way to send it, through GitHub issues or an email address.

**R.3 Share and listen**

- Post once where adult learners gather: r/piano, r/learnpiano, digital-piano forums.
- The app has no analytics by design, so the signals come from people:
  - messages, feature requests and bug reports;
  - people saying they came back to it;
  - stars, if the code is public.
- An optional "support" link (Ko-fi or GitHub Sponsors) tests whether anyone would pay, with no commitment on either side.

**R.4 If the response is good**

- Invest in this order:
  1. testing on more pianos and microphones;
  2. a macOS build;
  3. a tablet-friendly layout;
  4. more units.
- Costs to expect:
  - a Windows code-signing certificate (about $100–400 a year), so SmartScreen doesn't warn people away from the installer;
  - Apple's developer membership ($99 a year) for a macOS build;
  - support, and a website.

### Pricing options

- **A subscription** against Simply Piano: unlikely to work without large investment in mobile, content and marketing.
- **A one-time purchase for a niche** (adults with a digital piano who want offline learning and real sheet music, without a subscription): plausible at about $20–40, the way Synthesia sells. Expect modest income, not a business.
- **Free and open source, with donations:** the easiest start, and in keeping with a local, private app.

### When

After working through more of the course, say Units 6–9. Then the early units have been tested by a real learner, and a first impression is worth protecting.

### Done when

- [ ] The web version is online and works in Chrome and Edge, with MIDI and the microphone.
- [ ] A license, credits, the name and a README are in place.
- [ ] Tried on at least one other piano and microphone.
- [ ] Shared once, with a way to send feedback.
- [ ] A decision on what's next, based on the response.
