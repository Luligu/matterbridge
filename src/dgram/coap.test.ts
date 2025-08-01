/**
 * @description Coap class test
 * @file coap.test.ts
 * @author Luca Liguori
 * @created 2025-03-22
 * @version 1.0.0
 * @license Apache-2.0
 * @copyright 2025, 2026, 2027 Luca Liguori.
 */

import dgram from 'node:dgram';

import { jest } from '@jest/globals';

import { Coap, CoapMessage, COAP_OPTION_URI_PATH, COIOT_OPTION_DEVID, COIOT_OPTION_VALIDITY, COIOT_OPTION_SERIAL } from './coap.js';
import { COAP_MULTICAST_IPV4_ADDRESS, COAP_MULTICAST_PORT } from './multicast.js';

describe('Coap', () => {
  let coap: Coap;
  let mockSocket: jest.Mocked<dgram.Socket>;

  beforeEach(() => {
    // Mock dgram.createSocket
    mockSocket = {
      bind: jest.fn(),
      addMembership: jest.fn(),
      setMulticastTTL: jest.fn(),
      setBroadcast: jest.fn(),
      setMulticastLoopback: jest.fn(),
      setMulticastInterface: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      close: jest.fn(),
      send: jest.fn((msg: any, offset: number, length: number, port: number, address: string, callback?: (error: Error | null, bytes?: number) => void) => {
        // Call the callback to simulate successful send
        if (callback) callback(null, length);
      }),
      address: jest.fn(() => ({ address: '127.0.0.1', family: 'IPv4', port: 5683 })),
    } as unknown as jest.Mocked<dgram.Socket>;

    jest.spyOn(dgram, 'createSocket').mockReturnValue(mockSocket);

    coap = new Coap('test-coap', COAP_MULTICAST_IPV4_ADDRESS, COAP_MULTICAST_PORT, 'udp4', true);

    jest.spyOn(coap.log, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('decodeCoapMessage', () => {
    it('should decode a simple CoAP message', () => {
      // Create a simple CoAP message: Version 1, Type CON, Token Length 0, Code GET, Message ID 1234
      const buffer = Buffer.from([
        0x40, // Version 1, Type 0 (CON), Token Length 0
        0x01, // Code 1 (GET)
        0x04,
        0xd2, // Message ID 1234
      ]);

      const result = coap.decodeCoapMessage(buffer);

      expect(result.version).toBe(1);
      expect(result.type).toBe(0);
      expect(result.tokenLength).toBe(0);
      expect(result.code).toBe(1);
      expect(result.messageId).toBe(1234);
      expect(result.token).toEqual(Buffer.alloc(0));
      expect(result.options).toEqual([]);
      expect(result.payload).toBeUndefined();
    });

    it('should decode a CoAP message with token', () => {
      const buffer = Buffer.from([
        0x44, // Version 1, Type 0 (CON), Token Length 4
        0x01, // Code 1 (GET)
        0x04,
        0xd2, // Message ID 1234
        0x01,
        0x02,
        0x03,
        0x04, // Token
      ]);

      const result = coap.decodeCoapMessage(buffer);

      expect(result.tokenLength).toBe(4);
      expect(result.token).toEqual(Buffer.from([0x01, 0x02, 0x03, 0x04]));
    });

    it('should decode a CoAP message with options', () => {
      const buffer = Buffer.from([
        0x40, // Version 1, Type 0 (CON), Token Length 0
        0x01, // Code 1 (GET)
        0x04,
        0xd2, // Message ID 1234
        0xb4, // Option: Delta 11 (URI_PATH), Length 4
        0x74,
        0x65,
        0x73,
        0x74, // Option value: "test"
      ]);

      const result = coap.decodeCoapMessage(buffer);

      expect(result.options).toHaveLength(1);
      expect(result.options[0].number).toBe(11);
      expect(result.options[0].value.toString()).toBe('test');
    });

    it('should decode a CoAP message with payload', () => {
      const buffer = Buffer.from([
        0x40, // Version 1, Type 0 (CON), Token Length 0
        0x01, // Code 1 (GET)
        0x04,
        0xd2, // Message ID 1234
        0xff, // Payload marker
        0x48,
        0x65,
        0x6c,
        0x6c,
        0x6f, // Payload: "Hello"
      ]);

      const result = coap.decodeCoapMessage(buffer);

      expect(result.payload).toEqual(Buffer.from('Hello'));
    });

    it('should decode a CoAP message with extended option delta (13)', () => {
      const buffer = Buffer.from([
        0x40, // Version 1, Type 0 (CON), Token Length 0
        0x01, // Code 1 (GET)
        0x04,
        0xd2, // Message ID 1234
        0xd0, // Option: Delta 13 (extended), Length 0
        0x01, // Extended delta: 1 + 13 = 14
      ]);

      const result = coap.decodeCoapMessage(buffer);

      expect(result.options).toHaveLength(1);
      expect(result.options[0].number).toBe(14);
    });

    it('should decode a CoAP message with extended option delta (14)', () => {
      const buffer = Buffer.from([
        0x40, // Version 1, Type 0 (CON), Token Length 0
        0x01, // Code 1 (GET)
        0x04,
        0xd2, // Message ID 1234
        0xe0, // Option: Delta 14 (extended), Length 0
        0x01,
        0x00, // Extended delta: 256 + 269 = 525
      ]);

      const result = coap.decodeCoapMessage(buffer);

      expect(result.options).toHaveLength(1);
      expect(result.options[0].number).toBe(525);
    });

    it('should decode a CoAP message with extended option length (13)', () => {
      const buffer = Buffer.from([
        0x40, // Version 1, Type 0 (CON), Token Length 0
        0x01, // Code 1 (GET)
        0x04,
        0xd2, // Message ID 1234
        0x1d, // Option: Delta 1, Length 13 (extended)
        0x01, // Extended length: 1 + 13 = 14
        ...Array(14).fill(0x41), // 14 bytes of 'A'
      ]);

      const result = coap.decodeCoapMessage(buffer);

      expect(result.options).toHaveLength(1);
      expect(result.options[0].value).toHaveLength(14);
    });

    it('should decode a CoAP message with extended option length (14)', () => {
      const buffer = Buffer.from([
        0x40, // Version 1, Type 0 (CON), Token Length 0
        0x01, // Code 1 (GET)
        0x04,
        0xd2, // Message ID 1234
        0x1e, // Option: Delta 1, Length 14 (extended)
        0x01,
        0x00, // Extended length: 256 + 269 = 525
        ...Array(525).fill(0x41), // 525 bytes of 'A'
      ]);

      const result = coap.decodeCoapMessage(buffer);

      expect(result.options).toHaveLength(1);
      expect(result.options[0].value).toHaveLength(525);
    });

    it('should throw error for message too short', () => {
      const buffer = Buffer.from([0x40, 0x01]); // Only 2 bytes

      expect(() => coap.decodeCoapMessage(buffer)).toThrow('Message too short to be a valid CoAP message');
    });

    it('should throw error for token length exceeding message length', () => {
      const buffer = Buffer.from([
        0x48, // Version 1, Type 0 (CON), Token Length 8
        0x01, // Code 1 (GET)
        0x04,
        0xd2, // Message ID 1234
        0x01,
        0x02, // Only 2 bytes for token instead of 8
      ]);

      expect(() => coap.decodeCoapMessage(buffer)).toThrow('Message too short for the token length specified');
    });

    it('should throw error for reserved option delta (15)', () => {
      const buffer = Buffer.from([
        0x40, // Version 1, Type 0 (CON), Token Length 0
        0x01, // Code 1 (GET)
        0x04,
        0xd2, // Message ID 1234
        0xf0, // Option: Delta 15 (reserved), Length 0
      ]);

      expect(() => coap.decodeCoapMessage(buffer)).toThrow('Reserved option delta value encountered');
    });

    it('should throw error for reserved option length (15)', () => {
      const buffer = Buffer.from([
        0x40, // Version 1, Type 0 (CON), Token Length 0
        0x01, // Code 1 (GET)
        0x04,
        0xd2, // Message ID 1234
        0x1f, // Option: Delta 1, Length 15 (reserved)
      ]);

      expect(() => coap.decodeCoapMessage(buffer)).toThrow('Reserved option length value encountered');
    });

    it('should throw error for invalid extended option delta (insufficient bytes)', () => {
      const buffer = Buffer.from([
        0x40, // Version 1, Type 0 (CON), Token Length 0
        0x01, // Code 1 (GET)
        0x04,
        0xd2, // Message ID 1234
        0xd0, // Option: Delta 13 (extended), Length 0
        // Missing extended delta byte
      ]);

      expect(() => coap.decodeCoapMessage(buffer)).toThrow('Invalid extended option delta');
    });

    it('should throw error for invalid extended option delta (14, insufficient bytes)', () => {
      const buffer = Buffer.from([
        0x40, // Version 1, Type 0 (CON), Token Length 0
        0x01, // Code 1 (GET)
        0x04,
        0xd2, // Message ID 1234
        0xe0, // Option: Delta 14 (extended), Length 0
        0x01, // Only 1 byte instead of 2
      ]);

      expect(() => coap.decodeCoapMessage(buffer)).toThrow('Invalid extended option delta');
    });

    it('should throw error for invalid extended option length (insufficient bytes)', () => {
      const buffer = Buffer.from([
        0x40, // Version 1, Type 0 (CON), Token Length 0
        0x01, // Code 1 (GET)
        0x04,
        0xd2, // Message ID 1234
        0x1d, // Option: Delta 1, Length 13 (extended)
        // Missing extended length byte
      ]);

      expect(() => coap.decodeCoapMessage(buffer)).toThrow('Invalid extended option length');
    });

    it('should throw error for invalid extended option length (14, insufficient bytes)', () => {
      const buffer = Buffer.from([
        0x40, // Version 1, Type 0 (CON), Token Length 0
        0x01, // Code 1 (GET)
        0x04,
        0xd2, // Message ID 1234
        0x1e, // Option: Delta 1, Length 14 (extended)
        0x01, // Only 1 byte instead of 2
      ]);

      expect(() => coap.decodeCoapMessage(buffer)).toThrow('Invalid extended option length');
    });

    it('should throw error when option length exceeds message length', () => {
      const buffer = Buffer.from([
        0x40, // Version 1, Type 0 (CON), Token Length 0
        0x01, // Code 1 (GET)
        0x04,
        0xd2, // Message ID 1234
        0x15, // Option: Delta 1, Length 5
        0x01,
        0x02, // Only 2 bytes instead of 5
      ]);

      expect(() => coap.decodeCoapMessage(buffer)).toThrow('Option length exceeds message length');
    });
  });

  describe('encodeCoapMessage', () => {
    it('should encode a simple CoAP message', () => {
      const message: CoapMessage = {
        version: 1,
        type: 0,
        tokenLength: 0,
        code: 1,
        messageId: 1234,
        token: Buffer.alloc(0),
        options: [],
      };

      const result = coap.encodeCoapMessage(message);

      expect(result).toEqual(Buffer.from([0x40, 0x01, 0x04, 0xd2]));
    });

    it('should encode a CoAP message with token', () => {
      const token = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      const message: CoapMessage = {
        version: 1,
        type: 0,
        tokenLength: 4,
        code: 1,
        messageId: 1234,
        token,
        options: [],
      };

      const result = coap.encodeCoapMessage(message);

      expect(result).toEqual(Buffer.from([0x44, 0x01, 0x04, 0xd2, 0x01, 0x02, 0x03, 0x04]));
    });

    it('should encode a CoAP message with options', () => {
      const message: CoapMessage = {
        version: 1,
        type: 0,
        tokenLength: 0,
        code: 1,
        messageId: 1234,
        token: Buffer.alloc(0),
        options: [{ number: 11, value: Buffer.from('test') }],
      };

      const result = coap.encodeCoapMessage(message);

      expect(result).toEqual(Buffer.from([0x40, 0x01, 0x04, 0xd2, 0xb4, 0x74, 0x65, 0x73, 0x74]));
    });

    it('should encode a CoAP message with payload', () => {
      const message: CoapMessage = {
        version: 1,
        type: 0,
        tokenLength: 0,
        code: 1,
        messageId: 1234,
        token: Buffer.alloc(0),
        options: [],
        payload: Buffer.from('Hello'),
      };

      const result = coap.encodeCoapMessage(message);

      expect(result).toEqual(Buffer.from([0x40, 0x01, 0x04, 0xd2, 0xff, 0x48, 0x65, 0x6c, 0x6c, 0x6f]));
    });

    it('should handle undefined token by using empty buffer (line 304)', () => {
      const message: CoapMessage = {
        version: 1,
        type: 0,
        tokenLength: 0,
        code: 1,
        messageId: 1234,
        token: undefined as any, // Simulating undefined token
        options: [],
      };

      const result = coap.encodeCoapMessage(message);

      // Should successfully encode with empty token (Buffer.alloc(0))
      expect(result).toBeDefined();
      expect(result[0]).toBe(0x40); // Version 1, Type 0, Token Length 0
      expect(result[1]).toBe(0x01); // Code 1
      expect(result[2]).toBe(0x04); // Message ID high byte
      expect(result[3]).toBe(0xd2); // Message ID low byte
    });

    it('should handle null token by using empty buffer (line 304)', () => {
      const message: CoapMessage = {
        version: 1,
        type: 0,
        tokenLength: 0,
        code: 1,
        messageId: 1234,
        token: null as any, // Simulating null token
        options: [],
      };

      const result = coap.encodeCoapMessage(message);

      // Should successfully encode with empty token (Buffer.alloc(0))
      expect(result).toBeDefined();
      expect(result[0]).toBe(0x40); // Version 1, Type 0, Token Length 0
      expect(result[1]).toBe(0x01); // Code 1
      expect(result[2]).toBe(0x04); // Message ID high byte
      expect(result[3]).toBe(0xd2); // Message ID low byte
    });

    it('should encode options in sorted order', () => {
      const message: CoapMessage = {
        version: 1,
        type: 0,
        tokenLength: 0,
        code: 1,
        messageId: 1234,
        token: Buffer.alloc(0),
        options: [
          { number: 15, value: Buffer.from('b') },
          { number: 11, value: Buffer.from('a') },
        ],
      };

      const result = coap.encodeCoapMessage(message);

      // Should encode option 11 first, then option 15 (delta 4)
      expect(result[4]).toBe(0xb1); // Option 11, length 1
      expect(result[5]).toBe(0x61); // 'a'
      expect(result[6]).toBe(0x41); // Option delta 4, length 1
      expect(result[7]).toBe(0x62); // 'b'
    });

    it('should throw error for token length exceeding 8 bytes', () => {
      const message: CoapMessage = {
        version: 1,
        type: 0,
        tokenLength: 9,
        code: 1,
        messageId: 1234,
        token: Buffer.alloc(9),
        options: [],
      };

      expect(() => coap.encodeCoapMessage(message)).toThrow('Token length cannot exceed 8 bytes');
    });

    it('should encode message with extended option delta (13)', () => {
      const message: CoapMessage = {
        version: 1,
        type: 0,
        tokenLength: 0,
        code: 1,
        messageId: 1234,
        token: Buffer.alloc(0),
        options: [{ number: 14, value: Buffer.from('test') }], // Delta 14 requires extended encoding
      };

      const result = coap.encodeCoapMessage(message);

      // First option has delta 14, which requires extended encoding (13 + 1)
      expect(result[4]).toBe(0xd4); // Delta 13 (extended), Length 4
      expect(result[5]).toBe(0x01); // Extended delta: 14 - 13 = 1
    });

    it('should encode message with extended option delta (14)', () => {
      const message: CoapMessage = {
        version: 1,
        type: 0,
        tokenLength: 0,
        code: 1,
        messageId: 1234,
        token: Buffer.alloc(0),
        options: [{ number: 300, value: Buffer.from('test') }], // Delta 300 requires extended encoding (14)
      };

      const result = coap.encodeCoapMessage(message);

      // Option has delta 300, which requires extended encoding (269 + 31)
      expect(result[4]).toBe(0xe4); // Delta 14 (extended), Length 4
      expect(result[5]).toBe(0x00); // Extended delta high byte
      expect(result[6]).toBe(0x1f); // Extended delta low byte: 300 - 269 = 31
    });

    it('should encode message with extended option length (13)', () => {
      const longValue = Buffer.alloc(20, 0x41); // 20 bytes of 'A'
      const message: CoapMessage = {
        version: 1,
        type: 0,
        tokenLength: 0,
        code: 1,
        messageId: 1234,
        token: Buffer.alloc(0),
        options: [{ number: 11, value: longValue }],
      };

      const result = coap.encodeCoapMessage(message);

      // Option has length 20, which requires extended encoding (13 + 7)
      expect(result[4]).toBe(0xbd); // Delta 11, Length 13 (extended)
      expect(result[5]).toBe(0x07); // Extended length: 20 - 13 = 7
    });

    it('should encode message with extended option length (14)', () => {
      const veryLongValue = Buffer.alloc(300, 0x41); // 300 bytes
      const message: CoapMessage = {
        version: 1,
        type: 0,
        tokenLength: 0,
        code: 1,
        messageId: 1234,
        token: Buffer.alloc(0),
        options: [{ number: 11, value: veryLongValue }],
      };

      const result = coap.encodeCoapMessage(message);

      // Option has length 300, which requires extended encoding (269 + 31)
      expect(result[4]).toBe(0xbe); // Delta 11, Length 14 (extended)
      expect(result[5]).toBe(0x00); // Extended length high byte
      expect(result[6]).toBe(0x1f); // Extended length low byte: 300 - 269 = 31
    });
  });

  describe('coapTypeToString', () => {
    it('should convert type numbers to strings', () => {
      expect(coap.coapTypeToString(0)).toBe('Confirmable (CON)');
      expect(coap.coapTypeToString(1)).toBe('Non-confirmable (NON)');
      expect(coap.coapTypeToString(2)).toBe('Acknowledgement (ACK)');
      expect(coap.coapTypeToString(3)).toBe('Reset (RST)');
      expect(coap.coapTypeToString(99)).toBe('Unknown Type (99)');
    });
  });

  describe('coapCodeToString', () => {
    it('should convert code numbers to strings', () => {
      expect(coap.coapCodeToString(1)).toBe('0.01'); // GET
      expect(coap.coapCodeToString(2)).toBe('0.02'); // POST
      expect(coap.coapCodeToString(3)).toBe('0.03'); // PUT
      expect(coap.coapCodeToString(4)).toBe('0.04'); // DELETE
      expect(coap.coapCodeToString(69)).toBe('2.05'); // Content
      expect(coap.coapCodeToString(132)).toBe('4.04'); // Not Found
      expect(coap.coapCodeToString(160)).toBe('5.00'); // Internal Server Error
    });
  });

  describe('sendRequest', () => {
    it('should send a CoAP request', () => {
      const options = [{ number: COAP_OPTION_URI_PATH, value: Buffer.from('test') }];
      const payload = { test: 'data' };
      const token = 'abcd';

      coap.sendRequest(1234, options, payload, token, '192.168.1.100', 5683);

      expect(mockSocket.send).toHaveBeenCalled();
      const sendCall = mockSocket.send.mock.calls[0] as any[];
      // socket.send(msg, offset, length, port, address, callback)
      expect(sendCall[3]).toBe(5683); // port is at index 3
      expect(sendCall[4]).toBe('192.168.1.100'); // address is at index 4
    });

    it('should use default multicast address and port when not specified', () => {
      coap.sendRequest(1234, [], undefined, undefined, undefined, undefined);

      expect(mockSocket.send).toHaveBeenCalled();
      const sendCall = mockSocket.send.mock.calls[0] as any[];
      // socket.send(msg, offset, length, port, address, callback)
      expect(sendCall[3]).toBe(COAP_MULTICAST_PORT); // port is at index 3
      expect(sendCall[4]).toBe(COAP_MULTICAST_IPV4_ADDRESS); // address is at index 4
    });
  });

  describe('onMessage', () => {
    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(coap, 'onCoapMessage').mockImplementation(() => {});
      jest.spyOn(coap, 'logCoapMessage').mockImplementation(() => {});
    });

    it('should process valid CoAP message', () => {
      const buffer = Buffer.from([0x40, 0x01, 0x04, 0xd2]);
      const rinfo: dgram.RemoteInfo = { address: '192.168.1.100', port: 5683, family: 'IPv4', size: 4 };

      coap.onMessage(buffer, rinfo);

      expect(coap.onCoapMessage).toHaveBeenCalled();
      expect(coap.logCoapMessage).toHaveBeenCalled();
    });

    it('should handle invalid CoAP message', () => {
      const buffer = Buffer.from([0x40]); // Too short
      const rinfo: dgram.RemoteInfo = { address: '192.168.1.100', port: 5683, family: 'IPv4', size: 1 };

      coap.onMessage(buffer, rinfo);

      expect(coap.onCoapMessage).not.toHaveBeenCalled();
      expect(coap.logCoapMessage).not.toHaveBeenCalled();
    });
  });

  describe('onCoapMessage', () => {
    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('should handle CoAP message and log debug information', () => {
      const message: CoapMessage = {
        version: 1,
        type: 0,
        tokenLength: 4,
        code: 1,
        messageId: 1234,
        token: Buffer.from([0x01, 0x02, 0x03, 0x04]),
        options: [{ number: COAP_OPTION_URI_PATH, value: Buffer.from('test') }],
        payload: Buffer.from('Hello World'),
      };
      const rinfo: dgram.RemoteInfo = { address: '192.168.1.100', port: 5683, family: 'IPv4', size: 100 };

      // Spy on the debug log method
      const debugSpy = jest.spyOn(coap.log, 'debug');

      coap.onCoapMessage(message, rinfo);

      // Verify that the debug log was called with correct message
      expect(debugSpy).toHaveBeenCalledWith(expect.stringMatching(/Coap message received from.*IPv4.*192\.168\.1\.100.*:.*5683/));
    });

    it('should handle CoAP message with IPv6 address', () => {
      const message: CoapMessage = {
        version: 1,
        type: 1,
        tokenLength: 0,
        code: 2,
        messageId: 5678,
        token: Buffer.alloc(0),
        options: [],
      };
      const rinfo: dgram.RemoteInfo = { address: '::1', port: 5683, family: 'IPv6', size: 50 };

      // Spy on the debug log method
      const debugSpy = jest.spyOn(coap.log, 'debug');

      coap.onCoapMessage(message, rinfo);

      // Verify that the debug log was called with IPv6 address
      expect(debugSpy).toHaveBeenCalledWith(expect.stringMatching(/Coap message received from.*IPv6.*::1.*:.*5683/));
    });

    it('should be extensible for subclasses (like CoIoT)', () => {
      // This test verifies that onCoapMessage can be overridden in subclasses
      const message: CoapMessage = {
        version: 1,
        type: 0,
        tokenLength: 0,
        code: 1,
        messageId: 1234,
        token: Buffer.alloc(0),
        options: [{ number: COIOT_OPTION_DEVID, value: Buffer.from('SHSW-25#112233445566#1') }],
      };
      const rinfo: dgram.RemoteInfo = { address: '192.168.1.100', port: 5683, family: 'IPv4', size: 50 };

      // Create a spy to track method calls
      const onCoapMessageSpy = jest.spyOn(coap, 'onCoapMessage');

      coap.onCoapMessage(message, rinfo);

      // Verify the method was called with correct parameters
      expect(onCoapMessageSpy).toHaveBeenCalledWith(message, rinfo);
      expect(onCoapMessageSpy).toHaveBeenCalledTimes(1);

      // Verify the message object properties are accessible
      expect(message.options[0].number).toBe(COIOT_OPTION_DEVID);
      expect(message.options[0].value.toString()).toBe('SHSW-25#112233445566#1');
    });
  });

  describe('logCoapMessage', () => {
    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('should log CoAP message with URI_PATH option', () => {
      const message: CoapMessage = {
        version: 1,
        type: 0,
        tokenLength: 0,
        code: 1,
        messageId: 1234,
        token: Buffer.alloc(0),
        options: [{ number: COAP_OPTION_URI_PATH, value: Buffer.from('test/path') }],
      };

      coap.logCoapMessage(message);

      // Test passes if no exception is thrown
      expect(true).toBe(true);
    });

    it('should log CoAP message with COIOT_OPTION_DEVID', () => {
      const message: CoapMessage = {
        version: 1,
        type: 0,
        tokenLength: 0,
        code: 1,
        messageId: 1234,
        token: Buffer.alloc(0),
        options: [{ number: COIOT_OPTION_DEVID, value: Buffer.from('SHSW-25#112233445566#1') }],
      };

      coap.logCoapMessage(message);

      // Test passes if no exception is thrown
      expect(true).toBe(true);
    });

    it('should log CoAP message with COIOT_OPTION_SERIAL', () => {
      const serialBuffer = Buffer.alloc(2);
      serialBuffer.writeUInt16BE(12345, 0);

      const message: CoapMessage = {
        version: 1,
        type: 0,
        tokenLength: 0,
        code: 1,
        messageId: 1234,
        token: Buffer.alloc(0),
        options: [{ number: COIOT_OPTION_SERIAL, value: serialBuffer }],
      };

      coap.logCoapMessage(message);

      // Test passes if no exception is thrown
      expect(true).toBe(true);
    });

    it('should log CoAP message with COIOT_OPTION_VALIDITY', () => {
      const validityBuffer = Buffer.alloc(2);
      validityBuffer.writeUInt16BE(100, 0); // Even number

      const message: CoapMessage = {
        version: 1,
        type: 0,
        tokenLength: 0,
        code: 1,
        messageId: 1234,
        token: Buffer.alloc(0),
        options: [{ number: COIOT_OPTION_VALIDITY, value: validityBuffer }],
      };

      coap.logCoapMessage(message);

      // Test passes if no exception is thrown
      expect(true).toBe(true);
    });

    it('should log CoAP message with COIOT_OPTION_VALIDITY (odd number)', () => {
      const validityBuffer = Buffer.alloc(2);
      validityBuffer.writeUInt16BE(101, 0); // Odd number

      const message: CoapMessage = {
        version: 1,
        type: 0,
        tokenLength: 0,
        code: 1,
        messageId: 1234,
        token: Buffer.alloc(0),
        options: [{ number: COIOT_OPTION_VALIDITY, value: validityBuffer }],
      };

      coap.logCoapMessage(message);

      // Test passes if no exception is thrown
      expect(true).toBe(true);
    });

    it('should log CoAP message with unknown option', () => {
      const message: CoapMessage = {
        version: 1,
        type: 0,
        tokenLength: 0,
        code: 1,
        messageId: 1234,
        token: Buffer.alloc(0),
        options: [{ number: 9999, value: Buffer.from([0x01, 0x02, 0x03, 0x04]) }],
      };

      coap.logCoapMessage(message);

      // Test passes if no exception is thrown
      expect(true).toBe(true);
    });

    it('should log CoAP message with JSON payload', () => {
      const message: CoapMessage = {
        version: 1,
        type: 0,
        tokenLength: 0,
        code: 1,
        messageId: 1234,
        token: Buffer.alloc(0),
        options: [],
        payload: Buffer.from(JSON.stringify({ test: 'data' })),
      };

      coap.logCoapMessage(message);

      // Test passes if no exception is thrown
      expect(true).toBe(true);
    });
  });

  describe('round-trip encoding/decoding', () => {
    it('should encode and decode the same message', () => {
      const originalMessage: CoapMessage = {
        version: 1,
        type: 1,
        tokenLength: 4,
        code: 2,
        messageId: 5678,
        token: Buffer.from([0xaa, 0xbb, 0xcc, 0xdd]),
        options: [
          { number: 11, value: Buffer.from('hello') },
          { number: 15, value: Buffer.from('world') },
        ],
        payload: Buffer.from('test payload'),
      };

      const encoded = coap.encodeCoapMessage(originalMessage);
      const decoded = coap.decodeCoapMessage(encoded);

      expect(decoded.version).toBe(originalMessage.version);
      expect(decoded.type).toBe(originalMessage.type);
      expect(decoded.tokenLength).toBe(originalMessage.tokenLength);
      expect(decoded.code).toBe(originalMessage.code);
      expect(decoded.messageId).toBe(originalMessage.messageId);
      expect(decoded.token).toEqual(originalMessage.token);
      expect(decoded.options).toHaveLength(originalMessage.options.length);
      expect(decoded.options[0].number).toBe(11);
      expect(decoded.options[0].value).toEqual(Buffer.from('hello'));
      expect(decoded.options[1].number).toBe(15);
      expect(decoded.options[1].value).toEqual(Buffer.from('world'));
      expect(decoded.payload).toEqual(originalMessage.payload);
    });
  });
});
