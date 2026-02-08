import EventEmitter from 'node:events';

// Creates a mocks of Matterbridge
export class MockMatterbridge extends EventEmitter {
  version = '1.0.0';

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor() {
    super();
  }

  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
  static async loadInstance(initialize) {
    return new MockMatterbridge();
  }
}
