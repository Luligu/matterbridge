import EventEmitter from 'node:events';

// Creates a mocks of Matterbridge
export class MockMatterbridge extends EventEmitter {
  version = '1.0.0';

  constructor() {
    super();
  }

  static async loadInstance() {
    return new MockMatterbridge();
  }
}
