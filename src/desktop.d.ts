/** Added by the desktop app (electron/preload.cjs); absent in the browser. */
interface Window {
  desktop?: {
    setLanguage(language: string): void;
  };
}
