# Hantel KI-Worker

Kleines Backend für die KI-Funktionen (Foto → Nährwerte, Rezept aus Zutaten, Rezepte im Web, Freitext, PDF-Import).
Der OpenAI-Key liegt **nur hier** als Secret – nie in der App.

`index.js` ist generiert: Quelle sind `worker.src.js` + `../js/ai-tasks.js` (Prompts/Schemas, geteilt mit der App).
Nach Änderungen: `powershell -File tools\build-worker.ps1` und `index.js` neu deployen.

## Deploy ohne Node (Cloudflare-Dashboard)

1. Cloudflare-Konto (kostenlos) → **Workers & Pages → Create → Create Worker** → Name z.B. `hantel-ai` → Deploy.
2. **Edit code** → kompletten Inhalt von `worker/index.js` einfügen → **Deploy**.
3. **Settings → Variables and Secrets**:
   - `OPENAI_API_KEY` (Secret) – dein OpenAI-Key
   - `APP_TOKEN` (Secret) – ein langes Zufallspasswort, z.B. 32 Zeichen; dasselbe trägst du in der App ein
   - `OPENAI_MODEL` (Text) – z.B. `gpt-5-mini`; optional `OPENAI_VISION_MODEL`, `OPENAI_SEARCH_MODEL`
   - optional `ALLOWED_ORIGINS`, `DAILY_LIMIT`, `RATE_PER_10MIN`, `MAX_CONCURRENT`, `TIMEOUT_MS`
4. Optional, empfohlen: **Storage & Databases → KV → Create namespace** `hantel-kv`, dann im Worker unter
   **Settings → Bindings → KV Namespace** als `HANTEL_KV` binden (Limits/Zähler gelten dann global statt pro Instanz).
5. Die Worker-URL (`https://hantel-ai.<dein-name>.workers.dev`) und das `APP_TOKEN` in der App unter
   **Mehr → KI → Hantel-Server** eintragen → „Verbindung testen“.

## Deploy mit Wrangler (Node)

```
cd worker
npx wrangler login
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put APP_TOKEN
npx wrangler deploy
```

## Schutz

- Zugangstoken (`X-App-Token`) – ohne Token 401
- CORS nur für `ALLOWED_ORIGINS`
- Rate-Limit pro IP (10-Minuten-Fenster), Tageslimit gesamt, max. parallele Anfragen, Timeout
- Eingabeprüfung (Bildformat/-größe, Textlängen, Zutatenlisten) und Schema-Prüfung der KI-Antwort
- Zähler `usage:<tag>` / `usage:<monat>` → `GET /ai/usage` (in der App sichtbar)

## Endpunkte

`POST /ai/food-text` · `POST /ai/food-image` · `POST /ai/recipe` · `POST /ai/web-recipes` · `POST /ai/pdf-plans` · `GET /ai/usage`

Antwort: `{ ok: true, data, model, tokens, usage }` oder `{ ok: false, error }` mit HTTP-Status.
