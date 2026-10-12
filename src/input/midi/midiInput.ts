import { create } from 'zustand';
import { HeldNotes } from '../bus';
import { parseMidiMessage } from './parse';

export type MidiAccessState = 'unsupported' | 'idle' | 'requesting' | 'granted' | 'denied';

/**
 * - none: nothing selected and nothing available
 * - busy: the port couldn't be opened, typically because another app holds it (Windows)
 * - disconnected: the selected device isn't plugged in; reconnects automatically
 */
export type MidiConnection = 'none' | 'connecting' | 'connected' | 'busy' | 'disconnected';

export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
  available: boolean;
}

interface MidiState {
  access: MidiAccessState;
  devices: MidiDevice[];
  selectedId: string | null;
  selectedName: string | null;
  connection: MidiConnection;
  sustain: boolean;
}

export function isMidiSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
}

export const useMidi = create<MidiState>(() => ({
  access: isMidiSupported() ? 'idle' : 'unsupported',
  devices: [],
  selectedId: null,
  selectedName: null,
  connection: 'none',
  sustain: false,
}));

let access: MIDIAccess | null = null;
let port: MIDIInput | null = null;
const held = new HeldNotes('midi');
let onDeviceSelected: ((device: { id: string; name: string }) => void) | undefined;

/** Restores the remembered device and registers how to persist a new choice. */
export function configureMidi(options: {
  preferredId: string | null;
  preferredName: string | null;
  onDeviceSelected: (device: { id: string; name: string }) => void;
}): void {
  useMidi.setState({ selectedId: options.preferredId, selectedName: options.preferredName });
  onDeviceSelected = options.onDeviceSelected;
}

/** Whether MIDI was already allowed, so we can connect without prompting. */
export async function midiPermission(): Promise<PermissionState | 'unknown'> {
  try {
    const status = await navigator.permissions.query({ name: 'midi' as PermissionName });
    return status.state;
  } catch {
    return 'unknown';
  }
}

export async function enableMidi(): Promise<void> {
  if (!isMidiSupported()) {
    useMidi.setState({ access: 'unsupported' });
    return;
  }
  if (access) return;
  useMidi.setState({ access: 'requesting' });
  try {
    access = await navigator.requestMIDIAccess({ sysex: false });
  } catch (error) {
    console.warn('MIDI access was not granted', error);
    useMidi.setState({ access: 'denied' });
    return;
  }
  access.addEventListener('statechange', handleStateChange);
  useMidi.setState({ access: 'granted', devices: listDevices() });
  await connectPreferred();
}

export async function selectDevice(id: string): Promise<void> {
  if (!access) return;
  const input = access.inputs.get(id);
  closePort();
  const name = input?.name ?? null;
  useMidi.setState({ selectedId: id, selectedName: name });
  if (name) onDeviceSelected?.({ id, name });

  if (!input || input.state !== 'connected') {
    useMidi.setState({ connection: 'disconnected' });
    return;
  }
  useMidi.setState({ connection: 'connecting' });
  try {
    await input.open();
  } catch (error) {
    console.warn(`Could not open MIDI input "${input.name}"`, error);
    useMidi.setState({ connection: 'busy' });
    return;
  }
  if (input.connection !== 'open') {
    useMidi.setState({ connection: 'busy' });
    return;
  }
  input.addEventListener('midimessage', handleMessage);
  port = input;
  useMidi.setState({ connection: 'connected' });
}

export function retryMidiConnection(): void {
  const { selectedId } = useMidi.getState();
  void (selectedId ? selectDevice(selectedId) : connectPreferred());
}

function listDevices(): MidiDevice[] {
  if (!access) return [];
  return [...access.inputs.values()].map((input) => ({
    id: input.id,
    name: input.name ?? input.id,
    manufacturer: input.manufacturer ?? '',
    available: input.state === 'connected',
  }));
}

/** The remembered device (by id, then by name since ids can change), else the first one. */
function findPreferred(devices: MidiDevice[]): MidiDevice | undefined {
  const { selectedId, selectedName } = useMidi.getState();
  const available = devices.filter((device) => device.available);
  return (
    available.find((device) => device.id === selectedId) ??
    available.find((device) => selectedName !== null && device.name === selectedName) ??
    (selectedId === null ? available[0] : undefined)
  );
}

async function connectPreferred(): Promise<void> {
  const device = findPreferred(listDevices());
  if (device) {
    await selectDevice(device.id);
  } else {
    useMidi.setState({ connection: useMidi.getState().selectedId ? 'disconnected' : 'none' });
  }
}

function closePort(): void {
  if (!port) return;
  port.removeEventListener('midimessage', handleMessage);
  held.releaseAll();
  // Closing frees the device for other apps (Windows allows one app per device).
  port.close().catch(() => {});
  port = null;
  useMidi.setState({ sustain: false });
}

function handleStateChange(event: MIDIConnectionEvent): void {
  if (event.port?.type !== 'input') return;
  useMidi.setState({ devices: listDevices() });

  if (port && event.port.id === port.id && event.port.state === 'disconnected') {
    port.removeEventListener('midimessage', handleMessage);
    held.releaseAll();
    port = null;
    useMidi.setState({ connection: 'disconnected', sustain: false });
    return;
  }
  const { connection } = useMidi.getState();
  if (connection === 'disconnected' || connection === 'none') {
    void connectPreferred();
  }
}

function handleMessage(event: MIDIMessageEvent): void {
  const message = event.data && parseMidiMessage(event.data);
  if (!message) return;
  switch (message.kind) {
    case 'noteOn':
      held.on(message.note, message.velocity, event.timeStamp);
      break;
    case 'noteOff':
      held.off(message.note, event.timeStamp);
      break;
    case 'sustain':
      useMidi.setState({ sustain: message.down });
      break;
  }
}
