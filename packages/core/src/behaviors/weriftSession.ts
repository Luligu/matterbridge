/**
 * @file src/behaviors/weriftSession.ts
 * @description This file contains the WeriftWebRtcSession class, wrapping a werift RTCPeerConnection.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 * @created 2026-07-14
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026, 2027, 2028 Luca Liguori.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { ChildProcess } from 'node:child_process';
import { createSocket } from 'node:dgram';
import { fileURLToPath } from 'node:url';

import { fireAndForget, getErrorMessage } from '@matterbridge/utils';
import { AnsiLogger, LogLevel, MAGENTA, TimestampFormat } from 'node-ansi-logger';
import type { RTCDtlsTransport, RTCIceCandidatePairStats, RTCOutboundRtpStreamStats } from 'werift';
import { RTCPeerConnection, RTCRtpCodecParameters, useH264, useOPUS, usePCMU, useVP8 } from 'werift';
import { navigator } from 'werift/nonstandard';

import { hasFfmpeg, runFfmpeg } from './ffmpeg.js';

type VideoSource = 'none' | 'test' | 'webcam' | 'rtsp';

type AudioSource = 'none' | 'test' | 'microphone' | 'rtsp';

/**
 * Media kinds to negotiate when creating a real WebRTC offer for a WebRtcTransportProvider session.
 */
export interface WeriftOfferOptions {
  /** Whether to add a sendonly video transceiver to the offer. */
  video: boolean;
  /** Whether to add a sendonly audio transceiver to the offer. */
  audio: boolean;
  /**
   * Video source corresponding to MATTERBRIDGE_CAMERA_VIDEO_SOURCE: no injected track (`none`), a synthetic
   * pattern (`test`), a local capture device (`webcam`), or an RTSP stream (`rtsp`). The environment default is `none`.
   */
  videoSource: VideoSource;
  /**
   * Webcam device identifier or RTSP URL corresponding to MATTERBRIDGE_CAMERA_VIDEO_SOURCE_DEVICE.
   * Webcam identifiers are a device path on Linux, an avfoundation index on macOS, or a dshow name on Windows.
   * A missing device for webcam or RTSP capture currently falls back to the synthetic test pattern.
   */
  videoSourceDevice?: string;
  /**
   * Preferred capture resolution (e.g. "1280x720") for this session, typically the allocated video stream's
   * resolution from a real client's CameraAvStreamManagement.VideoStreamAllocate request. Supported resolutions
   * are 640x480, 1280x720, and 1920x1080. A fixed MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION overrides this preference;
   * when the environment variable is unset or `auto`, this preference is used, falling back to 640x480.
   * Applies to webcam and RTSP sources; ignored for the synthetic test pattern.
   */
  videoResolution?: string;
  /**
   * Target video encoder bitrate in kbps corresponding to MATTERBRIDGE_CAMERA_VIDEO_BITRATE.
   * Must be a finite positive number. The environment default and synthetic test pattern bitrate are 1000 kbps.
   */
  videoBitrate?: number;
  /**
   * Audio source corresponding to MATTERBRIDGE_CAMERA_AUDIO_SOURCE: no injected track (`none`), the recorded
   * voice clip (`test`), a local capture device (`microphone`), or an RTSP stream (`rtsp`). The environment default is `none`.
   */
  audioSource: AudioSource;
  /**
   * Microphone device identifier or RTSP URL corresponding to MATTERBRIDGE_CAMERA_AUDIO_SOURCE_DEVICE.
   * Microphone identifiers are an ALSA device on Linux, an avfoundation index on macOS, or a dshow name on Windows.
   * A missing device for microphone or RTSP capture currently falls back to the recorded test voice clip.
   */
  audioSourceDevice?: string;
}

/**
 * Wraps a werift RTCPeerConnection for a single WebRtcTransportProvider session (see
 * MatterbridgeWebRtcTransportProviderServer in ../behaviors/webRtcTransportProviderServer.ts), so the session's SDP
 * offer/answer and ICE candidates are handled by a real WebRTC peer connection instead of being just recorded.
 *
 * In addition to SDP/ICE negotiation, this session can inject a video source using werift/nonstandard + ffmpeg so an
 * end-to-end media path can be validated without a real camera capture pipeline. The source is a synthetic moving
 * test pattern when `MATTERBRIDGE_CAMERA_VIDEO_SOURCE=test`, a local webcam capture device when the source is
 * `webcam`, a real RTSP camera stream when the source is `rtsp`, or no injected track when the source is unset or
 * `none`. MATTERBRIDGE_CAMERA_VIDEO_SOURCE_DEVICE identifies the webcam device (e.g. /dev/video0 on Linux, an
 * avfoundation index on macOS, or a dshow device name on Windows) for `webcam`, or the RTSP url (e.g.
 * rtsp://user:password@host:554/path) for `rtsp`. The webcam capture resolution defaults to 640x480 and can be set
 * to 1280x720 or 1920x1080 with MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION.
 *
 * Similarly, the audio track can inject a recorded test-voice clip (e.g. for an Intercom's "Listen" live view) when
 * `MATTERBRIDGE_CAMERA_AUDIO_SOURCE=test`, capture from a local microphone when the source is `microphone`, or pull
 * the audio from a real RTSP camera stream when the source is `rtsp`; unset or `none` negotiates the audio
 * transceiver without attaching a track. MATTERBRIDGE_CAMERA_AUDIO_SOURCE_DEVICE identifies the microphone device
 * (e.g. a hw:X,Y ALSA device on Linux, an avfoundation audio index on macOS, or a dshow device name on Windows) for
 * `microphone`, or the RTSP url for `rtsp`.
 */
export class WeriftWebRtcSession {
  /**
   * Every live session, so the process `exit` handler below can kill any ffmpeg processes still running if the host
   * process exits without every session's close() being called (e.g. Matterbridge being killed rather than shut
   * down gracefully).
   */
  private static readonly activeSessions = new Set<WeriftWebRtcSession>();

  private static exitHandlerRegistered = false;

  /** The underlying werift peer connection for this session. */
  readonly peerConnection: RTCPeerConnection;

  /** The logger for this session. */
  private readonly log: AnsiLogger;

  /** The WebRtcTransportProvider session identifier this instance backs. */
  private readonly webRtcSessionId: number;

  private testVideoGenerator?: ChildProcess;

  private testVideoUdpDisposer?: () => void;

