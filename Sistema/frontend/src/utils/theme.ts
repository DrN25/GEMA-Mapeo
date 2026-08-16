// Gestión de tema (claro/oscuro) con persistencia en localStorage.
// Se aplica ANTES del primer render (main.tsx) para evitar parpadeo,
// y también en la pantalla de login para respetar la preferencia guardada.

const THEME_KEY = 'geolog_theme';

export const getStoredDarkMode = (): boolean => {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
  } catch {
    // localStorage no disponible: usar el default
  }
  return true; // Default: oscuro (estilo original del sistema)
};

export const applyThemeClass = (dark: boolean): void => {
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.classList.toggle('light', !dark);
};

export const applyStoredTheme = (): void => {
  applyThemeClass(getStoredDarkMode());
};

export const persistTheme = (dark: boolean): void => {
  applyThemeClass(dark);
  try {
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  } catch {
    // localStorage no disponible: el tema se aplica igual en memoria
  }
};
