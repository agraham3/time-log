const REQUIRED_HEADERS = [
  'date',
  'time_start',
  'time_end',
  'minutes',
  'task',
  'notes',
  'billable',
  'client_name',
  'ai_minutes'
];

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  throw new Error('Billable must be true or false.');
}

function parseMinutes(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative number.`);
  }
  return Math.round(parsed);
}

function parseTime(date, timeString, fieldName) {
  if (!timeString) return null;
  const trimmed = String(timeString).trim();
  if (!/^\d{2}:\d{2}$/.test(trimmed)) {
    throw new Error(`${fieldName} must be in HH:MM format.`);
  }

  const [hours, minutes] = trimmed.split(':').map(Number);
  if (hours > 23 || minutes > 59) {
    throw new Error(`${fieldName} is invalid.`);
  }

  return new Date(`${date}T${trimmed}:00`);
}

function getEntryMinutes(entry) {
  const date = String(entry.date ?? '').trim();
  const startInput = String(entry.time_start ?? '').trim();
  const endInput = String(entry.time_end ?? '').trim();

  if (startInput && endInput && date) {
    const start = parseTime(date, startInput, 'Start time');
    const end = parseTime(date, endInput, 'End time');
    if (end <= start) {
      throw new Error('End time must be after start time.');
    }

    return Math.round((end - start) / 60000);
  }

  return parseMinutes(entry.minutes, 'Minutes') ?? 0;
}

function escapeCsvValue(value) {
  const content = String(value ?? '');
  if (content.includes('"') || content.includes(',') || content.includes('\n')) {
    return `"${content.replaceAll('"', '""')}"`;
  }
  return content;
}

function formatCsvRow(entry) {
  return REQUIRED_HEADERS.map((header) => escapeCsvValue(entry[header])).join(',');
}

function splitCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}

function parseCsv(content) {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];

  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce((entry, header, index) => {
      entry[header] = values[index] ?? '';
      return entry;
    }, {});
  });
}

function normalizeEntry(payload) {
  const date = String(payload.date ?? '').trim();
  const task = String(payload.task ?? '').trim();
  const notes = String(payload.notes ?? '').trim();
  const clientName = String(payload.client_name ?? '').trim();

  if (!date) throw new Error('Date is required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Date must be in YYYY-MM-DD format.');
  if (!task) throw new Error('Task is required.');

  const billable = parseBoolean(payload.billable);
  if (billable && !clientName) {
    throw new Error('Client name is required for billable entries.');
  }

  const startInput = String(payload.time_start ?? '').trim();
  const endInput = String(payload.time_end ?? '').trim();
  const rawMinutes = parseMinutes(payload.minutes, 'Minutes');

  let calculatedMinutes = rawMinutes;
  if (startInput || endInput) {
    if (!startInput || !endInput) {
      throw new Error('Both start and end times are required when one is provided.');
    }

    calculatedMinutes = getEntryMinutes({ date, time_start: startInput, time_end: endInput });
  }

  if (calculatedMinutes === null) {
    throw new Error('Provide minutes or both start and end times.');
  }

  const aiMinutes = parseMinutes(payload.ai_minutes, 'AI minutes') ?? 0;
  const minutesToSave = startInput && endInput ? '' : String(calculatedMinutes);

  return {
    date,
    time_start: startInput,
    time_end: endInput,
    minutes: minutesToSave,
    task,
    notes,
    billable: String(billable),
    client_name: billable ? clientName : '',
    ai_minutes: String(aiMinutes)
  };
}

function getWeekRange(weekStart) {
  const start = new Date(`${weekStart}T00:00:00`);
  if (Number.isNaN(start.getTime())) {
    throw new Error('week_start must be in YYYY-MM-DD format.');
  }

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return { start, end };
}

function toDateValue(dateString) {
  return new Date(`${dateString}T00:00:00`);
}

function summarizeWeek(entries, weekStart) {
  const { start, end } = getWeekRange(weekStart);

  const inWeek = entries.filter((entry) => {
    const current = toDateValue(entry.date);
    return current >= start && current <= end;
  });

  const byClient = {};
  let billableMinutes = 0;
  let nonBillableMinutes = 0;

  for (const entry of inWeek) {
    const minutes = getEntryMinutes(entry);
    if (entry.billable === 'true') {
      const client = (entry.client_name || 'UNKNOWN').trim().toLowerCase();
      byClient[client] = (byClient[client] || 0) + minutes;
      billableMinutes += minutes;
    } else {
      nonBillableMinutes += minutes;
    }
  }

  return {
    week_start: weekStart,
    week_end: end.toISOString().slice(0, 10),
    total_minutes: billableMinutes + nonBillableMinutes,
    billable_minutes: billableMinutes,
    non_billable_minutes: nonBillableMinutes,
    billable_by_client: Object.entries(byClient).map(([client_name, minutes]) => ({
      client_name,
      minutes
    })),
    entries: inWeek
  };
}

module.exports = {
  REQUIRED_HEADERS,
  formatCsvRow,
  getEntryMinutes,
  normalizeEntry,
  parseCsv,
  summarizeWeek
};
