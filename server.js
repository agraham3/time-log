const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { addEntry, ensureStore, getAllEntries } = require('./src/csvStore');
const { normalizeEntry, summarizeWeek, REQUIRED_HEADERS, formatCsvRow } = require('./src/timeEntry');

const publicDir = path.join(__dirname, 'public');

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(payload));
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });

    request.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON body.'));
      }
    });

    request.on('error', () => reject(new Error('Request parsing failed.')));
  });
}

function serveFile(response, filePath, contentType) {
  if (!fs.existsSync(filePath)) {
    response.writeHead(404);
    response.end('Not Found');
    return;
  }

  response.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(response);
}

function toWeeklyCsv(summary) {
  const rows = [[
    'date',
    'minutes',
    'billable',
    'client_name',
    'task',
    'notes',
    'ai_minutes'
  ].join(',')];

  for (const entry of summary.entries) {
    rows.push([
      entry.date,
      entry.minutes,
      entry.billable,
      entry.client_name,
      entry.task,
      entry.notes,
      entry.ai_minutes
    ].map((value) => String(value).includes(',') ? `"${String(value).replaceAll('"', '""')}"` : value).join(','));
  }

  rows.push('');
  rows.push('Billable by client');
  rows.push('client_name,minutes');

  for (const group of summary.billable_by_client) {
    rows.push(`${group.client_name},${group.minutes}`);
  }

  rows.push(`Total minutes,${summary.total_minutes}`);
  rows.push(`Billable minutes,${summary.billable_minutes}`);
  rows.push(`Non billable minutes,${summary.non_billable_minutes}`);

  return rows.join('\n');
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');

  if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    serveFile(response, path.join(publicDir, 'index.html'), 'text/html; charset=utf-8');
    return;
  }

  if (request.method === 'GET' && url.pathname === '/app.js') {
    serveFile(response, path.join(publicDir, 'app.js'), 'application/javascript; charset=utf-8');
    return;
  }

  if (request.method === 'GET' && url.pathname === '/styles.css') {
    serveFile(response, path.join(publicDir, 'styles.css'), 'text/css; charset=utf-8');
    return;
  }

  if (request.method === 'POST' && url.pathname === '/entries') {
    try {
      const payload = await parseBody(request);
      const normalized = normalizeEntry(payload);
      addEntry(normalized);
      sendJson(response, 201, { message: 'Entry added.', entry: normalized });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/entries') {
    const entries = getAllEntries();
    sendJson(response, 200, { entries });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/report/weekly') {
    try {
      const weekStart = url.searchParams.get('week_start');
      if (!weekStart) {
        throw new Error('week_start query param is required.');
      }

      const entries = getAllEntries();
      const summary = summarizeWeek(entries, weekStart);
      const format = (url.searchParams.get('format') || 'json').toLowerCase();

      if (format === 'csv') {
        const csv = toWeeklyCsv(summary);
        response.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="weekly-report-${weekStart}.csv"`
        });
        response.end(csv);
        return;
      }

      sendJson(response, 200, summary);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/template.csv') {
    response.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="time-entry-template.csv"'
    });
    response.end(`${REQUIRED_HEADERS.join(',')}\n${formatCsvRow({
      date: '2026-02-17',
      time_start: '09:00',
      time_end: '10:00',
      minutes: '60',
      task: 'Example task',
      notes: 'Example notes',
      billable: 'true',
      client_name: 'Acme Corp',
      ai_minutes: '5'
    })}\n`);
    return;
  }

  response.writeHead(404, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = process.env.PORT || 3000;
ensureStore();
server.listen(PORT, () => {
  console.log(`Time log app running at http://localhost:${PORT}`);
});
