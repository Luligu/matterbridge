/**
 * @file vitest/behaviors/weriftSession.test.ts
 * @description This file contains the tests for the WeriftWebRtcSession class.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 */

// These tests raise the suite timeout because werift always gathers ICE against stun.l.google.com, even when
// iceServers is set to []; a dropped STUN response stalls an offer/answer for werift's full 5s gathering timeout.
// See https://github.com/shinyoshiaki/werift-webrtc/issues/691

const NAME = 'WeriftSession';

import { spawn, type ChildProcess } from 'node:child_process';

import { setupTest } from '@matterbridge/vitest-utils';
import { RTCPeerConnection, RTCRtpCodecParameters, useH264, usePCMU } from 'werift';

import { hasFfmpeg, runFfmpeg } from '../../src/behaviors/ffmpeg.js';
import { type WeriftOfferOptions, WeriftWebRtcSession } from '../../src/behaviors/weriftSession.js';

vi.mock('../../src/behaviors/ffmpeg.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/behaviors/ffmpeg.js')>();
  return { ...actual, hasFfmpeg: vi.fn(actual.hasFfmpeg), runFfmpeg: vi.fn(actual.runFfmpeg) };
});

await setupTest(NAME);

const realHasFfmpeg = await vi.importActual<typeof import('../../src/behaviors/ffmpeg.js')>('../../src/behaviors/ffmpeg.js').then((m) => m.hasFfmpeg);

/**
 * Makes `runFfmpeg` spawn a real, harmless `node` process instead of ffmpeg, so injection lifecycle (attach,
 * kill-on-close) can be exercised without a real ffmpeg dependency.
 */
function mockResolvableFfmpeg(): void {
  vi.mocked(hasFfmpeg).mockReturnValue(true);
  vi.mocked(runFfmpeg).mockImplementation(() => spawn(process.execPath, ['-e', '""']));
}

/**
 * Creates a real SDP offer from a throwaway remote peer connection, to feed into a WeriftWebRtcSession under test as
 * if it came from a real remote peer over the WebRtcTransportProvider cluster.
 *
 * @returns {Promise<string>} A real SDP offer with a single sendonly video transceiver.
 */
async function createRemoteOfferSdp(): Promise<string> {
  const remote = new RTCPeerConnection();
  remote.addTransceiver('video', { direction: 'sendonly' });
  const offer = await remote.createOffer();
  await remote.setLocalDescription(offer);
  const sdp = remote.localDescription?.sdp ?? offer.sdp;
  await remote.close();
  return sdp;
}

/**
 * Creates a real SDP offer from a throwaway remote peer connection, to feed into a WeriftWebRtcSession under test as
 * if it came from a real remote peer over the WebRtcTransportProvider cluster.
 *
 * @returns {Promise<string>} A real SDP offer with a single sendonly audio transceiver.
 */
async function createRemoteAudioOfferSdp(): Promise<string> {
  const remote = new RTCPeerConnection();
  remote.addTransceiver('audio', { direction: 'sendonly' });
  const offer = await remote.createOffer();
  await remote.setLocalDescription(offer);
  const sdp = remote.localDescription?.sdp ?? offer.sdp;
  await remote.close();
  return sdp;
}

/**
 * Creates a real SDP offer whose audio media section only advertises PCMU, matching controllers that do not offer Opus.
 *
 * @returns {Promise<string>} A real SDP offer with a single sendonly PCMU-only audio transceiver.
 */
async function createPcmuOnlyRemoteOfferSdp(): Promise<string> {
  const remote = new RTCPeerConnection({ codecs: { audio: [usePCMU()] } });
  remote.addTransceiver('audio', { direction: 'sendonly' });
  const offer = await remote.createOffer();
  await remote.setLocalDescription(offer);
  const sdp = remote.localDescription?.sdp ?? offer.sdp;
  await remote.close();
  return sdp;
}

/**
 * Creates a real SDP offer whose video media section only advertises H264, matching controllers that do not offer VP8.
 *
 * @returns {Promise<string>} A real SDP offer with a single sendonly H264 video transceiver.
 */
async function createH264RemoteOfferSdp(): Promise<string> {
  const remote = new RTCPeerConnection({ codecs: { video: [useH264()] } });
  remote.addTransceiver('video', { direction: 'sendonly' });
  const offer = await remote.createOffer();
  await remote.setLocalDescription(offer);
  const sdp = remote.localDescription?.sdp ?? offer.sdp;
  await remote.close();
  return sdp;
}

