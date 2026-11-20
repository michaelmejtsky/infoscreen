# BAZ 4.0 · Original-Kompatibilitätsbranch (V0.4)

**Zweck:** Die bestehende Werkstatt-/BAZ-Oberfläche **1:1 anzeigen und ihre bestehenden Google-Sheets- und Apps-Script-Funktionen weiterverwenden**, anstatt eine unvollständige Demo mit neuer Menüstruktur als Ersatz auszugeben.

- Repository: `michaelmejtsky/infoscreen`
- **Nur Testbranch:** `baz4-v0-4-original-kompatibilitaet`
- Cloudflare Workers-Einstieg: `src/worker.js`, Assets `public/`, Konfiguration `wrangler.jsonc`
- Neue Startseite `public/index.html` zeigt die originale Apps-Script-Webapp in einem bildschirmfüllenden iframe.
- `?mode=desktop` zeigt originale Desktop-Baz mit Reitern, `?mode=mobile` das originale Mobile-Dashboard.
- Kleiner Button **⋯** oben rechts enthält Direktlink, Ansichtwechsel, bisherigen Pilot unter `/pilot/`.
- `/pilot/` ist die bisherige V0.3-Oberfläche mit Demonstrationsdaten.
- Die schon vorhandene API `/api/v1/health` bleibt als **schreibgeschützter Demo-Worker** erhalten.

### Wichtige technische Grenzen

Dies ist eine **Kompatibilitätsbrücke, keine Apps-Script-Migration**. Alle echten Datenzugriffe, Schreibvorgänge, Kalender, PDF-Funktionen und E-Mails werden in der bestehenden Apps-Script-Webapp ausgeführt. Google Sheets und die Produktions-Skripte werden durch dieses Repository nicht verändert.

- Funktionalität setzt voraus, dass die bestehende Apps-Script-Webapp erreichbar ist und dass die Benutzerzugriffe in einem eingebetteten Fenster vom Browser zugelassen werden.
- Apps Script `doGet` verwendet `HtmlService.XFrameOptionsMode.ALLOWALL` für Desktop und Mobil; die schon bestehende DashboardAPP-PWA zeigt die mobile Anwendung erfolgreich über iframe an. Die neue Cloudflare-Desktop-Einbettung ist damit *nicht automatisch vollständig getestet*.
- Falls Google-Anmeldung/iframe/Browserregeln blockieren: über **⋯ → Original direkt öffnen** den bestehenden Web-App-Link aufrufen.
- Die angebundene BAZ behält ihre bisherige Geschwindigkeit; keine falschen Versprechen über Cloudflare-Beschleunigung.
- Eine vollständige Daten- und Funktionsmigration verlangt separate API-Implementierung und Tests für alle RPCs, Berechtigungen, Trigger, Kalender und Nachrichten. Die bisherige Sheets-API-Demo darf nicht als Ersatz freigeschaltet werden.
- Excel-Dienstbuch `Dienstbuch(2).xlsm` bleibt ein separates, noch nicht vollständig migriertes Projekt (VBA, ActiveX, SMB-Pfade, Windows-Dateibrücke, makrotreue Spiegelung).

**Sicherheit:** Das GitHub-Repository ist öffentlich. Keine Schlüssel, Personendaten, internen Dateipfade oder dienstlichen Dokumente in GitHub übertragen. Der direkte Live-Link war bereits im bestehenden DashboardAPP-Repository veröffentlicht.

### Deployment

Cloudflare Workers: verbundenes Repository `michaelmejtsky/infoscreen`, Testbranch `baz4-v0-4-original-kompatibilitaet`, `npx wrangler deploy --config wrangler.jsonc` als Deployment-Befehl. **Die produktive GitHub-Pages-Infoscreen-Anzeige auf `main` nicht verändern.** Vor Branchwechsel zuerst eine Cloudflare-Preview verifizieren. Für den Rollback zurück auf `baz4-v0-3-cloudflare-test`.

### Technischer Bestand aus dem Originalexport

- `Code.gs` liefert `Index` als Desktop- und `Mobile` bei `?page=mobileapp`.
- Beide Seiten werden mit `setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)` ausgeliefert.
- Originales Desktopmenü: ZDL-Mängel, Werkstatt, Haustechnik, BAZ, Infoscreen, Verleihliste, Mitarbeiter, Login, Zivildiener/Verwaltung, OVD-Dienste, Wetterlage.
- Bereits 76 `google.script.run`-Aufrufe in `Index.html` und 39 in `Mobile.html` – **ein bloßer Tabellen-Leseadapter deckt diese Semantik nicht ab**.
