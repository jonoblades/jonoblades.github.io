const apiOrigin = new URLSearchParams(window.location.search).get('dashboard-api')
  || document.querySelector('script[data-dashboard-api]')?.dataset.dashboardApi
  || (['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'http://localhost:4174' : '');
const snapshotKey = `site-visits:${apiOrigin}`;
const range = document.querySelector('#dashboard-range');
const status = document.querySelector('#dashboard-status');
const total = document.querySelector('#visit-total');
const trendCanvas = document.querySelector('#visit-trend');
const trendEmpty = document.querySelector('#visit-trend-empty');
const topPages = document.querySelector('#top-pages');
const breakdowns = document.querySelector('#dashboard-breakdowns');
const numberFormatter = new Intl.NumberFormat('en-GB');
const breakdownReports = [
  ['toprefs', 'Top referrers'],
  ['browsers', 'Browsers'],
  ['systems', 'Operating systems'],
  ['locations', 'Locations'],
  ['languages', 'Languages'],
  ['sizes', 'Screen sizes'],
  ['campaigns', 'Campaigns']
];
const sizeLabels = {
  phone: 'Phones',
  mobile: 'Phones',
  tablet: 'Tablets and large phones',
  desktop: 'Computer monitors',
  desktophd: 'Computer monitors larger than HD',
  unknown: 'Unknown'
};
let trendChart;
let currentDashboard;
const barObserver = new IntersectionObserver((entries) => {
  entries.forEach(({ target, isIntersecting }) => {
    target.classList.toggle('in-view', isIntersecting);
  });
});

function numericValue(value) {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function reportRows(report) {
  if (Array.isArray(report)) {
    return report;
  }

  if (report && typeof report === 'object') {
    return Object.values(report).find(Array.isArray) || [];
  }

  return [];
}

function countFor(item) {
  if (typeof item === 'number' || typeof item === 'string') {
    return numericValue(item);
  }

  if (!item || typeof item !== 'object') {
    return null;
  }

  return numericValue(item.count ?? item.hits ?? item.visits ?? item.value ?? item.total ?? item.daily);
}

function labelFor(item, index) {
  if (!item || typeof item !== 'object') {
    return `Item ${index + 1}`;
  }

  return item.path || item.page || item.name || item.event || item.referrer || item.browser
    || item.system || item.location || item.language || item.size || item.day || item.date
    || sizeLabels[item.id] || item.id || `Item ${index + 1}`;
}

function entriesFor(report, filter = false) {
  return reportRows(report)
    .map((item, index) => [labelFor(item, index), countFor(item)])
    .filter(([, count]) => (count !== null && (!filter || count > 0)));
}

function setMessage(container, message) {
  container.replaceChildren();
  const paragraph = document.createElement('p');
  paragraph.textContent = message;
  container.append(paragraph);
}

function chartColours() {
  const palette = document.createElement('span');
  palette.className = 'chart-palette';
  document.body.append(palette);
  const styles = getComputedStyle(palette);
  const colours = {
    line: styles.color || '#19737c',
    fill: styles.backgroundColor || 'rgba(49, 151, 149, 0.18)',
    grid: styles.borderTopColor || 'rgba(44, 82, 130, 0.5)',
    text: styles.outlineColor || '#4a5568'
  };
  palette.remove();
  return colours;
}

function chartDate(dateLabel, options) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateLabel)) {
    return dateLabel;
  }

  const date = new Date(`${dateLabel}T00:00:00Z`);
  if (options.compact) {
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${day}-${month}`;
  }

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    ...options
  }).format(date);
}

function chartTick(dateLabel, index) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateLabel)) {
    return dateLabel;
  }

  const date = new Date(`${dateLabel}T00:00:00Z`);
  if (index === 0 || date.getUTCDate() === 1) {
    return new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      timeZone: 'UTC'
    }).format(date).toUpperCase();
  }

  return String(date.getUTCDate()).padStart(2, '0');
}

function chartFill(context, colour) {
  const { chartArea, ctx } = context.chart;
  if (!chartArea) {
    return colour;
  }

  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  gradient.addColorStop(0, colour);
  gradient.addColorStop(0.45, colour);
  gradient.addColorStop(0.7, 'transparent');
  gradient.addColorStop(0.95, colour);
  return gradient;
}

function renderTrend(report) {
  const entries = entriesFor(report);
  trendChart?.destroy();
  if (typeof Chart !== 'function') {
    trendCanvas.hidden = true;
    trendEmpty.hidden = false;
    trendEmpty.textContent = 'Visit chart unavailable.';
    return;
  }
  trendCanvas.hidden = entries.length === 0;
  trendEmpty.hidden = entries.length !== 0;

  if (entries.length === 0) {
    return;
  }

  const colours = chartColours();
  trendChart = new Chart(trendCanvas, {
    type: 'line',
    data: {
      labels: entries.map(([label]) => label),
      datasets: [{
        label: 'Visits',
        data: entries.map(([, value]) => value),
        backgroundColor: (context) => chartFill(context, colours.fill),
        borderColor: colours.line,
        fill: true,
        tension: 0.3,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (contexts) => chartDate(contexts[0]?.label || '', {
              dateStyle: 'full'
            })
          }
        }
      },
      scales: {
        x: {
          grid: { color: colours.grid },
          ticks: {
            color: colours.text,
            callback(value, index) {
              return chartTick(this.getLabelForValue(value), index);
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: { color: colours.grid },
          ticks: { color: colours.text, precision: 0 }
        }
      },
      interaction: {
        mode: 'nearest',
        intersect: false,
        axis: 'x'
      },
      animations: {
        y: {
          duration: 500,
          easing: 'easeOutCirc',
          from: (ctx) => {
            if (ctx.type === 'data') {
              if (ctx.mode === 'default' && !ctx.dropped) {
                ctx.dropped = true;
                return ctx.chart.scales.y.getPixelForValue(0);
              }
            }
          }
        }
      },
    }
  });
}

function renderReport(container, report, error, filter = false) {
  if (error && report == null) {
    setMessage(container, 'This report is currently unavailable.');
    return;
  }

  const entries = entriesFor(report, filter);
  if (entries.length === 0) {
    setMessage(container, 'Nothing to display for this period.');
    return;
  }

  const maximum = Math.max(...entries.map(([, count]) => count));
  const list = document.createElement('ol');
  list.className = 'report-list';

  entries.slice(0, 10).forEach(([label, count], index) => {
    const item = document.createElement('li');
    const name = document.createElement('span');
    const bar = document.createElement('span');
    const value = document.createElement('strong');
    name.textContent = label;
    bar.className = 'report-bar';
    bar.style.setProperty('--report-bar-size', `${maximum ? (count / maximum) * 100 : 0}%`);
    bar.style.setProperty('--report-bar-delay', `calc(${index} * 0.1s)`);
    bar.dataset.tooltip = `${label}: ${numberFormatter.format(count)}`;
    value.textContent = numberFormatter.format(count);
    item.append(name, bar, value);
    list.append(item);
    barObserver.observe(bar);
  });

  container.replaceChildren(list);
}

function renderTimestamp(container, dashboard, name) {
  if (!container) {
    return;
  }
  container.replaceChildren();
  const metadata = dashboard.reportMetadata?.[name];
  if (!metadata) {
    container.textContent = 'Not yet updated.';
    return;
  }
  const time = document.createElement('time');
  time.dateTime = metadata.updatedAt;
  time.textContent = new Date(metadata.updatedAt).toLocaleString('en-GB');
  container.append('Updated ', time, `. ${metadata.range.start} to ${metadata.range.end}.`);
  if (dashboard.errors[name]) {
    container.append(' Refresh failed; showing saved data.');
  }
}

function renderDashboard(dashboard) {
  // All bars are rebuilt below, so drop observations of the old ones.
  barObserver.disconnect();
  currentDashboard = dashboard;
  range.textContent = `${dashboard.range.label}: ${dashboard.range.start} to ${dashboard.range.end}`;
  total.textContent = dashboard.data.total == null ? '-' : numberFormatter.format(
    entriesFor(dashboard.data.total).reduce((sum, [, count]) => sum + count, 0)
  );
  status.textContent = dashboard.stale
    ? 'Some reports could not refresh. Their previous data is retained where available.'
    : `Last refresh ${new Date(dashboard.lastAttemptAt || dashboard.generatedAt).toLocaleString('en-GB')}.`;

  renderTimestamp(document.querySelector('#visit-total-updated'), dashboard, 'total');
  renderTimestamp(document.querySelector('#visit-trend-updated'), dashboard, 'total');
  renderTimestamp(document.querySelector('#top-pages-updated'), dashboard, 'hits');
  renderTrend(dashboard.data.total);
  renderReport(topPages, dashboard.data.hits, dashboard.errors.hits);
  breakdowns.replaceChildren();

  breakdownReports.forEach(([name, title]) => {
    const section = document.createElement('section');
    section.className = 'dashboard-breakdown';
    const heading = document.createElement('h3');
    const updated = document.createElement('p');
    updated.className = 'report-updated';
    const content = document.createElement('div');
    heading.textContent = title;
    section.append(heading, updated, content);
    renderTimestamp(updated, dashboard, name);
    renderReport(content, dashboard.data[name], dashboard.errors[name], true);
    breakdowns.append(section);
  });
}

document.querySelector('#ThemeToggle')?.addEventListener('change', () => {
  if (currentDashboard) {
    renderTrend(currentDashboard.data.total);
  }
});

try {
  const saved = JSON.parse(localStorage.getItem(snapshotKey));
  if (saved?.data && saved?.range && saved?.reportMetadata) {
    renderDashboard(saved);
    status.textContent = 'Showing saved data while connecting.';
  }
} catch {
  status.textContent = 'Connecting to dashboard...';
}

let socket;
let reconnectTimer;
let heartbeatTimer;
let heartbeatDeadline;
let reconnectAttempts = 0;
let stopped = false;

function clearHeartbeat() {
  clearInterval(heartbeatTimer);
  clearTimeout(heartbeatDeadline);
}

function reconnect() {
  if (stopped) {
    return;
  }
  clearHeartbeat();
  clearTimeout(reconnectTimer);
  status.textContent = currentDashboard
    ? 'Disconnected. Showing saved data while retrying.'
    : 'Dashboard unavailable. Retrying connection.';
  const delay = Math.min(300000, 2000 * 2 ** Math.min(reconnectAttempts++, 8));
  reconnectTimer = setTimeout(connect, Math.min(300000, delay + Math.random() * delay * 0.25));
}

function connect() {
  if (stopped || !apiOrigin) {
    return;
  }
  try {
    const endpoint = new URL('/api/dashboard/events', apiOrigin);
    if (!['http:', 'https:'].includes(endpoint.protocol)
      || (window.location.protocol === 'https:' && endpoint.protocol !== 'https:')) {
      throw new Error('An HTTPS dashboard API is required.');
    }
    endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(endpoint);
  } catch {
    reconnect();
    return;
  }
  socket.addEventListener('open', () => {
    clearHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (socket.readyState !== WebSocket.OPEN) {
        return;
      }
      socket.send('ping');
      heartbeatDeadline = setTimeout(() => socket.close(4000, 'Heartbeat timeout.'), 30000);
    }, 60000);
  });
  socket.addEventListener('message', (event) => {
    if (event.data === 'pong') {
      clearTimeout(heartbeatDeadline);
      reconnectAttempts = 0;
      return;
    }
    try {
      const dashboard = JSON.parse(event.data);
      if (dashboard.error || dashboard.status) {
        status.textContent = dashboard.error || dashboard.status;
        if (!currentDashboard && dashboard.error) {
          range.textContent = 'Dashboard unavailable';
          setMessage(topPages, 'No saved dashboard data is available.');
        }
        return;
      }
      if (!dashboard.data || !dashboard.range || !dashboard.reportMetadata) {
        return;
      }
      renderDashboard(dashboard);
      try {
        localStorage.setItem(snapshotKey, JSON.stringify(dashboard));
      } catch {
        return;
      }
    } catch {
      status.textContent = 'Unable to read dashboard update.';
    }
  });
  socket.addEventListener('close', reconnect);
  socket.addEventListener('error', () => {
    status.textContent = currentDashboard
      ? 'Connection unavailable. Showing saved data.'
      : 'Dashboard connection unavailable.';
  });
}

window.addEventListener('pagehide', () => {
  stopped = true;
  clearTimeout(reconnectTimer);
  clearHeartbeat();
  socket?.close();
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted && stopped) {
    stopped = false;
    connect();
  }
});

if (apiOrigin) {
  connect();
} else {
  range.textContent = 'Dashboard unavailable';
  status.textContent = 'Dashboard API is not configured.';
}