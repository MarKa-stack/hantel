// Akzentfarbe: wird als CSS-Variablen auf <html> gesetzt (Dunkel/Hell je eigene Abstufung)
export const ACCENTS = {
  orange: { name: 'Orange', dark: '#ff5c35', light: '#e84a22' },
  blue: { name: 'Blau', dark: '#4f8cff', light: '#2f6fe8' },
  violet: { name: 'Violett', dark: '#b26bff', light: '#8f4ae6' },
  green: { name: 'Grün', dark: '#34d399', light: '#0f9f6e' },
  teal: { name: 'Türkis', dark: '#2ad4c6', light: '#0fa89c' },
  pink: { name: 'Pink', dark: '#ff5c8a', light: '#e23d6e' },
};

function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(hex, white) { return '#' + rgb(hex).map(c => Math.round(c + (255 - c) * white).toString(16).padStart(2, '0')).join(''); }

/** Aktuelle Akzentfarbe als Hex (z.B. für Canvas-Grafiken) */
export function accentHex(key, theme = 'dark') {
  const a = ACCENTS[key] || ACCENTS.orange;
  return theme === 'light' ? a.light : a.dark;
}

export function applyAccent(key, theme = 'dark') {
  const hex = accentHex(key, theme);
  const st = document.documentElement.style;
  st.setProperty('--accent', hex);
  st.setProperty('--accent-2', mix(hex, 0.22));
  st.setProperty('--accent-rgb', rgb(hex).join(', '));
  st.setProperty('--accent-soft', `rgba(${rgb(hex).join(', ')}, ${theme === 'light' ? 0.12 : 0.16})`);
}