  private testVideoAttached = false;

  private testAudioGenerator?: ChildProcess;

  private testAudioUdpDisposer?: () => void;

  private testAudioAttached = false;

  /**
   * Periodic diagnostics timer started in the constructor and cleared in {@link close}; see
   * {@link logDiagnosticsSnapshot}.
   */
  private diagnosticsInterval?: NodeJS.Timeout;

  /**
   * How often {@link logDiagnosticsSnapshot} runs while a session is alive. Purely observational for now, so a
   * conservative interval keeps the log readable while we gather real-world state transitions (e.g. whether a
   * controller-abandoned session's ICE/DTLS/connection state settles into something detectable, and whether it ever
   * recovers from `disconnected` on its own) before any auto-close behavior is designed.
   */
  private static readonly DIAGNOSTICS_INTERVAL_MS = 10_000;

  /**
   * The nominated candidate-pair and outbound-rtp packet counters from the previous {@link logDiagnosticsSnapshot}
   * tick, so it can report deltas (packets actually moved since the last tick) instead of only cumulative totals.
   * Unlike iceConnectionState, these counters come straight off werift's ICE `CandidatePair`/RTP sender objects and
   * are not affected by the one-shot RFC 7675 consent-check bug documented on {@link logDiagnosticsSnapshot}.
   */
  private lastDiagnosticsCounters?: { candidatePairPacketsSent: number; candidatePairPacketsReceived: number; outboundRtpPacketsSent: number };

  /**
   * DTLS transports already covered by {@link logDtlsTransportStateChanges}'s onStateChange subscription, so a
   * transport already listened to is not subscribed twice if that method runs again (e.g. an ICE restart).
   */
  private readonly dtlsTransportsWithStateLogging = new Set<RTCDtlsTransport>();

  /**
   * Creates a new werift RTCPeerConnection configured with the codecs this session can negotiate and inject.
   *
   * @param {number} webRtcSessionId - The WebRtcTransportProvider session identifier this instance backs, used as this session's log name.
   */
  constructor(webRtcSessionId: number) {
    this.webRtcSessionId = webRtcSessionId;
    this.peerConnection = new RTCPeerConnection({ codecs: { audio: [useOPUS(), usePCMU()], video: [useH264(), useVP8()] } });
    this.log = new AnsiLogger({ logName: `WebRTC session ${webRtcSessionId}`, logLevel: LogLevel.DEBUG, logNameColor: MAGENTA, logTimestampFormat: TimestampFormat.TIME_MILLIS });
    // Log when local ICE candidate discovery starts or completes.
    this.peerConnection.iceGatheringStateChange.subscribe((state) => {
      this.log.info(`ICE gathering state: ${state}`);
    });
    // Log each discovered local candidate, or the end-of-candidates signal.
    this.peerConnection.onIceCandidate.subscribe((candidate) => {
      this.log.debug(candidate ? `Gathered local ICE candidate: ${candidate.candidate}` : 'ICE candidate gathering completed');
    });
    // Log progress while ICE tests candidate pairs and establishes connectivity.
    this.peerConnection.iceConnectionStateChange.subscribe((state) => {
      this.log.info(`ICE connection state: ${state}`);
      if (state === 'connected' || state === 'completed') {
        for (const transport of this.peerConnection.iceTransports) {
          const pair = transport.connection.nominated;
          // v8 ignore start -- unreachable
          if (!pair) continue;
          const local = pair.localCandidate;
          const remote = pair.remoteCandidate;
          // Log the nominated local-to-remote route that carries WebRTC traffic.
          this.log.info(
            `Selected ICE candidate pair: local=${local.host}:${local.port} (${local.type}/${local.transport}) ` +
              `remote=${remote.host}:${remote.port} (${remote.type}/${remote.transport})`,
          );
          // v8 ignore end
        }
      }
    });
    // Log the aggregate peer connection state, including ICE and secure transports.
    this.peerConnection.connectionStateChange.subscribe((state) => {
      this.log.info(`Peer connection state: ${state}`);
    });
    this.log.debug(`Created RTCPeerConnection with codecs: audio=[OPUS, PCMU], video=[H264, VP8] for session ${webRtcSessionId}`);

    this.diagnosticsInterval = setInterval(() => void this.logDiagnosticsSnapshot(), WeriftWebRtcSession.DIAGNOSTICS_INTERVAL_MS);

    WeriftWebRtcSession.activeSessions.add(this);
    if (!WeriftWebRtcSession.exitHandlerRegistered) {
      WeriftWebRtcSession.exitHandlerRegistered = true;
      process.on('exit', () => {
        for (const session of WeriftWebRtcSession.activeSessions) {
          if (!session.testVideoGenerator && !session.testAudioGenerator) continue;
          session.log.info('Process exiting: killing leftover ffmpeg processes for this session');
          session.testVideoGenerator?.kill('SIGTERM');
          session.testAudioGenerator?.kill('SIGTERM');
        }
      });
    }
  }

