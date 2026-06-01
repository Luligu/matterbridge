# mDNS A Record Missing When Interface Has Many AAAA Records — Root Cause Analysis

## Symptom

Matter mDNS announcements (commissionable and operational) may carry only AAAA records. The A record (IPv4) is never seen by controllers or mDNS scanners on the LAN, making IPv4-only commissioning and connection impossible. The issue appears on any platform where a network interface has enough IPv6 addresses to push the mDNS packet past the 1232-byte limit, most commonly Windows where privacy extension addresses result in 3 or more AAAA records per interface.

---

## Investigation

Diagnostic logging was added to two files:

- `node_modules/@matter/protocol/dist/esm/advertisement/mdns/MdnsAdvertisement.js` — `#recordsFor()` method, to verify A records are being generated.
- `node_modules/@matter/nodejs/dist/esm/net/NodeJsNetwork.js` — `getIpMac()` method, to verify IPv4 addresses are detected and that `os.networkInterfaces()` returns properly string-typed `family` values on Windows.

The logs confirmed:

```text
[NodeJsNetwork] getIpMac(Wi-Fi) raw families=["IPv6", "IPv6", "IPv6", "IPv4"]
  ipV4=[192.168.69.100] ipV6=[fd78:...:c33d, fd78:...:d097, fe80::...]

[MdnsAdvertisement] #recordsFor hostname=C4CB76B3CD1F0000.local
  supportsIpv4=true ipV4=[192.168.69.100] ipV6=[...3 addresses...] A=1 AAAA=3
```

- `supportsIpv4 = true` — the IPv4 multicast socket was created successfully.
- `ipV4 = [192.168.69.100]` — IPv4 address is correctly detected.
- `A = 1` — the A record **is** being generated.

The A record is generated but never arrives on the LAN. The bug is therefore in the **sending path**, not in address detection or record generation.

---

## Root Cause

Two issues combine to produce the bug.

### 1. `MdnsSocket.send()` silently drops `additionalRecords` that overflow `MAX_MDNS_MESSAGE_SIZE`

File: `@matter/general/dist/esm/net/dns-sd/MdnsSocket.js`

`MAX_MDNS_MESSAGE_SIZE = 1232` bytes (IPv6 PMTU lower bound, mandated by RFC 6762 §17).

When assembling a DNS message, the loop that packs `additionalRecords` simply `break`s when the size limit is reached. The remaining records — including any that have not yet been added — are silently discarded. No second packet is sent.

```js
// @matter/general — MdnsSocket.js
const additionalRecords = message.additionalRecords ?? [];
for (const additionalRecord of additionalRecords) {
  const additionalRecordEncoded = DnsCodec.encodeRecord(additionalRecord);
  chunkSize += additionalRecordEncoded.byteLength;
  if (chunkSize > MAX_MDNS_MESSAGE_SIZE) {
    break; // ← remaining records are silently dropped, no second packet
  }
  chunk.additionalRecords.push(additionalRecordEncoded);
}
await this.#send(chunk, intf, unicastDest);
```

This is intentional per RFC 6762 — `additionalRecords` are "bonus" records a responder may include, and truncating them is permitted by the protocol. The problem is that Matter uses `additionalRecords` to carry A and AAAA records, which **are not optional from a Matter perspective**.

By contrast, the `answers` loop handles overflow correctly: it sends the current chunk with the `TC` (truncation) flag set and starts a new chunk for the overflowing record:

```js
// answers — overflow handled by multi-packet send
for (const answer of message.answers ?? []) {
  const answerEncoded = DnsCodec.encodeRecord(answer);
  if (chunkSize + answerEncoded.byteLength > MAX_MDNS_MESSAGE_SIZE) {
    await this.#send({ ...chunk, messageType: truncatedMessageType }, intf, unicastDest);
    chunk.answers.length = 0;
    chunkSize = encodedChunkWithoutAnswers.byteLength + answerEncoded.byteLength;
  } else {
    chunkSize += answerEncoded.byteLength;
  }
  chunk.answers.push(answerEncoded); // ← always pushed, never dropped
}
```

### 2. `MdnsAdvertisement.#recordsFor()` places A records after AAAA records

File: `@matter/protocol/dist/esm/advertisement/mdns/MdnsAdvertisement.js`

`#announceRecordsForInterface()` separates records into:

- `answers` → PTR records only
- `additionalRecords` → everything else: SRV, TXT, AAAA×N, A

The record ordering in `#recordsFor()` is:

```text
additionalRecords = [ SRV, TXT, AAAA, AAAA, AAAA, A ]
```

