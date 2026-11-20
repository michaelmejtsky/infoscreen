# BAZ 4.0 – isolierter Cloudflare-Testbranch

**Nur ein Pilot mit Demodaten und gesperrten Schreibvorgängen. Nicht für den produktiven BAZ-Dienst freigeben.**

## Cloudflare Pages mit dem bereits verbundenen Repository

- Repository: `michaelmejtsky/infoscreen`
- Branch für dieses neue **Testprojekt**: `baz4-v0-3-cloudflare-test`
- Framework: `None`
- Build-Befehl: leer
- Ausgabeordner: `.` (Repository-Stamm)
- Dashboard: Pages-Projekt → Settings → Builds → Branch control → Production branch ändern.

Die Dateien `index.html`, `styles.css`, `app.js` und `_worker.js` enthalten die V0.3-Testoberfläche und eine Worker-API. Der Worker verwendet Cloudflare Pages `env.ASSETS`. Ohne explizite Konfiguration bleibt `BAZ4_DEMO` aktiv (alle Schreibvorgänge gesperrt).

**Vermeide unbedingt** `BAZ4_DEMO=false` ohne vollständig konfigurierte Cloudflare Access-Anmeldung, abgesicherten Python-Dokumentendienst, eigene Testdatenbank und Vor-Ort-Tests.

## Verbindung zum bestehenden Infoscreen

Die Oberfläche enthält `Infoscreen Live` mit manuell ladbarer Vorschau von
https://michaelmejtsky.github.io/infoscreen/ .
Sie **ändert keine** Apps-Script-, PlaySignage-, OVD- oder GitHub-Pages-Endpunkte.

Der Branch `main` behält die bisherige produktive Infoscreen-Seite unverändert bei. Die existierende `ovd/`-Ordnerstruktur wird auf diesem Branch übernommen, aber nicht verändert oder in die neue BAZ 4.0 migriert. Der dortige OVD-Client hat derzeit keine konfigurierte API.

**Hinweis zur Sicherheit:** Dieses GitHub-Repository ist öffentlich. Keine personenbezogenen Dienstbuchdaten, Einsatzdaten, privaten Dateipfade oder Schlüssel ins Repository committen. Alle Secrets ausschließlich über die abgesicherte Cloudflare-Umgebung konfigurieren.

## Rollback

Das neue Cloudflare-Testprojekt kann auf einen anderen Branch oder eine vorherige Deployment-Version zurückgestellt werden. Die bestehende GitHub-Pages-Infoscreen-Seite auf `main` wird von diesem Pilotbranch nicht beeinflusst.
