/*
 * Clavier tactile AZERTY pour la borne (le clavier système n'apparaît pas
 * de façon fiable en mode kiosque). Il écrit dans un <input> et déclenche
 * l'événement 'input' comme une frappe normale.
 */
const ROWS = [
  ['a', 'z', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['q', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm'],
  ['w', 'x', 'c', 'v', 'b', 'n', 'é', 'è', '’', '-'],
];

export function mountKeyboard(container, input, { onEnter } = {}) {
  container.innerHTML = '';
  const fire = () => input.dispatchEvent(new Event('input', { bubbles: true }));
  const key = (label, cls, fn) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'kb-key' + (cls ? ' ' + cls : '');
    b.textContent = label;
    // pointerdown : réactif au toucher et ne retire pas le focus du champ
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); });
    return b;
  };
  for (const row of ROWS) {
    const r = document.createElement('div');
    r.className = 'kb-row';
    for (const c of row) r.appendChild(key(c, '', () => { input.value += c === '’' ? "'" : c; fire(); }));
    container.appendChild(r);
  }
  const last = document.createElement('div');
  last.className = 'kb-row';
  last.appendChild(key('Effacer tout', 'wide2', () => { input.value = ''; fire(); }));
  last.appendChild(key('Espace', 'space', () => { if (input.value && !input.value.endsWith(' ')) { input.value += ' '; fire(); } }));
  last.appendChild(key('⌫', 'wide', () => { input.value = input.value.slice(0, -1); fire(); }));
  last.appendChild(key('OK', 'wide ok', () => onEnter?.()));
  container.appendChild(last);
}
