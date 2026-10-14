# WebRTC media with werift

The camera device types (Camera, Floodlight Camera, Video Doorbell, Intercom, Audio Doorbell) stream their media over
WebRTC. Matterbridge uses [werift](https://github.com/shinyoshiaki/werift-webrtc) as the WebRTC stack and `ffmpeg` to
produce the media itself. This page explains how a session is established and what has to be true on your network for
it to work.

## Signalling and media take different paths

This is the single most important thing to understand, and the reason a camera can be perfectly commissioned and still
show no picture.

```
  SIGNALLING (Matter, TCP)                       MEDIA (WebRTC, UDP)

  Controller                                     Controller
      |  SDP offer                                   ^
      v                                              |
  WebRtcTransportProvider.ProvideOffer               |  ICE / DTLS / RTP
      |                                              |  flows DIRECTLY
      v                                              |
  Matterbridge (werift)  -- SDP answer -->       Matterbridge (werift)
```

- The **controller** creates the `RTCPeerConnection` and the SDP offer. Matterbridge has no control over it.
- **Matter carries only the signalling** — the offer and the answer. It is a courier and nothing more.
- The **media never travels over Matter.** Once the SDP exchange is done, the controller and werift talk to each other
  directly over UDP.

So Matter working proves nothing about whether media will work. They are separate network problems.

### What is at the other end

The remote WebRTC peer is whatever the controller runs on, and that is usually **not** a browser:

- **Apple Home, Google Home, Alexa, SmartThings, Home Assistant** — the peer is the hub, phone or app itself. There is
  no browser anywhere in the picture.
- **The matter.js server** (OHF Matter Server) is the exception: it ships a **browser UI**, so there the peer is the
  browser (Edge, Chrome, Firefox, Safari) on whatever machine has the page open — which may be a completely different
  machine from the matter.js server.

This matters when you are working out what has to reach what. With a hub controller you need Matterbridge reachable
from the hub; with the matter.js browser UI you need it reachable from the machine running the browser, and the
matter.js server's own address is irrelevant to the media path.

## What has to be true

ICE has to find one candidate pair where each side can reach the other. Each side offers the addresses it knows about,
and they probe every combination. If no pair is mutually routable, the connection stalls forever in `checking`.

On a flat home network this is invisible, because it always succeeds. Matterbridge is on the LAN, the controller is on
the same LAN, and the pair `192.168.1.x <-> 192.168.1.y` works on the first try.

It stops being invisible when Matterbridge runs somewhere the peer cannot reach directly:

- Matterbridge in a **Docker bridge network**, peer on the host or elsewhere on the LAN. Matterbridge only knows its
  private address (e.g. `172.18.0.5`), which nothing outside the bridge can route to.
- Matterbridge in a **dev container or VM**, peer on the host OS.
- Peer and Matterbridge on **different subnets**, or separated by client isolation on a guest/managed Wi-Fi.

In all of these the SDP exchange succeeds, both sides think a session started, and no packet ever arrives.

## Browser peers hide their address

To protect privacy, browsers replace their real LAN address in ICE host candidates with a random `<uuid>.local` mDNS
name, for example:

```
candidate:2844074272 1 udp 2113937151 dacfb37f-7d92-4462-9c7c-3d430ca8ca94.local 62365 typ host
```

werift resolves that name with a real multicast DNS query. Docker Desktop (macOS and Windows) runs containers inside a
VM and does not forward multicast between the container network and the host, so the query never reaches the browser
and each candidate times out after 5 seconds (`ICE_CANDIDATE_APPLY_TIMEOUT_MS` in `webRtcTransportProviderServer.ts`):

```
failed ICE candidate 1/8 for session 0 after 5002ms with Error: ... timed out applying an ICE candidate after 5000ms
```

Candidates are applied concurrently and `provideIceCandidates` answers the controller without waiting for them, so these
timeouts only add log noise. What matters is which direction can still work:

- **The browser sends its real address**: Matterbridge reaches the browser through the Docker outbound NAT, the replies
  come back the same way, and the session connects without any configuration. Tested with Firefox and Docker Desktop on
  macOS: `Selected ICE candidate pair: local=172.30.1.5:41366 (host/udp) remote=192.168.1.141:56668 (host/UDP)`.
- **The browser hides its address**: only the browser-to-Matterbridge direction is left, so Matterbridge has to
  advertise a candidate the browser can reach — see [Making Matterbridge reachable](#making-matterbridge-reachable).
  werift then learns the browser's real address from its incoming connectivity checks (peer-reflexive candidate).

The obfuscation can be turned off in some browsers only:

| Browser                  | Hides the address by default | How to disable it                                                                                                                                                |
| ------------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chrome (macOS, Windows)  | Yes                          | `chrome://flags/#enable-webrtc-hide-local-ips-with-mdns` → **Anonymize local IPs exposed by WebRTC** = **Disabled**, then relaunch                               |
| Edge (macOS, Windows)    | Yes                          | `edge://flags/#enable-webrtc-hide-local-ips-with-mdns` → **Anonymize local IPs exposed by WebRTC** = **Disabled**, then relaunch                                 |
| Firefox (macOS, Windows) | Yes (since Firefox 74)       | `about:config` → `media.peerconnection.ice.obfuscate_host_addresses` = `false`, or add the site to `media.peerconnection.ice.obfuscate_host_addresses.blocklist` |
| Safari (macOS)           | Yes                          | No setting in current Safari: the old Develop → WebRTC → **Disable ICE Candidate Restrictions** item and the mDNS feature flag have been removed                 |

Notes:

- The browsers keep the real address for a page that was granted camera or microphone access with `getUserMedia()`. A
  camera viewer only receives media and never asks for the camera, so allowing camera/microphone for the site in the
  browser settings does not help.
- Firefox can also advertise only an IPv6 link-local address (`fe80::…`) when the page is not a secure context (plain
  `http://` from a host other than `localhost`), even with the obfuscation disabled. Serve the page over HTTPS or open
  it via `localhost`. Check `window.isSecureContext` in the devtools, or the gathered candidates in `about:webrtc`.
  Chrome and Edge were not affected under the same conditions.

The ICE variables below work with every browser and its default settings, so they are the recommended setup for a
container; disabling the obfuscation only removes the timeout warnings.

## Reading the log

Set the log level to debug. Every session logs a diagnostics snapshot every 10 seconds.

Working:

```
Selected ICE candidate pair: local=... remote=...
- iceConnectionState=connected
- dtlsTransportStates=[connected]
- outboundRtp[video:packetsSent=620, audio:packetsSent=970] (totalPacketsSent Δ+823)
```

No routable candidate pair — the network problem described above:

```
- iceConnectionState=checking          <- never leaves "checking"
- dtlsTransportStates=[new]            <- DTLS never starts
- nominatedPair(packetsSent=0, packetsReceived=0)
- outboundRtp[video:packetsSent=0, audio:packetsSent=0]
```

Connected, but no media — this is not a network problem, it is a missing encoder:

```
Cannot inject video stream: missing dependency ffmpeg
- iceConnectionState=connected
- outboundRtp[video:packetsSent=0, audio:packetsSent=0]
```

Also worth checking the gathered candidates. If every `Gathered local ICE candidate` line shows an address the peer
cannot reach, that is the whole problem:

```
Gathered local ICE candidate: candidate:... 172.18.0.5 51001 typ host
```

## Making Matterbridge reachable

Two environment variables let a session advertise a candidate a remote peer can actually route to. Both are optional
and both fall back to werift's defaults, so a flat home network needs neither.

| Variable                          | Example          | Purpose                                                                                                                                                                                            |
| --------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MATTERBRIDGE_ICE_PORT_RANGE`     | `51000-51010`    | Pins ICE to a fixed local UDP range instead of an ephemeral port, so a container runtime can publish it. Ignored if malformed, out of range, or if min is not lower than max.                      |
| `MATTERBRIDGE_ICE_HOST_ADDRESSES` | `172.27.167.141` | Comma-separated extra addresses advertised as ICE host candidates. Use the address the peer reaches your host on. Advertised only, never bound, so an address that does not exist locally is fine. |

For Docker, pin the range, publish it as UDP, and advertise the host address:

```yaml
environment:
  MATTERBRIDGE_ICE_PORT_RANGE: '51000-51010'
  MATTERBRIDGE_ICE_HOST_ADDRESSES: '192.168.1.50' # the Docker host, as the peer sees it
ports:
  - '51000-51010:51000-51010/udp'
```

The published port range and `MATTERBRIDGE_ICE_PORT_RANGE` must always match. Each session opens one UDP socket per
gathered address (every local interface plus each advertised address) and each takes its own port of the range, e.g.
`192.168.1.50:51000`, `172.30.1.2:51001` and an IPv6 address on `51002`. Size the range for that many ports per
concurrent stream. If the Docker host gets a new LAN address, update
`MATTERBRIDGE_ICE_HOST_ADDRESSES` and recreate the container.

In a dev container (`.devcontainer/*/devcontainer.json`), add the two variables to `containerEnv` and
`"--publish", "51000-51010:51000-51010/udp"` to `runArgs`, then rebuild the container: published ports cannot be added
to a running container. The address can default to the host and be overridden from the host environment with
`"${localEnv:MATTERBRIDGE_ICE_HOST_ADDRESSES:192.168.1.50}"`.

When the variables are active, every session logs them, and the advertised candidates include the host address on a
port of the range:

```
ICE overrides: portRange=51000-51010 additionalHostAddresses=192.168.1.50
Gathered local ICE candidate: candidate:... 192.168.1.50 51000 typ host
```

Do not be surprised if the selected pair shows a `prflx` (peer-reflexive) remote candidate on an address the peer
never advertised. Docker's UDP proxy rewrites the source address, ICE discovers the rewritten one during its
connectivity checks, and uses it. That is normal and the connection is fine.

Running the container with `--network=host` also solves it, and needs no variables at all — but it drops the container
off any user-defined Docker network, so containers that reached each other by name (Home Assistant, a matter.js server)
no longer can. Prefer the variables when that matters.

### Docker Desktop: kernel networking for UDP

Docker Desktop on macOS has an option to use kernel networking for UDP (`KernelForUDP` in its settings). With it
enabled, UDP packets arriving on a published port were seen inside the container with an unrelated public source
address, so werift's replies never reached the peer and ICE stayed in `checking` even with the variables above.

Disable it in Docker Desktop → **Settings** → **Resources** → **Network**, apply and restart Docker Desktop. Incoming
packets then show the Docker network gateway as source (for example `172.30.1.1`) and the replies are delivered.

To check the UDP path on its own, run a small UDP echo on a free port of the range inside the container, send a datagram
from the host to `<host address>:<port>`, and verify that the reply comes back.

### Firewalls

The pinned UDP range has to be open inbound on the host. A blocked range looks exactly like having no routable
candidate: connectivity checks leave, nothing comes back, and ICE sits in `checking`.

Firewalls matter more here than they first appear, because ICE succeeds as soon as **either** side can reach the other.
On a permissive network the Matterbridge-to-peer direction often works on its own, and no configuration is needed at
all. Tighten the firewall and that direction disappears, leaving only peer-to-Matterbridge — which is precisely the
direction that needs a reachable advertised candidate.

That is why an unchanged setup can stream perfectly on one network and stall forever on another.

**Do not rule out a firewall just because everything else works.** A stateful firewall does not block "UDP" — it blocks
traffic that arrives _unsolicited_, and permits anything that matches a flow the host itself opened. Almost everything
Matterbridge does is outbound-initiated: STUN lookups, Matter commissioning, npm, the frontend on port 8283. All of
them keep working perfectly while unsolicited inbound is blocked outright.

A successful STUN lookup is the most misleading of these. It proves the host can reach the internet and receive the
reply on the flow it just opened. It says nothing at all about whether the remote peer can reach the host. The same
packet is treated differently depending on who is at the far end:

```
STUN request     host --> [firewall routes it out] --> STUN server     outbound, state created  -> reply allowed
ICE check in     peer --> [firewall IS the destination] --> local app  unsolicited inbound      -> dropped
```

So if media stalls in `checking` while every other feature is healthy, that pattern is evidence _for_ a firewall, not
against one.

### Windows network profile

On Windows this is usually the **network profile**. A **Private** network allows inbound connections from local
subnets; a **Public** one blocks them. Open and guest Wi-Fi — hotels, cafés, offices, managed or shared-building
networks — is classified Public. Recent WSL releases also apply Windows Firewall policy to WSL traffic, so this reaches
containers running inside WSL, not just processes on Windows itself.

```powershell
Get-NetConnectionProfile | Select-Object InterfaceAlias, NetworkCategory
```

Do **not** reclassify an untrusted network as Private to work around this. That exposes the machine's inbound services
to everyone else on the network, which on shared or open Wi-Fi is a genuine risk. Set the two ICE variables instead:
they rely only on the outbound direction, which stays allowed under Public.

## Stream resolution and stream allocation

In Matter a controller chooses the stream resolution and bitrate when it allocates a video stream with
`CameraAvStreamManagement.VideoStreamAllocate` (`MinResolution`/`MaxResolution`, `MinBitRate`/`MaxBitRate`).
`SolicitOffer`/`ProvideOffer` carry no resolution: they only reference allocated streams (`VideoStreams`). A snapshot is
different: `CaptureSnapshot` carries its own `RequestedResolution`.

For each WebRTC session, Matterbridge resolves the video resolution in this order:

1. A fixed `weriftOfferOptions.videoResolution` set by the plugin (`640x480`, `1280x720` or `1920x1080`).
2. When the plugin leaves it unset, the `MaxResolution` of the allocated video stream referenced by the offer. The
   matterbridge-camera and matterbridge-webcam plugins leave it unset for their `auto` setting; a literal `'auto'`
   value skips the allocated stream and falls to step 3.
3. Otherwise `640x480`. A resolution other than the three supported ones also falls back to `640x480`, with a warning.

It applies to every video source (`test`, `webcam` and `rtsp`). The encoder bitrate always comes from
`weriftOfferOptions.videoBitrate` (the plugin `videoBitrate` setting, default 1000 kbps), not from the allocated stream.
Snapshots use the `RequestedResolution` of `CaptureSnapshot`, downgraded if needed to keep the JPEG within 64000 bytes.

At startup Matterbridge allocates a default video, audio and snapshot stream (id 0) for a camera that has none, at its
largest supported resolution (for example 1920x1080), because some controllers never allocate streams. The allocated
streams are persisted, so they are restored at the next start.

Observed with the matter.js server (OHF Matter Server): it never sends `VideoStreamAllocate`, and every `ProvideOffer`
references video stream 0, even when no stream 0 exists. Its quality selection (for example 1280) only reaches
`CaptureSnapshot`. The stream therefore uses stream 0 (1920x1080 with the default stream, 640x480 without it), and a
fixed `videoResolution` in the plugin config is the only way to choose the stream resolution with this controller.

Two environment variables control this behavior, mainly for testing:

| Variable                                                      | Value | Effect                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MATTERBRIDGE_SKIP_AUTO_ALLOCATE_CAMERA_AV_STREAM_MANAGEMENT` | `1`   | Skips the default stream allocation at startup. Streams already persisted are still restored, so to start without a video stream the persisted `allocatedVideoStreams` entry must be removed from the storage (or deallocated by the controller).                                                                                                                                                                                                                       |
| `MATTERBRIDGE_STRICT_WEBRTCTRANSPORT`                         | `1`   | Strict spec conformance for `SolicitOffer`/`ProvideOffer`, for the CHIP WebRTC Transport Provider tests (`TC_WEBRTCP_2_*`): a request without stream fields is rejected with `InvalidCommand`, and a stream id that is not allocated is rejected (`InvalidInState` when none is allocated, `DynamicConstraintError` for an unknown id). By default these requests are accepted with automatic stream selection, for compatibility with controllers that never allocate. |

Do not set `MATTERBRIDGE_STRICT_WEBRTCTRANSPORT` with a controller like the matter.js server: its offers reference a
stream it never allocated and would be rejected.

## Test video source

The `test` video source streams an ffmpeg synthetic moving test pattern (`testsrc`), so a camera can be validated end to
end without a real capture device; the `test` audio source (`audioSource: test`) adds a 440 Hz test tone. The video
follows `videoResolution` and `videoBitrate` like the other sources.

Its frame rate defaults to 30 fps and can be changed with `MATTERBRIDGE_TEST_VIDEO_FPS` (an integer from 1 to 60; an
invalid value is ignored with a warning). The encoder sends a keyframe every 2 seconds (`-g` = 2 × fps), so the stream
starts and recovers from packet loss at the same pace at any frame rate. The `webcam` source captures at 30 fps and the
`rtsp` source keeps the camera frame rate; both send a keyframe every 20 frames.

The debug log shows the values in use:

```
Test pattern params: resolution=1920x1080, fps=30, description="synthetic moving test pattern (1920x1080, 30fps)", bitrateKbps=1000
```

## ffmpeg

`ffmpeg` is searched on `PATH`, then in `/usr/bin`, `/bin` and `/usr/local/bin`, and on Windows in the winget
(`%LOCALAPPDATA%\Microsoft\WinGet\Packages`) and `%ProgramFiles%` / `%ProgramFiles(x86)%` install folders. It is
resolved **once, on first use**, and the result is kept for the life of the process: if you install it by hand while
Matterbridge is running, restart Matterbridge before trying again. Installing it with the plugin's install action
(`installFfmpeg()`) resolves it again without a restart. Without it a session negotiates and connects
normally and then sends no RTP, logging `Cannot inject video stream: missing dependency ffmpeg`. A rebuilt container
starts from its image, so an ffmpeg installed by hand in the previous container is gone.

## Environment variables

All the environment variables of the Matterbridge camera and WebRTC implementation:

| Variable                                                      | Default            | Section                                                                             | Effect                                                                                   |
| ------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `MATTERBRIDGE_ICE_PORT_RANGE`                                 | random port        | [Making Matterbridge reachable](#making-matterbridge-reachable)                     | Fixed UDP port range for ICE, e.g. `51000-51010`, to publish from a container.           |
| `MATTERBRIDGE_ICE_HOST_ADDRESSES`                             | none               | [Making Matterbridge reachable](#making-matterbridge-reachable)                     | Extra ICE host candidate addresses, e.g. the Docker host address.                        |
| `MATTERBRIDGE_TEST_VIDEO_FPS`                                 | `30`               | [Test video source](#test-video-source)                                             | Frame rate of the `test` video source, 1 to 60.                                          |
| `MATTERBRIDGE_SKIP_AUTO_ALLOCATE_CAMERA_AV_STREAM_MANAGEMENT` | unset (allocate)   | [Stream resolution and stream allocation](#stream-resolution-and-stream-allocation) | `1` skips the default video, audio and snapshot stream allocation at startup.            |
| `MATTERBRIDGE_STRICT_WEBRTCTRANSPORT`                         | unset (compatible) | [Stream resolution and stream allocation](#stream-resolution-and-stream-allocation) | `1` enables strict spec conformance for `SolicitOffer`/`ProvideOffer` (CHIP tests only). |

## Diagnosing from scratch

1. Is `ffmpeg` on `PATH`? If not, install it and restart Matterbridge.
2. Does the log reach `iceConnectionState=connected`? If not, it is a routing problem — go to step 3. If yes and
   `packetsSent` stays 0, it is ffmpeg.
3. Look at the `Gathered local ICE candidate` lines. Can the peer's machine reach any of those addresses? Try to ping
   one from it. Remember the peer is the hub or app running the controller, or the machine with the matter.js browser
   UI open — not necessarily the matter.js server itself.
4. If not, set `MATTERBRIDGE_ICE_PORT_RANGE` and `MATTERBRIDGE_ICE_HOST_ADDRESSES`, publish the range as UDP, and
   restart. Check that the log shows the `ICE overrides` line.
5. Still stuck in `checking` with a correct-looking candidate? A firewall is dropping the range. On Windows, check the
   network profile first — Public blocks the inbound direction that a permissive network let through. On Docker Desktop
   for macOS, disable kernel networking for UDP.
6. Every remote candidate fails with `timed out applying an ICE candidate`? The peer is a browser hiding its address
   behind `.local` names: harmless once step 4 is done, or disable the obfuscation in the browser.
