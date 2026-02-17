const fs = require('node:fs');
const path = require('node:path');
const { REQUIRED_HEADERS, formatCsvRow, parseCsv } = require('./timeEntry');

const dataDir = path.join(__dirname, '..', 'data');
const csvPath = path.join(dataDir, 'time_entries.csv');

function ensureStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(csvPath)) {
    fs.writeFileSync(csvPath, `${REQUIRED_HEADERS.join(',')}\n`, 'utf8');
  }
}

function addEntry(entry) {
  ensureStore();
  fs.appendFileSync(csvPath, `${formatCsvRow(entry)}\n`, 'utf8');
}

function getAllEntries() {
  ensureStore();
  const content = fs.readFileSync(csvPath, 'utf8');
  return parseCsv(content);
}

module.exports = {
  addEntry,
  csvPath,
  ensureStore,
  getAllEntries
};