When an interface has two or more IPv6 addresses, the cumulative size of SRV + TXT + AAAA×N exceeds 1232 bytes before the A record is reached. The `break` fires and the A record is never sent. The packet budget is tight enough that even two AAAA records can cause the overflow depending on TXT record size.

Windows is the most common trigger because its IPv6 privacy extensions assign two temporary global addresses plus a link-local per interface, giving three AAAA records. Linux and macOS typically assign one global plus one link-local (two AAAA records), which usually fits — but this is not guaranteed.

---

## Fix Applied (node_modules workaround)

The immediate fix reverses the A/AAAA ordering in `#recordsFor()` in both the ESM and CJS builds of `@matter/protocol`:

**Before:**

```js
for (const addr of addrs.ipV6) {
  records.push(AAAARecord(hostname, addr));
}
if (this.advertiser.server.supportsIpv4) {
  for (const addr of addrs.ipV4) {
    records.push(ARecord(hostname, addr));
  }
}
```

**After:**

```js
for (const addr of addrs.ipV6.filter((a) => a.startsWith('fe80'))) {
  records.push(AAAARecord(hostname, addr)); // AAAA link-local first — stable, MAC-derived
}
if (this.advertiser.server.supportsIpv4) {
  for (const addr of addrs.ipV4) {
    records.push(ARecord(hostname, addr)); // A second — reliable IPv4 fallback
  }
}
for (const addr of addrs.ipV6.filter((a) => !a.startsWith('fe80'))) {
  records.push(AAAARecord(hostname, addr)); // AAAA non-link-local last — may rotate
}
```

The ordering gives highest priority to the `fe80::` link-local AAAA address: it is derived from the MAC address, has `valid_lft forever`, and never rotates — making it the most stable endpoint a controller can use. The A record comes second as a reliable IPv4 fallback that always fits in the packet. Non-link-local AAAA addresses (global, ULA, and privacy-extension addresses) come last: they may expire and rotate, so dropping them under packet budget pressure is the least harmful outcome.

The corrected `additionalRecords` order is:

```text
additionalRecords = [ SRV, TXT, AAAA(fe80), A, AAAA(global1), AAAA(global2) ]
```

---

## Future fix for matter.js

The correct next fix would be in `@matter/general/MdnsSocket.send()`. The `additionalRecords` loop should collect any records that would overflow into a follow-up packet, exactly as the `answers` loop already does.

### Rationale

Per RFC 6762 §6, a responder is free to omit `additionalRecords` when they do not fit. That rule was designed for generic DNS record types. In Matter, however, A and AAAA records carried in `additionalRecords` are the **only mechanism** by which a controller learns the IP address of a device. Treating them as silently discardable produces a functional failure: the device is discovered via mDNS but may be unreachable at the IP layer.

---

## Patch Applied to node_modules

Applied to both the ESM and CJS builds of `@matter/protocol/dist/.../advertisement/mdns/MdnsAdvertisement.js`.

### `#recordsFor()` — reverse A/AAAA order and sort AAAA with fe80:: first

```diff
-for (const addr of addrs.ipV6) {
-  records.push(AAAARecord(hostname, addr));
-}
-if (this.advertiser.server.supportsIpv4) {
-  for (const addr of addrs.ipV4) {
-    records.push(ARecord(hostname, addr));
-  }
-}
+for (const addr of addrs.ipV6.filter((a) => a.startsWith("fe80"))) {
+  records.push(AAAARecord(hostname, addr));    // AAAA link-local first — stable, MAC-derived
+}
+if (this.advertiser.server.supportsIpv4) {
+  for (const addr of addrs.ipV4) {
+    records.push(ARecord(hostname, addr));      // A second — reliable IPv4 fallback
+  }
+}
+for (const addr of addrs.ipV6.filter((a) => !a.startsWith("fe80"))) {
+  records.push(AAAARecord(hostname, addr));    // AAAA non-link-local last — may rotate
+}
```

Files patched:

- `node_modules/@matter/protocol/dist/esm/advertisement/mdns/MdnsAdvertisement.js`
- `node_modules/@matter/protocol/dist/cjs/advertisement/mdns/MdnsAdvertisement.js`

---

## Affected Files

| File                                                                | Change                                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `@matter/protocol/dist/esm/advertisement/mdns/MdnsAdvertisement.js` | A records before AAAA in `#recordsFor()`; AAAA sorted with `fe80::` link-local first |
| `@matter/protocol/dist/cjs/advertisement/mdns/MdnsAdvertisement.js` | Same change in CJS build                                                             |
