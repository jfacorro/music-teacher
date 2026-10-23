# Voice recordings

Real singing, for tuning how the app judges a voice. Each recording is one `<name>.wav`: the
microphone audio (16-bit mono), which plays in any audio player, with the run of Match the note
inside it, in a `json` chunk after the audio: the notes asked, when the app listened for each,
and how each went while singing.

## Making one

1. Find your vocal range first (**Settings → Your vocal range**).
2. On the **Tuner** page, press **Start** under Match the note and sing the ten notes.
3. On the results, press **Save recording**. Your browser saves the file.
4. Move it into this folder.

Recordings are a few MB each, so they aren't committed (`.gitignore`); they stay on the
machine that made them.

`npm test` replays every recording through the detector and the matcher
(`src/input/mic/voiceFixtures.test.ts`) and prints how many notes it matches in time. Add a
`<name>.min.json` beside a recording, such as `{ "minMatched": 8 }`, to make the test fail if
fewer notes match than that.
