/**
 * Playback position in beats. The position is computed from the clock on demand, so renderers
 * can read it every animation frame without any timer. Milestone 1.4 adds count-in and the
 * metronome on top of this.
 */
import { msToBeats } from './score';

export type Clock = () => number;

export interface TransportState {
  playing: boolean;
  tempo: number;
}

export class Transport {
  private readonly clock: Clock;
  private readonly listeners = new Set<() => void>();
  private anchorBeat = 0;
  private anchorTime = 0;
  private state: TransportState;

  constructor(tempo: number, clock: Clock = () => performance.now()) {
    this.clock = clock;
    this.state = { playing: false, tempo };
  }

  get playing(): boolean {
    return this.state.playing;
  }

  get tempo(): number {
    return this.state.tempo;
  }

  position(): number {
    if (!this.state.playing) return this.anchorBeat;
    return this.anchorBeat + msToBeats(this.clock() - this.anchorTime, this.state.tempo);
  }

  play(): void {
    if (this.state.playing) return;
    this.anchorTime = this.clock();
    this.setState({ playing: true });
  }

  pause(): void {
    if (!this.state.playing) return;
    this.anchorBeat = this.position();
    this.setState({ playing: false });
  }

  seek(beat: number): void {
    this.anchorBeat = beat;
    this.anchorTime = this.clock();
    this.notify();
  }

  /** Changes speed without jumping: the position stays where it is. */
  setTempo(tempo: number): void {
    this.anchorBeat = this.position();
    this.anchorTime = this.clock();
    this.setState({ tempo });
  }

  // useSyncExternalStore-compatible

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): TransportState => this.state;

  private setState(patch: Partial<TransportState>): void {
    this.state = { ...this.state, ...patch };
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
