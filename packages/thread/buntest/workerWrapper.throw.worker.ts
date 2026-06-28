import { WorkerWrapper } from '../src/workerWrapper.js';

export default new WorkerWrapper('CheckUpdates', async () => {
  throw new Error('real worker callback failed');
});
