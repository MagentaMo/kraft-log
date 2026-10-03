# Kraftlog – Plan

Stand: 03.10.2026 (überarbeitet mit den sinnvollen Vorschlägen von Gemini)

## Ziel

Eine schlichte Fitness-Tracker-App fürs iPhone, die wie eine echte App auf dem Homescreen liegt.

**Technik:** Web-App (PWA). Sie wird kostenlos über GitHub Pages online gestellt und in Safari über „Teilen → Zum Home-Bildschirm“ abgelegt. Danach öffnet sie sich im Vollbild mit eigenem Icon und funktioniert auch offline.

## Design

- Darkmode: schwarz bzw. dunkelblau, Akzente in Orange
- Schlicht, alles auf Deutsch
- Drei Seiten. Du wechselst per Wischen oder über die Tab-Leiste unten mit drei Symbolen.

```
 Finger wischt nach rechts →        ← Finger wischt nach links
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  LOGBUCH    │ ← │    HEUTE    │ → │  STATISTIK  │
└─────────────┘   └─────────────┘   └─────────────┘
  Tab-Leiste:   Logbuch  |  Heute  |  Statistik
```

Die Anordnung folgt der iPhone-Logik: Wischt der Finger nach rechts, kommt die Seite von links herein, also das Logbuch. Andersherum ist es eine kleine Änderung.

## Startseite „Heute“ (Mitte)

Hier landet man beim Öffnen.

- Das heutige Datum
- Was heute dran ist: ein Training, ein Ruhetag oder „erledigt“. Dazu die nächsten Schritte der Reihenfolge.
- Die durchschnittliche Kraftsteigerung pro Woche in %, gemittelt über die letzten 4 Wochen
- Ein Hinweis, wenn das letzte Backup älter als 14 Tage ist

## Logbuch (links)

**Trainings anlegen**
- Jedes Training hat einen Namen, z. B. „Push“, und eigene Übungen mit Satzanzahl.
- Es gibt keine vorgegebene Übungsliste.
- Eine Übung, die in mehreren Trainings vorkommt, wird gemeinsam ausgewertet.

**Reihenfolge festlegen** (statt „alle X Tage“, nach Geminis Vorschlag)
- Du legst eine Reihenfolge aus Trainings und Ruhetagen fest, z. B. Push → Pull → Beine → Ruhe. Danach beginnt sie von vorn.
- Neue Trainings werden automatisch hinten angehängt.
- Ruhetage laufen mit dem Kalender ab. Ein Training bleibt fällig, bis du es einträgst. Fällt ein Tag aus, rutscht alles einen Tag nach hinten.
- Trainierst du etwas anderes als geplant, geht die Reihenfolge ab diesem Training weiter.
- So gibt es keine Überschneidungen. „Alle X Tage“ ergibt sich aus der Länge der Reihenfolge, im Beispiel alle 4 Tage.

**Einheiten eintragen**
- Pro Satz trägst du Gewicht (kg) und Wiederholungen ein.
- Neben jedem Satz steht, was du beim letzten Mal geschafft hast. Tippst du darauf, werden die Werte übernommen.
- Unter jeder Übung steht die Veränderung zum letzten Mal in %.
- Alles wird sofort gespeichert, auch wenn die App mitten im Training geschlossen wird.

**Verlauf**
- Alle Einheiten, neueste zuerst. Jede lässt sich öffnen und bearbeiten.

## Statistik (rechts)

- Den Zeitraum stellst du selbst ein: mit − und + wochenweise oder per Schnellwahl (4, 8, 12, 26 Wochen oder alles).
- Die durchschnittliche Steigerung pro Woche im gewählten Zeitraum
- Ein Verlaufsdiagramm, wahlweise
  - für alle Übungen zusammen: durchschnittliche Veränderung seit Beginn des Zeitraums in %
  - für eine einzelne Übung: geschätztes Maximalgewicht über die Zeit
- Eine Rangliste: Bei welcher Übung steigerst du dich pro Woche am stärksten?
- Die Werte des Diagramms gibt es auch als Tabelle.

