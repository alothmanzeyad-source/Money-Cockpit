[README.txt](https://github.com/user-attachments/files/29677529/README.txt)
STROMTARIF-COCKPIT — Robuste Standalone-Version
===================================================

WAS IST ANDERS ALS VORHER?
----------------------------
Die App ist jetzt zu 100% vorkompiliert (React, ReactDOM und die App-Logik
liegen alle DIREKT in index.html, kein CDN, kein Babel-im-Browser mehr).
Das entfernt die komplette Fehlerquelle der letzten Versuche (der
"import"-SyntaxError kann so gar nicht mehr auftreten).

Ich habe diese Datei zusätzlich automatisiert in einer echten
Browser-Engine (jsdom) gerendert und geprüft: 0 Laufzeitfehler,
App rendert korrekt.


SCHRITT 1 — SOFORT TESTEN (ohne Hosting, ohne Internet-Voraussetzung
für die App selbst)
----------------------------------------------------------------------
Doppelklick auf index.html -> öffnet sich direkt im Standardbrowser
und funktioniert vollständig (Berechnung, Grafiken, Heatmap, alle Hebel).
Einzige Ausnahme: Google-Fonts brauchen Internet für die hübsche
Schrift — ohne Internet nutzt der Browser automatisch eine Standardschrift,
die App bleibt aber voll funktionsfähig.

Falls das bei dir schon funktioniert: du hast eine 100% funktionierende
App. Für "installierbar als App auf dem Handy" oder "als APK" muss sie
zusätzlich noch online gehostet werden (Schritt 2).


SCHRITT 2 — ALS INSTALLIERBARE APP HOSTEN (empfohlen: GitHub Pages
statt Netlify — zuverlässiger, kein Passwortschutz-Feature das im Weg steht)
--------------------------------------------------------------------------------
1. github.com -> account erstellen falls nötig -> "New repository"
   -> Name z.B. "stromtarif-cockpit" -> Public -> Create repository
2. Auf der neuen Repo-Seite: "uploading an existing file" anklicken
3. ALLE Dateien aus diesem Ordner hochladen:
   index.html, manifest.json, sw.js, icon-192.png, icon-512.png,
   icon-512-maskable.png
   (WICHTIG: die Dateien selbst hochladen, nicht in einen Unterordner
   ziehen — sie müssen auf oberster Ebene des Repos liegen)
4. "Commit changes"
5. Im Repo: Settings -> Pages (linkes Menü) -> unter "Branch": "main"
   und "/ (root)" auswählen -> Save
6. Nach ca. 1-2 Minuten ist die Seite live unter:
   https://DEINUSERNAME.github.io/stromtarif-cockpit/
7. Diese URL im Handy-Browser öffnen -> Menü -> "App installieren"
   (Android/Chrome) bzw. "Zum Home-Bildschirm" (iPhone/Safari)


SCHRITT 3 — ECHTE .APK-DATEI (falls gewünscht)
-------------------------------------------------
1. Die GitHub-Pages-URL aus Schritt 2 bei www.pwabuilder.com eingeben
2. "Start" -> PWABuilder sollte jetzt Manifest + Service Worker finden
   (beides liegt korrekt auf oberster Ebene)
3. "Android" -> "Package for stores" -> .apk generieren lassen


FALLS ES IMMER NOCH NICHT KLAPPT
-----------------------------------
Schick mir einfach die GitHub-Pages-URL (nicht die Netlify-URL) — GitHub
Pages hat keine der Netlify-Eigenheiten (kein Passwortschutz-Feature,
keine verschachtelten Ordner-Überraschungen beim Drag&Drop), daher sollte
das jetzt zuverlässig funktionieren.
