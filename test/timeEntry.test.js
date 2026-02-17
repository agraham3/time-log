const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEntry, summarizeWeek } = require('../src/timeEntry');

test('normalizeEntry computes minutes from start/end and requires client for billable', () => {
  const result = normalizeEntry({
    date: '2026-02-16',
    time_start: '09:00',
    time_end: '10:30',
    task: 'Client workshop',
    notes: 'Prep and run workshop',
    billable: true,
    client_name: 'Acme',
    ai_minutes: 20
  });

  assert.equal(result.minutes, '90');
  assert.equal(result.client_name, 'Acme');
  assert.equal(result.billable, 'true');
});

test('normalizeEntry supports direct minute entry for non-billable', () => {
  const result = normalizeEntry({
    date: '2026-02-16',
    minutes: 45,
    task: 'Internal planning',
    notes: '',
    billable: false,
    ai_minutes: 5
  });

  assert.equal(result.minutes, '45');
  assert.equal(result.client_name, '');
});

test('normalizeEntry rejects billable entries without client name', () => {
  assert.throws(() => normalizeEntry({
    date: '2026-02-16',
    minutes: 30,
    task: 'Billable task',
    billable: true
  }), /Client name is required/);
});

test('summarizeWeek groups billable minutes by client', () => {
  const summary = summarizeWeek([
    { date: '2026-02-16', minutes: '60', billable: 'true', client_name: 'Acme' },
    { date: '2026-02-17', minutes: '30', billable: 'true', client_name: 'Globex' },
    { date: '2026-02-18', minutes: '15', billable: 'false', client_name: '' },
    { date: '2026-02-25', minutes: '99', billable: 'true', client_name: 'Acme' }
  ], '2026-02-16');

  assert.equal(summary.total_minutes, 105);
  assert.equal(summary.billable_minutes, 90);
  assert.equal(summary.non_billable_minutes, 15);
  assert.deepEqual(summary.billable_by_client, [
    { client_name: 'acme', minutes: 60 },
    { client_name: 'globex', minutes: 30 }
  ]);
});