## Berechnung der Kraftsteigerung

**1. Geschätztes Maximalgewicht (e1RM) pro Einheit**

Der e1RM-Wert ist das Gewicht, das du theoretisch für genau eine Wiederholung schaffen würdest. Er wird mit der Epley-Formel berechnet:

> e1RM = Gewicht × (1 + Wiederholungen / 30)

Pro Einheit zählt der **beste Satz**, also der Satz mit dem höchsten e1RM.

So zählen mehr Wiederholungen genauso als Fortschritt wie mehr Gewicht.

**2. Steigerung pro Woche (deine Formel)**

> Rate pro Woche = (e1RM Ende / e1RM Start)^(1 / Anzahl Wochen) − 1

- **Start und Ende:** die erste und die letzte Einheit der Übung im gewählten Zeitraum
- **Anzahl Wochen:** die tatsächlichen Tage zwischen diesen beiden Einheiten, geteilt durch 7

**Beispiel:**
- Start: 80 kg × 8 → e1RM = 101,3 kg
- Ende nach 4 Wochen: 85 kg × 8 → e1RM = 107,7 kg
- Rate = (107,7 / 101,3)^(1/4) − 1 ≈ **+1,5 % pro Woche**

**3. Gesamtwert**

Die Raten aller Übungen werden gemittelt.

Eine Übung fließt erst ein, wenn sie im Zeitraum mindestens zweimal trainiert wurde und zwischen erster und letzter Einheit mindestens 7 Tage liegen.

## Daten

**Speicherung**
- Gespeichert wird nur auf dem iPhone, ohne Account und ohne Server. Technisch läuft das über IndexedDB.
- Beim Start bittet die App iOS, die Daten dauerhaft zu behalten.

**Backup**
- Über „Backup sichern“ speicherst du eine Datei, z. B. per „In Dateien sichern“ nach iCloud Drive.
- Über „Backup einspielen“ holst du sie zurück.
- Ist das letzte Backup älter als 14 Tage, erinnert die Startseite daran.

**Wichtig**
- Nutze die App nur über das Homescreen-Icon. Safari und die Homescreen-App haben getrennte Speicher.
- Löschst du das Icon, sind die Daten weg. Vorher ein Backup sichern.

## Bewusst nicht übernommen

- **„Nur Tab-Leiste, kein Wischen“:** Wischen bleibt. Der befürchtete Konflikt mit der iOS-Zurück-Geste tritt nur auf, wenn es eine vorherige Seite gibt, und die App hat keine.
- **„IndexedDB schützt vor dem Löschen“:** IndexedDB wird zwar verwendet, schützt aber nicht vor dem Löschen. Den Schutz übernehmen das Homescreen-Icon, der Dauerspeicher-Wunsch an iOS und die Backups.

## Von Claude festgelegt (änderbar)

- App-Name „Kraftlog“
- Gewichte in kg
- Epley-Formel für den e1RM-Wert
- Start und Ende = erste und letzte Einheit im Zeitraum
- Mindestens 7 Tage Abstand für eine Rate. Sonst springen die Werte stark, z. B. +30 % pro Woche nach nur 2 Tagen.
- Gesamtwert = Durchschnitt der Raten aller Übungen
- Übungen ohne Gewicht (Körpergewicht): Hier zählen die Wiederholungen des besten Satzes statt des e1RM.
- Backup-Erinnerung nach 14 Tagen

## Dateien

- `index.html`, `styles.css`, `app.js`: die App
- `calc.js`: alle Berechnungen
- `manifest.webmanifest`, `icons/`: Name und Icon für den Homescreen
- `sw.js`: macht die App offline nutzbar
- `README.md`: Anleitung für GitHub Pages und das iPhone

## Nächste Schritte

1. App bauen ✓
2. Auf dem Mac im Browser testen ✓ (Rechenlogik mit 19 Tests, Bedienung, Offline-Betrieb)
3. Über GitHub Pages online stellen (Anleitung in README.md)
4. Auf dem iPhone in Safari öffnen → „Zum Home-Bildschirm“
