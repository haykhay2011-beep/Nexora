// Bundled Earth grid (baked by tools/bake-earth.mjs from Natural Earth, public domain).
import { GEONAMES } from '../data';

export interface EarthSample {
  land: number; // 0..1 coverage
  lake: number; // 0..1
  elev: number; // metres (estimated)
  feature: number; // physical feature class (see bake script)
  riverSize: number; // 0 none, 1..3
  riverAngle: number; // degrees 0..180 (east = 0, counter-clockwise towards north), -1 none
  riverOffset: number; // -1..1 in cell units, perpendicular offset of the river from the cell centre
  coastDist: number; // cells (~27 km) to coast, positive on land, negative at sea
  plate: number;
  country: number;
  admin1: number;
  region: number;
  marine: number;
}

export const FEATURE = {
  none: 0, range: 1, desert: 2, plateau: 3, tundra: 4, wetland: 5, basin: 6, plain: 7, valley: 8, gorge: 9, foothills: 10,
} as const;

export const CELL_DEG = 0.25;
export const CELL_M = 27830; // metres per 0.25° of latitude

export class EarthData {
  readonly W: number;
  readonly H: number;
  readonly NW: number;
  readonly NH: number;
  readonly land: Uint8Array;
  readonly lake: Uint8Array;
  readonly elev: Uint8Array;
  readonly feat: Uint8Array;
  readonly rivAng: Uint8Array;
  readonly rivOff: Int8Array;
  readonly dist: Uint8Array;
  readonly plate: Uint8Array;
  readonly country: Uint8Array;
  readonly admin1: Uint16Array;
  readonly region: Uint16Array;
  readonly marine: Uint16Array;

  constructor(raw: Uint8Array) {
    const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const magic = String.fromCharCode(raw[0], raw[1], raw[2], raw[3]);
    if (magic !== 'ANYW') throw new Error('bad earth data');
    this.W = dv.getUint16(6, true);
    this.H = dv.getUint16(8, true);
    this.NW = dv.getUint16(10, true);
    this.NH = dv.getUint16(12, true);
    const n = this.W * this.H;
    const nn = this.NW * this.NH;
    let o = 16;
    const u8 = (len: number) => { const a = raw.slice(o, o + len); o += len; return a; };
    this.land = u8(n);
    this.lake = u8(n);
    this.elev = u8(n);
    this.feat = u8(n);
    this.rivAng = u8(n);
    this.rivOff = new Int8Array(u8(n).buffer);
    this.dist = u8(n);
    this.plate = u8(n);
    this.country = u8(nn);
    this.admin1 = new Uint16Array(u8(nn * 2).buffer);
    this.region = new Uint16Array(u8(nn * 2).buffer);
    this.marine = new Uint16Array(u8(nn * 2).buffer);
  }

  private idx(x: number, y: number): number {
    x = ((x % this.W) + this.W) % this.W;
    y = Math.max(0, Math.min(this.H - 1, y));
    return y * this.W + x;
  }

  /** Bilinear sample of a byte layer at fractional cell coordinates. */
  private bil(layer: Uint8Array, fx: number, fy: number): number {
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const a = layer[this.idx(x0, y0)], b = layer[this.idx(x0 + 1, y0)];
    const c = layer[this.idx(x0, y0 + 1)], d = layer[this.idx(x0 + 1, y0 + 1)];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }

  sample(lat: number, lon: number): EarthSample {
    lon = ((((lon + 180) % 360) + 360) % 360) - 180;
    lat = Math.max(-89.99, Math.min(89.99, lat));
    const fx = (lon + 180) / CELL_DEG - 0.5;
    const fy = (90 - lat) / CELL_DEG - 0.5;
    const ni = this.idx(Math.round(fx), Math.round(fy));
    const land = this.bil(this.land, fx, fy) / 255;
    const isLand = this.land[ni] >= 128;
    const ra = this.rivAng[ni];
    const nx = Math.max(0, Math.min(this.NW - 1, Math.floor((lon + 180) / (CELL_DEG * 2))));
    const ny = Math.max(0, Math.min(this.NH - 1, Math.floor((90 - lat) / (CELL_DEG * 2))));
    const nIdx = ny * this.NW + nx;
    return {
      land,
      lake: this.bil(this.lake, fx, fy) / 255,
      elev: this.bil(this.elev, fx, fy) * 32,
      feature: this.feat[ni] & 15,
      riverSize: this.feat[ni] >> 4,
      riverAngle: ra ? ra - 1 : -1,
      riverOffset: this.rivOff[ni] / 127,
      coastDist: isLand ? this.dist[ni] : -this.dist[ni],
      plate: this.plate[ni],
      country: this.country[nIdx],
      admin1: this.admin1[nIdx],
      region: this.region[nIdx],
      marine: this.marine[nIdx],
    };
  }

  /** Land coverage only (fast), 0..1. */
  landAt(lat: number, lon: number): number {
    lon = ((((lon + 180) % 360) + 360) % 360) - 180;
    const fx = (lon + 180) / CELL_DEG - 0.5;
    const fy = (90 - lat) / CELL_DEG - 0.5;
    return this.bil(this.land, fx, fy) / 255;
  }

  plateAt(lat: number, lon: number): number {
    lon = ((((lon + 180) % 360) + 360) % 360) - 180;
    const x = Math.floor((lon + 180) / CELL_DEG), y = Math.floor((90 - lat) / CELL_DEG);
    return this.plate[this.idx(x, y)];
  }

  countryName(i: number): string | null {
    return i === 255 ? null : GEONAMES.countries[i]?.name ?? null;
  }
  admin1Name(i: number): string | null {
    return i === 65535 ? null : GEONAMES.admin1[i]?.name ?? null;
  }
  regionName(i: number): { name: string; cls: string } | null {
    return i === 65535 ? null : GEONAMES.regions[i] ?? null;
  }
  marineName(i: number): string | null {
    return i === 65535 ? null : GEONAMES.marine[i] ?? null;
  }
}

/** Decompress gzip bytes in browsers (DecompressionStream) or Node (zlib). */
export async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'undefined') {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  const zlib = await import(/* @vite-ignore */ 'node:zlib');
  return new Uint8Array(zlib.gunzipSync(bytes));
}

let cached: Promise<EarthData> | null = null;
export function loadEarth(url: string): Promise<EarthData> {
  if (!cached) {
    cached = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error('failed to load earth data: ' + r.status);
        return r.arrayBuffer();
      })
      .then((b) => gunzip(new Uint8Array(b)))
      .then((raw) => new EarthData(raw));
  }
  return cached;
}
