export const dashboardReports = [
  'total',
  'hits',
  'toprefs',
  'browsers',
  'systems',
  'locations',
  'languages',
  'sizes',
  'campaigns'
];

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorMessage(error) {
  return error instanceof Error ? error.message : 'Unable to load this report.';
}

function dashboardRange(now) {
  const end = new Date(now);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label: 'Last 30 days'
  };
}

export function createDashboardService({
  apiBaseUrl,
  apiToken,
  cacheTtlMilliseconds = 600000,
  requestIntervalMilliseconds = 350,
  requestTimeoutMilliseconds = 10000,
  rowLimit = 10,
  initialDashboard,
  fetchImplementation = fetch,
  now = () => new Date()
}) {
  let cachedDashboard = initialDashboard;
  let refreshPromise;
  let nextRequestStart = 0;

  async function fetchReport(name, range) {
    const requestStart = Math.max(Date.now(), nextRequestStart);
    nextRequestStart = requestStart + requestIntervalMilliseconds;
    await wait(requestStart - Date.now());

    const upstreamUrl = new URL(name, `${apiBaseUrl.replace(/\/$/, '')}/`);
    upstreamUrl.searchParams.set('start', range.start);
    upstreamUrl.searchParams.set('end', range.end);

    if (name !== 'total') {
      upstreamUrl.searchParams.set('limit', String(rowLimit));
    }

    const response = await fetchImplementation(upstreamUrl, {
      signal: AbortSignal.timeout(requestTimeoutMilliseconds),
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`GoatCounter returned ${response.status} for ${name}.`);
    }

    return response.json();
  }

  async function refreshDashboard() {
    const range = dashboardRange(now());
    const lastAttemptAt = now().toISOString();
    const results = await Promise.allSettled(
      dashboardReports.map(async (name) => [name, await fetchReport(name, range), now().toISOString()])
    );
    const data = { ...cachedDashboard?.data };
    const reportMetadata = { ...cachedDashboard?.reportMetadata };
    const errors = {};

    results.forEach((result, index) => {
      const name = dashboardReports[index];
      if (result.status === 'fulfilled') {
        data[name] = result.value[1];
        reportMetadata[name] = { updatedAt: result.value[2], range };
      } else {
        data[name] ??= null;
        errors[name] = errorMessage(result.reason);
      }
    });

    if (Object.keys(errors).length === dashboardReports.length
      && !dashboardReports.some((name) => data[name] != null)) {
      throw new Error('Unable to load GoatCounter dashboard data.');
    }

    const dashboard = {
      generatedAt: now().toISOString(),
      range,
      lastAttemptAt,
      stale: Object.keys(errors).length > 0,
      data,
      reportMetadata,
      errors
    };

    cachedDashboard = dashboard;

    return dashboard;
  }

  return {
    async getDashboard() {
      const cacheIsFresh = cachedDashboard
        && now().getTime() - Date.parse(cachedDashboard.generatedAt) < cacheTtlMilliseconds;

      if (cacheIsFresh) {
        return cachedDashboard;
      }

      if (!refreshPromise) {
        refreshPromise = refreshDashboard()
          .finally(() => {
            refreshPromise = undefined;
          });
      }

      return refreshPromise;
    }
  };
}