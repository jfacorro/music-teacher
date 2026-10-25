/**
 * Which sound output the app plays through, by name ("Speakers (Realtek Audio)",
 * "WH-1000XM4"), so the click timing measured for it can follow it: Bluetooth headphones play
 * sound much later than speakers, and browsers can't tell (see the timing correction in
 * audio.ts). Browsers name the outputs only once the microphone has been allowed (the desktop
 * app always does); the name is null until then.
 *
 * Sound goes to the system's default output, or to the one chosen in Settings while it's
 * connected.
 */
import { create } from 'zustand';

export interface SoundDevice {
  id: string;
  label: string;
}

interface SoundOutputState {
  name: string | null;
  /** The outputs to choose from (without the browser's "default" entries). */
  outputs: SoundDevice[];
  /** The output sound goes to: the chosen one while it's connected, '' for the default. */
  deviceId: string;
}

export const useSoundOutput = create<SoundOutputState>(() => ({
  name: null,
  outputs: [],
  deviceId: '',
}));

/** The output devices are checked this often too, as switching outputs isn't always announced. */
const CHECK_EVERY_MS = 5000;

type Device = Pick<MediaDeviceInfo, 'deviceId' | 'groupId' | 'kind' | 'label'>;

/** Entries that stand for another device: the system's default and (Windows) communications. */
const STAND_INS = new Set(['default', 'communications']);

/**
 * The devices of a kind to choose from, each once: the browser lists the default (and on
 * Windows the communications device) twice, as itself and as a stand-in, and lists none by
 * name until the microphone has been allowed.
 */
export function devicesToChoose(devices: readonly Device[], kind: MediaDeviceKind): SoundDevice[] {
  return devices
    .filter((device) => device.kind === kind && device.deviceId && !STAND_INS.has(device.deviceId))
    .map((device) => ({ id: device.deviceId, label: device.label }));
}

/** The output sound goes to: the chosen one while it's connected, '' (the default) otherwise. */
export function outputDeviceIdOf(devices: readonly Device[], chosen: string | null): string {
  return chosen !== null &&
    devices.some((device) => device.kind === 'audiooutput' && device.deviceId === chosen)
    ? chosen
    : '';
}

/**
 * The name of the output sound goes to: the chosen one, or the system's default. The default is
 * listed twice, as "default" ("Default - Speakers (…)", in the browser's language) and as
 * itself, so its own entry is used.
 */
export function outputNameOf(
  devices: readonly Device[],
  chosen: string | null = null,
): string | null {
  const outputs = devices.filter((device) => device.kind === 'audiooutput');
  const id = outputDeviceIdOf(outputs, chosen);
  const current = outputs.find((device) => device.deviceId === (id || 'default')) ?? outputs[0];
  if (!current) return null;
  const itself = outputs.find(
    (device) =>
      device !== current && device.groupId === current.groupId && !STAND_INS.has(device.deviceId),
  );
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

/** The output chosen in Settings; null for the system's default. */
let chosenId: string | null = null;

/** Sends sound to an output (null: the system's default), from now on while it's connected. */
export function chooseSoundOutput(id: string | null): void {
  chosenId = id;
  refreshSoundOutputs();
}

/** Lists the outputs again (e.g. once the microphone is allowed, which names them). */
export function refreshSoundOutputs(): void {
  const devices = navigator.mediaDevices as MediaDevices | undefined;
  if (!devices?.enumerateDevices) return;
  devices.enumerateDevices().then(
    (list) => {
      const outputs = devicesToChoose(list, 'audiooutput');
      const current = useSoundOutput.getState();
      const next = {
        name: outputNameOf(list, chosenId),
        deviceId: outputDeviceIdOf(list, chosenId),
        outputs: sameDevices(outputs, current.outputs) ? current.outputs : outputs,
      };
      if (
        next.name !== current.name ||
        next.deviceId !== current.deviceId ||
        next.outputs !== current.outputs
      ) {
        useSoundOutput.setState(next);
      }
    },
    (error: unknown) => console.error('Could not list the sound outputs', error),
  );
}

export function sameDevices(a: readonly SoundDevice[], b: readonly SoundDevice[]): boolean {
  return a.length === b.length && a.every((d, i) => d.id === b[i]!.id && d.label === b[i]!.label);
}

/** Keeps `useSoundOutput` up to date as outputs come and go. */
export function watchSoundOutput(): () => void {
  const devices = navigator.mediaDevices as MediaDevices | undefined;
  if (!devices?.enumerateDevices) return () => {};
  const update = refreshSoundOutputs;
  update();
  devices.addEventListener('devicechange', update);
  const timer = setInterval(update, CHECK_EVERY_MS);
  return () => {
    devices.removeEventListener('devicechange', update);
    clearInterval(timer);
  };
}
