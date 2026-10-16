/** Added by the desktop app (electron/preload.cjs); absent in the browser. */
interface Window {
  desktop?: {
    setLanguage(language: string): void;
    /** "system", "light" or "dark": the window's frame and title bar follow. */
    setTheme?(theme: string): void;
  };
}
