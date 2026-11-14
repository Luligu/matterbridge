/**
 * @file packages/dgram/vitest/matterAdvertise.test.ts
 * @description Matter discovery records, validation, network selection and lifecycle tests
 * @author Luca Liguori
 */

import os from 'node:os';

import { setupTest } from '@matterbridge/test-utils/vitest/setup';

import { CommissioningMode, MatterAdvertise, type MatterAdvertiseOptions } from '../src/matterAdvertise.js';
import { DnsRecordType, Mdns } from '../src/mdns.js';
import { MdnsResponder } from '../src/mdnsResponder.js';

await setupTest('MatterAdvertise', false);

const networks: NodeJS.Dict<os.NetworkInterfaceInfo[]> = {
  lan0: [
    { address: '192.0.2.10', family: 'IPv4', internal: false, mac: 'b7:5a:fb:45:8e:cd', netmask: '255.255.255.0', cidr: '192.0.2.10/24' },
    { address: 'fe80::10', family: 'IPv6', internal: false, mac: 'b7:5a:fb:45:8e:cd', netmask: 'ffff:ffff:ffff:ffff::', cidr: 'fe80::10/64', scopeid: 2 },
    { address: 'fd00::10', family: 'IPv6', internal: false, mac: 'b7:5a:fb:45:8e:cd', netmask: 'ffff:ffff:ffff:ffff::', cidr: 'fd00::10/64', scopeid: 0 },
  ],
  lan1: [{ address: '198.51.100.10', family: 'IPv4', internal: false, mac: 'b7:5a:fb:45:8e:ce', netmask: '255.255.255.0', cidr: '198.51.100.10/24' }],
  lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true, mac: '00:00:00:00:00:00', netmask: '255.0.0.0', cidr: '127.0.0.1/8' }],
};
const codec = new Mdns('Codec', '224.0.0.251', 5353, 'udp4');
const created: MatterAdvertise[] = [];

/**
 * Creates a tracked advertiser whose unopened sockets are closed after the test.
 *
 * @param {MatterAdvertiseOptions} options - Discovery options.
 * @returns {MatterAdvertise} Advertiser.
 */
function create(options: MatterAdvertiseOptions): MatterAdvertise {
  const advertiser = new MatterAdvertise(options);
  created.push(advertiser);
  return advertiser;
}

/**
 * Decodes the TXT entries of the first interface's service.
 *
 * @param {MatterAdvertise} advertiser - Advertiser.
 * @returns {string[]} TXT strings.
 */
function txt(advertiser: MatterAdvertise): string[] {
  const record = advertiser['responders'][0]['buildRecords']().find((entry) => entry.type === DnsRecordType.TXT);
  const result: string[] = [];
  if (!record) return result;
  for (let offset = 0; offset < record.rdata.length;) {
    const length = record.rdata[offset++];
    result.push(record.rdata.subarray(offset, offset + length).toString());
    offset += length;
  }
  return result;
}

beforeEach(() => {
  vi.spyOn(os, 'networkInterfaces').mockReturnValue(networks);
});

afterEach(() => {
  for (const advertiser of created.splice(0)) {
    for (const responder of advertiser['responders']) {
      responder.sockets.ipv4?.socket.close();
      responder.sockets.ipv6?.socket.close();
    }
  }
  vi.restoreAllMocks();
  vi.useRealTimers();
});

afterAll(() => {
  codec.socket.close();
});

