/**
 * @file packages/core/buntest/behaviors/weriftSession.test.ts
 * @description This file contains the bun tests for weriftSession.
 * @author Luca Liguori
 */

const NAME = 'WeriftSession';

import { afterEach, beforeEach, describe, expect, mock, setDefaultTimeout, spyOn, test, vi } from 'bun:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { createSocket } from 'node:dgram';
import { EventEmitter } from 'node:events';

import { loggerDebugSpy, loggerErrorSpy, loggerWarnSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { RTCPeerConnection, RTCRtpCodecParameters, useH264, usePCMU } from 'werift';

import type { WeriftOfferOptions } from '../../src/behaviors/weriftSession.js';
import { waitFor } from '../bunUtils.js';

await setupTest(NAME, false);
delete process.env.MATTERBRIDGE_ICE_PORT_RANGE;
delete process.env.MATTERBRIDGE_ICE_HOST_ADDRESSES;
setDefaultTimeout(30_000);

// ffmpeg is replaced by a process that exits at once, so no real encoder runs; the real hasFfmpeg is kept for restores.
const ffmpegModule = await import('../../src/behaviors/ffmpeg.js');
const realHasFfmpeg = ffmpegModule.hasFfmpeg;
const hasFfmpeg = vi.fn(realHasFfmpeg);
const runFfmpeg = vi.fn<(args: string[]) => ChildProcess>(ffmpegModule.runFfmpeg);
await mock.module('../../src/behaviors/ffmpeg.js', () => ({ ...ffmpegModule, hasFfmpeg, runFfmpeg }));
const { WeriftWebRtcSession } = await import('../../src/behaviors/weriftSession.js');

/**
 * Makes ffmpeg resolvable, with every generator a process that exits at once.
 *
 * @returns {void}
 */
function mockResolvableFfmpeg(): void {
  hasFfmpeg.mockReturnValue(true);
  runFfmpeg.mockImplementation(() => spawn(process.execPath, ['-e', '""']));
}

/**
 * Creates the SDP offer of a remote peer.
 *
 * @param {'video' | 'audio'} kind - The media of the offer.
 * @param {ConstructorParameters<typeof RTCPeerConnection>[0]} [config] - The peer configuration, for a codec restriction.
 * @returns {Promise<string>} The offer SDP.
 */
async function remoteOffer(kind: 'video' | 'audio', config?: ConstructorParameters<typeof RTCPeerConnection>[0]): Promise<string> {
  const remote = new RTCPeerConnection(config);
  remote.addTransceiver(kind, { direction: 'sendonly' });
  const offer = await remote.createOffer();
  await remote.setLocalDescription(offer);
  const sdp = remote.localDescription?.sdp ?? offer.sdp;
  await remote.close();
  return sdp;
}

/**
 * Creates the SDP answer of a remote peer to an offer.
 *
 * @param {string} offerSdp - The offer.
 * @returns {Promise<string>} The answer SDP.
 */
async function remoteAnswer(offerSdp: string): Promise<string> {
  const remote = new RTCPeerConnection();
  await remote.setRemoteDescription({ type: 'offer', sdp: offerSdp });
  const answer = await remote.createAnswer();
  await remote.setLocalDescription(answer);
  const sdp = remote.localDescription?.sdp ?? answer.sdp;
  await remote.close();
  return sdp;
}

/**
 * Creates the SDP offer of a remote peer with several transceivers.
 *
 * @param {('video' | 'audio')[]} kinds - The media of the transceivers, in order.
 * @param {(peer: RTCPeerConnection) => void} [configure] - Adjusts the peer before the offer.
 * @returns {Promise<string>} The offer SDP.
 */
async function remoteOfferWith(kinds: ('video' | 'audio')[], configure?: (peer: RTCPeerConnection) => void): Promise<string> {
  const remote = new RTCPeerConnection();
  for (const kind of kinds) remote.addTransceiver(kind, { direction: 'sendonly' });
  configure?.(remote);
  const offer = await remote.createOffer();
  await remote.setLocalDescription(offer);
  const sdp = remote.localDescription?.sdp ?? offer.sdp;
  await remote.close();
  return sdp;
}

const h264Only: ConstructorParameters<typeof RTCPeerConnection>[0] = { codecs: { video: [useH264()] } };
const lastArgs = (): string[] => runFfmpeg.mock.calls.at(-1)?.[0] ?? [];

/**
 * Runs the callback with environment variables set, restoring them afterwards. Bun has no vi.stubEnv().
 *
 * @param {Record<string, string | undefined>} vars - The variables to set (undefined deletes one).
 * @param {() => Promise<void>} callback - The code to run.
 * @returns {Promise<void>} Resolves once the callback completed and the variables are restored.
 */
async function withEnv(vars: Record<string, string | undefined>, callback: () => Promise<void>): Promise<void> {
  const saved = Object.fromEntries(Object.keys(vars).map((name) => [name, process.env[name]]));
  const apply = (values: Record<string, string | undefined>): void => {
    for (const [name, value] of Object.entries(values)) {
      if (value === undefined) Reflect.deleteProperty(process.env, name);
      else process.env[name] = value;
    }
  };
  apply(vars);
  try {
    await callback();
  } finally {
    apply(saved);
  }
}

/**
 * Runs the callback with a new session, always closing it afterwards.
 *
 * @param {WeriftOfferOptions} options - The session options.
 * @param {(session: InstanceType<typeof WeriftWebRtcSession>) => Promise<void>} callback - The code to run.
 * @returns {Promise<void>} Resolves once the session is closed.
 */
async function withSession(options: WeriftOfferOptions, callback: (session: InstanceType<typeof WeriftWebRtcSession>) => Promise<void>): Promise<void> {
  const session = new WeriftWebRtcSession(1, options);
  try {
    await callback(session);
  } finally {
    await session.close();
  }
}

/**
 * Returns the value that follows a flag in the ffmpeg arguments.
 *
 * @param {string[]} args - The arguments.
 * @param {string} flag - The flag.
 * @returns {string | undefined} The value.
 */
const valueOf = (args: string[], flag: string): string | undefined => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);

