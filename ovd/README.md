# OVD-Zentrale – eigenständige PWA
Die App unter `/ovd/` ist eine eigenständige Progressive Web App (PWA), **kein iframe** und keine Infoscreen-Ansicht. GitHub Pages liefert nur HTML, CSS, JavaScript, Manifest, Icons und Service Worker aus. Personendaten, OVD-Dienste, Tauschvorgänge und Push-Abos bleiben serverseitig im vorhandenen Google-Sheets-/Apps-Script-System.

## Was fertig auf GitHub liegt
- Eigene App-Oberfläche: Start (aktueller OVD), Dienste, Tauschanfragen, Profil
- Installationsfunktion, manifest, PNG-Icons für 192/512 Pixel, Offline-App-Shell
- Login-Oberfläche mit Standesbuchnummer + einmaligem E-Mail-Code
- Eigene API-Clientlogik und Push-Registrierung

**Noch nicht produktiv verbunden:** Eine funktionsfähige Cloudflare-Worker-URL muss in `ovd/config.js` als `window.OVD_API_URL` gesetzt werden. Ohne diese Adresse bleibt die App bewusst im Einrichtungszustand. Es werden weder erfundene Live-Daten angezeigt noch Tausche vorgetäuscht.

## Einmalige Servereinrichtung
1. Im bestehenden OVD-Apps-Script-Projekt die Datei `server/Code.gs` als **neue GS-Datei** `OVD_App_API.gs` hinzufügen. **Nicht** die bisherige Haupt-GS-Datei ersetzen.
2. Am Anfang der vorhandenen Funktion `doPost(e)` **vor** den bisherigen Excel-/Dashboard-Zweigen einfügen:
   ```js
   if (e && e.parameter && e.parameter.ovd_app_v1 === '1') {
     return ovdAppRequest(e);
   }
   ```
3. `ovdAppEinrichten` im Apps-Script-Editor einmal ausführen. In `OVD_Personen` Spalte H die eindeutigen **dreistelligen Standesbuchnummern** der aktiven OVD eintragen und die vorhandenen E-Mail-Adressen prüfen. Die Nummer allein ist **kein** ausreichender Login; der Einmalcode wird an die hinterlegte E-Mail gesendet.
4. In Apps Script unter **Projekteinstellungen → Skripteigenschaften** `OVD_APP_GATEWAY_KEY` mit einem langen, zufälligen geheimen Wert setzen. `ovdAppSetupCheck` starten und dessen Protokoll prüfen.
5. **Dieselbe vorhandene Apps-Script-Web-App neu bereitstellen**, damit der neue `doPost`-Zweig erreichbar ist. Die bestehenden Funktionen für Excel, Dashboard und Dienstkalender bleiben unverändert.
6. Einen eigenständigen Cloudflare Worker mit dem Inhalt von `server/cloudflare-worker.js` bereitstellen. Als Secrets konfigurieren: `GAS_WEBAPP_URL` (aktuelle `/exec`-URL), `GAS_BRIDGE_KEY` (derselbe geheime Wert wie bei Apps Script), `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`. Für den 24-Stunden-Push einen Cron-Trigger (beispielsweise alle 5 Minuten) einrichten. VAPID-Schlüssel nur serverseitig als Secrets hinterlegen, nicht im öffentlichen GitHub-Code.
7. **Nur die öffentliche Worker-URL** in `ovd/config.js` hinterlegen. Keine geheimen Schlüssel, Standesbuchnummern oder Mitgliederdaten auf GitHub einchecken.

## Vor Freigabe für Mitglieder prüfen
- Standesbuchnummer → E-Mail-Code → 30-Tage-Sitzung → Abmelden
- Aktueller OVD aus `Dienstkalender!H6`
- Eigene und andere Dienste; geteilter Dienst und Übernahmezeiten
- Tauschanfrage OVD A → OVD B → annehmen/ablehnen, Kalenderaktualisierung, kein doppelter Antrag
- E-Mail und Web-Push beim Tausch sowie 24-Stunden-Erinnerung
- Installation auf Android/iOS und Push nach Schließen der App
- Berechtigungen: keine fremden Personen/Dienste bearbeiten; kein OVD-Planungspasswort in der App

Die bisherige `/infoscreen/`-Startseite wird durch diese App nicht verändert.
