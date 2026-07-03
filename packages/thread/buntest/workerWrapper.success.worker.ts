import { WorkerWrapper } from '../src/workerWrapper.js';

// oxlint-disable-next-line typescript/require-await
export default new WorkerWrapper('CheckUpdates', async () => true);
