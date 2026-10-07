import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dashboard = {
  generatedAt: '2026-10-05T12:00:00.000Z',
  range: {
    label: 'Last 30 days',
    start: '2026-09-06',
    end: '2026-10-05'
  },
  stale: false,
  reportMetadata: Object.fromEntries(['total', 'hits', 'toprefs', 'browsers', 'systems', 'locations', 'languages', 'sizes', 'campaigns']
    .map((name) => [name, {
      updatedAt: '2026-10-05T12:00:00.000Z',
      range: { start: '2026-09-06', end: '2026-10-05' }
    }])),
  errors: {},
  data: {
    total: { total: [{ day: '2026-10-04', count: 2 }, { day: '2026-10-05', count: 3 }] },
    hits: { hits: [{ path: '/', count: 4 }, { path: '/writing', count: 1 }] },
    toprefs: { toprefs: [{ referrer: 'example.test', count: 2 }] },
    browsers: { browsers: [{ browser: 'Chrome', count: 5 }] },
    systems: { systems: [{ system: 'Linux', count: 5 }] },
    locations: { locations: [{ location: 'United Kingdom', count: 5 }] },
    languages: { languages: [{ language: 'English', count: 5 }] },
    sizes: { stats: [{ id: 'desktophd', name: '', count: 5 }] },
    campaigns: { campaigns: [{ name: 'Newsletter', count: 1 }] }
  }
};

function pageMarkup() {
  return `
    <p id="dashboard-range"></p>
    <p id="dashboard-status"></p>
    <p id="visit-total"></p>
    <span id="visit-total-updated" class="info-icon"></span>
    <span id="visit-trend-updated" class="info-icon"></span>
    <span id="top-pages-updated" class="info-icon"></span>
    <input id="ThemeToggle" type="checkbox">
    <canvas id="visit-trend"></canvas>
    <p id="visit-trend-empty" hidden></p>
    <div id="top-pages"></div>
    <div id="dashboard-breakdowns"></div>
    <script data-dashboard-api="https://dashboard.example.test"></script>
  `;
}

