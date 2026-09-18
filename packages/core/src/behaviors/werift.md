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
- **The matter.js server** is the exception: it ships a **browser UI**, so there the peer is the browser (Edge, Chrome)
  on whatever machine has the page open — which may be a completely different machine from the matter.js server.

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
| `MATTERBRIDGE_ICE_PORT_RANGE`     | `51000-51010`    | Pins ICE to a fixed local UDP range instead of an ephemeral port, so a container runtime can publish it. Ignored if malformed, out of range, or if the bounds are equal.                           |
| `MATTERBRIDGE_ICE_HOST_ADDRESSES` | `172.27.167.141` | Comma-separated extra addresses advertised as ICE host candidates. Use the address the peer reaches your host on. Advertised only, never bound, so an address that does not exist locally is fine. |

For Docker, pin the range, publish it as UDP, and advertise the host address:

```yaml
environment:
  MATTERBRIDGE_ICE_PORT_RANGE: '51000-51010'
  MATTERBRIDGE_ICE_HOST_ADDRESSES: '192.168.1.50' # the Docker host, as the peer sees it
ports:
  - '51000-51010:51000-51010/udp'
```

The published port range and `MATTERBRIDGE_ICE_PORT_RANGE` must always match.

Do not be surprised if the selected pair shows a `prflx` (peer-reflexive) remote candidate on an address the peer
never advertised. Docker's UDP proxy rewrites the source address, ICE discovers the rewritten one during its
connectivity checks, and uses it. That is normal and the connection is fine.

Running the container with `--network=host` also solves it, and needs no variables at all — but it drops the container
off any user-defined Docker network, so containers that reached each other by name (Home Assistant, a matter.js server)
no longer can. Prefer the variables when that matters.

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

## ffmpeg

`ffmpeg` must be on `PATH`. It is resolved **once at module load**, so if you install it while Matterbridge is running,
restart Matterbridge before trying again. Without it a session negotiates and connects normally and then sends no RTP,
logging `Cannot inject video stream: missing dependency ffmpeg`.

## Diagnosing from scratch

1. Is `ffmpeg` on `PATH`? If not, install it and restart Matterbridge.
2. Does the log reach `iceConnectionState=connected`? If not, it is a routing problem — go to step 3. If yes and
   `packetsSent` stays 0, it is ffmpeg.
3. Look at the `Gathered local ICE candidate` lines. Can the peer's machine reach any of those addresses? Try to ping
   one from it. Remember the peer is the hub or app running the controller, or the machine with the matter.js browser
   UI open — not necessarily the matter.js server itself.
4. If not, set `MATTERBRIDGE_ICE_PORT_RANGE` and `MATTERBRIDGE_ICE_HOST_ADDRESSES`, publish the range as UDP, and
   restart.
5. Still stuck in `checking` with a correct-looking candidate? A firewall is dropping the range. On Windows, check the
   network profile first — Public blocks the inbound direction that a permissive network let through.
