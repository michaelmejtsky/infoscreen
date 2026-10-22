# Weihnachten im Park 2026 – Helferplanung Käsehütte

Zeitraum: **4.–6. Dezember 2026**. Mobile Anmeldeseite, Zeitwünsche, Änderungen, persönlicher Fixplan und Admin-Dienstplan.

## Architektur
- \`index.html\`: öffentliche Oberfläche über GitHub Pages (ohne Google-Balken)
- \`config.js\`: Adresse der Google-Apps-Script-Webapp (kein Passwort hineinschreiben!)
- \`Code.gs\`: Backend auf Google Apps Script; schreibt in Google Sheets
- Datenbank: https://docs.google.com/spreadsheets/d/1-wyGW6BNzV9eq2Xks07e1bieB4dfVa16sSebLN0jE5Q/edit

## Einmalige Einrichtung

1. https://script.google.com/home/projects öffnen, **Neues Projekt** erstellen.
2. \`Code.gs\` aus diesem Ordner vollständig in die Datei \`Code.gs\` kopieren.
3. Funktion \`setupWIP\` wählen → **Ausführen** → Berechtigungen gewähren.
4. Im Ausführungsprotokoll den **Admin-Schlüssel** kopieren und privat aufbewahren. Alternativ in den Skripteigenschaften \`WIP_ADMIN_KEY\` ansehen. **Niemals bei GitHub speichern.**
5. Bereitstellen → **Neue Bereitstellung** → Typ **Web-App** → Ausführen als **Ich** → Zugriff **Jeder** → Bereitstellen. Die \`/exec\`-URL kopieren.
6. In \`config.js\` die URL zwischen die Anführungszeichen eintragen und auf GitHub speichern.
7. GitHub Pages für das verwendete öffentliche Repository aktivieren: Einstellungen → Pages → Deploy from a branch → \`main\`, \`/(root)\`. Der Ordner wird unter \`https://michaelmejtsky.github.io/infoscreen/weihnachten-im-park-2026/\` erreichbar, **sofern GitHub Pages dort aktiviert ist**.

## Benutzung

Helfer senden Verfügbarkeiten und Wünsche ohne Konto, erhalten auf demselben Gerät einen persönlichen Bearbeitungszugang (Browser-Speicher). Im Reiter „Meine Einteilung“ sehen sie nach der Veröffentlichung ihre fixen Zeiten. Als Organisator unter „Verwaltung“ den geheimen Admin-Schlüssel eingeben, Dienste als Entwurf anlegen und über „Plan veröffentlichen“ fixieren.

**Datenschutz:** Personen mit dem Anmelde-Link können den veröffentlichten Dienstplan sehen. Namen werden nur angezeigt, wenn die jeweilige Person beim Eintragen ausdrücklich zugestimmt hat; sonst steht „Helfer:in“. Telefonnummern und Notizen stehen nur im Adminbereich. Das Backend benötigt die öffentliche Apps-Script-Webapp; bitte nicht den Google-Sheet-Link oder den Admin-Schlüssel in der WhatsApp-Gruppe teilen. Verfügbarkeit ist keine automatische fixe Zusage.

**Hinweis:** Ohne Script-Bereitstellung und URL in \`config.js\` ist die Seite nur eine Vorschau und nimmt keine Anmeldungen entgegen. GitHub Pages braucht möglicherweise wenige Minuten zum Aktualisieren.
