const entryForm = document.querySelector('#entry-form');
const entryDateInput = document.querySelector('#entry-date');
const billableCheckbox = document.querySelector('#billable');
const clientLabel = document.querySelector('#client-label');
const clientInput = document.querySelector('#client-name');
const entryMessage = document.querySelector('#entry-message');
const reportMessage = document.querySelector('#report-message');
const rawMessage = document.querySelector('#raw-message');
const reportSummary = document.querySelector('#report-summary');
const reportTable = document.querySelector('#report-table');
const reportBody = reportTable.querySelector('tbody');
const rawTable = document.querySelector('#raw-table');
const rawBody = rawTable.querySelector('tbody');
const weekStartInput = document.querySelector('#week-start');
const tabButtons = document.querySelectorAll('.tab-button');
const weeklyView = document.querySelector('#weekly-view');
const rawView = document.querySelector('#raw-view');

function setMessage(element, text, type) {
  element.textContent = text;
  element.classList.remove('error', 'success');
  if (type) element.classList.add(type);
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getMonday(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

function initializeDefaults() {
  const today = getToday();
  entryDateInput.value = today;
  weekStartInput.value = getMonday(today);
}

function switchTab(tabName) {
  const weeklyActive = tabName === 'weekly';
  weeklyView.classList.toggle('hidden', !weeklyActive);
  rawView.classList.toggle('hidden', weeklyActive);

  tabButtons.forEach((button) => {
    const active = button.dataset.tab === tabName;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
}

billableCheckbox.addEventListener('change', () => {
  const show = billableCheckbox.checked;
  clientLabel.classList.toggle('hidden', !show);
  clientInput.required = show;
  if (!show) clientInput.value = '';
});

entryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(entryForm);
  const payload = Object.fromEntries(formData.entries());
  payload.billable = billableCheckbox.checked;

  try {
    const response = await fetch('/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to save entry.');

    setMessage(entryMessage, 'Entry saved.', 'success');
    entryForm.reset();
    entryDateInput.value = getToday();
    billableCheckbox.dispatchEvent(new Event('change'));
  } catch (error) {
    setMessage(entryMessage, error.message, 'error');
  }
});

async function loadWeeklyReport() {
  const weekStart = weekStartInput.value;
  if (!weekStart) {
    setMessage(reportMessage, 'Please select a week start date.', 'error');
    return;
  }

  try {
    const response = await fetch(`/report/weekly?week_start=${encodeURIComponent(weekStart)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to load report.');

    setMessage(reportMessage, 'Weekly report loaded.', 'success');
    reportSummary.innerHTML = `
      <p><strong>Range:</strong> ${data.week_start} to ${data.week_end}</p>
      <p><strong>Non-billable total:</strong> ${data.non_billable_minutes} minutes</p>
      <p><strong>Billable total:</strong> ${data.billable_minutes} minutes</p>
      <p><strong>Billable by client:</strong> ${data.billable_by_client.map((row) => `${row.client_name}: ${row.minutes}m`).join(', ') || 'None'}</p>
    `;

    reportBody.innerHTML = data.entries.map((entry) => `
      <tr>
        <td>${entry.date}</td>
        <td>${entry.task}</td>
        <td>${entry.minutes}</td>
        <td>${entry.billable}</td>
        <td>${entry.client_name}</td>
      </tr>
    `).join('');

    reportTable.classList.toggle('hidden', data.entries.length === 0);
  } catch (error) {
    setMessage(reportMessage, error.message, 'error');
  }
}

async function loadRawData() {
  try {
    const response = await fetch('/entries');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to load raw CSV data.');

    rawBody.innerHTML = data.entries.map((entry) => `
      <tr>
        <td>${entry.date}</td>
        <td>${entry.task}</td>
        <td>${entry.minutes}</td>
        <td>${entry.billable}</td>
        <td>${entry.client_name}</td>
        <td>${entry.notes}</td>
        <td>${entry.ai_minutes}</td>
      </tr>
    `).join('');

    rawTable.classList.toggle('hidden', data.entries.length === 0);
    setMessage(rawMessage, `Loaded ${data.entries.length} CSV row(s).`, 'success');
  } catch (error) {
    setMessage(rawMessage, error.message, 'error');
  }
}

document.querySelector('#load-report').addEventListener('click', loadWeeklyReport);

document.querySelector('#download-report').addEventListener('click', () => {
  const weekStart = weekStartInput.value;
  if (!weekStart) {
    setMessage(reportMessage, 'Please select a week start date before downloading.', 'error');
    return;
  }

  window.open(`/report/weekly?week_start=${encodeURIComponent(weekStart)}&format=csv`, '_blank');
});

document.querySelector('#load-raw').addEventListener('click', loadRawData);

document.querySelector('#download-raw').addEventListener('click', () => {
  window.open('/entries?format=csv', '_blank');
});

tabButtons.forEach((button) => {
  button.addEventListener('click', () => switchTab(button.dataset.tab));
});

initializeDefaults();
billableCheckbox.dispatchEvent(new Event('change'));