/**
 * Creates a real SDP answer from a throwaway remote peer connection, answering the given SDP offer, to feed into a
 * WeriftWebRtcSession under test as if it came from a real remote peer over the WebRtcTransportProvider cluster.
 *
 * @param {string} offerSdp - The SDP offer to answer.
 * @returns {Promise<string>} A real SDP answer for the given offer.
 */
async function createRemoteAnswerSdp(offerSdp: string): Promise<string> {
  const remote = new RTCPeerConnection();
  await remote.setRemoteDescription({ type: 'offer', sdp: offerSdp });
  const answer = await remote.createAnswer();
  await remote.setLocalDescription(answer);
  const sdp = remote.localDescription?.sdp ?? answer.sdp;
  await remote.close();
  return sdp;
}

// Timeout raised for the STUN gathering stall described in the file header above.
vi.setConfig({ testTimeout: 30_000 });

describe('WeriftWebRtcSession', () => {
  let options: WeriftOfferOptions;

  beforeEach(() => {
    options = { video: true, audio: true, videoSource: 'test', audioSource: 'test' };
    mockResolvableFfmpeg();
  });

  afterEach(() => {
    // vite.config.ts sets clearMocks/restoreMocks to false, so a test-local hasFfmpeg/runFfmpeg override would
    // otherwise leak into every later test.
    vi.mocked(hasFfmpeg).mockImplementation(realHasFfmpeg);
    vi.mocked(runFfmpeg).mockReset();
  });

  it('should create a real SDP offer with a video transceiver when video is requested', async () => {
    const session = new WeriftWebRtcSession(1, { ...options, video: true, audio: false });

    const sdp = await session.createOffer();

    expect(sdp).toContain('v=0');
    expect(sdp).toContain('m=video');
    expect(sdp).not.toContain('m=audio');

    await session.close();
  });

  it('should create a real SDP offer with both a video and an audio transceiver when both are requested', async () => {
    const session = new WeriftWebRtcSession(1, { ...options, video: true, audio: true });

    const sdp = await session.createOffer();

    expect(sdp).toContain('m=video');
    expect(sdp).toContain('m=audio');

    await session.close();
  });

  it('should create a real SDP offer with no media transceivers when neither video nor audio is requested', async () => {
    const session = new WeriftWebRtcSession(1, { ...options, video: false, audio: false });

    const sdp = await session.createOffer();

    expect(sdp).toContain('v=0');
    expect(sdp).not.toContain('m=video');
    expect(sdp).not.toContain('m=audio');

    await session.close();
  });

  it('should close without throwing', async () => {
    const session = new WeriftWebRtcSession(1, { ...options, video: true, audio: false });
    await session.createOffer();

    await expect(session.close()).resolves.toBeUndefined();
  });

  it('should not attach a second test video track when creating a subsequent offer on the same session', async () => {
    const session = new WeriftWebRtcSession(1, { ...options, video: true, audio: false });
    await session.createOffer();

    const sdp = await session.createOffer();

    expect(sdp).toContain('m=video');

    await session.close();
  });

  it('should create a real SDP answer for a remote SDP offer', async () => {
    const session = new WeriftWebRtcSession(1, { ...options });
    const offerSdp = await createRemoteOfferSdp();

    const answerSdp = await session.createAnswer(offerSdp);

    expect(answerSdp).toContain('v=0');
    expect(answerSdp).toContain('m=video');
    expect(session.peerConnection.signalingState).toBe('stable');

    await session.close();
  });

  it('should create a real SDP answer for a remote H264-only SDP offer', async () => {
    const session = new WeriftWebRtcSession(1, { ...options });
    const offerSdp = await createH264RemoteOfferSdp();

    const answerSdp = await session.createAnswer(offerSdp);

    expect(answerSdp).toContain('v=0');
    expect(answerSdp).toContain('m=video');
    expect(answerSdp.toLowerCase()).toContain('h264/90000');
    expect(session.peerConnection.signalingState).toBe('stable');

    await session.close();
  });

  it('should apply a real remote SDP answer to a local offer', async () => {
    const session = new WeriftWebRtcSession(1, { ...options, video: true, audio: false });
    const offerSdp = await session.createOffer();
    const answerSdp = await createRemoteAnswerSdp(offerSdp);

    await expect(session.applyAnswer(answerSdp)).resolves.toBeUndefined();
    expect(session.peerConnection.signalingState).toBe('stable');

    await session.close();
  });

  it('should apply a remote ICE candidate after a completed offer/answer exchange', async () => {
    const session = new WeriftWebRtcSession(1, { ...options, video: true, audio: false });
    const offerSdp = await session.createOffer();
    const answerSdp = await createRemoteAnswerSdp(offerSdp);
    await session.applyAnswer(answerSdp);

    await expect(session.addIceCandidate('candidate:1 1 UDP 1 127.0.0.1 1 typ host', null, 0)).resolves.toBeUndefined();
    await expect(session.addIceCandidate('candidate:1 1 UDP 1 127.0.0.1 1 typ host', '0', null)).resolves.toBeUndefined();

    await session.close();
  });

  describe('environment-to-options behavior compatibility', () => {
    it.each([
      ['1280x720', '1280:720'],
      ['1920x1080', '1920:1080'],
      ['auto', '640:480'],
      [undefined, '640:480'],
      ['4000x3000', '640:480'],
    ])('should use constructor resolution %s when creating an offer', async (resolution, expected) => {
      const session = new WeriftWebRtcSession(1, {
        ...options,
        videoSource: 'rtsp',
        videoSourceDevice: 'rtsp://camera.local/live',
        videoResolution: resolution,
      });
      try {
        await session.createOffer();
        const args = vi.mocked(runFfmpeg).mock.calls[0]?.[0] ?? [];
        expect(args.slice(args.indexOf('-vf'), args.indexOf('-vf') + 2)).toEqual(['-vf', `scale=${expected}`]);
      } finally {
        await session.close();
      }
    });

    it.each([
      ['640x480', '640:480'],
      ['1280x720', '1280:720'],
      ['1920x1080', '1920:1080'],
      ['auto', '640:480'],
      [undefined, '640:480'],
      ['4000x3000', '640:480'],
    ])('should use constructor resolution %s when answering', async (configured, expected) => {
      options.videoSource = 'rtsp';
      options.videoSourceDevice = 'rtsp://camera.local/live';
      options.videoResolution = configured;
      const session = new WeriftWebRtcSession(1, { ...options });
      try {
        await session.createAnswer(await createRemoteOfferSdp());
        const args = vi.mocked(runFfmpeg).mock.calls[0]?.[0] ?? [];
        expect(args.slice(args.indexOf('-i'), args.indexOf('-i') + 2)).toEqual(['-i', 'rtsp://camera.local/live']);
        expect(args.slice(args.indexOf('-vf'), args.indexOf('-vf') + 2)).toEqual(['-vf', `scale=${expected}`]);
      } finally {
        await session.close();
      }
    });

    it.each([
      [undefined, '1000k'],
      [2500, '2500k'],
      [0, '1000k'],
      [-1, '1000k'],
      [Number.NaN, '1000k'],
      [Number.POSITIVE_INFINITY, '1000k'],
    ])('should preserve encoder bitrate fallback for %s', async (configured, expected) => {
      options.videoSource = 'rtsp';
      options.videoSourceDevice = 'rtsp://camera.local/live';
      options.videoBitrate = configured;
      const session = new WeriftWebRtcSession(1, { ...options });
      try {
        await session.createOffer();
        const args = vi.mocked(runFfmpeg).mock.calls[0]?.[0] ?? [];
        for (const flag of ['-b:v', '-maxrate', '-bufsize']) {
          expect(args.slice(args.indexOf(flag), args.indexOf(flag) + 2)).toEqual([flag, expected]);
        }
      } finally {
        await session.close();
      }
    });

    it('should keep the synthetic pattern fixed despite resolution and bitrate options', async () => {
      options.videoResolution = '1920x1080';
      options.videoBitrate = 2500;
      const session = new WeriftWebRtcSession(1, { ...options });
      try {
        await session.createOffer();
        const args = vi.mocked(runFfmpeg).mock.calls[0]?.[0] ?? [];
        expect(args).toContain('testsrc=size=640x480:rate=10');
        expect(args.slice(args.indexOf('-b:v'), args.indexOf('-b:v') + 2)).toEqual(['-b:v', '1000k']);
      } finally {
        await session.close();
      }
    });

    it('should ignore conflicting environment values when constructor options are supplied', async () => {
      vi.stubEnv('MATTERBRIDGE_CAMERA_VIDEO_SOURCE', 'none');
      vi.stubEnv('MATTERBRIDGE_CAMERA_AUDIO_SOURCE', 'none');
      const session = new WeriftWebRtcSession(1, { ...options });
      try {
        await session.createAnswer(await createRemoteAudioOfferSdp());
        expect(vi.mocked(runFfmpeg).mock.calls[0]?.[0]).toEqual(expect.arrayContaining(['-stream_loop', '-1']));
      } finally {
        await session.close();
        vi.unstubAllEnvs();
      }
    });
  });

  describe('video source selection', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should not inject a video track when videoSource is missing at runtime', async () => {
      // @ts-expect-error Exercise missing configuration supplied by an untyped caller.
      options.videoSource = undefined;
      const session = new WeriftWebRtcSession(1, { ...options, video: true, audio: false });

      const sdp = await session.createOffer();

      expect(sdp).toContain('m=video');
      expect((session as unknown as { testVideoAttached: boolean }).testVideoAttached).toBe(false);

      await session.close();
    });

    it('should attach the synthetic moving test pattern track when videoSource=test', async () => {
      options.videoSource = 'test';
      const session = new WeriftWebRtcSession(1, { ...options, video: true, audio: false });

      const sdp = await session.createOffer();

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should fall back to no injected track when videoSource is unsupported', async () => {
      // @ts-expect-error Exercise invalid configuration supplied by an untyped caller.
      options.videoSource = 'unsupported';
      const session = new WeriftWebRtcSession(1, { ...options, video: true, audio: false });

      const sdp = await session.createOffer();

      expect(sdp).toContain('m=video');
      expect((session as unknown as { testVideoAttached: boolean }).testVideoAttached).toBe(false);

      await session.close();
    });

    it('should still attach a video track, falling back to the test pattern, when videoSource=webcam is set without a device', async () => {
      options.videoSource = 'webcam';
      const session = new WeriftWebRtcSession(1, { ...options, video: true, audio: false });

      const sdp = await session.createOffer();

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it.each([
      ['linux', '/dev/video0'],
      ['darwin', '0'],
      ['win32', 'Integrated Camera'],
      ['freebsd', '/dev/video0'],
    ])('should attach a video track from the configured webcam device on platform %s', async (platform, device) => {
      options.videoSource = 'webcam';
      options.videoSourceDevice = device;
      Object.defineProperty(process, 'platform', { value: platform });
      const session = new WeriftWebRtcSession(1, { ...options, video: true, audio: false });

      const sdp = await session.createOffer();

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it.each(['1280x720', '1920x1080'])('should attach a video track using the requested videoResolution=%s', async (resolution) => {
      options.videoSource = 'webcam';
      options.videoSourceDevice = '/dev/video0';
      options.videoResolution = resolution;
      const session = new WeriftWebRtcSession(1, { ...options, video: true, audio: false });

      const sdp = await session.createOffer();

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should still attach a video track, falling back to 640x480, when videoResolution is not one of the supported resolutions', async () => {
      options.videoSource = 'webcam';
      options.videoSourceDevice = '/dev/video0';
      options.videoResolution = '4000x3000';
      const session = new WeriftWebRtcSession(1, { ...options, video: true, audio: false });

      const sdp = await session.createOffer();

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should answer with the configured 1280x720 webcam resolution', async () => {
      options.videoSource = 'webcam';
      options.videoSourceDevice = '/dev/video0';
      options.videoResolution = '1280x720';
      const session = new WeriftWebRtcSession(1, { ...options });

      const sdp = await session.createAnswer(await createRemoteOfferSdp());

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should answer with the configured 640x480 webcam resolution', async () => {
      options.videoSource = 'webcam';
      options.videoSourceDevice = '/dev/video0';
      options.videoResolution = '640x480';
      const session = new WeriftWebRtcSession(1, { ...options });

      const sdp = await session.createAnswer(await createRemoteOfferSdp());

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should answer with the default webcam resolution when videoResolution=auto', async () => {
      options.videoSource = 'webcam';
      options.videoSourceDevice = '/dev/video0';
      options.videoResolution = 'auto';
      const session = new WeriftWebRtcSession(1, { ...options });

      const sdp = await session.createAnswer(await createRemoteOfferSdp());

      expect(sdp).toContain('m=video');

      await session.close();
    });
  });

  describe('rtsp video source', () => {
    it('should still attach a video track, falling back to the test pattern, when videoSource=rtsp is set without a url', async () => {
      options.videoSource = 'rtsp';
      const session = new WeriftWebRtcSession(1, { ...options, video: true, audio: false });

      const sdp = await session.createOffer();

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should attach a video track from the configured RTSP url', async () => {
      options.videoSource = 'rtsp';
      options.videoSourceDevice = 'rtsp://admin:password@192.168.1.100:554/ch1/main';
      const session = new WeriftWebRtcSession(1, { ...options, video: true, audio: false });

      const sdp = await session.createOffer();

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should scale the RTSP camera to the configured answer resolution', async () => {
      options.videoSource = 'rtsp';
      options.videoSourceDevice = 'rtsp://admin:password@192.168.1.100:554/ch1/main';
      options.videoResolution = '1280x720';
      const session = new WeriftWebRtcSession(1, { ...options });

      const sdp = await session.createAnswer(await createRemoteOfferSdp());

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should scale the RTSP camera to the default answer resolution when videoResolution=auto', async () => {
      options.videoSource = 'rtsp';
      options.videoSourceDevice = 'rtsp://admin:password@192.168.1.100:554/ch1/main';
      options.videoResolution = 'auto';
      const session = new WeriftWebRtcSession(1, { ...options });

      const sdp = await session.createAnswer(await createRemoteOfferSdp());

      expect(sdp).toContain('m=video');

      await session.close();
    });
  });

  describe('disabled video source', () => {
    it('should still negotiate a video transceiver but not inject a track when videoSource=none', async () => {
      options.videoSource = 'none';
      const session = new WeriftWebRtcSession(1, { ...options, video: true, audio: false });

      const sdp = await session.createOffer();

      expect(sdp).toContain('m=video');
      expect((session as unknown as { testVideoAttached: boolean }).testVideoAttached).toBe(false);

      await session.close();
    });
  });

  describe('test audio injection toggle', () => {
    it('should still negotiate an audio transceiver but not inject a track when audioSource=none', async () => {
      options.audioSource = 'none';
      const session = new WeriftWebRtcSession(1, { ...options });
      const offerSdp = await createRemoteAudioOfferSdp();

      const answerSdp = await session.createAnswer(offerSdp);

      expect(answerSdp).toContain('m=audio');

      await session.close();
    });
  });

  describe('audio source selection', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should fall back to no injected track when audioSource is unsupported', async () => {
      // @ts-expect-error Exercise invalid configuration supplied by an untyped caller.
      options.audioSource = 'unsupported';
      const session = new WeriftWebRtcSession(1, { ...options });
      const offerSdp = await createRemoteAudioOfferSdp();

      const answerSdp = await session.createAnswer(offerSdp);

      expect(answerSdp).toContain('m=audio');
      expect((session as unknown as { testAudioAttached: boolean }).testAudioAttached).toBe(false);

      await session.close();
    });

    it('should still attach an audio track, falling back to the test-voice clip, when audioSource=microphone is set without a device', async () => {
      options.audioSource = 'microphone';
      const session = new WeriftWebRtcSession(1, { ...options });
      const offerSdp = await createRemoteAudioOfferSdp();

      const answerSdp = await session.createAnswer(offerSdp);

      expect(answerSdp).toContain('m=audio');

      await session.close();
    });

    it.each([
      ['linux', 'hw:0,0'],
      ['darwin', '0'],
      ['win32', 'Microphone Array'],
      ['freebsd', 'hw:0,0'],
    ])('should attach an audio track from the configured microphone device on platform %s', async (platform, device) => {
      options.audioSource = 'microphone';
      options.audioSourceDevice = device;
      Object.defineProperty(process, 'platform', { value: platform });
      const session = new WeriftWebRtcSession(1, { ...options });
      const offerSdp = await createRemoteAudioOfferSdp();

      const answerSdp = await session.createAnswer(offerSdp);

      expect(answerSdp).toContain('m=audio');

      await session.close();
    });
  });

  describe('rtsp audio source', () => {
    it('should still attach an audio track, falling back to the test-voice clip, when audioSource=rtsp is set without a url', async () => {
      options.audioSource = 'rtsp';
      const session = new WeriftWebRtcSession(1, { ...options });
      const offerSdp = await createRemoteAudioOfferSdp();

      const answerSdp = await session.createAnswer(offerSdp);

      expect(answerSdp).toContain('m=audio');

      await session.close();
    });

    it('should attach an audio track from the configured RTSP url', async () => {
      options.audioSource = 'rtsp';
      options.audioSourceDevice = 'rtsp://admin:password@192.168.1.100:554/ch1/main';
      const session = new WeriftWebRtcSession(1, { ...options });
      const offerSdp = await createRemoteAudioOfferSdp();

      const answerSdp = await session.createAnswer(offerSdp);

      expect(answerSdp).toContain('m=audio');

      await session.close();
    });
  });

  describe('injectable codec selection', () => {
    it('should prefer an already-negotiated injectable codec when creating a subsequent offer', async () => {
      const session = new WeriftWebRtcSession(1, { ...options, video: true, audio: false });
      const transceiver = session.peerConnection.addTransceiver('video', { direction: 'sendonly' });
      transceiver.codecs = [new RTCRtpCodecParameters({ mimeType: 'video/VP8', clockRate: 90000, payloadType: 96 })];

      const sdp = await session.createOffer();

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should prefer an already-negotiated H264 codec, using the H264 ffmpeg encoder, when creating a subsequent offer', async () => {
      const session = new WeriftWebRtcSession(1, { ...options, video: true, audio: false });
      const transceiver = session.peerConnection.addTransceiver('video', { direction: 'sendonly' });
      transceiver.codecs = [new RTCRtpCodecParameters({ mimeType: 'video/h264', clockRate: 90000, payloadType: 97 })];

      const sdp = await session.createOffer();

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should skip non-video transceivers when selecting and preferring an injectable codec', async () => {
      const session = new WeriftWebRtcSession(1, { ...options });
      const remote = new RTCPeerConnection();
      // Audio added before video so the answering session encounters the non-video transceiver first in each loop.
      remote.addTransceiver('audio', { direction: 'sendonly' });
      remote.addTransceiver('video', { direction: 'sendonly' });
      const offer = await remote.createOffer();
      await remote.setLocalDescription(offer);
      const offerSdp = remote.localDescription?.sdp ?? offer.sdp;
      await remote.close();

      const answerSdp = await session.createAnswer(offerSdp);

      expect(answerSdp).toContain('m=video');
      expect(answerSdp).toContain('m=audio');

      await session.close();
    });

    it('should skip non-audio transceivers when selecting and preferring an injectable audio codec', async () => {
      const session = new WeriftWebRtcSession(1, { ...options });
      const remote = new RTCPeerConnection();
      // Video added before audio so the answering session encounters the non-audio transceiver first in the audio codec loop.
      remote.addTransceiver('video', { direction: 'sendonly' });
      remote.addTransceiver('audio', { direction: 'sendonly' });
      const offer = await remote.createOffer();
      await remote.setLocalDescription(offer);
      const offerSdp = remote.localDescription?.sdp ?? offer.sdp;
      await remote.close();

      const answerSdp = await session.createAnswer(offerSdp);

      expect(answerSdp).toContain('m=video');
      expect(answerSdp).toContain('m=audio');

      await session.close();
    });

    it('should create an SDP answer without an injectable audio codec when the remote offer only supports PCMU', async () => {
      type TestAudioState = { testAudioAttached: boolean; testAudioGenerator?: { killed: boolean } };
      const session = new WeriftWebRtcSession(1, { ...options });
      // A resolvable ffmpeg command would let a wrongly-defaulted Opus track slip through; asserting testAudioAttached
      // stays false below proves injection is skipped because no codec was negotiated, not because ffmpeg is missing.
      mockResolvableFfmpeg();
      const offerSdp = await createPcmuOnlyRemoteOfferSdp();

      const answerSdp = await session.createAnswer(offerSdp);

      expect(answerSdp).toContain('m=audio');
      expect(answerSdp.toLowerCase()).not.toContain('opus');
      expect((session as unknown as TestAudioState).testAudioAttached).toBe(false);
      expect((session as unknown as TestAudioState).testAudioGenerator).toBeUndefined();

      await session.close();
    });

    it('should not treat a non-injectable codec as preferred when creating an offer for a pre-existing transceiver', async () => {
      const session = new WeriftWebRtcSession(1, { ...options, video: true, audio: false });
      const transceiver = session.peerConnection.addTransceiver('video', { direction: 'sendonly' });
      transceiver.codecs = [new RTCRtpCodecParameters({ mimeType: 'video/VP9', clockRate: 90000, payloadType: 98 })];

      const sdp = await session.createOffer();

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should only adjust the video transceiver(s) that actually have the preferred codec available', async () => {
      const session = new WeriftWebRtcSession(1, { ...options, video: true, audio: false });
      const withPreferredCodec = session.peerConnection.addTransceiver('video', { direction: 'sendonly' });
      withPreferredCodec.codecs = [new RTCRtpCodecParameters({ mimeType: 'video/VP8', clockRate: 90000, payloadType: 96 })];
      const withoutPreferredCodec = session.peerConnection.addTransceiver('video', { direction: 'sendonly' });
      withoutPreferredCodec.codecs = [new RTCRtpCodecParameters({ mimeType: 'video/VP9', clockRate: 90000, payloadType: 98 })];

      const sdp = await session.createOffer();

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should only adjust the audio transceiver(s) that actually have the preferred codec available', async () => {
      const session = new WeriftWebRtcSession(1, { ...options });

      const remote = new RTCPeerConnection();
      // Two audio m-lines: the first offers Opus and PCMU (the default), the second is restricted to PCMU only, so
      // after negotiation only one of the resulting local audio transceivers ends up with an injectable Opus codec.
      remote.addTransceiver('audio', { direction: 'sendonly' });
      const pcmuOnlyTransceiver = remote.addTransceiver('audio', { direction: 'sendonly' });
      pcmuOnlyTransceiver.codecs = [new RTCRtpCodecParameters({ mimeType: 'audio/PCMU', clockRate: 8000, payloadType: 0 })];
      const offer = await remote.createOffer();
      await remote.setLocalDescription(offer);
      const offerSdp = remote.localDescription?.sdp ?? offer.sdp;
      await remote.close();

      const answerSdp = await session.createAnswer(offerSdp);

      expect(answerSdp.match(/m=audio/g)).toHaveLength(2);

      await session.close();
    });
  });

  describe('answering an offer with no video media', () => {
    it('should create an SDP answer without attempting video codec selection when the remote offer has no video transceiver', async () => {
      const session = new WeriftWebRtcSession(1, { ...options });
      const remote = new RTCPeerConnection();
      remote.addTransceiver('audio', { direction: 'sendonly' });
      const offer = await remote.createOffer();
      await remote.setLocalDescription(offer);
      const offerSdp = remote.localDescription?.sdp ?? offer.sdp;
      await remote.close();

      const answerSdp = await session.createAnswer(offerSdp);

      expect(answerSdp).toContain('m=audio');
      expect(answerSdp).not.toContain('m=video');

      await session.close();
    });
  });

  describe('per-session webcam resolution', () => {
    it('should use the configured per-session resolution when it names a supported resolution', async () => {
      options.videoResolution = '1280x720';
      options.videoSource = 'webcam';
      options.videoSourceDevice = '/dev/video0';
      const session = new WeriftWebRtcSession(1, { ...options });

      const sdp = await session.createAnswer(await createRemoteOfferSdp());

      expect(sdp).toContain('m=video');

      await session.close();
    });
  });

  describe('missing ffmpeg dependency', () => {
    it('should still negotiate a video transceiver but not inject a track when ffmpeg cannot be resolved', async () => {
      const session = new WeriftWebRtcSession(1, { ...options, video: true, audio: false });
      vi.mocked(hasFfmpeg).mockReturnValue(false);

      const sdp = await session.createOffer();

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should still negotiate an audio transceiver but not inject a track when ffmpeg cannot be resolved', async () => {
      const session = new WeriftWebRtcSession(1, { ...options });
      vi.mocked(hasFfmpeg).mockReturnValue(false);
      const offerSdp = await createRemoteAudioOfferSdp();

      const answerSdp = await session.createAnswer(offerSdp);

      expect(answerSdp).toContain('m=audio');

      await session.close();
    });
  });

  describe('video track injection lifecycle', () => {
    it('should attach a default VP8 video track only once when no codec is already preferred', async () => {
      type TestVideoState = { testVideoAttached: boolean; testVideoGenerator?: { killed: boolean } };
      const session = new WeriftWebRtcSession(1, { ...options, video: true, audio: false });
      mockResolvableFfmpeg();

      const firstSdp = await session.createOffer();
      const secondSdp = await session.createOffer();

      expect(firstSdp).toContain('m=video');
      expect(secondSdp).toContain('m=video');
      expect((session as unknown as TestVideoState).testVideoAttached).toBe(true);
      expect((session as unknown as TestVideoState).testVideoGenerator).toBeDefined();

      await session.close();
    });

    it.each([
      ['VP8', new RTCRtpCodecParameters({ mimeType: 'video/VP8', clockRate: 90000, payloadType: 96 })],
      ['H264', new RTCRtpCodecParameters({ mimeType: 'video/H264', clockRate: 90000, payloadType: 97 })],
    ])('should attach and clean up a %s video track when command resolution succeeds', async (_name, codec) => {
      type TestVideoState = { testVideoAttached: boolean; testVideoGenerator?: { killed: boolean } };
      const session = new WeriftWebRtcSession(1, { ...options, video: true, audio: false });
      mockResolvableFfmpeg();
      const transceiver = session.peerConnection.addTransceiver('video', { direction: 'sendonly' });
      transceiver.codecs = [codec];

      const sdp = await session.createOffer();

      expect(sdp).toContain('m=video');
      expect((session as unknown as TestVideoState).testVideoAttached).toBe(true);
      expect((session as unknown as TestVideoState).testVideoGenerator).toBeDefined();

      await session.close();

      expect((session as unknown as TestVideoState).testVideoAttached).toBe(false);
      expect((session as unknown as TestVideoState).testVideoGenerator).toBeUndefined();
    });
  });

  describe('audio track injection lifecycle', () => {
    it('should not attach a second test audio track when creating a subsequent answer on the same session', async () => {
      type TestAudioState = { testAudioAttached: boolean; testAudioGenerator?: { killed: boolean } };
      const session = new WeriftWebRtcSession(1, { ...options });
      mockResolvableFfmpeg();
      const offerSdp = await createRemoteAudioOfferSdp();

      await session.createAnswer(offerSdp);
      const answerSdp = await session.createAnswer(offerSdp);

      expect(answerSdp).toContain('m=audio');
      expect((session as unknown as TestAudioState).testAudioAttached).toBe(true);
      expect((session as unknown as TestAudioState).testAudioGenerator).toBeDefined();

      await session.close();

      expect((session as unknown as TestAudioState).testAudioAttached).toBe(false);
      expect((session as unknown as TestAudioState).testAudioGenerator).toBeUndefined();
    });
  });

  describe('process exit cleanup', () => {
    it('should kill a leftover ffmpeg process when the process emits exit', async () => {
      type SessionState = { testVideoGenerator?: ChildProcess };
      const session = new WeriftWebRtcSession(1, { ...options, video: true, audio: false });
      mockResolvableFfmpeg();

      await session.createOffer();
      const videoGenerator = (session as unknown as SessionState).testVideoGenerator;

      if (!videoGenerator) throw new Error('videoGenerator was not attached');
      const killSpy = vi.spyOn(videoGenerator, 'kill');

      process.emit('exit', 0);

      expect(killSpy).toHaveBeenCalledWith('SIGTERM');

      await session.close();
    });

    it('should not throw when the process emits exit for a session with no leftover ffmpeg process', async () => {
      const session = new WeriftWebRtcSession(1, { ...options });

      expect(() => process.emit('exit', 0)).not.toThrow();

      await session.close();
    });
  });

  describe('closeAll', () => {
    it('should close every active session and remove them from the active session registry', async () => {
      const first = new WeriftWebRtcSession(1, { ...options });
      const second = new WeriftWebRtcSession(2, { ...options });
      const firstCloseSpy = vi.spyOn(first, 'close');
      const secondCloseSpy = vi.spyOn(second, 'close');

      await WeriftWebRtcSession.closeAll();

      expect(firstCloseSpy).toHaveBeenCalledTimes(1);
      expect(secondCloseSpy).toHaveBeenCalledTimes(1);

      // Closing again should be a no-op since closeAll() already removed both sessions from the registry.
      await expect(WeriftWebRtcSession.closeAll()).resolves.toBeUndefined();
      expect(firstCloseSpy).toHaveBeenCalledTimes(1);
      expect(secondCloseSpy).toHaveBeenCalledTimes(1);
    });

    it('should not throw when there are no active sessions', async () => {
      await expect(WeriftWebRtcSession.closeAll()).resolves.toBeUndefined();
    });
  });

  describe('DTLS-triggered auto-close', () => {
    it('should close the session once a DTLS transport reaches closed on its own', async () => {
      type DtlsTransportState = { setState(state: string, emitEvent?: boolean): void };
      const session = new WeriftWebRtcSession(1, { ...options, video: true, audio: false });
      const closeSpy = vi.spyOn(session, 'close');
      await session.createOffer();
      const [dtlsTransport] = session.peerConnection.dtlsTransports;
      if (!dtlsTransport) throw new Error('no DTLS transport negotiated');

      (dtlsTransport as unknown as DtlsTransportState).setState('closed');

      await vi.waitFor(() => expect(closeSpy).toHaveBeenCalledTimes(1));
      await closeSpy.mock.results[0]?.value;
      expect((session as unknown as { closing: boolean }).closing).toBe(true);
    });

    it('should close the session once a DTLS transport reaches failed on its own', async () => {
      type DtlsTransportState = { setState(state: string, emitEvent?: boolean): void };
      const session = new WeriftWebRtcSession(1, { ...options, video: true, audio: false });
      const closeSpy = vi.spyOn(session, 'close');
      await session.createOffer();
      const [dtlsTransport] = session.peerConnection.dtlsTransports;
      if (!dtlsTransport) throw new Error('no DTLS transport negotiated');

      (dtlsTransport as unknown as DtlsTransportState).setState('failed');

      await vi.waitFor(() => expect(closeSpy).toHaveBeenCalledTimes(1));
      await closeSpy.mock.results[0]?.value;
    });

    it('should not call close a second time when a normal close() itself drives the DTLS transport to closed', async () => {
      const session = new WeriftWebRtcSession(1, { ...options, video: true, audio: false });
      const closeSpy = vi.spyOn(session, 'close');
      await session.createOffer();

      await session.close();

      // A normal close() also stops the DTLS transports (see the doc comment on `closing`), which must not re-enter
      // close() a second time via the same onStateChange subscription that drives the auto-close above.
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });
  });
});
