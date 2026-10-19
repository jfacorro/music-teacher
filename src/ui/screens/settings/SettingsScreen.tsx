import {
  type ComponentType,
  Fragment,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import { AppearanceSettings } from './AppearanceSettings';
import { DataSettings } from './DataSettings';
import { DevKeyboardSettings } from './DevKeyboardSettings';
import { InputSettings } from './InputSettings';
import { LanguageSettings } from './LanguageSettings';
import { LiveTest } from './LiveTest';
import { MicCheck } from './MicCheck';
import { MicSettings } from './MicSettings';
import { MidiSettings } from './MidiSettings';
import { SoundSettings } from './SoundSettings';
import { VoiceSettings } from './VoiceSettings';

/** The cards, in groups; each card's id is where links ("/settings#sound") and the index go. */
const GROUPS = [
  {
    heading: 'settings.groups.keyboard',
    sections: [
      { id: 'input', heading: 'settings.input.heading', Card: InputSettings },
      { id: 'live-test', heading: 'settings.liveTest.heading', Card: LiveTest },
      { id: 'midi', heading: 'settings.midi.heading', Card: MidiSettings },
      { id: 'mic', heading: 'settings.mic.heading', Card: MicSettings },
      { id: 'mic-check', heading: 'settings.micCheck.heading', Card: MicCheck },
      {
        id: 'computer-keyboard',
        heading: 'settings.devKeyboard.heading',
        Card: DevKeyboardSettings,
      },
    ],
  },
  {
    heading: 'settings.groups.sound',
    sections: [
      { id: 'sound', heading: 'settings.sound.heading', Card: SoundSettings },
      { id: 'voice', heading: 'settings.voice.heading', Card: VoiceSettings },
    ],
  },
  {
    heading: 'settings.groups.look',
    sections: [
      { id: 'appearance', heading: 'settings.appearance.heading', Card: AppearanceSettings },
      { id: 'language', heading: 'settings.language.heading', Card: LanguageSettings },
    ],
  },
  // A group of one card needs no heading of its own.
  {
    heading: null,
    sections: [{ id: 'data', heading: 'settings.data.heading', Card: DataSettings }],
  },
] as const satisfies readonly {
  heading: string | null;
  sections: readonly { id: string; heading: string; Card: ComponentType }[];
}[];

const SECTION_IDS = GROUPS.flatMap((group) => group.sections.map((section) => section.id));

const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ block: 'start' });

/**
 * The sections showing (a card can show nothing, like the microphone check without a
 * microphone), and the one scrolled to: the last whose top is under the top bar.
 */
function useSections(list: RefObject<HTMLElement | null>) {
  const [state, setState] = useState<{ shown: readonly string[]; current: string | null }>({
    shown: SECTION_IDS,
    current: null,
  });
  const update = useCallback(() => {
    const elements = SECTION_IDS.flatMap((id) => {
      const element = document.getElementById(id);
      return element && element.childElementCount > 0 ? [element] : [];
    });
    const passed = elements.filter((element) => {
      const margin = parseFloat(getComputedStyle(element).scrollMarginBlockStart) || 0;
      return element.getBoundingClientRect().top <= margin + 1;
    });
    const shown = elements.map((element) => element.id);
    const current = (passed.at(-1) ?? elements[0])?.id ?? null;
    setState((previous) =>
      previous.current === current && previous.shown.join() === shown.join()
        ? previous
        : { shown, current },
    );
  }, []);
  useEffect(() => {
    // Once the cards are on the page.
    const first = setTimeout(update);
    const cards = new MutationObserver(update);
    if (list.current) cards.observe(list.current, { childList: true, subtree: true });
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      clearTimeout(first);
      cards.disconnect();
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [list, update]);
  // A jump updates it right away, without waiting for the scroll event.
  return { ...state, refresh: update };
}

export function SettingsScreen() {
  const { t } = useTranslation('screens');
  const { hash } = useLocation();
  const list = useRef<HTMLDivElement>(null);
  const { shown, current, refresh } = useSections(list);
  const go = (id: string) => {
    jump(id);
    refresh();
  };
  // A link to a card ("/settings#sound") shows it.
  useEffect(() => {
    if (hash) jump(hash.slice(1));
  }, [hash]);

  return (
    <section className="screen">
      <h1>{t('settings.title')}</h1>
      {/* A narrow window has no room for the index beside the cards: a menu instead. */}
      <label className="settings-jump">
        <span>{t('settings.jumpTo')}</span>
        <select value={current ?? ''} onChange={(event) => go(event.target.value)}>
          {GROUPS.map((group) => {
            const options = group.sections
              .filter((section) => shown.includes(section.id))
              .map((section) => (
                <option key={section.id} value={section.id}>
                  {t(section.heading)}
                </option>
              ));
            return group.heading ? (
              <optgroup key={group.heading} label={t(group.heading)}>
                {options}
              </optgroup>
            ) : (
              <Fragment key={group.sections[0].id}>{options}</Fragment>
            );
          })}
        </select>
      </label>
      <div className="settings-layout">
        <div className="settings-list" ref={list}>
          {GROUPS.map((group) => {
            const cards = group.sections.map(({ id, Card }) => (
              <div key={id} id={id} className="settings-section">
                <Card />
              </div>
            ));
            return group.heading ? (
              <section key={group.heading} className="settings-group">
                <h2 className="settings-group__heading">{t(group.heading)}</h2>
                {cards}
              </section>
            ) : (
              <Fragment key={group.sections[0].id}>{cards}</Fragment>
            );
          })}
        </div>
        <nav className="settings-index" aria-label={t('settings.index')}>
          {GROUPS.map((group) => (
            <Fragment key={group.sections[0].id}>
              {group.heading && <p className="settings-index__group">{t(group.heading)}</p>}
              {group.sections
                .filter((section) => shown.includes(section.id))
                .map((section) => (
                  <a
                    key={section.id}
                    // A group of one card: spaced like a group, without the heading.
                    className={group.heading ? undefined : 'settings-index__alone'}
                    href={`#${section.id}`}
                    aria-current={section.id === current ? 'true' : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      go(section.id);
                    }}
                  >
                    {t(section.heading)}
                  </a>
                ))}
            </Fragment>
          ))}
        </nav>
      </div>
    </section>
  );
}
