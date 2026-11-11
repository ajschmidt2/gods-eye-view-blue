import * as Cesium from 'cesium';

const CATEGORY_COLORS = Object.freeze({
  Wildfires: Cesium.Color.ORANGERED,
  Volcanoes: Cesium.Color.RED,
  'Severe Storms': Cesium.Color.DEEPSKYBLUE,
  Floods: Cesium.Color.CYAN,
  Landslides: Cesium.Color.YELLOW,
});
export function createNasaNaturalEventsLayer() {
  let viewer = null,
    dataSource = null,
    enabled = false,
    request = null,
    count = 0,
    lastUpdate = null,
    error = null;
  return {
    id: 'nasa-natural-events',
    name: 'NASA Natural Events',
    icon: '🌎',
    source: 'NASA EONET',
    updateInterval: 300000,
    init(nextViewer) {
      viewer = nextViewer;
      dataSource = new Cesium.CustomDataSource('nasa-natural-events');
      dataSource.show = false;
      viewer.dataSources.add(dataSource);
    },
    enable() {
      enabled = true;
      if (dataSource) dataSource.show = true;
    },
    disable() {
      enabled = false;
      request?.abort();
      request = null;
      if (dataSource) dataSource.show = false;
    },
    async update() {
      if (!enabled || !dataSource) return false;
      request?.abort();
      const controller = new AbortController();
      request = controller;
      try {
        const response = await fetch('/api/natural-events?days=14', {
          signal: controller.signal,
        });
        if (!response.ok) throw Error('NASA EONET HTTP ' + response.status);
        const payload = await response.json();
        if (!Array.isArray(payload.events)) throw Error('Invalid NASA events');
        if (controller.signal.aborted || request !== controller || !enabled)
          return false;
        const next = [];
        for (const event of payload.events) {
          if (
            !Number.isFinite(event.latitude) ||
            !Number.isFinite(event.longitude)
          )
            continue;
          const category = event.categories?.[0] || 'Natural event';
          const color = CATEGORY_COLORS[category] || Cesium.Color.LIME;
          next.push(
            new Cesium.Entity({
              id: 'nasa-event:' + event.id,
              name: event.title,
              position: Cesium.Cartesian3.fromDegrees(
                event.longitude,
                event.latitude,
              ),
              point: {
                pixelSize: 11,
                color,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
              },
              description:
                String(category) +
                ' · ' +
                String(event.date || 'Date unavailable') +
                ' · NASA EONET (reported point, not event boundary)',
              properties: {
                category,
                eventDate: event.date || null,
                eventUrl: event.link || null,
              },
            }),
          );
        }
        dataSource.entities.removeAll();
        for (const entity of next) dataSource.entities.add(entity);
        count = next.length;
        lastUpdate = Date.now();
        error = null;
        return true;
      } catch (cause) {
        if (!controller.signal.aborted)
          error = cause?.message || 'NASA EONET unavailable';
        return false;
      } finally {
        if (request === controller) request = null;
      }
    },
    getStats() {
      return { count, lastUpdate, error };
    },
    destroy() {
      request?.abort();
      enabled = false;
      if (viewer && dataSource) viewer.dataSources.remove(dataSource, true);
      viewer = null;
      dataSource = null;
    },
  };
}
