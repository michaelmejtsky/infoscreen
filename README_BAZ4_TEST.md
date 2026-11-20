# BAZ 4.0 V0.3 – Cloudflare Workers Testbranch

**Nur schreibgeschützter Pilot.** Bestehende BAZ und den produktiven GitHub-Pages-Infoscreen keinesfalls überschreiben.

## Richtiges Deployment: Cloudflare Workers (nicht Cloudflare Pages)

Das bestehende Cloudflare-Projekt heißt `infoscreen` und ist ein **Worker**. Dessen Worker-URL endet auf `workers.dev`.

- Verbundenes GitHub-Repository: `michaelmejtsky/infoscreen`
- Testbranch: `baz4-v0-3-cloudflare-test`
- Datei `wrangler.jsonc` im Repository-Stamm: Cloudflare-Worker-Konfiguration
- `src/worker.js`: echte Worker-Einstiegsdatei für API-Operationen
- `public/index.html`, `public/styles.css`, `public/app.js`: statische BAZ-4.0-Oberfläche
- `run_worker_first: ["/api/*"]`: API-Anfragen erreichen Worker-Code statt HTTP 404 aus dem Asset-Server
- `BAZ4_DEMO: "true"`: serverseitig alle Schreibvorgänge gesperrt

### Einstellungen im Cloudflare-Dashboard

Unter **Workers & Pages → infoscreen → Settings → Build** den GitHub-Branch und die Deployments überprüfen:

- Production branch kann beim bestehenden Projekt abweichen. **Nicht das ursprüngliche Infoscreen-Produktionssystem verändern.**
- **Non-production branch builds / Worker Previews** für den Testbranch aktivieren.
- Build command: leer, wenn Cloudflare Build das Projekt direkt erkennt.
- Deploy command: `npx wrangler deploy --config wrangler.jsonc` falls kein automatischer Deploy-Befehl eingetragen ist.
- Root directory: Repository-Stamm.
- Preview URL aus Cloudflare **Deployments** übernehmen; nicht aus dem Branchnamen erraten.

Der Branch-Preview-Aufruf `/api/v1/health` muss `{"ok":true,"mode":"demo","readOnly":true}` liefern. Bei HTTP 404 wurde noch die alte Asset-only-Bereitstellung veröffentlicht oder die Vorschau ist nicht online.

### Bestehende Projekte und Sicherheit

Der GitHub-Branch `main` von `michaelmejtsky/infoscreen` und der bestehende Ordner `ovd/` werden nicht bearbeitet. Dieser Testbranch ersetzt **weder** den aktiven Apps-Script-Infoscreen noch die OVD-Verwaltung.

`Infoscreen Live` in BAZ 4.0 ist nur eine schreibgeschützte Vorschau des öffentlichen Infoscreens. Bestehende Alarm-, Dienst- und Verwaltungssysteme werden nicht geändert.

Dieses Repository ist öffentlich. Keine Zugangsdaten, internen Serverpfade, Einsatzdaten oder personenbezogenen Informationen in GitHub einchecken. Für die spätere Freigabe Cloudflare Access, separaten internen Python-Service, freigegebene Sheets-Testkopie und vollständige Integrations-/Sicherheitstests vorsehen.

**Pilotstatus:** Nur Demooberfläche und API-Verbindungsprüfung. Kein produktiver Schreibbetrieb.
