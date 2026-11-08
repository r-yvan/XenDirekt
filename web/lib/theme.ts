export type ThemePreference = 'light' | 'dark' | 'system';
export const THEME_KEY = 'xd-theme';

/** Inline, pre-paint: apply the stored preference (default: follow the system). */
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_KEY}')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})();`;
