// Die App wurde ursprünglich für die Claude.ai-Artefakt-Umgebung entwickelt,
// die ein `window.storage`-API (get/set/delete/list) bereitstellt.
// Dieser Polyfill bildet dieselbe API auf localStorage ab, damit der App-Code
// unverändert außerhalb von Claude.ai läuft (z. B. als Android-App via Capacitor).
//
// Hinweis: Der "shared"-Parameter wird ignoriert, da eine mobile Einzelgerät-App
// kein geräteübergreifendes Teilen von Daten benötigt.

const PREFIX = "vermoegens-cockpit:";

window.storage = {
  async get(key) {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) {
      throw new Error(`Kein Wert für Schlüssel "${key}" gefunden`);
    }
    return { key, value: raw, shared: false };
  },

  async set(key, value) {
    window.localStorage.setItem(PREFIX + key, value);
    return { key, value, shared: false };
  },

  async delete(key) {
    window.localStorage.removeItem(PREFIX + key);
    return { key, deleted: true, shared: false };
  },

  async list(prefix = "") {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(PREFIX + prefix)) {
        keys.push(k.slice(PREFIX.length));
      }
    }
    return { keys };
  },
};
