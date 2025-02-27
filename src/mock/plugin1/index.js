export default function initializePlugin(matterbridge, log, config) {
  return new MockPlatform(matterbridge, log, config);
}

export class MockPlatform {
  type = 'DynamicPlatform';
  log = null;
  constructor(matterbridge, log, config) {
    this.log = log;
  }
  async onStart(reason) {
    this.log.info(`Starting platform ${this.config.name}: ${reason ?? ''}`);
  }
  async onConfigure() {
    this.log.info(`Configuring platform ${this.config.name}`);
  }
  async onShutdown(reason) {
    this.log.info(`Shutting down platform ${this.config.name}: ${reason ?? ''}`);
  }
}
