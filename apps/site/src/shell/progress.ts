import { ProgressManager } from '@chags/progress';
import { platform } from './platform';

export const progressManager = new ProgressManager(platform.storage, () => platform.now());
