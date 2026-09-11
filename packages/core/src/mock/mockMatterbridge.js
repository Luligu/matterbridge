import EventEmitter from 'node:events';

// Creates a mocks of Matterbridge
export class MockMatterbridge extends EventEmitter {
  version = '1.0.0';

  // oxlint-disable-next-line typescript/require-await
  static async loadInstance() {
    return new MockMatterbridge();
  }
}
