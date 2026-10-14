import { geoEqualEarth, geoGraticule10, geoPath } from 'd3-geo';
import { useEffect, useState } from 'preact/hooks';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';

let landPromise: Promise<string> | null = null;
const W = 360;
const H = 180;
const projection = geoEqualEarth().fitExtent([[4, 4], [W - 4, H - 4]], { type: 'Sphere' });
const path = geoPath(projection);

/** Natural Earth 1:110m land (public domain, via the world-atlas package), loaded once on demand. */
function loadLand(): Promise<string> {
  if (!landPromise) {
    landPromise = import('world-atlas/land-110m.json').then((mod) => {
      const topo = (mod.default ?? mod) as unknown as Topology;
      const land = feature(topo, topo.objects.land);
      return path(land) ?? '';
    });
  }
  return landPromise;
}

export function WorldMap({ lat, lon, label }: { lat: number | null; lon: number | null; label: string }) {
  const [land, setLand] = useState<string | null>(null);
  useEffect(() => {
    loadLand().then(setLand).catch(() => setLand(''));
  }, []);
  const pt = lat != null && lon != null ? projection([lon, lat]) : null;
  return (
    <svg class="worldmap" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <path class="map-sphere" d={path({ type: 'Sphere' }) ?? ''} />
      <path class="map-graticule" d={path(geoGraticule10()) ?? ''} />
      {land && <path class="map-land" d={land} />}
      {pt && (
        <g transform={`translate(${pt[0]} ${pt[1]})`}>
          <circle class="map-pulse" r="9" />
          <circle class="map-dot" r="4" />
        </g>
      )}
    </svg>
  );
}
