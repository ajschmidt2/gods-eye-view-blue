import * as Cesium from 'cesium';

const SEVERITY = Object.freeze({
  Extreme: Cesium.Color.RED,
  Severe: Cesium.Color.ORANGERED,
  Moderate: Cesium.Color.GOLD,
  Minor: Cesium.Color.YELLOW,
  Unknown: Cesium.Color.LIGHTGRAY,
});

function polygonRings(geometry) {
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) return [];
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  if (!Array.isArray(polygons)) return [];
  // Only outer rings. Never fill a polygon with holes as though holes were warned.
  // Multi-ring polygons are displayed as outlines to avoid false affected areas.
  const result = [];
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || !Array.isArray(polygon[0])) continue;
    const rings = polygon.filter((ring) => Array.isArray(ring) && ring.length >= 4);
    for (const ring of rings) {
      const points = ring.filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90);
      if (points.length >= 4) result.push({ points, outlineOnly: rings.length > 1 });
    }
  }
  return result;
}

export function createNwsWeatherAlertsLayer({ area = 'IN', fetchImpl = (...args) => globalThis.fetch(...args) } = {}) {
  let viewer = null;
  let dataSource = null;
  let enabled = false;
  let request = null;
  let count = 0;
  let lastUpdate = null;
  let error = null;
  return {
    id: 'nws-weather-alerts',
    name: 'NWS Weather Alerts (Indiana)',
    icon: '⚠',
    source: 'National Weather Service',
    updateInterval: 120000,
    init(nextViewer) {
      viewer = nextViewer;
      dataSource = new Cesium.CustomDataSource('nws-weather-alerts');
      dataSource.show = false;
      viewer.dataSources.add(dataSource);
    },
    enable() { enabled = true; if (dataSource) dataSource.show = true; },
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
        const response = await fetchImpl('/api/weather-alerts?area=' + encodeURIComponent(area), { signal: controller.signal });
        if (!response.ok) throw new Error('NWS alerts HTTP ' + response.status);
        const payload = await response.json();
        if (!Array.isArray(payload.features)) throw new Error('Malformed NWS alert response');
        if (controller.signal.aborted || !enabled || request !== controller) return false;
        const entities = [];
        let alertCount = 0;
        for (const feature of payload.features.slice(0, 500)) {
          const props = feature?.properties || {};
          const rings = polygonRings(feature?.geometry);
          if (!rings.length) continue; // NWS sometimes returns null geometry for zone-based alerts.
          alertCount++;
          const severity = String(props.severity || 'Unknown');
          const color = SEVERITY[severity] || SEVERITY.Unknown;
          const event = String(props.event || 'Weather alert').slice(0, 160);
          const description = String(props.headline || props.description || event).slice(0, 1200);
          for (const [index, ring] of rings.entries()) {
            const positions = ring.points.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat));
            if (ring.outlineOnly) {
              entities.push(new Cesium.Entity({
                id: 'nws:' + String(feature.id || alertCount) + ':' + index,
                name: event,
                description,
                polyline: { positions, width: 3, material: color },
                properties: { severity, event, expires: props.expires || null },
              }));
            } else {
              entities.push(new Cesium.Entity({
                id: 'nws:' + String(feature.id || alertCount) + ':' + index,
                name: event,
                description,
                polygon: {
                  hierarchy: new Cesium.PolygonHierarchy(positions),
                  material: color.withAlpha(0.22),
                  outline: true,
                  outlineColor: color,
                  height: 0,
                },
                properties: { severity, event, expires: props.expires || null },
              }));
            }
          }
        }
        dataSource.entities.removeAll();
        for (const entity of entities) dataSource.entities.add(entity);
        count = alertCount;
        lastUpdate = Date.now();
        error = null;
        return true;
      } catch (cause) {
        if (!controller.signal.aborted) error = cause?.message || 'NWS unavailable';
        return false;
      } finally {
        if (request === controller) request = null;
      }
    },
    getStats() { return { count, lastUpdate, error }; },
    destroy() {
      request?.abort();
      enabled = false;
      if (dataSource && viewer) viewer.dataSources.remove(dataSource, true);
      dataSource = null;
      viewer = null;
    },
  };
}