describe('WeriftWebRtcSession', () => {
  let options: WeriftOfferOptions;

  beforeEach(() => {
    options = { offerVideo: true, offerAudio: true, videoSource: 'test', audioSource: 'test' };
    mockResolvableFfmpeg();
  });

  afterEach(() => {
    hasFfmpeg.mockImplementation(realHasFfmpeg);
    runFfmpeg.mockReset();
  });

  test('local ICE candidates are gathered with a null default sdpMid/sdpMLineIndex, and a read-only copy is exposed', async () => {
    const session = new WeriftWebRtcSession(1, { ...options, offerVideo: false, offerAudio: false });
    expect(session.localIceCandidates).toEqual([]);
    session.peerConnection.onIceCandidate.execute({ candidate: 'candidate:1 1 udp 2130706431 192.0.2.1 5000 typ host', sdpMid: '0', sdpMLineIndex: 0 } as never);
    session.peerConnection.onIceCandidate.execute({ candidate: 'candidate:2 1 udp 2130706431 192.0.2.2 5001 typ host' } as never);
    // The end-of-candidates signal is ignored.
    // oxlint-disable-next-line unicorn/no-useless-undefined
    session.peerConnection.onIceCandidate.execute(undefined);
    expect(session.localIceCandidates).toEqual([
      { candidate: 'candidate:1 1 udp 2130706431 192.0.2.1 5000 typ host', sdpMid: '0', sdpmLineIndex: 0 },
      { candidate: 'candidate:2 1 udp 2130706431 192.0.2.2 5001 typ host', sdpMid: null, sdpmLineIndex: null },
    ]);
    session.localIceCandidates.push({ candidate: 'candidate:3', sdpMid: null, sdpmLineIndex: null });
    expect(session.localIceCandidates).toHaveLength(2);
    // The diagnostics timer does not keep the process alive and is cleared on close.
    expect((session as unknown as { diagnosticsInterval: NodeJS.Timeout }).diagnosticsInterval.hasRef()).toBe(false);
    await session.close();
    expect((session as unknown as { diagnosticsInterval?: NodeJS.Timeout }).diagnosticsInterval).toBeUndefined();
  });

  test.each([
    [true, false, ['m=video'], ['m=audio']],
    [true, true, ['m=video', 'm=audio'], []],
    [false, false, [], ['m=video', 'm=audio']],
  ])('an offer with offerVideo %p and offerAudio %p has the requested transceivers', async (offerVideo, offerAudio, present, absent) => {
    const session = new WeriftWebRtcSession(1, { ...options, offerVideo, offerAudio });
    const sdp = await session.createOffer();
    expect(sdp).toContain('v=0');
    for (const line of present) expect(sdp).toContain(line);
    for (const line of absent) expect(sdp).not.toContain(line);
    // A second offer on the same session keeps the media and attaches no second test track.
    if (offerVideo) expect(await session.createOffer()).toContain('m=video');
    expect(session.close()).resolves.toBeUndefined();
  });

  test.each([
    ['a VP8 video offer', undefined, undefined],
    ['an H264-only video offer', h264Only, 'h264/90000'],
  ] as const)('a real answer is created for %s', async (_label, config, codec) => {
    const session = new WeriftWebRtcSession(1, { ...options });
    const answer = await session.createAnswer(await remoteOffer('video', config));
    expect(answer).toContain('v=0');
    expect(answer).toContain('m=video');
    if (codec) expect(answer.toLowerCase()).toContain(codec);
    expect(session.peerConnection.signalingState).toBe('stable');
    await session.close();
  });

  test('a remote answer applies to a local offer, and remote ICE candidates are accepted after it', async () => {
    const session = new WeriftWebRtcSession(1, { ...options, offerVideo: true, offerAudio: false });
    const offer = await session.createOffer();
    expect(session.applyAnswer(await remoteAnswer(offer))).resolves.toBeUndefined();
    expect(session.peerConnection.signalingState).toBe('stable');
    expect(session.addIceCandidate('candidate:1 1 UDP 1 127.0.0.1 1 typ host', null, 0)).resolves.toBeUndefined();
    expect(session.addIceCandidate('candidate:1 1 UDP 1 127.0.0.1 1 typ host', '0', null)).resolves.toBeUndefined();
    await session.close();
  });

  test('the diagnostics snapshot logs the states and the packet counter deltas', async () => {
    const session = new WeriftWebRtcSession(1, { ...options, offerVideo: false, offerAudio: false });
    const snapshot = async (): Promise<void> => (session as unknown as { logDiagnosticsSnapshot: () => Promise<void> }).logDiagnosticsSnapshot();
    const getStats = spyOn(session.peerConnection, 'getStats');
    // No stats and no transports: every summary falls back to none and the deltas to n/a.
    getStats.mockResolvedValueOnce(new Map() as never);
    loggerDebugSpy.mockClear();
    await snapshot();
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('outboundRtp[none] (totalPacketsSent Δn/a)'));
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('iceTransportStates=[none]'));
    // A nominated pair and outbound RTP streams, some without counters or kind.
    getStats.mockResolvedValueOnce(
      new Map<string, unknown>([
        ['p0', { type: 'candidate-pair', nominated: false, packetsSent: 99 }],
        ['p1', { type: 'candidate-pair', nominated: true, packetsSent: 5, packetsReceived: 3 }],
        ['o1', { type: 'outbound-rtp', kind: 'video', packetsSent: 7 }],
        ['o2', { type: 'outbound-rtp' }],
        ['x', { type: 'transport' }],
      ]) as never,
    );
    loggerDebugSpy.mockClear();
    await snapshot();
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('nominatedPair(packetsSent=5 Δ+5, packetsReceived=3 Δ+3)'));
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('outboundRtp[video:packetsSent=7, unknown:packetsSent=0] (totalPacketsSent Δ+7)'));
    // Counters going back produce a negative delta.
    getStats.mockResolvedValueOnce(new Map<string, unknown>([['p1', { type: 'candidate-pair', nominated: true }]]) as never);
    loggerDebugSpy.mockClear();
    await snapshot();
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('nominatedPair(packetsSent=0 Δ-5, packetsReceived=0 Δ-3)'));
    getStats.mockRestore();
    await session.close();
  });
  describe('encoder arguments from the options and the environment', () => {
    const rtsp = { videoSource: 'rtsp', videoSourceDevice: 'rtsp://camera.local/live' } as const;

    test.each([
      ['1280x720', '1280:720'],
      ['1920x1080', '1920:1080'],
      ['auto', '640:480'],
      [undefined, '640:480'],
      ['4000x3000', '640:480'],
    ])('an RTSP offer with videoResolution %s scales to %s', async (videoResolution, expected) => {
      await withSession({ ...options, ...rtsp, videoResolution }, async (session) => {
        await session.createOffer();
        expect(valueOf(lastArgs(), '-vf')).toBe(`scale=${expected}`);
      });
    });

    test.each([
      ['640x480', '640:480'],
      ['1280x720', '1280:720'],
      ['1920x1080', '1920:1080'],
      ['auto', '640:480'],
      [undefined, '640:480'],
      ['4000x3000', '640:480'],
    ])('an RTSP answer with videoResolution %s reads the url and scales to %s', async (videoResolution, expected) => {
      await withSession({ ...options, ...rtsp, videoResolution }, async (session) => {
        await session.createAnswer(await remoteOffer('video'));
        expect(valueOf(lastArgs(), '-i')).toBe('rtsp://camera.local/live');
        expect(valueOf(lastArgs(), '-vf')).toBe(`scale=${expected}`);
      });
    });

    test.each([
      [undefined, '1000k'],
      [2500, '2500k'],
      [0, '1000k'],
      [-1, '1000k'],
      [Number.NaN, '1000k'],
      [Number.POSITIVE_INFINITY, '1000k'],
    ])('videoBitrate %p sets the bitrate, maxrate and bufsize to %s', async (videoBitrate, expected) => {
      await withSession({ ...options, ...rtsp, videoBitrate }, async (session) => {
        await session.createOffer();
        for (const flag of ['-b:v', '-maxrate', '-bufsize']) expect(valueOf(lastArgs(), flag)).toBe(expected);
      });
    });

    test.each([
      [undefined, undefined, 'testsrc=size=640x480:rate=30', '1000k'],
      ['auto', undefined, 'testsrc=size=640x480:rate=30', '1000k'],
      ['1280x720', 2000, 'testsrc=size=1280x720:rate=30', '2000k'],
      ['1920x1080', 2500, 'testsrc=size=1920x1080:rate=30', '2500k'],
    ])('the test pattern with videoResolution %s and videoBitrate %s', async (videoResolution, videoBitrate, input, bitrate) => {
      await withSession({ ...options, videoResolution, videoBitrate }, async (session) => {
        await session.createOffer();
        expect(lastArgs()).toContain(input);
        expect(valueOf(lastArgs(), '-b:v')).toBe(bitrate);
      });
    });

    test.each([
      [undefined, 'testsrc=size=640x480:rate=30', '60'],
      ['10', 'testsrc=size=640x480:rate=10', '20'],
      [' 60 ', 'testsrc=size=640x480:rate=60', '120'],
      ['0', 'testsrc=size=640x480:rate=30', '60'],
      ['61', 'testsrc=size=640x480:rate=30', '60'],
      ['12.5', 'testsrc=size=640x480:rate=30', '60'],
      ['abc', 'testsrc=size=640x480:rate=30', '60'],
    ])('MATTERBRIDGE_TEST_VIDEO_FPS %p sets the test pattern rate and a keyframe every two seconds', async (fps, input, keyFrameInterval) => {
      await withEnv({ MATTERBRIDGE_TEST_VIDEO_FPS: fps }, async () => {
        await withSession({ ...options }, async (session) => {
          await session.createOffer();
          expect(lastArgs()).toContain(input);
          expect(valueOf(lastArgs(), '-g')).toBe(keyFrameInterval);
        });
      });
    });

    test('RTSP keeps a keyframe every 20 frames, and constructor options win over conflicting environment values', async () => {
      await withEnv({ MATTERBRIDGE_TEST_VIDEO_FPS: '10' }, async () => {
        await withSession({ ...options, ...rtsp }, async (session) => {
          await session.createOffer();
          expect(lastArgs()).not.toContain('testsrc=size=640x480:rate=10');
          expect(valueOf(lastArgs(), '-g')).toBe('20');
        });
      });
      runFfmpeg.mockClear();
      await withEnv({ MATTERBRIDGE_CAMERA_VIDEO_SOURCE: 'none', MATTERBRIDGE_CAMERA_AUDIO_SOURCE: 'none' }, async () => {
        await withSession({ ...options }, async (session) => {
          await session.createAnswer(await remoteOffer('audio'));
          expect(runFfmpeg.mock.calls[0]?.[0]).toEqual(expect.arrayContaining(['-f', 'lavfi', '-i', expect.stringContaining('sine=')]));
        });
      });
    });
  });

  describe('ICE environment overrides', () => {
    /**
     * Extracts the host candidates of an SDP.
     *
     * @param {string} sdp - The SDP.
     * @returns {{ address: string; port: number }[]} The host candidates.
     */
    const hostCandidates = (sdp: string): { address: string; port: number }[] =>
      [...sdp.matchAll(/^a=candidate:\S+ \d+ udp \d+ (\S+) (\d+) typ host/gm)].map((match) => ({ address: match[1], port: Number(match[2]) }));

    /**
     * Finds a range of free UDP ports.
     *
     * @param {number} size - The number of ports.
     * @returns {Promise<[number, number]>} The first and last port of the range.
     */
    const findFreeUdpPortRange = async (size: number): Promise<[number, number]> => {
      const canBind = async (port: number): Promise<boolean> =>
        new Promise((resolve) => {
          const socket = createSocket('udp4');
          socket.once('error', () => {
            try {
              socket.close();
            } catch {
              // Already closed.
            }
            resolve(false);
          });
          socket.once('listening', () => socket.close(() => resolve(true)));
          socket.bind(port);
        });
      for (let min = 49_152; min + size - 1 <= 65_535; min += size) {
        let free = true;
        for (let port = min; port < min + size && free; port++) free = await canBind(port);
        if (free) return [min, min + size - 1];
      }
      throw new Error(`No free UDP port range of ${size} ports found`);
    };

    test('MATTERBRIDGE_ICE_PORT_RANGE binds the host candidates inside the range', async () => {
      const [min, max] = await findFreeUdpPortRange(11);
      await withEnv({ MATTERBRIDGE_ICE_PORT_RANGE: `${min}-${max}` }, async () => {
        await withSession({ ...options }, async (session) => {
          const candidates = hostCandidates(await session.createOffer());
          expect(candidates.length).toBeGreaterThan(0);
          for (const { port } of candidates) expect(port >= min && port <= max).toBe(true);
        });
      });
    });

    test('MATTERBRIDGE_ICE_HOST_ADDRESSES advertises an extra host candidate', async () => {
      await withEnv({ MATTERBRIDGE_ICE_HOST_ADDRESSES: '203.0.113.9' }, async () => {
        await withSession({ ...options }, async (session) => {
          expect(hostCandidates(await session.createOffer()).map((candidate) => candidate.address)).toContain('203.0.113.9');
        });
      });
    });

    test.each(['51000', '51000-51000'])('a malformed MATTERBRIDGE_ICE_PORT_RANGE %s falls back to ephemeral ports', async (range) => {
      await withEnv({ MATTERBRIDGE_ICE_PORT_RANGE: range }, async () => {
        await withSession({ ...options }, async (session) => {
          expect(hostCandidates(await session.createOffer()).length).toBeGreaterThan(0);
        });
      });
    });
  });
  describe('video sources', () => {
    const originalPlatform = process.platform;
    const attached = (session: InstanceType<typeof WeriftWebRtcSession>, kind: 'Video' | 'Audio'): boolean =>
      (session as unknown as Record<string, boolean>)[`test${kind}Attached`];
    const rtspUrl = 'rtsp://admin:password@192.168.1.100:554/ch1/main';

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    // [label, video options, offer or answer, track attached, error logged]
    test.each([
      ['a missing videoSource', { videoSource: undefined }, 'offer', false, undefined],
      ['videoSource test', { videoSource: 'test' }, 'offer', true, undefined],
      ['an unsupported videoSource', { videoSource: 'unsupported' }, 'offer', false, undefined],
      ['videoSource none', { videoSource: 'none' }, 'offer', false, undefined],
      [
        'webcam without a device',
        { videoSource: 'webcam' },
        'offer',
        false,
        'options.videoSource=webcam requires options.videoSourceDevice to be set; not injecting a video track',
      ],
      ['rtsp without a url', { videoSource: 'rtsp' }, 'offer', false, 'options.videoSource=rtsp requires options.videoSourceDevice to be set; not injecting a video track'],
      ['webcam 1280x720', { videoSource: 'webcam', videoSourceDevice: '/dev/video0', videoResolution: '1280x720' }, 'offer', true, undefined],
      ['webcam 1920x1080', { videoSource: 'webcam', videoSourceDevice: '/dev/video0', videoResolution: '1920x1080' }, 'offer', true, undefined],
      ['webcam with an unsupported resolution (640x480)', { videoSource: 'webcam', videoSourceDevice: '/dev/video0', videoResolution: '4000x3000' }, 'offer', true, undefined],
      ['webcam answer 1280x720', { videoSource: 'webcam', videoSourceDevice: '/dev/video0', videoResolution: '1280x720' }, 'answer', true, undefined],
      ['webcam answer 640x480', { videoSource: 'webcam', videoSourceDevice: '/dev/video0', videoResolution: '640x480' }, 'answer', true, undefined],
      ['webcam answer auto', { videoSource: 'webcam', videoSourceDevice: '/dev/video0', videoResolution: 'auto' }, 'answer', true, undefined],
      ['rtsp', { videoSource: 'rtsp', videoSourceDevice: rtspUrl }, 'offer', true, undefined],
      ['rtsp answer 1280x720', { videoSource: 'rtsp', videoSourceDevice: rtspUrl, videoResolution: '1280x720' }, 'answer', true, undefined],
      ['rtsp answer auto', { videoSource: 'rtsp', videoSourceDevice: rtspUrl, videoResolution: 'auto' }, 'answer', true, undefined],
    ] as const)('%s negotiates video and attaches the expected track', async (_label, video, exchange, expectAttached, error) => {
      loggerErrorSpy.mockClear();
      await withSession({ ...options, ...video, ...(exchange === 'offer' ? { offerAudio: false } : {}) } as WeriftOfferOptions, async (session) => {
        const sdp = exchange === 'offer' ? await session.createOffer() : await session.createAnswer(await remoteOffer('video'));
        expect(sdp).toContain('m=video');
        if (exchange === 'offer') expect(attached(session, 'Video')).toBe(expectAttached);
        if (error) expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(error));
      });
      loggerErrorSpy.mockClear();
    });

    test('webcam capture is refused on an unsupported platform', async () => {
      loggerErrorSpy.mockClear();
      Object.defineProperty(process, 'platform', { value: 'freebsd' });
      await withSession({ ...options, videoSource: 'webcam', videoSourceDevice: '/dev/video0', offerAudio: false }, async (session) => {
        expect(await session.createOffer()).toContain('m=video');
        expect(attached(session, 'Video')).toBe(false);
        expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Webcam capture via ffmpeg is not supported on platform "freebsd"; not injecting a video track'));
      });
      loggerErrorSpy.mockClear();
    });

    test.each([
      ['linux', '/dev/video0', 'v4l2', '/dev/video0'],
      ['darwin', '0', 'avfoundation', '0'],
      ['win32', 'Integrated Camera', 'dshow', 'video=Integrated Camera'],
    ])('a webcam on %s reads the device with the platform format at a constant 30 fps', async (platform, device, format, input) => {
      Object.defineProperty(process, 'platform', { value: platform });
      await withSession({ ...options, videoSource: 'webcam', videoSourceDevice: device, offerAudio: false }, async (session) => {
        expect(await session.createOffer()).toContain('m=video');
        const args = lastArgs();
        expect(valueOf(args, '-f')).toBe(format);
        expect(args.slice(args.indexOf('-i'), args.indexOf('-i') + 6)).toEqual(['-i', input, '-fps_mode', 'cfr', '-r', '30']);
      });
    });
  });
  describe('audio sources and codec selection', () => {
    const originalPlatform = process.platform;
    const state = (session: InstanceType<typeof WeriftWebRtcSession>): Record<string, unknown> => session as unknown as Record<string, unknown>;
    const codec = (mimeType: string, clockRate: number, payloadType: number): RTCRtpCodecParameters => new RTCRtpCodecParameters({ mimeType, clockRate, payloadType });

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    // [label, audio options, platform, track attached, error logged]
    test.each([
      ['audioSource none', { audioSource: 'none' }, undefined, false, undefined],
      ['an unsupported audioSource', { audioSource: 'unsupported' }, undefined, false, undefined],
      [
        'microphone without a device',
        { audioSource: 'microphone' },
        undefined,
        false,
        'options.audioSource=microphone requires options.audioSourceDevice to be set; not injecting an audio track',
      ],
      [
        'microphone on an unsupported platform',
        { audioSource: 'microphone', audioSourceDevice: 'hw:0,0' },
        'freebsd',
        false,
        'Microphone capture via ffmpeg is not supported on platform "freebsd"; not injecting an audio track',
      ],
      ['microphone on linux', { audioSource: 'microphone', audioSourceDevice: 'hw:0,0' }, 'linux', true, undefined],
      ['microphone on darwin', { audioSource: 'microphone', audioSourceDevice: '0' }, 'darwin', true, undefined],
      ['microphone on win32', { audioSource: 'microphone', audioSourceDevice: 'Microphone Array' }, 'win32', true, undefined],
      ['rtsp without a url', { audioSource: 'rtsp' }, undefined, false, 'options.audioSource=rtsp requires options.audioSourceDevice to be set; not injecting an audio track'],
      ['rtsp', { audioSource: 'rtsp', audioSourceDevice: 'rtsp://admin:password@192.168.1.100:554/ch1/main' }, undefined, true, undefined],
    ] as const)('an audio answer with %s', async (_label, audio, platform, expectAttached, error) => {
      loggerErrorSpy.mockClear();
      if (platform) Object.defineProperty(process, 'platform', { value: platform });
      await withSession({ ...options, ...audio } as WeriftOfferOptions, async (session) => {
        expect(await session.createAnswer(await remoteOffer('audio'))).toContain('m=audio');
        expect(state(session).testAudioAttached).toBe(expectAttached);
        if (error) expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(error));
      });
      loggerErrorSpy.mockClear();
    });

    test.each([
      ['VP8', [codec('video/VP8', 90000, 96)], true],
      ['H264', [codec('video/h264', 90000, 97)], true],
      ['VP9 (not injectable)', [codec('video/VP9', 90000, 98)], false],
    ] as const)('an offer on a pre-existing %s video transceiver', async (_label, codecs, injectable) => {
      await withSession({ ...options, offerAudio: false }, async (session) => {
        session.peerConnection.addTransceiver('video', { direction: 'sendonly' }).codecs = [...codecs];
        expect(await session.createOffer()).toContain('m=video');
        if (injectable) {
          expect(state(session).testVideoAttached).toBe(true);
          expect(state(session).testVideoGenerator).toBeDefined();
        }
      });
    });

    test('only the transceivers with the preferred codec are adjusted, and other media are skipped', async () => {
      await withSession({ ...options, offerAudio: false }, async (session) => {
        session.peerConnection.addTransceiver('video', { direction: 'sendonly' }).codecs = [codec('video/VP8', 90000, 96)];
        session.peerConnection.addTransceiver('video', { direction: 'sendonly' }).codecs = [codec('video/VP9', 90000, 98)];
        expect(await session.createOffer()).toContain('m=video');
      });
      for (const kinds of [
        ['audio', 'video'],
        ['video', 'audio'],
      ] as const) {
        await withSession({ ...options }, async (session) => {
          const answer = await session.createAnswer(await remoteOfferWith([...kinds]));
          expect(answer).toContain('m=video');
          expect(answer).toContain('m=audio');
        });
      }
      await withSession({ ...options }, async (session) => {
        const offer = await remoteOfferWith(['audio', 'audio'], (peer) => {
          peer.getTransceivers()[1].codecs = [codec('audio/PCMU', 8000, 0)];
        });
        expect((await session.createAnswer(offer)).match(/m=audio/g)).toHaveLength(2);
      });
    });

    test('a PCMU-only offer is answered without an injected audio track, and an audio-only offer without video', async () => {
      await withSession({ ...options }, async (session) => {
        const answer = await session.createAnswer(await remoteOffer('audio', { codecs: { audio: [usePCMU()] } }));
        expect(answer).toContain('m=audio');
        expect(answer.toLowerCase()).not.toContain('opus');
        expect([state(session).testAudioAttached, state(session).testAudioGenerator]).toEqual([false, undefined]);
      });
      await withSession({ ...options }, async (session) => {
        const answer = await session.createAnswer(await remoteOffer('audio'));
        expect(answer).toContain('m=audio');
        expect(answer).not.toContain('m=video');
      });
    });

    test('without ffmpeg the media are negotiated but no track is injected', async () => {
      hasFfmpeg.mockReturnValue(false);
      await withSession({ ...options, offerAudio: false }, async (session) => {
        expect(await session.createOffer()).toContain('m=video');
        expect(state(session).testVideoAttached).toBe(false);
      });
      await withSession({ ...options }, async (session) => {
        expect(await session.createAnswer(await remoteOffer('audio'))).toContain('m=audio');
        expect(state(session).testAudioAttached).toBe(false);
      });
    });

    test('the video track is attached once and cleaned up on close', async () => {
      const session = new WeriftWebRtcSession(1, { ...options, offerAudio: false });
      expect(await session.createOffer()).toContain('m=video');
      expect(await session.createOffer()).toContain('m=video');
      expect(state(session).testVideoAttached).toBe(true);
      expect(state(session).testVideoGenerator).toBeDefined();
      await session.close();
      expect([state(session).testVideoAttached, state(session).testVideoGenerator]).toEqual([false, undefined]);
    });
  });
  describe('generator lifecycle and auto-close', () => {
    type Session = InstanceType<typeof WeriftWebRtcSession>;
    type Generators = { testVideoGenerator?: ChildProcess; testAudioGenerator?: ChildProcess; testAudioAttached: boolean };
    const generators = (session: Session): Generators => session as unknown as Generators;
    const logged = (spy: typeof loggerWarnSpy, text: string): boolean => spy.mock.calls.some(([message]) => message.includes(text));
    const setDtlsState = (session: Session, state: string): void => {
      const [dtlsTransport] = session.peerConnection.dtlsTransports;
      if (!dtlsTransport) throw new Error('no DTLS transport negotiated');
      (dtlsTransport as unknown as { setState(state: string): void }).setState(state);
    };
    const streaming = (script: string): void => {
      hasFfmpeg.mockReturnValue(true);
      runFfmpeg.mockImplementation(() => spawn(process.execPath, ['-e', script]));
    };
    const videoSession = async (): Promise<Session> => {
      const session = new WeriftWebRtcSession(1, { ...options, offerAudio: false });
      session.peerConnection.addTransceiver('video', { direction: 'sendonly' }).codecs = [new RTCRtpCodecParameters({ mimeType: 'video/VP8', clockRate: 90000, payloadType: 96 })];
      await session.createOffer();
      return session;
    };

    test('a generator stopped by close is logged without a warning, one killed while attached warns', async () => {
      streaming('setInterval(() => {}, 1000)');
      const session = await videoSession();
      const generator = generators(session).testVideoGenerator;
      expect(generator).toBeDefined();
      const exited = new Promise((resolve) => generator?.once('exit', resolve));
      loggerWarnSpy.mockClear();
      await session.close();
      await exited;
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`Stopping ffmpeg video generator (pid ${generator?.pid})`));
      expect(logged(loggerWarnSpy, 'exited unexpectedly')).toBe(false);

      const killed = await videoSession();
      generators(killed).testVideoGenerator?.kill('SIGKILL');
      await waitFor(() => logged(loggerWarnSpy, 'Ffmpeg video generator exited unexpectedly with signal SIGKILL: the video track carries no more media'), 5000);
      await killed.close();
      loggerWarnSpy.mockClear();
    });

    test('an audio generator that exits on its own warns, and its stderr is logged at debug level', async () => {
      streaming('setTimeout(() => process.exit(1), 200)');
      await withSession({ ...options }, async (session) => {
        await session.createAnswer(await remoteOffer('audio'));
        expect(generators(session).testAudioGenerator).toBeDefined();
        await waitFor(() => logged(loggerWarnSpy, 'Ffmpeg audio generator exited unexpectedly with code 1'), 5000);
      });
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('Stopping ffmpeg audio generator'));
      loggerWarnSpy.mockClear();

      streaming('process.stderr.write("Invalid argument\\n")');
      await withSession({ ...options }, async (session) => {
        await session.createAnswer(await remoteOffer('audio'));
        await waitFor(() => logged(loggerDebugSpy, 'Ffmpeg audio generator: Invalid argument'), 5000);
      });
      loggerWarnSpy.mockClear();
    });

    test('a whitespace-only stderr chunk and a generator without stderr are ignored', async () => {
      loggerDebugSpy.mockClear();
      const stderr = new EventEmitter();
      const withStderr = Object.assign(new EventEmitter(), { stderr, kill: vi.fn() }) as unknown as ChildProcess;
      const withoutStderr = Object.assign(new EventEmitter(), { stderr: null, kill: vi.fn() }) as unknown as ChildProcess;
      hasFfmpeg.mockReturnValue(true);
      runFfmpeg.mockReturnValueOnce(withStderr).mockReturnValueOnce(withoutStderr);
      const first = new WeriftWebRtcSession(1, { ...options });
      await first.createAnswer(await remoteOffer('audio'));
      stderr.emit('data', Buffer.from('  \n'));
      const second = new WeriftWebRtcSession(2, { ...options });
      await second.createAnswer(await remoteOffer('audio'));
      expect(logged(loggerDebugSpy, 'Ffmpeg audio generator:')).toBe(false);
      await first.close();
      await second.close();
    });

    test('the audio track is attached once per session and cleaned up on close', async () => {
      const session = new WeriftWebRtcSession(1, { ...options });
      const offer = await remoteOffer('audio');
      await session.createAnswer(offer);
      expect(await session.createAnswer(offer)).toContain('m=audio');
      expect(generators(session).testAudioAttached).toBe(true);
      expect(generators(session).testAudioGenerator).toBeDefined();
      await session.close();
      expect([generators(session).testAudioAttached, generators(session).testAudioGenerator]).toEqual([false, undefined]);
    });

    test('a process exit kills a leftover generator, and does not throw without one', async () => {
      const session = new WeriftWebRtcSession(1, { ...options, offerAudio: false });
      await session.createOffer();
      const generator = generators(session).testVideoGenerator;
      if (!generator) throw new Error('the video generator was not attached');
      const kill = spyOn(generator, 'kill');
      process.emit('exit', 0);
      expect(kill).toHaveBeenCalledWith('SIGTERM');
      await session.close();
      await withSession({ ...options }, async () => {
        expect(() => process.emit('exit', 0)).not.toThrow();
      });
    });

    test.each(['closed', 'failed'])('a DTLS transport reaching %s on its own closes the session once', async (state) => {
      const session = new WeriftWebRtcSession(1, { ...options, offerAudio: false });
      const close = spyOn(session, 'close');
      await session.createOffer();
      setDtlsState(session, state);
      await waitFor(() => close.mock.calls.length === 1);
      await close.mock.results[0]?.value;
      expect((session as unknown as { closing: boolean }).closing).toBe(true);
    });

    test('no auto-close for a normal close, a DTLS close during a description operation, or a transport no longer in use', async () => {
      const normal = new WeriftWebRtcSession(1, { ...options, offerAudio: false });
      const normalClose = spyOn(normal, 'close');
      await normal.createOffer();
      await normal.close();
      expect(normalClose).toHaveBeenCalledTimes(1);

      const describing = new WeriftWebRtcSession(1, { ...options, offerAudio: false });
      const describingClose = spyOn(describing, 'close');
      await describing.createOffer();
      spyOn(describing.peerConnection, 'setRemoteDescription').mockImplementationOnce(async () => {
        setDtlsState(describing, 'closed');
      });
      await describing.applyAnswer('v=0 o=- answer');
      expect(describingClose).not.toHaveBeenCalled();
      await describing.close();

      // Bun's spyOn has no getter form: shadow dtlsTransports on the instance, then remove the override.
      const unused = new WeriftWebRtcSession(1, { ...options, offerAudio: false });
      const unusedClose = spyOn(unused, 'close');
      await unused.createOffer();
      const [transport] = unused.peerConnection.dtlsTransports;
      Object.defineProperty(unused.peerConnection, 'dtlsTransports', { configurable: true, get: () => [] });
      (transport as unknown as { setState(state: string): void }).setState('closed');
      expect(unusedClose).not.toHaveBeenCalled();
      Reflect.deleteProperty(unused.peerConnection, 'dtlsTransports');
      await unused.close();
    });
  });
});
