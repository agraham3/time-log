const entryForm = document.querySelector('#entry-form');
const billableCheckbox = document.querySelector('#billable');
const clientLabel = document.querySelector('#client-label');
const clientInput = document.querySelector('#client-name');
const entryMessage = document.querySelector('#entry-message');
const reportMessage = document.querySelector('#report-message');
const reportSummary = document.querySelector('#report-summary');
const reportTable = document.querySelector('#report-table');
const reportBody = reportTable.querySelector('tbody');

function setMessage(element, text, type) {
  element.textContent = text;
  element.classList.remove('error', 'success');
  if (type) element.classList.add(type);
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
    billableCheckbox.dispatchEvent(new Event('change'));
  } catch (error) {
    setMessage(entryMessage, error.message, 'error');
  }
});

async function loadReport() {
  const weekStart = document.querySelector('#week-start').value;
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
      <p><strong>Total:</strong> ${data.total_minutes} minutes</p>
      <p><strong>Billable:</strong> ${data.billable_minutes} minutes</p>
      <p><strong>Non-billable:</strong> ${data.non_billable_minutes} minutes</p>
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

document.querySelector('#load-report').addEventListener('click', loadReport);

document.querySelector('#download-report').addEventListener('click', () => {
  const weekStart = document.querySelector('#week-start').value;
  if (!weekStart) {
    setMessage(reportMessage, 'Please select a week start date before downloading.', 'error');
    return;
  }

  window.open(`/report/weekly?week_start=${encodeURIComponent(weekStart)}&format=csv`, '_blank');
});