  /**
   * Builds a short, log-friendly summary of an SDP body (length and negotiated media kinds).
   *
   * @param {string} sdp - The SDP body to summarize.
   * @returns {string} A summary string such as `length=1234 media=[video,audio]`.
   */
  private summarizeSdp(sdp: string): string {
    const mediaKinds = sdp
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('m='))
      .map((line) => line.slice(2).split(' ')[0]);
    return `length=${sdp.length} media=[${mediaKinds.join(',')}]`;
  }

  /**
   * Allocates an ephemeral local UDP port for ffmpeg to send the injected video track's RTP stream to.
   *
   * @returns {Promise<number>} The allocated port number on `127.0.0.1`.
   */
  private async getFreeUdpPort(): Promise<number> {
    return await new Promise<number>((resolve, reject) => {
      const socket = createSocket('udp4');
      socket.once('error', reject);
      socket.bind(0, '127.0.0.1', () => {
        const port = socket.address().port;
        this.log.debug(`Allocated free UDP port ${port}`);
        socket.close(() => resolve(port));
      });
    });
  }

  /**
   * Finds the first VP8 or H264 codec negotiated on any video transceiver, i.e. a codec ffmpeg can encode to for
   * the injected test/webcam video track.
   *
   * @returns {RTCRtpCodecParameters | undefined} The preferred codec, or `undefined` if no video transceiver
   * negotiated VP8 or H264.
   */
  private getPreferredInjectableVideoCodec(): RTCRtpCodecParameters | undefined {
    for (const transceiver of this.peerConnection.getTransceivers()) {
      if (transceiver.kind !== 'video') continue;
      const preferredCodec = transceiver.codecs.find((codec) => {
        const mimeType = codec.mimeType.toLowerCase();
        return mimeType === 'video/vp8' || mimeType === 'video/h264';
      });
      if (preferredCodec) {
        this.log.debug(`Preferred injectable video codec: ${preferredCodec.mimeType}`);
        return preferredCodec;
      }
    }
    this.log.debug('No preferred injectable video codec (VP8/H264) negotiated on any video transceiver');
    return undefined;
  }

  /**
   * Finds the first Opus codec negotiated on any audio transceiver, i.e. a codec ffmpeg can encode to for the
   * injected test-voice audio track.
   *
   * @returns {RTCRtpCodecParameters | undefined} The preferred codec, or `undefined` if no audio transceiver
   * negotiated Opus.
   */
  private getPreferredInjectableAudioCodec(): RTCRtpCodecParameters | undefined {
    for (const transceiver of this.peerConnection.getTransceivers()) {
      if (transceiver.kind !== 'audio') continue;
      const preferredCodec = transceiver.codecs.find((codec) => codec.mimeType.toLowerCase() === 'audio/opus');
      if (preferredCodec) {
        this.log.debug(`Preferred injectable audio codec: ${preferredCodec.mimeType}`);
        return preferredCodec;
      }
    }
    this.log.debug('No preferred injectable audio codec (Opus) negotiated on any audio transceiver');
    return undefined;
  }

  /** Webcam capture resolutions supported via MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION; falls back to the first entry. */
  private static readonly SUPPORTED_VIDEO_RESOLUTIONS = ['640x480', '1280x720', '1920x1080'];

  /**
   * Default target encoder bitrate (kbps), used for the test pattern and as the fallback when
   * MATTERBRIDGE_CAMERA_VIDEO_BITRATE is unset or invalid. Without an explicit -b:v, ffmpeg falls back to a generic
   * ~200kbps default that is far too low even at 640x480 and produces heavy blocking artifacts.
   */
  private static readonly DEFAULT_BITRATE_KBPS = 1000;

  /**
   * Resolves the configured encoder bitrate (kbps) from MATTERBRIDGE_CAMERA_VIDEO_BITRATE, applied regardless of the
   * capture resolution; falls back to {@link DEFAULT_BITRATE_KBPS} (with a warning) if unset or not a positive
   * number.
   *
   * @returns {number} The target encoder bitrate in kbps.
   */
  private getConfiguredVideoBitrate(): number {
    const configured = process.env.MATTERBRIDGE_CAMERA_VIDEO_BITRATE;
    if (!configured) return WeriftWebRtcSession.DEFAULT_BITRATE_KBPS;
    const bitrateKbps = Number(configured);
    if (!Number.isFinite(bitrateKbps) || bitrateKbps <= 0) {
      this.log.warn(`Invalid MATTERBRIDGE_CAMERA_VIDEO_BITRATE "${configured}"; falling back to ${WeriftWebRtcSession.DEFAULT_BITRATE_KBPS}kbps`);
      return WeriftWebRtcSession.DEFAULT_BITRATE_KBPS;
    }
    return bitrateKbps;
  }

  /**
   * Resolves the capture/output resolution to use. When MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION names a supported fixed
   * resolution, that value always wins, regardless of what the controller requested. When it is unset or `auto`,
   * the requested per-session resolution (typically the client's allocated video stream resolution) is used when it
   * names a supported resolution, falling back (with a warning) to 640x480 otherwise.
   *
   * @param {string} [requestedResolution] - The per-session preferred resolution, e.g. "1280x720".
   * @returns {string} The resolution to use, e.g. "1280x720".
   */
  private getConfiguredVideoResolution(requestedResolution?: string): string {
    const [defaultResolution] = WeriftWebRtcSession.SUPPORTED_VIDEO_RESOLUTIONS;
    const configured = process.env.MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION;

    if (configured && configured !== 'auto') {
      if (WeriftWebRtcSession.SUPPORTED_VIDEO_RESOLUTIONS.includes(configured)) {
        this.log.debug(`Using configured MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION ${configured}`);
        return configured;
      }
      this.log.warn(
        `Unsupported MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION "${configured}" (supported: ${WeriftWebRtcSession.SUPPORTED_VIDEO_RESOLUTIONS.join(', ')}, auto); falling back to ${defaultResolution}`,
      );
      return defaultResolution;
    }

    if (requestedResolution) {
      if (WeriftWebRtcSession.SUPPORTED_VIDEO_RESOLUTIONS.includes(requestedResolution)) {
        this.log.debug(`Using requested video stream resolution ${requestedResolution} (MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION=auto)`);
        return requestedResolution;
      }
      this.log.warn(
        `Requested video stream resolution "${requestedResolution}" is not supported (supported: ${WeriftWebRtcSession.SUPPORTED_VIDEO_RESOLUTIONS.join(', ')}); falling back to ${defaultResolution}`,
      );
      return defaultResolution;
    }
    this.log.debug(`No requested video stream resolution available; using default ${defaultResolution} (MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION=auto)`);
    return defaultResolution;
  }

  /**
   * Resolves the configured injected video source.
   *
   * @returns {VideoSource} `none` by default, or the configured `test`/`webcam`/`rtsp` source.
   */
  private getConfiguredVideoSource(): VideoSource {
    const source = process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE?.trim().toLowerCase() ?? 'none';
    switch (source) {
      case 'none':
      case 'test':
      case 'webcam':
      case 'rtsp':
        return source;
      default:
        this.log.warn(`Unsupported MATTERBRIDGE_CAMERA_VIDEO_SOURCE "${source}" (supported: test, webcam, rtsp, none); falling back to none`);
        return 'none';
    }
  }

  /**
   * Resolves the ffmpeg input arguments and a human-readable description for the configured video source.
   *
   * Uses the synthetic moving test pattern for `test`, or MATTERBRIDGE_CAMERA_VIDEO_SOURCE_DEVICE for `webcam`/`rtsp`
   * (the RTSP url for `rtsp`); falls back to the test pattern (logging a warning) if the device/url is missing or
   * webcam capture isn't supported on this platform. The output resolution is resolved via
   * {@link getConfiguredVideoResolution}: a fixed MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION (640x480, 1280x720, or
   * 1920x1080) always wins, while `auto` (or unset) uses the per-session requestedResolution, typically the
   * controller's allocated video stream resolution. For `webcam` this selects the capture resolution directly; for
   * `rtsp` the camera streams at its own native resolution and is scaled to the resolved resolution with a `scale`
   * filter. The encoder bitrate defaults to {@link DEFAULT_BITRATE_KBPS} and can be overridden with
   * MATTERBRIDGE_CAMERA_VIDEO_BITRATE, regardless of resolution.
   *
   * @param {'test' | 'webcam' | 'rtsp'} videoSource - The configured video source after `none` has been handled by the caller.
   * @param {string} [requestedResolution] - The per-session preferred resolution; see {@link getConfiguredVideoResolution}.
   * @returns {{ args: string[]; description: string; bitrateKbps: number }} The ffmpeg input arguments, a description of the source for logging, and the target encoder bitrate.
   */
  private buildFfmpegVideoInputArgs(videoSource: 'test' | 'webcam' | 'rtsp', requestedResolution?: string): { args: string[]; description: string; bitrateKbps: number } {
    const testPatternInput = {
      args: ['-re', '-f', 'lavfi', '-i', 'testsrc=size=640x480:rate=10'],
      description: 'synthetic moving test pattern',
      bitrateKbps: WeriftWebRtcSession.DEFAULT_BITRATE_KBPS,
    };
    if (videoSource === 'test') {
      this.log.debug(`Test pattern params: resolution=640x480, description="${testPatternInput.description}", bitrateKbps=${testPatternInput.bitrateKbps}`);
      return testPatternInput;
    }

    const device = process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE_DEVICE;
    if (!device) {
      this.log.warn(`MATTERBRIDGE_CAMERA_VIDEO_SOURCE=${videoSource} requires MATTERBRIDGE_CAMERA_VIDEO_SOURCE_DEVICE to be set; falling back to the synthetic test video`);
      return testPatternInput;
    }

    const resolution = this.getConfiguredVideoResolution(requestedResolution);
    const bitrateKbps = this.getConfiguredVideoBitrate();

    if (videoSource === 'rtsp') {
      const description = `RTSP camera (${device}, ${resolution})`;
      this.log.debug(`RTSP capture params: url=${device}, resolution=${resolution}, description="${description}", bitrateKbps=${bitrateKbps}`);
      return { args: ['-rtsp_transport', 'tcp', '-i', device, '-vf', `scale=${resolution.replace('x', ':')}`], description, bitrateKbps };
    }

    const description = `local webcam (${device}, ${resolution})`;
    this.log.debug(`Webcam capture params: device=${device}, resolution=${resolution}, description="${description}", bitrateKbps=${bitrateKbps}`);
    switch (process.platform) {
      case 'linux':
        return { args: ['-f', 'v4l2', '-video_size', resolution, '-framerate', '30', '-i', device], description, bitrateKbps };
      case 'darwin':
        return { args: ['-f', 'avfoundation', '-video_size', resolution, '-framerate', '30', '-i', device], description, bitrateKbps };
      case 'win32':
        return { args: ['-f', 'dshow', '-video_size', resolution, '-framerate', '30', '-i', `video=${device}`], description, bitrateKbps };
      default:
        this.log.warn(`Webcam capture via ffmpeg is not supported on platform "${process.platform}"; falling back to the synthetic test video`);
        return testPatternInput;
    }
  }

  /**
   * Attaches an injected video track (test pattern, webcam, or RTSP camera, per {@link buildFfmpegVideoInputArgs}) to the peer
   * connection by spawning ffmpeg to encode into it over a local UDP/RTP loop, unless one is already attached, the
   * configured source is `none`, or ffmpeg can't be resolved. Failures are logged and swallowed rather than thrown,
   * since the offer/answer exchange should still proceed without video.
   *
   * @param {RTCRtpCodecParameters} [codec] - The negotiated codec to encode into, from {@link getPreferredInjectableVideoCodec}; defaults to VP8.
   * @param {string} [videoResolution] - The per-session preferred webcam resolution; see {@link buildFfmpegVideoInputArgs}.
   * @returns {Promise<void>} Resolves once the attach attempt (successful or not) has completed.
   */
  private async generateVideoTrack(codec?: RTCRtpCodecParameters, videoResolution?: string): Promise<void> {
    if (this.testVideoAttached) return;
    const videoSource = this.getConfiguredVideoSource();
    if (videoSource === 'none') {
      this.log.debug('Video injection disabled by MATTERBRIDGE_CAMERA_VIDEO_SOURCE=none');
      return;
    }

    const videoInput = this.buildFfmpegVideoInputArgs(videoSource, videoResolution);
    this.log.debug(`Attempting to attach ${videoInput.description} video track at ${videoInput.bitrateKbps}kbps`);

    if (!hasFfmpeg()) {
      this.log.warn('Cannot inject video stream: missing dependency ffmpeg');
      return;
    }

    const selectedMimeType = (codec?.mimeType ?? 'video/vp8').toLowerCase();
    const selectedPayloadType = codec?.payloadType ?? 120;
    try {
      const udpPort = await this.getFreeUdpPort();
      const { track, disposer } = navigator.mediaDevices.getUdpMedia({
        port: udpPort,
        codec: new RTCRtpCodecParameters({ mimeType: selectedMimeType, clockRate: 90000, payloadType: selectedPayloadType }),
      });
      this.peerConnection.addTrack(track);

      const bitrate = `${videoInput.bitrateKbps}k`;
      const encoderArgs =
        selectedMimeType === 'video/h264'
          ? ['-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-pix_fmt', 'yuv420p', '-g', '20', '-b:v', bitrate, '-maxrate', bitrate, '-bufsize', bitrate]
          : ['-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '4', '-pix_fmt', 'yuv420p', '-g', '20', '-b:v', bitrate, '-maxrate', bitrate, '-bufsize', bitrate];

      const ffmpegArgs = [
        '-hide_banner',
        '-loglevel',
        'error',
        ...videoInput.args,
        '-an',
        ...encoderArgs,
        '-f',
        'rtp',
        '-payload_type',
        String(selectedPayloadType),
        `rtp://127.0.0.1:${udpPort}`,
      ];
      const generator = runFfmpeg(ffmpegArgs);

      /* v8 ignore start -- requires the spawned ffmpeg process itself to fail after hasFfmpeg already verified
       * it runs (e.g. the binary is removed between the check and this spawn), which this harness can't simulate
       * without deleting real system binaries or mocking node:child_process. */
      generator.once('error', (error: unknown) => {
        this.log.warn(`Video generator failed: ${getErrorMessage(error)}`);
      });
      /* v8 ignore stop */

      this.testVideoUdpDisposer = disposer;
      this.testVideoGenerator = generator;
      this.testVideoAttached = true;
      this.log.info(`Attached ${videoInput.description} video track (codec=${selectedMimeType}, payloadType=${selectedPayloadType}, sourcePort=${udpPort})`);
      /* v8 ignore start -- requires a lower-level failure (UDP port allocation racing, werift/nonstandard media
       * internals throwing) that isn't practically triggerable in this harness without mocking werift internals. */
    } catch (error) {
      this.log.warn(`Failed to attach ${videoInput.description} video track: ${getErrorMessage(error)}`);
    }
    /* v8 ignore stop */
  }

  /**
   * Restricts every negotiated video transceiver's codec list to the given mime type, so werift's answer/offer only
   * proposes the codec ffmpeg will actually encode into.
   *
   * @param {string} mimeType - The codec mime type to keep, e.g. `"video/vp8"`.
   * @returns {void}
   */
  private preferVideoCodecOnTransceivers(mimeType: string): void {
    let adjustedTransceivers = 0;
    for (const transceiver of this.peerConnection.getTransceivers()) {
      if (transceiver.kind !== 'video') continue;
      const preferredCodecs = transceiver.codecs.filter((codec) => codec.mimeType.toLowerCase() === mimeType);
      if (!preferredCodecs.length) continue;
      transceiver.codecs = preferredCodecs;
      adjustedTransceivers += 1;
    }
    /* v8 ignore else -- unreachable: callers only ever pass a mimeType they just found on one of these same
     * transceivers via getPreferredInjectableVideoCodec(), so adjustedTransceivers always ends up > 0. */
    if (adjustedTransceivers > 0) {
      this.log.debug(`Preferred ${mimeType.toUpperCase()} codecs on ${adjustedTransceivers} video transceiver(s)`);
    }
  }

  /**
   * Restricts every negotiated audio transceiver's codec list to the given mime type, so werift's answer/offer only
   * proposes the codec ffmpeg will actually encode into.
   *
   * @param {string} mimeType - The codec mime type to keep, e.g. `"audio/opus"`.
   * @returns {void}
   */
  private preferAudioCodecOnTransceivers(mimeType: string): void {
    let adjustedTransceivers = 0;
    for (const transceiver of this.peerConnection.getTransceivers()) {
      if (transceiver.kind !== 'audio') continue;
      const preferredCodecs = transceiver.codecs.filter((codec) => codec.mimeType.toLowerCase() === mimeType);
      if (!preferredCodecs.length) continue;
      transceiver.codecs = preferredCodecs;
      adjustedTransceivers += 1;
    }
    /* v8 ignore else -- unreachable: callers only ever pass a mimeType they just found on one of these same
     * transceivers via getPreferredInjectableAudioCodec(), so adjustedTransceivers always ends up > 0. */
    if (adjustedTransceivers > 0) {
      this.log.debug(`Preferred ${mimeType.toUpperCase()} codecs on ${adjustedTransceivers} audio transceiver(s)`);
    }
  }

  /** Recorded test-voice clip (espeak-ng synthesized, checked into the repo) looped as the injected audio source. */
  private static readonly TEST_VOICE_PATH = fileURLToPath(new URL('../../assets/test-voice.opus', import.meta.url));

  /**
   * Resolves the configured injected audio source.
   *
   * @returns {AudioSource} `none` by default, or the configured `test`/`microphone`/`rtsp` source.
   */
  private getConfiguredAudioSource(): AudioSource {
    const source = process.env.MATTERBRIDGE_CAMERA_AUDIO_SOURCE?.trim().toLowerCase() ?? 'none';
    switch (source) {
      case 'none':
      case 'test':
      case 'microphone':
      case 'rtsp':
        return source;
      default:
        this.log.warn(`Unsupported MATTERBRIDGE_CAMERA_AUDIO_SOURCE "${source}" (supported: test, microphone, rtsp, none); falling back to none`);
        return 'none';
    }
  }

  /**
   * Resolves the ffmpeg input arguments and a human-readable description for the configured audio source.
   *
   * Uses the recorded test-voice clip (looped) for `test`, or MATTERBRIDGE_CAMERA_AUDIO_SOURCE_DEVICE for
   * `microphone`/`rtsp` (the RTSP url for `rtsp`); falls back to the test-voice clip (logging a warning) if the
   * device/url is missing or microphone capture isn't supported on this platform.
   *
   * @param {'test' | 'microphone' | 'rtsp'} audioSource - The configured audio source after `none` has been handled by the caller.
   * @returns {{ args: string[]; description: string; volumeFilter?: string }} The ffmpeg input arguments, a description of the source for logging, and an optional `-af` volume-boost filter (only for the test-voice clip, which was recorded quietly).
   */
  private buildFfmpegAudioInputArgs(audioSource: 'test' | 'microphone' | 'rtsp'): { args: string[]; description: string; volumeFilter?: string } {
    const testVoiceInput = {
      args: ['-re', '-stream_loop', '-1', '-i', WeriftWebRtcSession.TEST_VOICE_PATH],
      description: 'recorded test-voice clip',
      volumeFilter: 'volume=6dB',
    };
    if (audioSource === 'test') return testVoiceInput;

    const device = process.env.MATTERBRIDGE_CAMERA_AUDIO_SOURCE_DEVICE;
    if (!device) {
      this.log.warn(`MATTERBRIDGE_CAMERA_AUDIO_SOURCE=${audioSource} requires MATTERBRIDGE_CAMERA_AUDIO_SOURCE_DEVICE to be set; falling back to the recorded test-voice clip`);
      return testVoiceInput;
    }

    if (audioSource === 'rtsp') {
      const description = `RTSP camera audio (${device})`;
      this.log.debug(`RTSP audio capture params: url=${device}, description="${description}"`);
      return { args: ['-rtsp_transport', 'tcp', '-i', device], description };
    }

    const description = `local microphone (${device})`;
    this.log.debug(`Microphone capture params: device=${device}, description="${description}"`);
    switch (process.platform) {
      case 'linux':
        return { args: ['-f', 'alsa', '-i', device], description };
      case 'darwin':
        return { args: ['-f', 'avfoundation', '-i', `:${device}`], description };
      case 'win32':
        return { args: ['-f', 'dshow', '-i', `audio=${device}`], description };
      default:
        this.log.warn(`Microphone capture via ffmpeg is not supported on platform "${process.platform}"; falling back to the recorded test-voice clip`);
        return testVoiceInput;
    }
  }

  /**
   * Attaches an injected audio track (test-voice clip, microphone, or RTSP camera audio, per
   * {@link buildFfmpegAudioInputArgs}) to the peer connection by spawning ffmpeg to encode into it over a local
   * UDP/RTP loop, so an end-to-end audio path (e.g. an Intercom's "Listen" live view) can be verified without a
   * real microphone capture pipeline. Mirrors {@link generateVideoTrack}; only injects when
   * MATTERBRIDGE_CAMERA_AUDIO_SOURCE is `test`, `microphone`, or `rtsp`.
   *
   * @param {RTCRtpCodecParameters} codec - The negotiated Opus codec parameters to encode and send as.
   * @returns {Promise<void>} Resolves once the track is attached, or once injection is skipped/failed (logged, not thrown).
   */
  private async generateAudioTrack(codec: RTCRtpCodecParameters): Promise<void> {
    if (this.testAudioAttached) return;
    const audioSource = this.getConfiguredAudioSource();
    if (audioSource === 'none') {
      this.log.debug('Audio injection disabled by MATTERBRIDGE_CAMERA_AUDIO_SOURCE=none');
      return;
    }

    const audioInput = this.buildFfmpegAudioInputArgs(audioSource);
    this.log.debug(`Attempting to attach ${audioInput.description} audio track`);

    if (!hasFfmpeg()) {
      this.log.warn('Cannot inject audio stream: missing dependency ffmpeg');
      return;
    }

    const selectedMimeType = codec.mimeType.toLowerCase();
    const selectedPayloadType = codec.payloadType;
    const clockRate = codec.clockRate;
    const channels = codec.channels;
    try {
      const udpPort = await this.getFreeUdpPort();
      const { track, disposer } = navigator.mediaDevices.getUdpMedia({
        port: udpPort,
        codec: new RTCRtpCodecParameters({ mimeType: selectedMimeType, clockRate, channels, payloadType: selectedPayloadType }),
      });
      this.peerConnection.addTrack(track);

      const ffmpegArgs = [
        '-hide_banner',
        '-loglevel',
        'error',
        ...audioInput.args,
        '-vn',
        ...(audioInput.volumeFilter ? ['-af', audioInput.volumeFilter] : []),
        '-c:a',
        'libopus',
        '-b:a',
        '32k',
        '-ac',
        String(channels),
        '-ar',
        String(clockRate),
        '-f',
        'rtp',
        '-payload_type',
        String(selectedPayloadType),
        `rtp://127.0.0.1:${udpPort}`,
      ];
      const generator = runFfmpeg(ffmpegArgs);

      /* v8 ignore start -- requires the spawned ffmpeg process itself to fail after hasFfmpeg already verified
       * it runs (e.g. the binary is removed between the check and this spawn), which this harness can't simulate
       * without deleting real system binaries or mocking node:child_process. */
      generator.once('error', (error: unknown) => {
        this.log.warn(`Audio generator failed: ${getErrorMessage(error)}`);
      });
      /* v8 ignore stop */

      this.testAudioUdpDisposer = disposer;
      this.testAudioGenerator = generator;
      this.testAudioAttached = true;
      this.log.info(`Attached ${audioInput.description} audio track (codec=${selectedMimeType}, payloadType=${selectedPayloadType}, sourcePort=${udpPort})`);
      /* v8 ignore start -- requires a lower-level failure (UDP port allocation racing, werift/nonstandard media
       * internals throwing) that isn't practically triggerable in this harness without mocking werift internals. */
    } catch (error) {
      this.log.warn(`Failed to attach ${audioInput.description} audio track: ${getErrorMessage(error)}`);
    }
    /* v8 ignore stop */
  }

  /**
   * Kills the injected video track's ffmpeg process (if any) and disposes its UDP media resources.
   *
   * @returns {void}
   */
  private cleanupTestVideoArtifacts(): void {
    if (this.testVideoGenerator) {
      this.testVideoGenerator.kill('SIGTERM');
      this.testVideoGenerator = undefined;
    }
    this.testVideoUdpDisposer?.();
    this.testVideoUdpDisposer = undefined;
    this.testVideoAttached = false;
  }

  /**
   * Kills the injected audio track's ffmpeg process (if any) and disposes its UDP media resources.
   *
   * @returns {void}
   */
  private cleanupTestAudioArtifacts(): void {
    if (this.testAudioGenerator) {
      this.testAudioGenerator.kill('SIGTERM');
      this.testAudioGenerator = undefined;
    }
    this.testAudioUdpDisposer?.();
    this.testAudioUdpDisposer = undefined;
    this.testAudioAttached = false;
  }

  /**
   * Adds a sendonly transceiver for each requested media kind and creates a real local SDP offer.
   *
   * @param {WeriftOfferOptions} options - Which media kinds to add a sendonly transceiver for.
   * @returns {Promise<string>} The generated local SDP offer.
   */
  async createOffer(options: WeriftOfferOptions): Promise<string> {
    this.log.debug(`CreateOffer requested (video=${options.video}, audio=${options.audio}, videoResolution=${options.videoResolution ?? 'undefined'})`);
    if (options.video) {
      const preferredCodec = this.getPreferredInjectableVideoCodec();
      if (preferredCodec) {
        this.preferVideoCodecOnTransceivers(preferredCodec.mimeType.toLowerCase());
      } else {
        this.log.warn('No injectable video codec available on negotiated transceivers (supported: VP8, H264)');
      }
      await this.generateVideoTrack(preferredCodec, options.videoResolution);
      if (!this.testVideoAttached) this.peerConnection.addTransceiver('video', { direction: 'sendonly' });
    }
    if (options.audio) this.peerConnection.addTransceiver('audio', { direction: 'sendonly' });
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    // setLocalDescription gathers ICE candidates into the SDP it stores as localDescription; offer.sdp itself
    // predates that gathering, so localDescription (always set once setLocalDescription above resolves) is returned.
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const sdp = this.peerConnection.localDescription!.sdp;
    this.log.info(`Created local SDP offer (${this.summarizeSdp(sdp)})`);
    this.logDtlsTransportStateChanges();
    return sdp;
  }

  /**
   * Applies a remote SDP offer and creates a real local SDP answer for it.
   *
   * @param {string} offerSdp - The remote SDP offer to answer.
   * @param {string} [videoResolution] - Preferred webcam capture resolution for this session; see {@link WeriftOfferOptions.videoResolution}.
   * @returns {Promise<string>} The generated local SDP answer.
   */
  async createAnswer(offerSdp: string, videoResolution?: string): Promise<string> {
    this.log.debug(`CreateAnswer requested for remote offer (${this.summarizeSdp(offerSdp)}, videoResolution=${videoResolution ?? 'undefined'})`);
    await this.peerConnection.setRemoteDescription({ type: 'offer', sdp: offerSdp });
    const hasVideoTransceiver = this.peerConnection.getTransceivers().some((transceiver) => transceiver.kind === 'video');
    this.log.debug(`Remote offer created video transceiver: ${hasVideoTransceiver}`);
    if (hasVideoTransceiver) {
      const preferredCodec = this.getPreferredInjectableVideoCodec();
      /* v8 ignore start -- unreachable: this.peerConnection defaults to VP8 as its only local video codec (werift's
       * own RTCPeerConnection default), so any offer that negotiates a video transceiver at all always ends up with
       * VP8 available; there is no real-world remote offer that reaches this point without an injectable codec. */
      if (preferredCodec) {
        this.preferVideoCodecOnTransceivers(preferredCodec.mimeType.toLowerCase());
      } else {
        this.log.warn('No injectable video codec available on negotiated transceivers (supported: VP8, H264)');
      }
      /* v8 ignore stop */
      await this.generateVideoTrack(preferredCodec, videoResolution);
    }
    const hasAudioTransceiver = this.peerConnection.getTransceivers().some((transceiver) => transceiver.kind === 'audio');
    this.log.debug(`Remote offer created audio transceiver: ${hasAudioTransceiver}`);
    if (hasAudioTransceiver) {
      const preferredAudioCodec = this.getPreferredInjectableAudioCodec();
      if (preferredAudioCodec) {
        this.preferAudioCodecOnTransceivers(preferredAudioCodec.mimeType.toLowerCase());
        await this.generateAudioTrack(preferredAudioCodec);
      } else {
        this.log.warn('No injectable audio codec available on negotiated transceivers (supported: Opus)');
      }
    }
    // Transceivers werift auto-creates from the remote offer default to a direction that answers "inactive" with
    // port 0 when no local track is attached; a port-0 m-section is still listed in a=group:BUNDLE, which peers
    // (e.g. Firefox) reject as invalid. Answering "sendonly" keeps the m-section active even with no track yet.
    for (const transceiver of this.peerConnection.getTransceivers()) {
      transceiver.setDirection('sendonly');
    }
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    // See the matching comment in createOffer above: localDescription (not answer.sdp) carries the gathered candidates.
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const sdp = this.peerConnection.localDescription!.sdp;
    this.log.info(`Created local SDP answer (${this.summarizeSdp(sdp)})`);
    this.logDtlsTransportStateChanges();
    return sdp;
  }

  /**
   * Applies a remote SDP answer received in response to a local offer created by {@link createOffer}.
   *
   * @param {string} answerSdp - The remote SDP answer to apply.
   * @returns {Promise<void>} Resolves once the remote description has been applied.
   */
  async applyAnswer(answerSdp: string): Promise<void> {
    this.log.debug(`ApplyAnswer requested (${this.summarizeSdp(answerSdp)})`);
    await this.peerConnection.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    this.log.info(`Remote SDP answer applied (signalingState=${this.peerConnection.signalingState})`);
    this.logDtlsTransportStateChanges();
  }

  /**
   * Applies a remote ICE candidate gathered after the initial offer/answer exchange.
   *
   * @param {string} candidate - The RFC 8839 candidate-attribute field in string form.
   * @param {string | null} sdpMid - The media stream identification tag the candidate is associated with, or null.
   * @param {number | null} sdpMLineIndex - The zero-based media description index the candidate is associated with, or null.
   * @returns {Promise<void>} Resolves once the candidate has been applied.
   */
  async addIceCandidate(candidate: string, sdpMid: string | null, sdpMLineIndex: number | null): Promise<void> {
    this.log.debug(`Applying ICE candidate (mid=${sdpMid ?? 'null'}, mLine=${sdpMLineIndex ?? 'null'}, endOfCandidates=${candidate.trim() === ''})`);
    await this.peerConnection.addIceCandidate({ candidate, sdpMid: sdpMid ?? undefined, sdpMLineIndex: sdpMLineIndex ?? undefined });
  }

  /**
   * Set at the very start of {@link close}, before it awaits anything, so:
   * - a concurrent/duplicate call to {@link close} (e.g. from {@link logDtlsTransportStateChanges}'s own auto-close,
   *   or a second DTLS transport reaching `closed`/`failed`) is a no-op instead of doing the cleanup work twice.
   * - {@link logDtlsTransportStateChanges} can tell a DTLS transport reaching `closed` as a *side effect of our own*
   *   close() (every close — EndSession, closeAll(), this same auto-close — stops the DTLS transports, which
   *   triggers this same onStateChange) apart from one reaching `closed` on its own, unprompted, which is the real
   *   orphaned-session signal that should trigger an auto-close.
   */
  private closing = false;

  /**
   * Subscribes each of this session's DTLS transports' onStateChange event to a dedicated log line — rather than
   * relying only on the periodic {@link logDiagnosticsSnapshot} tick to notice a transition — and, once a transport
   * reaches `closed` or `failed`, closes this session. Safe to call more than once (e.g. after createOffer and again
   * after createAnswer) — already-subscribed transports are skipped via {@link dtlsTransportsWithStateLogging}.
   *
   * This matters because a DTLS transport reaching `closed`/`failed` looks like a real, one-way teardown signal from
   * the peer (see the `dtls.onClose`/`onError` handlers in werift/lib/webrtc/src/transport/dtls.js), unlike
   * iceConnectionState's `disconnected` (see {@link logDiagnosticsSnapshot}'s doc comment), which can latch on a
   * single missed keepalive on an otherwise healthy, actively-streaming session and must never trigger a close by
   * itself. Unlike iceConnectionState, peerConnection.connectionState never reflects a closed DTLS transport either,
   * so without this dedicated subscription an abandoned session (e.g. a controller that never sends EndSession)
   * would otherwise stay open — peer connection, ffmpeg generators and all — until the whole platform shuts down.
   *
   * @returns {void}
   */
  private logDtlsTransportStateChanges(): void {
    for (const transport of this.peerConnection.dtlsTransports) {
      if (this.dtlsTransportsWithStateLogging.has(transport)) continue;
      this.dtlsTransportsWithStateLogging.add(transport);
      transport.onStateChange.subscribe((state) => {
        this.log.info(`DTLS transport state: ${state}`);
        if ((state === 'closed' || state === 'failed') && !this.closing) {
          this.log.info(`Closing session ${this.webRtcSessionId}: DTLS transport reached ${state}`);
          fireAndForget(this.close(), this.log, `Failed to auto-close session ${this.webRtcSessionId} after DTLS transport reached ${state}`);
        }
      });
    }
  }

  /**
   * Logs a snapshot of every state this session's werift peer connection exposes: the aggregate connection and
   * signaling states, the per-transport ICE and DTLS states, and real packet-flow counters from getStats(). Purely
   * observational (see {@link diagnosticsInterval}) — nothing here reacts to the state, it just makes it visible in
   * the log so a controller-abandoned session (no EndSession ever sent) can be characterized before any auto-close
   * logic is designed.
   *
   * iceConnectionState/iceTransportStates alone are not a reliable liveness signal here: werift's RFC 7675
   * consent-check loop (see werift/lib/ice/src/ice.js's queryConsent) latches the ICE transport at `disconnected`
   * after a single missed keepalive and never retries, so a perfectly healthy, actively-streaming session can show
   * `disconnected` forever. The nominated candidate-pair and outbound-rtp packet counters below come from a
   * different code path (werift's ICE `CandidatePair`/RTP sender objects, incremented on every actual UDP
   * send/receive) and are unaffected by that bug, so their deltas are a genuine "is data still moving" signal.
   *
   * @returns {Promise<void>} Resolves once the snapshot has been logged.
   */
  private async logDiagnosticsSnapshot(): Promise<void> {
    const iceStates = this.peerConnection.iceTransports.map((transport) => transport.state).join(',') || 'none';
    const dtlsStates = this.peerConnection.dtlsTransports.map((transport) => transport.state).join(',') || 'none';

    const stats = [...(await this.peerConnection.getStats()).values()];
    // werift's RTCStats subtypes (RTCIceCandidatePairStats, RTCOutboundRtpStreamStats, ...) aren't combined into a
    // discriminated union in its type declarations, so narrowing past the `type` check still needs an assertion.
    // oxlint-disable typescript/no-unsafe-type-assertion
    const nominatedPair = stats
      .filter((stat) => stat.type === 'candidate-pair')
      .map((stat) => stat as RTCIceCandidatePairStats)
      .find((pair) => pair.nominated === true);
    const outboundRtp = stats.filter((stat) => stat.type === 'outbound-rtp').map((stat) => stat as RTCOutboundRtpStreamStats);
    // oxlint-enable typescript/no-unsafe-type-assertion

    const candidatePairPacketsSent = nominatedPair?.packetsSent ?? 0;
    const candidatePairPacketsReceived = nominatedPair?.packetsReceived ?? 0;
    const outboundRtpPacketsSent = outboundRtp.reduce((sum, stat) => sum + (stat.packetsSent ?? 0), 0);

    const previous = this.lastDiagnosticsCounters;
    this.lastDiagnosticsCounters = { candidatePairPacketsSent, candidatePairPacketsReceived, outboundRtpPacketsSent };

    const delta = (current: number, previousValue: number | undefined): string =>
      previousValue === undefined ? 'n/a' : `${current - previousValue >= 0 ? '+' : ''}${current - previousValue}`;
    const outboundRtpSummary = outboundRtp.map((stat) => `${stat.kind ?? 'unknown'}:packetsSent=${stat.packetsSent ?? 0}`).join(', ') || 'none';

    this.log.debug(
      [
        'Diagnostics:',
        `- connectionState=${this.peerConnection.connectionState}`,
        `- iceConnectionState=${this.peerConnection.iceConnectionState}`,
        `- iceGatheringState=${this.peerConnection.iceGatheringState}`,
        `- signalingState=${this.peerConnection.signalingState}`,
        `- iceTransportStates=[${iceStates}]`,
        `- dtlsTransportStates=[${dtlsStates}]`,
        `- nominatedPair(packetsSent=${candidatePairPacketsSent} Δ${delta(candidatePairPacketsSent, previous?.candidatePairPacketsSent)}, packetsReceived=${candidatePairPacketsReceived} Δ${delta(candidatePairPacketsReceived, previous?.candidatePairPacketsReceived)})`,
        `- outboundRtp[${outboundRtpSummary}] (totalPacketsSent Δ${delta(outboundRtpPacketsSent, previous?.outboundRtpPacketsSent)})`,
      ].join('\n'),
    );
  }

  /**
   * Closes the underlying peer connection. A no-op if this session is already closing/closed — see {@link closing}.
   *
   * @returns {Promise<void>} Resolves once the peer connection is closed.
   */
  async close(): Promise<void> {
    if (this.closing) return;
    this.closing = true;
    this.log.debug('Closing RTCPeerConnection');
    clearInterval(this.diagnosticsInterval);
    this.diagnosticsInterval = undefined;
    await this.peerConnection.close();
    this.cleanupTestVideoArtifacts();
    this.cleanupTestAudioArtifacts();
    WeriftWebRtcSession.activeSessions.delete(this);
    this.log.info(`RTCPeerConnection closed (connectionState=${this.peerConnection.connectionState})`);
  }

  /**
   * Closes every currently active session, e.g. during a graceful platform shutdown.
   *
   * @returns {Promise<void>} Resolves once every active session has been closed.
   */
  static async closeAll(): Promise<void> {
    for (const session of WeriftWebRtcSession.activeSessions) {
      session.log.info(`Closing session ${session.webRtcSessionId} as part of closeAll()`);
      await session.close();
    }
  }
}
