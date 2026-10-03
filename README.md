# Kraftlog

Schlichter Krafttraining-Tracker fürs iPhone, als Web-App für den Homescreen.

- **Heute:** Was heute dran ist und die Ø Kraftsteigerung pro Woche
- **Logbuch:** Trainings, Reihenfolge und Einheiten mit Gewicht × Wiederholungen
- **Statistik:** Fortschritt je Übung und Verlauf über frei wählbare Wochen

Die Daten bleiben nur auf dem Gerät. Details zu Aufbau und Berechnung stehen in [PLAN.md](PLAN.md).

## Online stellen mit GitHub Pages

Einmalig, dauert etwa 5 Minuten.

1. Auf github.com oben rechts **+ → New repository** wählen.
2. Name z. B. `kraftlog`, Sichtbarkeit **Public**, dann **Create repository**.
3. Auf der neuen Seite **uploading an existing file** anklicken.
4. Diese Dateien aus dem Ordner `Fitness-Tracker` hineinziehen:
   - `index.html`, `styles.css`, `app.js`, `calc.js`, `sw.js`, `manifest.webmanifest`
   - den Ordner `icons`
5. Unten **Commit changes** klicken.
6. Im Repository **Settings → Pages** öffnen. Unter „Branch“ `main` und `/ (root)` wählen, dann **Save**.
7. Nach 1–2 Minuten steht oben auf der Seite die Adresse, z. B. `https://DEIN-NAME.github.io/kraftlog/`.

Der Code ist dann öffentlich. Deine Trainingsdaten sind es nicht, die liegen nur auf deinem iPhone.

## Auf den Homescreen

1. Die Adresse auf dem iPhone in **Safari** öffnen.
2. **Teilen** (Quadrat mit Pfeil) → **Zum Home-Bildschirm** → **Hinzufügen**.
3. Ab jetzt nur noch über das Icon öffnen. Safari speichert getrennt davon.

## Wichtig zu den Daten

- **Backup:** Auf der Startseite oben rechts auf das Zahnrad tippen, dann **Backup sichern** → „In Dateien sichern“ (z. B. iCloud Drive). Nach 14 Tagen ohne Backup erinnert die App daran.
- **Icon löschen = Daten weg.** Vorher immer ein Backup sichern.
- **Neues iPhone:** App installieren und dann über **Backup einspielen** die Datei laden.

## Änderungen veröffentlichen

Geänderte Dateien im Repository erneut hochladen (**Add file → Upload files**). Die App holt sich die neue Version im Hintergrund. Beim übernächsten Öffnen ist sie aktiv.

## Lokal testen

```bash
python3 -m http.server 8123 --directory ~/Documents/claude/Fitness-Tracker
```

Danach `http://localhost:8123` im Browser öffnen.
