/**
 * @file vitest/behaviors/weriftSession.test.ts
 * @description This file contains the tests for the WeriftWebRtcSession class.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 */

const NAME = 'WeriftSession';

import { spawn, type ChildProcess } from 'node:child_process';

import { setupTest } from '@matterbridge/vitest-utils';
import { RTCPeerConnection, RTCRtpCodecParameters, useH264, usePCMU } from 'werift';

import { hasFfmpeg, runFfmpeg } from '../../src/behaviors/ffmpeg.js';
import { WeriftWebRtcSession } from '../../src/behaviors/weriftSession.js';

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

describe('WeriftWebRtcSession', () => {
  const originalVideoSource = process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE;
  const originalAudioSource = process.env.MATTERBRIDGE_CAMERA_AUDIO_SOURCE;

  beforeEach(() => {
    process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'test';
    process.env.MATTERBRIDGE_CAMERA_AUDIO_SOURCE = 'test';
  });

  afterEach(() => {
    // vite.config.ts sets clearMocks/restoreMocks to false, so a test-local hasFfmpeg/runFfmpeg override would
    // otherwise leak into every later test.
    vi.mocked(hasFfmpeg).mockImplementation(realHasFfmpeg);
    vi.mocked(runFfmpeg).mockReset();
  });

  afterAll(() => {
    if (originalVideoSource === undefined) delete process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE;
    else process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = originalVideoSource;
    if (originalAudioSource === undefined) delete process.env.MATTERBRIDGE_CAMERA_AUDIO_SOURCE;
    else process.env.MATTERBRIDGE_CAMERA_AUDIO_SOURCE = originalAudioSource;
  });

  it('should create a real SDP offer with a video transceiver when video is requested', async () => {
    const session = new WeriftWebRtcSession(1);

    const sdp = await session.createOffer({ video: true, audio: false });

    expect(sdp).toContain('v=0');
    expect(sdp).toContain('m=video');
    expect(sdp).not.toContain('m=audio');

    await session.close();
  });

  it('should create a real SDP offer with both a video and an audio transceiver when both are requested', async () => {
    const session = new WeriftWebRtcSession(1);

    const sdp = await session.createOffer({ video: true, audio: true });

    expect(sdp).toContain('m=video');
    expect(sdp).toContain('m=audio');

    await session.close();
  });

  it('should create a real SDP offer with no media transceivers when neither video nor audio is requested', async () => {
    const session = new WeriftWebRtcSession(1);

    const sdp = await session.createOffer({ video: false, audio: false });

    expect(sdp).toContain('v=0');
    expect(sdp).not.toContain('m=video');
    expect(sdp).not.toContain('m=audio');

    await session.close();
  });

  it('should close without throwing', async () => {
    const session = new WeriftWebRtcSession(1);
    await session.createOffer({ video: true, audio: false });

    await expect(session.close()).resolves.toBeUndefined();
  });

  it('should not attach a second test video track when creating a subsequent offer on the same session', async () => {
    const session = new WeriftWebRtcSession(1);
    await session.createOffer({ video: true, audio: false });

    const sdp = await session.createOffer({ video: true, audio: false });

    expect(sdp).toContain('m=video');

    await session.close();
  });

  it('should create a real SDP answer for a remote SDP offer', async () => {
    const session = new WeriftWebRtcSession(1);
    const offerSdp = await createRemoteOfferSdp();

    const answerSdp = await session.createAnswer(offerSdp);

    expect(answerSdp).toContain('v=0');
    expect(answerSdp).toContain('m=video');
    expect(session.peerConnection.signalingState).toBe('stable');

    await session.close();
  });

  it('should create a real SDP answer for a remote H264-only SDP offer', async () => {
    const session = new WeriftWebRtcSession(1);
    const offerSdp = await createH264RemoteOfferSdp();

    const answerSdp = await session.createAnswer(offerSdp);

    expect(answerSdp).toContain('v=0');
    expect(answerSdp).toContain('m=video');
    expect(answerSdp.toLowerCase()).toContain('h264/90000');
    expect(session.peerConnection.signalingState).toBe('stable');

    await session.close();
  });

  it('should apply a real remote SDP answer to a local offer', async () => {
    const session = new WeriftWebRtcSession(1);
    const offerSdp = await session.createOffer({ video: true, audio: false });
    const answerSdp = await createRemoteAnswerSdp(offerSdp);

    await expect(session.applyAnswer(answerSdp)).resolves.toBeUndefined();
    expect(session.peerConnection.signalingState).toBe('stable');

    await session.close();
  });

  it('should apply a remote ICE candidate after a completed offer/answer exchange', async () => {
    const session = new WeriftWebRtcSession(1);
    const offerSdp = await session.createOffer({ video: true, audio: false });
    const answerSdp = await createRemoteAnswerSdp(offerSdp);
    await session.applyAnswer(answerSdp);

    await expect(session.addIceCandidate('candidate:1 1 UDP 1 127.0.0.1 1 typ host', null, 0)).resolves.toBeUndefined();
    await expect(session.addIceCandidate('candidate:1 1 UDP 1 127.0.0.1 1 typ host', '0', null)).resolves.toBeUndefined();

    await session.close();
  });

  describe('video source selection', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      delete process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE;
      delete process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE_DEVICE;
      delete process.env.MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION;
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should not inject a video track when MATTERBRIDGE_CAMERA_VIDEO_SOURCE is unset', async () => {
      delete process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE;
      const session = new WeriftWebRtcSession(1);

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');
      expect((session as unknown as { testVideoAttached: boolean }).testVideoAttached).toBe(false);

      await session.close();
    });

    it('should attach the synthetic moving test pattern track when MATTERBRIDGE_CAMERA_VIDEO_SOURCE=test', async () => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'test';
      const session = new WeriftWebRtcSession(1);

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should fall back to no injected track when MATTERBRIDGE_CAMERA_VIDEO_SOURCE is unsupported', async () => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'unsupported';
      const session = new WeriftWebRtcSession(1);

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');
      expect((session as unknown as { testVideoAttached: boolean }).testVideoAttached).toBe(false);

      await session.close();
    });

    it('should still attach a video track, falling back to the test pattern, when MATTERBRIDGE_CAMERA_VIDEO_SOURCE=webcam is set without a device', async () => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'webcam';
      const session = new WeriftWebRtcSession(1);

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it.each([
      ['linux', '/dev/video0'],
      ['darwin', '0'],
      ['win32', 'Integrated Camera'],
      ['freebsd', '/dev/video0'],
    ])('should attach a video track from the configured webcam device on platform %s', async (platform, device) => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'webcam';
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE_DEVICE = device;
      Object.defineProperty(process, 'platform', { value: platform });
      const session = new WeriftWebRtcSession(1);

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it.each(['1280x720', '1920x1080'])('should attach a video track using the requested MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION=%s', async (resolution) => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'webcam';
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE_DEVICE = '/dev/video0';
      process.env.MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION = resolution;
      const session = new WeriftWebRtcSession(1);

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should still attach a video track, falling back to 640x480, when MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION is not one of the supported resolutions', async () => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'webcam';
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE_DEVICE = '/dev/video0';
      process.env.MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION = '4000x3000';
      const session = new WeriftWebRtcSession(1);

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should still attach a video track, falling back to MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION, when the requested per-session resolution is not supported', async () => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'webcam';
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE_DEVICE = '/dev/video0';
      process.env.MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION = '1280x720';
      const session = new WeriftWebRtcSession(1);

      const sdp = await session.createOffer({ video: true, audio: false, videoResolution: '9999x9999' });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should use a fixed MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION even when the requested per-session resolution names a different supported resolution', async () => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'webcam';
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE_DEVICE = '/dev/video0';
      process.env.MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION = '640x480';
      const session = new WeriftWebRtcSession(1);

      const sdp = await session.createOffer({ video: true, audio: false, videoResolution: '1920x1080' });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should use the requested per-session resolution when MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION=auto', async () => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'webcam';
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE_DEVICE = '/dev/video0';
      process.env.MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION = 'auto';
      const session = new WeriftWebRtcSession(1);

      const sdp = await session.createOffer({ video: true, audio: false, videoResolution: '1280x720' });

      expect(sdp).toContain('m=video');

      await session.close();
    });
  });

  describe('rtsp video source', () => {
    afterEach(() => {
      delete process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE;
      delete process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE_DEVICE;
      delete process.env.MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION;
    });

    it('should still attach a video track, falling back to the test pattern, when MATTERBRIDGE_CAMERA_VIDEO_SOURCE=rtsp is set without a url', async () => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'rtsp';
      const session = new WeriftWebRtcSession(1);

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should attach a video track from the configured RTSP url', async () => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'rtsp';
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE_DEVICE = 'rtsp://admin:password@192.168.1.100:554/ch1/main';
      const session = new WeriftWebRtcSession(1);

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should scale the RTSP camera to a fixed MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION regardless of the requested per-session resolution', async () => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'rtsp';
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE_DEVICE = 'rtsp://admin:password@192.168.1.100:554/ch1/main';
      process.env.MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION = '1280x720';
      const session = new WeriftWebRtcSession(1);

      const sdp = await session.createOffer({ video: true, audio: false, videoResolution: '640x480' });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should scale the RTSP camera to the requested per-session resolution when MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION=auto', async () => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'rtsp';
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE_DEVICE = 'rtsp://admin:password@192.168.1.100:554/ch1/main';
      process.env.MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION = 'auto';
      const session = new WeriftWebRtcSession(1);

      const sdp = await session.createOffer({ video: true, audio: false, videoResolution: '1920x1080' });

      expect(sdp).toContain('m=video');

      await session.close();
    });
  });

  describe('disabled video source', () => {
    afterEach(() => {
      delete process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE;
    });

    it('should still negotiate a video transceiver but not inject a track when MATTERBRIDGE_CAMERA_VIDEO_SOURCE=none', async () => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'none';
      const session = new WeriftWebRtcSession(1);

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');
      expect((session as unknown as { testVideoAttached: boolean }).testVideoAttached).toBe(false);

      await session.close();
    });
  });

  describe('test audio injection toggle', () => {
    it('should still negotiate an audio transceiver but not inject a track when MATTERBRIDGE_CAMERA_AUDIO_SOURCE=none', async () => {
      process.env.MATTERBRIDGE_CAMERA_AUDIO_SOURCE = 'none';
      const session = new WeriftWebRtcSession(1);
      const offerSdp = await createRemoteAudioOfferSdp();

      const answerSdp = await session.createAnswer(offerSdp);

      expect(answerSdp).toContain('m=audio');

      await session.close();
    });
  });

  describe('audio source selection', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      delete process.env.MATTERBRIDGE_CAMERA_AUDIO_SOURCE_DEVICE;
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should fall back to the test-voice clip when MATTERBRIDGE_CAMERA_AUDIO_SOURCE is unsupported', async () => {
      process.env.MATTERBRIDGE_CAMERA_AUDIO_SOURCE = 'unsupported';
      const session = new WeriftWebRtcSession(1);
      const offerSdp = await createRemoteAudioOfferSdp();

      const answerSdp = await session.createAnswer(offerSdp);

      expect(answerSdp).toContain('m=audio');
      expect((session as unknown as { testAudioAttached: boolean }).testAudioAttached).toBe(false);

      await session.close();
    });

    it('should still attach an audio track, falling back to the test-voice clip, when MATTERBRIDGE_CAMERA_AUDIO_SOURCE=microphone is set without a device', async () => {
      process.env.MATTERBRIDGE_CAMERA_AUDIO_SOURCE = 'microphone';
      const session = new WeriftWebRtcSession(1);
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
      process.env.MATTERBRIDGE_CAMERA_AUDIO_SOURCE = 'microphone';
      process.env.MATTERBRIDGE_CAMERA_AUDIO_SOURCE_DEVICE = device;
      Object.defineProperty(process, 'platform', { value: platform });
      const session = new WeriftWebRtcSession(1);
      const offerSdp = await createRemoteAudioOfferSdp();

      const answerSdp = await session.createAnswer(offerSdp);

      expect(answerSdp).toContain('m=audio');

      await session.close();
    });
  });

  describe('rtsp audio source', () => {
    afterEach(() => {
      delete process.env.MATTERBRIDGE_CAMERA_AUDIO_SOURCE_DEVICE;
    });

    it('should still attach an audio track, falling back to the test-voice clip, when MATTERBRIDGE_CAMERA_AUDIO_SOURCE=rtsp is set without a url', async () => {
      process.env.MATTERBRIDGE_CAMERA_AUDIO_SOURCE = 'rtsp';
      const session = new WeriftWebRtcSession(1);
      const offerSdp = await createRemoteAudioOfferSdp();

      const answerSdp = await session.createAnswer(offerSdp);

      expect(answerSdp).toContain('m=audio');

      await session.close();
    });

    it('should attach an audio track from the configured RTSP url', async () => {
      process.env.MATTERBRIDGE_CAMERA_AUDIO_SOURCE = 'rtsp';
      process.env.MATTERBRIDGE_CAMERA_AUDIO_SOURCE_DEVICE = 'rtsp://admin:password@192.168.1.100:554/ch1/main';
      const session = new WeriftWebRtcSession(1);
      const offerSdp = await createRemoteAudioOfferSdp();

      const answerSdp = await session.createAnswer(offerSdp);

      expect(answerSdp).toContain('m=audio');

      await session.close();
    });
  });

  describe('injectable codec selection', () => {
    it('should prefer an already-negotiated injectable codec when creating a subsequent offer', async () => {
      const session = new WeriftWebRtcSession(1);
      const transceiver = session.peerConnection.addTransceiver('video', { direction: 'sendonly' });
      transceiver.codecs = [new RTCRtpCodecParameters({ mimeType: 'video/VP8', clockRate: 90000, payloadType: 96 })];

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should prefer an already-negotiated H264 codec, using the H264 ffmpeg encoder, when creating a subsequent offer', async () => {
      const session = new WeriftWebRtcSession(1);
      const transceiver = session.peerConnection.addTransceiver('video', { direction: 'sendonly' });
      transceiver.codecs = [new RTCRtpCodecParameters({ mimeType: 'video/h264', clockRate: 90000, payloadType: 97 })];

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should skip non-video transceivers when selecting and preferring an injectable codec', async () => {
      const session = new WeriftWebRtcSession(1);
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
      const session = new WeriftWebRtcSession(1);
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
      const session = new WeriftWebRtcSession(1);
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
      const session = new WeriftWebRtcSession(1);
      const transceiver = session.peerConnection.addTransceiver('video', { direction: 'sendonly' });
      transceiver.codecs = [new RTCRtpCodecParameters({ mimeType: 'video/VP9', clockRate: 90000, payloadType: 98 })];

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should only adjust the video transceiver(s) that actually have the preferred codec available', async () => {
      const session = new WeriftWebRtcSession(1);
      const withPreferredCodec = session.peerConnection.addTransceiver('video', { direction: 'sendonly' });
      withPreferredCodec.codecs = [new RTCRtpCodecParameters({ mimeType: 'video/VP8', clockRate: 90000, payloadType: 96 })];
      const withoutPreferredCodec = session.peerConnection.addTransceiver('video', { direction: 'sendonly' });
      withoutPreferredCodec.codecs = [new RTCRtpCodecParameters({ mimeType: 'video/VP9', clockRate: 90000, payloadType: 98 })];

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should only adjust the audio transceiver(s) that actually have the preferred codec available', async () => {
      const session = new WeriftWebRtcSession(1);

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
      const session = new WeriftWebRtcSession(1);
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

  describe('per-session webcam resolution precedence', () => {
    afterEach(() => {
      delete process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE;
      delete process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE_DEVICE;
    });

    it('should use the requested per-session resolution when it names a supported resolution', async () => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'webcam';
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE_DEVICE = '/dev/video0';
      const session = new WeriftWebRtcSession(1);

      const sdp = await session.createOffer({ video: true, audio: false, videoResolution: '1280x720' });

      expect(sdp).toContain('m=video');

      await session.close();
    });
  });

  describe('missing ffmpeg dependency', () => {
    it('should still negotiate a video transceiver but not inject a track when ffmpeg cannot be resolved', async () => {
      const session = new WeriftWebRtcSession(1);
      vi.mocked(hasFfmpeg).mockReturnValue(false);

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should still negotiate an audio transceiver but not inject a track when ffmpeg cannot be resolved', async () => {
      const session = new WeriftWebRtcSession(1);
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
      const session = new WeriftWebRtcSession(1);
      mockResolvableFfmpeg();

      const firstSdp = await session.createOffer({ video: true, audio: false });
      const secondSdp = await session.createOffer({ video: true, audio: false });

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
      const session = new WeriftWebRtcSession(1);
      mockResolvableFfmpeg();
      const transceiver = session.peerConnection.addTransceiver('video', { direction: 'sendonly' });
      transceiver.codecs = [codec];

      const sdp = await session.createOffer({ video: true, audio: false });

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
      const session = new WeriftWebRtcSession(1);
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
      const session = new WeriftWebRtcSession(1);
      mockResolvableFfmpeg();

      await session.createOffer({ video: true, audio: false });
      const videoGenerator = (session as unknown as SessionState).testVideoGenerator;

      if (!videoGenerator) throw new Error('videoGenerator was not attached');
      const killSpy = vi.spyOn(videoGenerator, 'kill');

      process.emit('exit', 0);

      expect(killSpy).toHaveBeenCalledWith('SIGTERM');

      await session.close();
    });

    it('should not throw when the process emits exit for a session with no leftover ffmpeg process', async () => {
      const session = new WeriftWebRtcSession(1);

      expect(() => process.emit('exit', 0)).not.toThrow();

      await session.close();
    });
  });

  describe('closeAll', () => {
    it('should close every active session and remove them from the active session registry', async () => {
      const first = new WeriftWebRtcSession(1);
      const second = new WeriftWebRtcSession(2);
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
      const session = new WeriftWebRtcSession(1);
      const closeSpy = vi.spyOn(session, 'close');
      await session.createOffer({ video: true, audio: false });
      const [dtlsTransport] = session.peerConnection.dtlsTransports;
      if (!dtlsTransport) throw new Error('no DTLS transport negotiated');

      (dtlsTransport as unknown as DtlsTransportState).setState('closed');

      await vi.waitFor(() => expect(closeSpy).toHaveBeenCalledTimes(1));
      await closeSpy.mock.results[0]?.value;
      expect((session as unknown as { closing: boolean }).closing).toBe(true);
    });

    it('should close the session once a DTLS transport reaches failed on its own', async () => {
      type DtlsTransportState = { setState(state: string, emitEvent?: boolean): void };
      const session = new WeriftWebRtcSession(1);
      const closeSpy = vi.spyOn(session, 'close');
      await session.createOffer({ video: true, audio: false });
      const [dtlsTransport] = session.peerConnection.dtlsTransports;
      if (!dtlsTransport) throw new Error('no DTLS transport negotiated');

      (dtlsTransport as unknown as DtlsTransportState).setState('failed');

      await vi.waitFor(() => expect(closeSpy).toHaveBeenCalledTimes(1));
      await closeSpy.mock.results[0]?.value;
    });

    it('should not call close a second time when a normal close() itself drives the DTLS transport to closed', async () => {
      const session = new WeriftWebRtcSession(1);
      const closeSpy = vi.spyOn(session, 'close');
      await session.createOffer({ video: true, audio: false });

      await session.close();

      // A normal close() also stops the DTLS transports (see the doc comment on `closing`), which must not re-enter
      // close() a second time via the same onStateChange subscription that drives the auto-close above.
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });
  });
});
