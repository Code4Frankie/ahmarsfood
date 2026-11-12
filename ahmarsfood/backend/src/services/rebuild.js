import { env } from '../config/env.js';
import { createRebuildTrigger } from '../utils/rebuildTrigger.js';

export const requestRebuild = createRebuildTrigger({ url: env.deployHookUrl, delayMs: env.rebuildDelayMs });
