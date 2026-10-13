# Microphone recordings

Real piano recordings for tuning the note detector. Each recording is one `<name>.json`
with the microphone audio (a 16-bit mono WAV, embedded), the MIDI notes played at the same
time (the ground truth), the notes the microphone detected live, and the detector settings.

## Making one

1. Connect the keyboard over USB (MIDI) and turn on the microphone in **Settings**.
2. In **Microphone check**, keep "Record audio" on, press **Start check** and play.
   Cover low and high notes, repeated notes, soft and loud notes.
3. Press **Stop**, then **Save recording**. Your browser saves the file.
4. Move it into this folder.

Recordings are several MB each, so they aren't committed (`.gitignore`); they stay on
the machine that made them.

`npm test` replays every recording through the detector (`src/input/mic/fixtures.test.ts`)
and prints how many notes it gets right. Add `"minAccuracy": 0.9` to a recording's JSON to
make the test fail if detection gets worse than that.
