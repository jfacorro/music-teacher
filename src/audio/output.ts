/**
 * Which sound output the app plays through, by name ("Speakers (Realtek Audio)",
 * "WH-1000XM4"), so the click timing measured for it can follow it: Bluetooth headphones play
 * sound much later than speakers, and browsers can't tell (see the timing correction in
 * audio.ts). Browsers name the outputs only once the microphone has been allowed (the desktop
 * app always does); the name is null until then.
 */
import { create } from 'zustand';

export const useSoundOutput = create<{ name: string | null }>(() => ({ name: null }));

/** The output devices are checked this often too, as switching outputs isn't always announced. */
const CHECK_EVERY_MS = 5000;

type Device = Pick<MediaDeviceInfo, 'deviceId' | 'groupId' | 'kind' | 'label'>;

/**
 * The name of the output sound goes to: the system's default. It's listed twice, as "default"
 * ("Default - Speakers (…)", in the browser's language) and as itself, so its own entry is used.
 */
export function outputNameOf(devices: readonly Device[]): string | null {
  const outputs = devices.filter((device) => device.kind === 'audiooutput');
  const current = outputs.find((device) => device.deviceId === 'default') ?? outputs[0];
  if (!current) return null;
  const itself = outputs.find((device) => device !== current && device.groupId === current.groupId);
  return (itself ?? current).label || null;
}

/**
 * The click timing correction for an output: the one measured for it, or none (0) for an
 * output never measured once others have been. Null keeps the current one: the output isn't
 * named, or nothing was measured for a named output yet.
 */
export function timingForOutput(
  timings: Readonly<Record<string, number>>,
  output: string | null,
): number | null {
  if (output === null || Object.keys(timings).length === 0) return null;
  return Object.hasOwn(timings, output) ? timings[output]! : 0;
}

/** Sound goes to an output whose timing hasn't been measured, while another's has. */
export function isUnmeasuredOutput(
  timings: Readonly<Record<string, number>>,
  output: string | null,
): output is string {
  return output !== null && Object.keys(timings).length > 0 && !Object.hasOwn(timings, output);
}

/** Keeps `useSoundOutput` up to date as outputs come and go. */
export function watchSoundOutput(): () => void {
  const devices = navigator.mediaDevices as MediaDevices | undefined;
  if (!devices?.enumerateDevices) return () => {};
  const update = () => {
    devices.enumerateDevices().then(
      (list) => {
        const name = outputNameOf(list);
        if (name !== useSoundOutput.getState().name) useSoundOutput.setState({ name });
      },
      (error: unknown) => console.error('Could not list the sound outputs', error),
    );
  };
  update();
  devices.addEventListener('devicechange', update);
  const timer = setInterval(update, CHECK_EVERY_MS);
  return () => {
    devices.removeEventListener('devicechange', update);
    clearInterval(timer);
  };
}