describe('site visits dashboard', () => {
  let socket;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    localStorage.clear();
    vi.stubGlobal('IntersectionObserver', class {
      observe = vi.fn();
      disconnect = vi.fn();
    });
    document.body.innerHTML = pageMarkup();
    globalThis.Chart = vi.fn(function Chart() {
      return { destroy: vi.fn() };
    });
    globalThis.getComputedStyle = vi.fn(() => ({
      color: 'rgb(1, 2, 3)',
      backgroundColor: 'rgba(4, 5, 6, 0.18)',
      borderTopColor: 'rgb(7, 8, 9)',
      outlineColor: 'rgb(10, 11, 12)'
    }));
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => dashboard
    });
    vi.stubGlobal('WebSocket', class extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      send = vi.fn();
      close = vi.fn(() => { this.readyState = 3; });
      constructor(url) {
        super();
        this.url = String(url);
        socket = this;
      }
    });
  });

  afterEach(() => {
    window.dispatchEvent(new Event('pagehide'));
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('loads one snapshot and renders the fixed dashboard reports', async () => {
    await import('../../src/site/site-visits/site-visits.js');
    socket.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(dashboard) }));

    expect(fetch).not.toHaveBeenCalled();
    expect(socket.url).toBe('wss://dashboard.example.test/api/dashboard/events');
    expect(document.querySelector('#visit-total').textContent).toBe('5');
    expect(document.querySelector('#top-pages .report-list')).not.toBeNull();
    expect(document.querySelectorAll('.dashboard-breakdown')).toHaveLength(7);
    expect(document.querySelector('#dashboard-breakdowns').textContent)
      .toContain('Computer monitors larger than HD');
    expect(Chart).toHaveBeenCalledTimes(1);
    const dataset = Chart.mock.calls[0][1].data.datasets[0];
    expect(dataset).toMatchObject({
      borderColor: 'rgb(1, 2, 3)'
    });
    const gradient = { addColorStop: vi.fn() };
    expect(dataset.backgroundColor({
      chart: {
        chartArea: { top: 10, bottom: 240 },
        ctx: { createLinearGradient: vi.fn(() => gradient) }
      }
    })).toBe(gradient);
    expect(gradient.addColorStop).toHaveBeenNthCalledWith(1, 0, 'rgba(4, 5, 6, 0.18)');
    expect(gradient.addColorStop).toHaveBeenNthCalledWith(2, 0.45, 'rgba(4, 5, 6, 0.18)');
    expect(gradient.addColorStop).toHaveBeenNthCalledWith(3, 0.7, 'transparent');
    expect(gradient.addColorStop).toHaveBeenNthCalledWith(4, 0.95, 'rgba(4, 5, 6, 0.18)');
    expect(Chart.mock.calls[0][1].options.scales.y.grid.color).toBe('rgb(7, 8, 9)');
    expect(Chart.mock.calls[0][1].options.scales.y.ticks.color).toBe('rgb(10, 11, 12)');
    const chartOptions = Chart.mock.calls[0][1].options;
    expect(chartOptions.scales.x.ticks.callback.call({
      getLabelForValue: () => '2026-10-04'
    }, 0, 0, [])).toBe('OCT');
    expect(chartOptions.scales.x.ticks.callback.call({
      getLabelForValue: () => '2026-10-04'
    }, 0, 1, [])).toBe('04');
    expect(chartOptions.plugins.tooltip.callbacks.title([{ label: '2026-10-04' }]))
      .toContain('4 October 2026');
    const origin = Chart.mock.calls[0][1].options.animations.y.from;
    const getPixelForValue = vi.fn(() => 240);
    expect(origin({
      type: 'data',
      mode: 'default',
      dropped: false,
      chart: { scales: { y: { getPixelForValue } } }
    })).toBe(240);
    expect(getPixelForValue).toHaveBeenCalledWith(0);
  });

  it('renders retained failed reports with their own timestamps and date ranges', async () => {
    const hitsMetadata = {
      updatedAt: '2026-10-04T10:00:00.000Z',
      range: { start: '2026-09-05', end: '2026-10-04' }
    };
    await import('../../src/site/site-visits/site-visits.js');
    socket.dispatchEvent(new MessageEvent('message', {
      data: JSON.stringify({
        ...dashboard,
        stale: true,
        errors: { hits: 'Unavailable' },
        reportMetadata: { ...dashboard.reportMetadata, hits: hitsMetadata }
      })
    }));
    expect(document.querySelector('#top-pages .report-list')).not.toBeNull();
    expect(document.querySelector('#top-pages-updated').dataset.tooltip).toBe(
      `Updated ${new Date(hitsMetadata.updatedAt).toLocaleString('en-GB')}. 2026-09-05 to 2026-10-04. Refresh failed; showing saved data.`
    );
    const breakdownTooltips = document.querySelectorAll('.dashboard-breakdown .info-icon[data-tooltip]');
    expect(breakdownTooltips).toHaveLength(7);
    breakdownTooltips.forEach((icon) => {
      expect(icon.dataset.tooltip).toBe(
        `Updated ${new Date(dashboard.generatedAt).toLocaleString('en-GB')}. 2026-09-06 to 2026-10-05.`
      );
    });
  });

  it('renders the GoatCounter total and daily stats response format', async () => {
    await import('../../src/site/site-visits/site-visits.js');
    socket.dispatchEvent(new MessageEvent('message', {
      data: JSON.stringify({
        ...dashboard,
        data: {
          ...dashboard.data,
          total: {
            total: 11,
            stats: [{ day: '2026-10-01', daily: 7 }, { day: '2026-10-02', daily: 4 }]
          }
        }
      })
    }));
    expect(document.querySelector('#visit-total').textContent).toBe('11');
    expect(Chart.mock.calls[0][1].data.labels).toEqual(['2026-10-01', '2026-10-02']);
    expect(Chart.mock.calls[0][1].data.datasets[0].data).toEqual([7, 4]);
  });

  it('restores saved data and retains it while disconnected with delayed reconnects', async () => {
    localStorage.setItem('site-visits:https://dashboard.example.test', JSON.stringify(dashboard));
    await import('../../src/site/site-visits/site-visits.js');
    expect(document.querySelector('#visit-total').textContent).toBe('5');
    const previous = socket;
    previous.dispatchEvent(new Event('close'));
    expect(document.querySelector('#dashboard-status').textContent).toContain('Disconnected');
    expect(document.querySelector('#visit-total').textContent).toBe('5');
    await vi.advanceTimersByTimeAsync(2500);
    expect(socket).not.toBe(previous);
  });

  it('uses automatic heartbeats and cancels reconnects when the page leaves', async () => {
    await import('../../src/site/site-visits/site-visits.js');
    socket.dispatchEvent(new Event('open'));
    await vi.advanceTimersByTimeAsync(60000);
    expect(socket.send).toHaveBeenCalledWith('ping');
    socket.dispatchEvent(new MessageEvent('message', { data: 'pong' }));
    await vi.advanceTimersByTimeAsync(30000);
    expect(socket.close).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('pagehide'));
    const previous = socket;
    socket.dispatchEvent(new Event('close'));
    await vi.advanceTimersByTimeAsync(300000);
    expect(socket).toBe(previous);
  });

  it('shows an honest unavailable state on initial upstream failure', async () => {
    await import('../../src/site/site-visits/site-visits.js');
    socket.dispatchEvent(new MessageEvent('message', { data: '{"error":"GoatCounter unavailable"}' }));
    expect(document.querySelector('#dashboard-status').textContent).toBe('GoatCounter unavailable');
    expect(document.querySelector('#visit-total').textContent).not.toBe('0');
    expect(document.querySelector('#top-pages').textContent).toContain('No saved dashboard data');
  });
});