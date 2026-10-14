# <img src="https://matterbridge.io/assets/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge WebRTC (werift) networking

Matterbridge cameras (Camera, Doorbell, Intercom and the [matterbridge-camera](https://github.com/Luligu/matterbridge-camera) and [matterbridge-webcam](https://github.com/Luligu/matterbridge-webcam) plugins) stream video and audio over WebRTC with [werift](https://github.com/shinyoshiaki/werift-webrtc). This page explains why a stream can stay black when Matterbridge runs in a container and the viewer is a browser, and how to fix it.

## Who talks to whom

When you open a Matter camera in Home Assistant or in the OHF Matter Server (matterjs-server) dashboard, the WebRTC peer is **the browser**, not the Matter Server:

```text
Browser (Safari / Chrome / Edge / Firefox)
   │  SDP offer/answer + ICE candidates (signaling only)
   ▼
OHF Matter Server ──Matter WebRtcTransportProvider / Requestor──► Matterbridge camera (werift)
   ▲                                                                       │
   └──────────── media: direct UDP between browser and Matterbridge ◄──────┘
```

The Matter Server only relays the signaling. The video and audio flow directly between the browser and Matterbridge over UDP, so the **browser** and **Matterbridge** must be able to reach each other, in both directions.

## Symptoms

The camera answers the offer, but the stream never starts. In the Matterbridge log (debug level):

- `ICE connection state: checking` never moves to `connected`.
- `Diagnostics:` shows `dtlsTransportStates=[new]` and `outboundRtp[video:packetsSent=0, audio:packetsSent=0]`.
- Every remote candidate fails with `failed ICE candidate n/m ... timed out applying an ICE candidate after 5000ms`.

## Cause 1: the browser hides its address behind an mDNS `.local` name

To protect privacy, browsers replace their real LAN address in ICE host candidates with a random `<uuid>.local` name, for example:

```text
candidate:2844074272 1 udp 2113937151 dacfb37f-7d92-4462-9c7c-3d430ca8ca94.local 62365 typ host
```

werift resolves that name with a real multicast DNS query. Docker Desktop (macOS and Windows) runs containers inside a VM and does not forward multicast between the container network and the host, so the query never reaches the browser and each candidate times out after 5 seconds (`ICE_CANDIDATE_APPLY_TIMEOUT_MS` in `packages/core/src/behaviors/webRtcTransportProviderServer.ts`).

Candidates are applied concurrently and `provideIceCandidates` answers the controller without waiting for them, so these timeouts only add log noise. They are harmless as long as the browser can reach Matterbridge (see cause 2): werift then learns the browser's real address from the incoming connectivity checks (peer-reflexive candidate).

The obfuscation can be turned off in some browsers only:

| Browser                  | Hides the address by default | How to disable it                                                                                                                                                |
| ------------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chrome (macOS, Windows)  | Yes                          | `chrome://flags/#enable-webrtc-hide-local-ips-with-mdns` → **Anonymize local IPs exposed by WebRTC** = **Disabled**, then relaunch                               |
| Edge (macOS, Windows)    | Yes                          | `edge://flags/#enable-webrtc-hide-local-ips-with-mdns` → **Anonymize local IPs exposed by WebRTC** = **Disabled**, then relaunch                                 |
| Firefox (macOS, Windows) | Yes (since Firefox 74)       | `about:config` → `media.peerconnection.ice.obfuscate_host_addresses` = `false`, or add the site to `media.peerconnection.ice.obfuscate_host_addresses.blocklist` |
| Safari (macOS)           | Yes                          | No setting in current Safari: the old Develop → WebRTC → **Disable ICE Candidate Restrictions** item and the mDNS feature flag have been removed                 |

Notes:

- The browsers keep the real address for a page that was granted camera or microphone access with `getUserMedia()`. A camera viewer only receives media and never asks for the camera, so allowing camera/microphone for the site in the browser settings does not help.
- Firefox can also advertise only an IPv6 link-local address (`fe80::…`) when the page is not a secure context (plain `http://` from a host other than `localhost`), even with the obfuscation disabled. Serve the page over HTTPS or open it via `localhost`. Check `window.isSecureContext` in the devtools, or the gathered candidates in `about:webrtc`.
- Chrome and Edge were not affected by the link-local issue under the same conditions.

## Cause 2: the browser cannot reach Matterbridge in the container

On a Docker bridge network Matterbridge only knows its container addresses, for example:

```text
candidate:… 1 udp 2116026367 172.30.1.2 53963 typ host
candidate:… 1 udp 2116026367 fddd:3fa2:5acd:d100::2 44680 typ host
candidate:… 1 udp 1679818751 92.107.71.137 47166 typ srflx raddr 172.30.1.2 rport 53963
```

None of these is reachable from the browser: the container addresses are not routable from the host, and no UDP port is published for the public (srflx) address. ICE uses a random UDP port per session, so it cannot be published ahead of time.

Whether this blocks the stream depends on the browser (cause 1):

- **The browser sends its real address** (Chrome, Edge or Firefox with the obfuscation disabled): it works without any override. Matterbridge sends its connectivity checks to the browser's real address through the Docker outbound NAT, and the browser's replies come back the same way. Tested with Firefox and Docker Desktop on macOS, with the log showing `Selected ICE candidate pair: local=172.30.1.5:41366 (host/udp) remote=192.168.1.141:56668 (host/UDP)`.
- **The browser hides its address** (Safari, or any browser with the default settings): neither side has a reachable address for the other, and ICE stays in `checking`. The overrides below are required.

The overrides work with every browser and default settings, so they are the recommended setup for a container. They are two environment variables read by `WeriftWebRtcSession` (`packages/core/src/behaviors/weriftSession.ts`):

| Variable                          | Example         | Effect                                                                                                                                         |
| --------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `MATTERBRIDGE_ICE_PORT_RANGE`     | `50000-50010`   | Binds ICE to this fixed UDP port range (`min-max`, min ≥ 1024, max ≤ 65535, min < max) so it can be published. A malformed value is ignored.   |
| `MATTERBRIDGE_ICE_HOST_ADDRESSES` | `192.168.1.141` | Comma-separated extra addresses advertised as ICE host candidates. Use the LAN address of the Docker host, which forwards the published ports. |

Publish the same port range as UDP. With `docker run`:

```bash
docker run ... \
  -e MATTERBRIDGE_ICE_PORT_RANGE=50000-50010 \
  -e MATTERBRIDGE_ICE_HOST_ADDRESSES=192.168.1.141 \
  -p 50000-50010:50000-50010/udp \
  luligu/matterbridge:latest
```

With Docker Compose:

```yaml
services:
  matterbridge:
    environment:
      - MATTERBRIDGE_ICE_PORT_RANGE=50000-50010
      - MATTERBRIDGE_ICE_HOST_ADDRESSES=192.168.1.141
    ports:
      - '50000-50010:50000-50010/udp'
```

In a dev container (`.devcontainer/*/devcontainer.json`), add the two variables to `containerEnv` and `"--publish", "50000-50010:50000-50010/udp"` to `runArgs`, then rebuild the container (published ports cannot be added to a running container). `MATTERBRIDGE_ICE_HOST_ADDRESSES` can default to the host address and be overridden from the host environment: `"${localEnv:MATTERBRIDGE_ICE_HOST_ADDRESSES:192.168.1.141}"`.

Each concurrent WebRTC session uses one port of the range, so size it for the number of streams you expect. If the Docker host gets a new LAN address, update `MATTERBRIDGE_ICE_HOST_ADDRESSES` and recreate the container.

When the overrides are active, the log shows at debug level:

```text
[WebRTC session 0] ICE overrides: portRange=50000-50010 additionalHostAddresses=192.168.1.141
```

and the advertised candidates include the host address on a port of the range:

```text
candidate:… 1 udp 2116026367 192.168.1.141 50000 typ host
```

With network mode `host` on Linux (Docker Engine), Matterbridge already sees the LAN address and none of this is needed.

## Cause 3: Docker Desktop "kernel networking for UDP"

Docker Desktop (macOS) has an option to use kernel networking for UDP (`KernelForUDP` in its settings). With it enabled, UDP packets arriving on a published port were seen inside the container with an unrelated public source address, so werift's replies never got back to the browser and ICE stayed in `checking` even with the overrides above.

Disable it in Docker Desktop → **Settings** → **Resources** → **Network**, apply and restart Docker Desktop. Incoming packets then show the Docker network gateway as source (for example `172.30.1.1`) and the replies are delivered.

To check the UDP path on its own, run a small UDP echo on a free port of the range inside the container, send a datagram from the host to `<host LAN address>:<port>`, and verify that the reply comes back.

## Stream resolution and stream allocation

In Matter a controller chooses the stream resolution and bitrate when it allocates a video stream with `CameraAvStreamManagement.VideoStreamAllocate` (`MinResolution`/`MaxResolution`, `MinBitRate`/`MaxBitRate`). `SolicitOffer`/`ProvideOffer` carry no resolution: they only reference allocated streams (`VideoStreams`). A snapshot is different: `CaptureSnapshot` carries its own `RequestedResolution`.

For each WebRTC session, Matterbridge resolves the video resolution in this order:

1. A fixed `videoResolution` in the plugin config (`640x480`, `1280x720` or `1920x1080`).
2. With `auto`, the `MaxResolution` of the allocated video stream referenced by the offer.
3. Otherwise `640x480`.

It applies to every video source (`test`, `webcam` and `rtsp`). The encoder bitrate always comes from `videoBitrate` in the plugin config (default 1000 kbps), not from the allocated stream. Snapshots always use the `RequestedResolution` of `CaptureSnapshot`.

At startup Matterbridge allocates a default video, audio and snapshot stream (id 0) for a camera that has none, at its largest supported resolution (for example 1920x1080), because some controllers never allocate streams. The allocated streams are persisted, so they are restored at the next start.

Observed with the OHF Matter Server: it never sends `VideoStreamAllocate`, and every `ProvideOffer` references video stream 0, even when no stream 0 exists. Its quality selection (for example 1280) only reaches `CaptureSnapshot`. The stream therefore uses stream 0 (1920x1080 with the default stream, 640x480 without it), and a fixed `videoResolution` in the plugin config is the only way to choose the stream resolution with this controller.

Two environment variables control this behavior, mainly for testing:

| Variable                                                      | Value | Effect                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MATTERBRIDGE_SKIP_AUTO_ALLOCATE_CAMERA_AV_STREAM_MANAGEMENT` | `1`   | Skips the default stream allocation at startup. Streams already persisted are still restored, so to start without a video stream the persisted `allocatedVideoStreams` entry must be removed from the storage (or deallocated by the controller).                                                                                                                                                                                                                       |
| `MATTERBRIDGE_STRICT_WEBRTCTRANSPORT`                         | `1`   | Strict spec conformance for `SolicitOffer`/`ProvideOffer`, for the CHIP WebRTC Transport Provider tests (`TC_WEBRTCP_2_*`): a request without stream fields is rejected with `InvalidCommand`, and a stream id that is not allocated is rejected (`InvalidInState` when none is allocated, `DynamicConstraintError` for an unknown id). By default these requests are accepted with automatic stream selection, for compatibility with controllers that never allocate. |

Do not set `MATTERBRIDGE_STRICT_WEBRTCTRANSPORT` with a controller like the OHF Matter Server: its offers reference a stream it never allocated and would be rejected.

## Checklist

1. `MATTERBRIDGE_ICE_PORT_RANGE` and `MATTERBRIDGE_ICE_HOST_ADDRESSES` are set, and the log shows the `ICE overrides` line.
2. The same port range is published as UDP on the container.
3. On Docker Desktop, kernel networking for UDP is disabled.
4. Optional: disable the browser's mDNS obfuscation (Chrome, Edge, Firefox) to remove the `timed out applying an ICE candidate` warnings. With the obfuscation disabled that browser also works without the overrides.
5. With Firefox, the page is a secure context (HTTPS or `localhost`).
6. ffmpeg is installed in the container. A rebuilt dev container starts without it: the session connects, but the log shows `Cannot inject video stream: missing dependency ffmpeg` and `outboundRtp` stays at `packetsSent=0`.

A working session logs `ICE connection state: connected`, `Peer connection state: connected`, `dtlsTransportStates=[connected]` and growing `outboundRtp` packet counters.
