// Landmark builder registry. landmarks.json "builder" names map to these functions.
import * as A from './ancient';
import * as M from './medieval';
import * as N from './modern';
import type { Builder } from './common';

export const BUILDERS: Record<string, Builder> = { ...A, ...M, ...N } as Record<string, Builder>;
export type { Builder, LmCtx, Collider, WaterRect } from './common';
