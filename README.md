# Vermögens-Cockpit

Persönlicher Geldmanager: CSV-Kontoauszüge importieren, automatisch kategorisieren,
Monats-/Jahres-/Mehrjahresvergleiche, Prognosen und ein paar nützliche Werkzeuge
(Taschenrechner, Währungsrechner, Sparziel- und Kreditrechner).

Alle Daten bleiben lokal auf dem Gerät (im Browser-Storage bzw. in der App)
und werden nirgendwo hochgeladen.

---

## Option A: APK automatisch über GitHub Actions bauen (empfohlen, kein Android Studio nötig)

1. Dieses Projekt in ein neues GitHub-Repository hochladen (z. B. per GitHub-Weboberfläche
   „Upload files" oder per Git):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<dein-benutzername>/<dein-repo>.git
   git push -u origin main
   ```
2. Auf GitHub in deinem Repository auf den Tab **„Actions"** gehen. Der Workflow
   „Android APK bauen" startet automatisch beim Push auf `main` (oder manuell über
   „Run workflow").
3. Wenn der Workflow durchgelaufen ist (dauert einige Minuten), auf den Workflow-Lauf
   klicken → unten bei **„Artifacts"** liegt `vermoegens-cockpit-apk` zum Download bereit.
   Das ist deine fertige `app-debug.apk`.
4. Die APK aufs Android-Gerät übertragen und installieren (dort ggf. „Installation aus
   unbekannten Quellen" erlauben, da die APK nicht aus dem Play Store stammt).

Diese Debug-APK ist zum Selbst-Installieren und Testen gedacht. Für eine Veröffentlichung
im Play Store braucht es zusätzlich eine signierte Release-Build (siehe unten).

---

## Option B: Lokal bauen (mit Android Studio)

### Voraussetzungen
- [Node.js](https://nodejs.org) (Version 18 oder neuer)
- [Android Studio](https://developer.android.com/studio) (bringt Android SDK & JDK mit)

### Schritte
```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Web-App bauen
npm run build

# 3. Android-Projekt erzeugen (nur beim ersten Mal nötig)
npx cap add android

# 4. Web-Build ins Android-Projekt übernehmen
npx cap sync android

# 5a. Entweder in Android Studio öffnen und dort bauen/starten:
npx cap open android
#    → in Android Studio: Build → Build Bundle(s) / APK(s) → Build APK(s)
#    Die fertige Datei liegt danach unter:
#    android/app/build/outputs/apk/debug/app-debug.apk

# 5b. Oder direkt per Kommandozeile bauen (ohne Android Studio zu öffnen):
cd android && ./gradlew assembleDebug
```

### Bei Änderungen am Code
Nach jeder Änderung an `src/App.jsx` einfach erneut ausführen:
```bash
npm run build
npx cap sync android
```
und die App in Android Studio neu bauen/starten.

---

## Release-Build für den Play Store (optional)

Für eine echte Veröffentlichung brauchst du eine signierte Release-APK/-AAB:

1. In Android Studio: **Build → Generate Signed Bundle / APK**
2. Einen neuen Keystore erstellen (oder einen bestehenden verwenden) und die
   Zugangsdaten **sicher aufbewahren** – ohne den Keystore kannst du spätere
   Updates nicht mehr signieren.
3. „Android App Bundle" (`.aab`) auswählen, das ist das von Google Play erwartete Format.

---

## Web-Vorschau im Browser über GitHub Pages

Der mitgelieferte Workflow **„Web-Vorschau auf GitHub Pages veröffentlichen"** baut die App
automatisch und veröffentlicht sie als Webseite – nützlich, um die App direkt im Browser zu
testen, ohne sie auf einem Android-Gerät zu installieren.

**Einmalige Einrichtung (wichtig, sonst bleibt die Seite leer):**

1. Im Repository zu **Settings → Pages** gehen.
2. Bei **„Build and deployment" → „Source"** auf **„GitHub Actions"** umstellen
   (nicht „Deploy from a branch" — das würde nur den unveränderten Quellcode anzeigen,
   der Browser kann `.jsx`-Dateien nicht direkt ausführen).
3. Erneut auf `main` pushen (oder den Workflow manuell über „Actions" → „Run workflow" starten).
4. Nach Abschluss erscheint der Link zur Seite unter **Settings → Pages** ganz oben
   (Format: `https://<benutzername>.github.io/<repo-name>/`).

Falls die Seite bereits über „Deploy from a branch" eingerichtet war und deshalb leer blieb:
genau dieser Schritt 2 (Umstellung auf „GitHub Actions") behebt es.

---

## Projektstruktur

```
├── src/
│   ├── App.jsx                 → die eigentliche Cockpit-Anwendung
│   ├── main.jsx                → React-Einstiegspunkt
│   └── storage-polyfill.js     → speichert Daten lokal auf dem Gerät (localStorage)
├── index.html
├── vite.config.js
├── capacitor.config.json       → App-Name, App-ID, Build-Ordner
├── package.json
└── .github/workflows/build-apk.yml → automatischer APK-Build bei jedem Push
```

## Technische Hinweise

- **Speicherung**: Die App speichert alle Konten, Transaktionen, Regeln und
  Einstellungen lokal auf dem Gerät (`localStorage` im Android-WebView).
  Es gibt keinen Cloud-Sync — bei Deinstallation der App gehen die Daten verloren,
  sofern kein Backup gemacht wurde.
- **Internetzugriff**: Für zwei Funktionen wird eine Internetverbindung benötigt:
  die Google-Schriftart „Roboto" (lädt beim ersten Start) und der Währungsrechner
  (ruft Wechselkurse ab). Ohne Internet funktioniert der Rest der App weiterhin,
  der Währungsrechner erlaubt dann die manuelle Eingabe eines Kurses.
- **App-ID ändern**: Falls du die App unter einer eigenen Kennung veröffentlichen
  willst, `appId` in `capacitor.config.json` **vor** dem ersten `npx cap add android`
  anpassen (z. B. `com.deinname.geldmanager`).
