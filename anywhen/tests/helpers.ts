import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { EarthData } from '../src/geo/earth';

let earth: EarthData | null = null;
export function loadEarthSync(): EarthData {
  if (!earth) {
    const gz = fs.readFileSync(path.resolve(__dirname, '../public/data/earth.dat'));
    earth = new EarthData(new Uint8Array(zlib.gunzipSync(gz)));
  }
  return earth;
}