describe('Matter discovery', () => {
  it('should encode mandatory commissionable records and subtype targets from the specification example', () => {
    const advertiser = create({ mode: 'commissionable', port: 11111, discriminator: 840, commissioningMode: CommissioningMode.Enhanced });
    expect(advertiser.interfaceNames).toEqual(['lan0', 'lan1']);
    const responder = advertiser['responders'][0];
    expect(responder.instanceName).toMatch(/^[0-9A-F]{16}$/);
    expect(responder.hostName).toBe('B75AFB458ECD.local');
    expect(txt(advertiser)).toEqual(['D=840', 'CM=2']);
    const records = responder['buildRecords']();
    const instance = `${responder.instanceName}._matterc._udp.local`;
    for (const name of ['_matterc._udp.local', '_S3._sub._matterc._udp.local', '_L840._sub._matterc._udp.local', '_CM._sub._matterc._udp.local']) {
      const record = records.find((entry) => entry.name === name);
      expect(record?.type).toBe(DnsRecordType.PTR);
      expect(record?.unique).toBe(false);
      expect(codec.decodeDnsName(record?.rdata ?? Buffer.alloc(0), 0).name).toBe(instance);
    }
    const srv = records.find((entry) => entry.type === DnsRecordType.SRV);
    expect(srv?.rdata.readUInt16BE(4)).toBe(11111);
    expect(codec.decodeDnsName(srv?.rdata ?? Buffer.alloc(0), 6).name).toBe('B75AFB458ECD.local');
    expect(records.filter((entry) => entry.type === DnsRecordType.AAAA)).toHaveLength(2);
    expect(records.some((entry) => entry.name === 'matterbridge.local')).toBe(false);
  });

  it('should omit commissioning-mode subtype in extended discovery and include optional identity', () => {
    const advertiser = create({
      mode: 'commissionable',
      port: 5540,
      discriminator: 0,
      commissioningMode: CommissioningMode.None,
      vendorId: 123,
      productId: 456,
      deviceType: 266,
      deviceName: 'Kitchen Plug',
      rotatingDeviceId: 'AABB',
    });
    expect(txt(advertiser)).toEqual(['VP=123+456', 'DT=266', 'DN=Kitchen Plug', 'D=0', 'CM=0', 'RI=AABB']);
    const names = advertiser['responders'][0]['buildRecords']().map((record) => record.name);
    expect(names).toContain('_V123._sub._matterc._udp.local');
    expect(names).toContain('_T266._sub._matterc._udp.local');
    expect(names).not.toContain('_CM._sub._matterc._udp.local');
  });

  it('should format operational identifiers with fixed-width uppercase hex and fabric subtype', () => {
    const advertiser = create({
      mode: 'operational',
      port: 22222,
      compressedFabricId: 0x87e1b004e235a130n,
      nodeId: 0x8fc7772401cd0696n,
      tcpSupport: 6,
      incompleteCommissioning: true,
    });
    const responder = advertiser['responders'][0];
    expect(responder.instanceName).toBe('87E1B004E235A130-8FC7772401CD0696');
    expect(responder['buildRecords']().map((record) => record.name)).toContain('_I87E1B004E235A130._sub._matter._tcp.local');
    expect(responder['buildRecords']().map((record) => record.name)).toContain('_IC._sub._matter._tcp.local');
    expect(txt(advertiser)).toEqual(['T=6', 'IC=1']);
    expect(create({ mode: 'operational', port: 5540, compressedFabricId: 1n, nodeId: 2n })['responders'][0].instanceName).toBe('0000000000000001-0000000000000002');
  });

  it('should advertise commissioner discovery on its UDC port without commissionable keys', () => {
    const advertiser = create({
      mode: 'controller',
      port: 33333,
      matterPorts: [5540],
      commissionerPasscode: true,
      vendorId: 123,
      sessionIdleInterval: 5300,
      sessionActiveInterval: 1250,
      sessionActiveThreshold: 65535,
      longIdleTime: true,
    });
    expect(txt(advertiser)).toEqual(['SII=5300', 'SAI=1250', 'SAT=65535', 'ICD=1', 'VP=123', 'CP=1']);
    expect(advertiser['responders'][0]['buildRecords']().map((record) => record.name)).toContain('_matterd._udp.local');
  });

  it('should keep address records scoped to each interface and support address and family selection', () => {
    const all = create({ mode: 'controller', port: 5541 });
    const second = all['responders'][1]['buildRecords']();
    expect(second.filter((record) => record.type === DnsRecordType.AAAA)).toHaveLength(0);
    expect(second.find((record) => record.type === DnsRecordType.A)?.rdata).toEqual(codec.encodeA('198.51.100.10'));
    const selected = create({ mode: 'controller', port: 5541, address: 'fe80::10%lan0' });
    expect(selected.interfaceNames).toEqual(['lan0']);
    expect(selected['responders'][0].sockets.ipv4).toBeUndefined();
    expect(selected['responders'][0]['buildRecords']().filter((record) => record.type === DnsRecordType.AAAA)).toHaveLength(1);
    const ipv4 = create({ mode: 'controller', port: 5541, family: 'ipv4', interfaceName: 'lan0' });
    expect(ipv4['responders'][0]['buildRecords']().filter((record) => record.type === DnsRecordType.AAAA)).toHaveLength(0);
    expect(ipv4['responders'][0].sockets.ipv6).toBeUndefined();
  });

  it('should group only owned records by their selected interface', () => {
    const advertiser = create({ mode: 'controller', port: 5541 });
    expect([...advertiser.activeRecords()]).toEqual([
      ['lan0', []],
      ['lan1', []],
    ]);
    for (const responder of advertiser['responders']) {
      responder['claims'].set('host', 'owned');
      responder['claims'].set('instance', 'owned');
    }
    const records = advertiser.activeRecords();
    expect([...records.keys()]).toEqual(['lan0', 'lan1']);
    const firstAddresses = records.get('lan0')?.filter((record) => record.type === DnsRecordType.A);
    expect(firstAddresses?.map((record) => record.rdata)).toEqual([codec.encodeA('192.0.2.10')]);
    const secondAddresses = records.get('lan1')?.filter((record) => record.type === DnsRecordType.A);
    expect(secondAddresses?.map((record) => record.rdata)).toEqual([codec.encodeA('198.51.100.10')]);
    expect(records.get('lan1')?.some((record) => record.type === DnsRecordType.AAAA)).toBe(false);
  });

  it('should generate fresh temporary identities and preserve operational identities on conflict', () => {
    const first = create({ mode: 'commissionable', port: 5540, discriminator: 4095 });
    const second = create({ mode: 'commissionable', port: 5540, discriminator: 4095 });
    expect(first['responders'][0].instanceName).not.toBe(second['responders'][0].instanceName);
    const resolve = first['responders'][0]['options'].resolveConflict;
    expect(resolve?.('instance', first['responders'][0].instanceName)).toMatch(/^[0-9A-F]{16}$/);
    expect(resolve?.('host', 'B75AFB458ECD')).toBeUndefined();
    const operational = create({ mode: 'operational', port: 5540, compressedFabricId: 1n, nodeId: 1n });
    expect(operational['responders'][0]['options'].resolveConflict?.('instance', 'identity')).toBeUndefined();
  });

  it('should retry a temporary instance collision with another valid Matter name', () => {
    const advertiser = create({ mode: 'commissionable', port: 5540, discriminator: 1 });
    const responder = advertiser['responders'][0];
    const probe = vi.spyOn(responder as unknown as { startProbing: () => void }, 'startProbing').mockImplementation(() => {});
    const previous = responder.instanceName;
    responder['probeConflict']('instance');
    expect(responder.instanceName).toMatch(/^[0-9A-F]{16}$/);
    expect(responder.instanceName).not.toBe(previous);
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('should withdraw every interface and report a conflicting operational identity', () => {
    const advertiser = create({ mode: 'operational', port: 5540, compressedFabricId: 1n, nodeId: 1n });
    const stop = vi.spyOn(MdnsResponder.prototype, 'stop').mockResolvedValue();
    const error = vi.fn();
    advertiser.on('error', error);
    advertiser['responders'][0]['probeConflict']('instance');
    expect(error).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalled();
    expect(advertiser['responders'][0].instanceName).toBe('0000000000000001-0000000000000001');
  });

  it('should reuse an available link-layer identity for an interface without a MAC', () => {
    vi.spyOn(os, 'networkInterfaces').mockReturnValue({ ...networks, tunnel: [{ ...(networks.lan1 ?? [])[0], mac: '00:00:00:00:00:00' }] });
    const advertiser = create({ mode: 'controller', port: 5541, interfaceName: 'tunnel' });
    expect(advertiser['responders'][0].hostName).toBe('B75AFB458ECD.local');
  });

  it('should use a random locally administered host identity when only placeholder MACs are reported', () => {
    const hidden = (infos: os.NetworkInterfaceInfo[] | undefined): os.NetworkInterfaceInfo[] => (infos ?? []).map((info) => ({ ...info, mac: '02:00:00:00:00:00' }));
    vi.spyOn(os, 'networkInterfaces').mockReturnValue({ lan0: hidden(networks.lan0), lan1: hidden(networks.lan1) });
    const advertiser = create({ mode: 'controller', port: 5541, interfaceName: 'lan0' });
    const responder = advertiser['responders'][0];
    expect(responder.hostName).toMatch(/^[0-9A-F][26AE][0-9A-F]{10}\.local$/);
    expect(responder.hostName).not.toBe('020000000000.local');
    vi.spyOn(responder as unknown as { startProbing: () => void }, 'startProbing').mockImplementation(() => {});
    const hostName = responder.hostName;
    responder['checkAddresses']();
    expect(responder.hostName).toBe(hostName);
  });

  it('should stop and log a host collision when no error listener is registered', () => {
    const advertiser = create({ mode: 'controller', port: 5541 });
    vi.spyOn(MdnsResponder.prototype, 'stop').mockResolvedValue();
    const responder = advertiser['responders'][0];
    const log = vi.spyOn(responder.log, 'error').mockImplementation(() => {});
    responder['probeConflict']('host');
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('should refresh the Matter host name when a privacy MAC rotates', () => {
    const advertiser = create({ mode: 'controller', port: 5541, interfaceName: 'lan0' });
    const responder = advertiser['responders'][0];
    vi.spyOn(responder as unknown as { startProbing: () => void }, 'startProbing').mockImplementation(() => {});
    vi.spyOn(os, 'networkInterfaces').mockReturnValue({ lan0: (networks.lan0 ?? []).map((info) => ({ ...info, mac: 'aa:bb:cc:dd:ee:ff' })) });
    responder['checkAddresses']();
    expect(responder.hostName).toBe('AABBCCDDEEFF.local');
  });

  it('should refresh a tunnel host identity from another interface when its MAC rotates', () => {
    const tunnel = (networks.lan1 ?? []).map((info) => ({ ...info, mac: '00:00:00:00:00:00' }));
    vi.spyOn(os, 'networkInterfaces').mockReturnValue({ ...networks, tunnel });
    const advertiser = create({ mode: 'controller', port: 5541, interfaceName: 'tunnel' });
    const responder = advertiser['responders'][0];
    vi.spyOn(responder as unknown as { startProbing: () => void }, 'startProbing').mockImplementation(() => {});
    vi.spyOn(os, 'networkInterfaces').mockReturnValue({
      tunnel,
      lan0: (networks.lan0 ?? []).map((info) => ({ ...info, mac: 'aa:bb:cc:dd:ee:ff' })),
    });
    responder['checkAddresses']();
    expect(responder.hostName).toBe('AABBCCDDEEFF.local');
  });

  it.each([
    { mode: 'commissionable', port: 0, discriminator: 1 },
    { mode: 'commissionable', port: 5540, discriminator: 4096 },
    { mode: 'commissionable', port: 5540, discriminator: -1 },
    { mode: 'commissionable', port: 5540, discriminator: 1.5 },
    { mode: 'commissionable', port: 5540, discriminator: 1, productId: 2 },
    { mode: 'commissionable', port: 5540, discriminator: 1, vendorId: 65536 },
    { mode: 'commissionable', port: 5540, discriminator: 1, rotatingDeviceId: 'aabb' },
    { mode: 'controller', port: 5540, matterPorts: [5540] },
    { mode: 'controller', port: 5541, sessionIdleInterval: 3600001 },
    { mode: 'controller', port: 5541, sessionActiveThreshold: 65536 },
    { mode: 'controller', port: 5541, durationMs: 0 },
    { mode: 'controller', port: 5541, deviceName: 'é'.repeat(17) },
    { mode: 'controller', port: 5541, interfaceName: 'missing' },
    { mode: 'controller', port: 5541, address: '203.0.113.10' },
    { mode: 'controller', port: 5541, address: 'invalid' },
    { mode: 'controller', port: 5541, address: 'fe80::10%lan1' },
    { mode: 'operational', port: 5540, compressedFabricId: -1n, nodeId: 1n },
    { mode: 'operational', port: 5540, compressedFabricId: 1n, nodeId: 0n },
    { mode: 'operational', port: 5540, compressedFabricId: 1n, nodeId: 0xfffffff000000000n },
  ] satisfies MatterAdvertiseOptions[])('should reject invalid options %#', (options) => {
    expect(() => new MatterAdvertise(options)).toThrow();
  });

  it('should start every interface and withdraw when the discovery duration expires', async () => {
    vi.useFakeTimers();
    const start = vi.spyOn(MdnsResponder.prototype, 'start').mockResolvedValue();
    const stop = vi.spyOn(MdnsResponder.prototype, 'stop').mockResolvedValue();
    const advertiser = create({ mode: 'controller', port: 5541, durationMs: 1000 });
    const announced = vi.fn();
    advertiser.on('announced', announced);
    await advertiser.start();
    expect(start).toHaveBeenCalledTimes(2);
    expect(announced).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(stop).toHaveBeenCalledTimes(2);
    await expect(advertiser.start()).rejects.toThrow('already started or stopped');
  });

  it('should stop all responders if one interface fails to start', async () => {
    vi.spyOn(MdnsResponder.prototype, 'start').mockRejectedValue(new Error('bind failed'));
    const stop = vi.spyOn(MdnsResponder.prototype, 'stop').mockResolvedValue();
    const advertiser = create({ mode: 'controller', port: 5541 });
    await expect(advertiser.start()).rejects.toThrow('bind failed');
    expect(stop).toHaveBeenCalledTimes(2);
  });

  describe('branch coverage', () => {
    it('should reject an invalid family and an invalid mode', () => {
      expect(() => create({ mode: 'controller', port: 5541, family: 'ipx' } as unknown as MatterAdvertiseOptions)).toThrow('invalid family');
      expect(() => create({ mode: 'unknown', port: 5541 } as unknown as MatterAdvertiseOptions)).toThrow('invalid mode');
    });

    it('should reject an invalid operational tcpSupport', () => {
      expect(() => create({ mode: 'operational', port: 5540, compressedFabricId: 1n, nodeId: 1n, tcpSupport: 3 } as unknown as MatterAdvertiseOptions)).toThrow(
        'invalid tcpSupport',
      );
    });

    it('should accept the optional mdnsPort, addressCheckIntervalMs, ICD=0 and CP=0', () => {
      const advertiser = create({ mode: 'controller', port: 5541, mdnsPort: 15353, addressCheckIntervalMs: 0, longIdleTime: false, commissionerPasscode: false });
      expect(txt(advertiser)).toEqual(expect.arrayContaining(['ICD=0', 'CP=0']));
    });

    it('should select only IPv6 addresses with family ipv6', () => {
      const advertiser = create({ mode: 'controller', port: 5541, family: 'ipv6' });
      expect(advertiser.interfaceNames).toEqual(['lan0']);
    });

    it('should skip undefined interface entries and fall back for the host name provider', () => {
      vi.spyOn(os, 'networkInterfaces').mockReturnValue({ ...networks, ghost: undefined });
      const advertiser = create({ mode: 'controller', port: 5541, interfaceName: 'lan1' });
      const provider = advertiser['responders'][0]['options'].hostNameProvider as () => string | undefined;
      vi.spyOn(os, 'networkInterfaces').mockReturnValue({ lan0: networks.lan0, ghost: undefined });
      expect(provider()).toBe('B75AFB458ECD');
    });

    it('should skip undefined interface entries without an interface filter', () => {
      vi.spyOn(os, 'networkInterfaces').mockReturnValue({ ...networks, ghost: undefined });
      expect(create({ mode: 'controller', port: 5541 }).interfaceNames).toEqual(['lan0', 'lan1']);
    });

    it('should start without a duration timer', async () => {
      vi.spyOn(MdnsResponder.prototype, 'start').mockResolvedValue();
      vi.spyOn(MdnsResponder.prototype, 'stop').mockResolvedValue();
      const advertiser = create({ mode: 'controller', port: 5541 });
      await advertiser.start();
      expect(advertiser['durationTimer']).toBeUndefined();
      await advertiser.stop();
    });

    it('should not announce when stopped while the responders are starting', async () => {
      vi.spyOn(MdnsResponder.prototype, 'stop').mockResolvedValue();
      const advertiser = create({ mode: 'controller', port: 5541, durationMs: 1000 });
      vi.spyOn(MdnsResponder.prototype, 'start').mockImplementation(async () => {
        await advertiser.stop();
      });
      const announced = vi.fn();
      advertiser.on('announced', announced);
      await advertiser.start();
      expect(announced).not.toHaveBeenCalled();
      expect(advertiser['durationTimer']).toBeUndefined();
    });
  });
});
