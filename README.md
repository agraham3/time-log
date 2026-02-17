# time-log

A lightweight consultant time tracker with CSV storage.

## Features
- Add time entries with either:
  - start/end time (minutes auto-calculated), or
  - direct minutes entry.
- Capture task, notes, billable flag, client name, and AI usage minutes.
- Enforce **client name required when billable is true**.
- Weekly report extraction for quick copy/export into external time systems.
- Weekly CSV download with detail rows + billable totals by client.

## Data columns
The CSV storage file (`data/time_entries.csv`) uses:
- `date`
- `time_start`
- `time_end`
- `minutes`
- `task`
- `notes`
- `billable`
- `client_name`
- `ai_minutes`

## Run locally
```bash
npm start
```
Then open: `http://localhost:3000`

## API
### Add entry
`POST /entries`

Example body:
```json
{
  "date": "2026-02-16",
  "time_start": "09:00",
  "time_end": "10:00",
  "task": "Client call",
  "notes": "Status update",
  "billable": true,
  "client_name": "Acme Corp",
  "ai_minutes": 10
}
```

### Weekly report
`GET /report/weekly?week_start=YYYY-MM-DD`

CSV download:
`GET /report/weekly?week_start=YYYY-MM-DD&format=csv`

## Tests
```bash
npm test
```
