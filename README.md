<div align="center">
  <img src="public/images/logo.png" alt="CheezyPizza Logo" width="50%" />
  <h3>WebRTC based P2P file transfers in your browser </h3>
  <p><em>A fork of <a href="https://file.pizza">FilePizza</a> — with thanks to <a href="https://kern.io">Alex Kern</a> and <a href="https://github.com/neerajbaid">Neeraj Baid</a> for the original work.</em></p>
</div>

Using [WebRTC](http://www.webrtc.org), CheezyPizza eliminates the initial upload step required by other web-based file sharing services. Because data is never stored in an intermediary server, the transfer is fast, private, and secure.

## What's new in CheezyPizza 🍕

* **Resumable downloads.** Transfers interrupted by network drops, browser crashes, or manual pauses can be resumed from where they left off. Progress is persisted to OPFS or IndexedDB so no data is re-downloaded unnecessarily.
* **SHA-256 file integrity verification.** Every file is hashed by the uploader after transfer and verified by the downloader. A mismatch flags the file as corrupt before it is ever saved to disk.
* **Large file support.** Files are written incrementally to the Origin Private File System (OPFS) or IndexedDB as chunks arrive, with automatic fallback between the two, allowing transfers well beyond what fits in memory.
* **Better error handling.** Per-file errors are tracked independently. A failed or corrupt file does not block other files in a multi-file transfer. Integrity failures clean up partial data automatically.
* **Application-level flow control.** With high/low watermarks on the WebRTC data channel prevents buffer bloat and keeps transfers smooth at high speeds across varying network conditions.
* **Automatic reconnect on network change.** When a device switches networks (e.g. mobile data -> Wi-Fi) or a connection drops, CheezyPizza detects the reconnection and resumes the download automatically from the last saved offset.
* **Multi-file transfers with per-file progress.** Upload multiple files at once. The downloader receives them as a zip archive.
* **Password protection.** Transfers can be protected with a password, verified before any file is transferred.

```NOTE: TURN support has not yet been added, as I am an individual maintainer (and just a student) and would not be able to afford it without donations (will add it in future). (Peers trying to connect from behind symmetric NAT or strict firewalls may face connection issues.)```

## Browser Support
Every browser implements OPFS and persistant storage differently. Thus, some browser's may limit the total storage quota per tab or origin. Browser quota limitations affect the pause-resume feature because of the file-size restriction. You can read more on this here:
[MDN Storage Quota Docs](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria#other_web_technologies)

All the features of the website should work on Chrome and Chromium based brwosers (except Brave).

| | <img src="https://raw.githubusercontent.com/alrra/browser-logos/main/src/chrome/chrome_48x48.png" width="32"/><br>Chrome | <img src="https://raw.githubusercontent.com/alrra/browser-logos/main/src/firefox/firefox_48x48.png" width="32"/><br>Firefox | <img src="https://raw.githubusercontent.com/alrra/browser-logos/main/src/edge/edge_48x48.png" width="32"/><br>Edge | <img src="https://raw.githubusercontent.com/alrra/browser-logos/main/src/safari/safari_48x48.png" width="32"/><br>Safari | <img src="https://raw.githubusercontent.com/alrra/browser-logos/main/src/opera/opera_48x48.png" width="32"/><br>Opera | <img src="https://raw.githubusercontent.com/alrra/browser-logos/main/src/vivaldi/vivaldi_48x48.png" width="32"/><br>Vivaldi | <img src="https://raw.githubusercontent.com/alrra/browser-logos/main/src/brave/brave_48x48.png" width="32"/><br>Brave |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Desktop** | | | | | | | |
| File transfer (WebRTC) | ✅ | ✅ | ✅ | * | ✅ | ✅ | ✅ |
| OPFS storage (large files) | ✅ | ✅ | ✅ | * | ✅ | ✅ | ⚠️ limited  |
| Resumable downloads | ✅ | ✅ | ✅ | * | ✅ | ✅ | ⚠️ limited  |
| SHA-256 integrity check | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Password protection | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multi-file zip download | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Mobile** | | | | | | | |
| File transfer (WebRTC) | ✅ | ✅ | ✅ | * | ✅ | ✅ | ✅ |
| OPFS storage (large files) | ✅ | ⚠️ limited | ✅ | * | ✅ | ✅ | ⚠️ limited |
| Resumable downloads | ✅ | ⚠️ IDB fallback | ✅ | * | ✅ | ✅ | ⚠️ limited  |
| SHA-256 integrity check | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Streaming save (no memory cap) | ✅ | ⚠️ partial | ✅ | *| ✅ | ✅ | ✅ |
| Password protection | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Auto-reconnect on network switch | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

> ⚠️ = supported with limitations. OPFS write access varies by browser version and storage quota policies. <br>
 \* = Not yet tested

## Development

```
$ git clone https://github.com/hariharjeevan/cheezypizza.git
$ pnpm install
$ pnpm dev
$ pnpm build
$ pnpm start
```

### Running with Docker

```
$ pnpm docker:build
$ pnpm docker:up
$ pnpm docker:down
```

## Stack

* Next.js
* React
* TypeScript
* Tailwind CSS
* PeerJS (WebRTC)
* Zod
* hash-wasm
* fflate (client-side zip)
* Vitest + Playwright (testing)
* Redis (optional, for channel metadata)

## Configuration

The server can be customized with the following environment variables:

- `REDIS_URL` – Connection string for a Redis instance used to store channel metadata. If not set, CheezyPizza falls back to in-memory storage.
- `COTURN_ENABLED` – When set to `true`, enables TURN support for connecting peers behind NAT.
- `TURN_HOST` – Hostname or IP address of the TURN server. Defaults to `127.0.0.1`.
- `TURN_REALM` – Realm used when generating TURN credentials. Defaults to `file.pizza`.
- `STUN_SERVER` – STUN server URL to use when `COTURN_ENABLED` is disabled. Defaults to `stun:stun.l.google.com:19302`.
- `PEERJS_HOST` – Hostname or IP address of the self-hosted PeerJS server. Defaults to `0.peerjs.com`.
- `PEERJS_PATH` – Path to the self-hosted PeerJS server. Defaults to `/`.

## FAQ

**How are my files sent?** Files are sent directly from your browser to the downloader's browser over WebRTC. They never pass through any server. The uploader must keep their browser window open until the transfer is complete.

**Can multiple people download my file at once?** Yes. Share the link with as many people as you like.

**How big can my files be?** Very large. CheezyPizza streams files to the OPFS and the max file size is determined by the type of the browser and total disk size. (Check [Browser Support](#browser-support) Section above)

**What happens if my download is interrupted?** CheezyPizza saves your progress automatically. If the connection drops the download will resume from where it left off once the connection is restored.

**How do I know my file wasn't corrupted in transit?** After each file transfer completes, the uploader computes a SHA-256 hash and sends it to the downloader. CheezyPizza verifies the hash before offering the file for saving. If the hashes don't match, the file is flagged and discarded.

**Can I password-protect my transfer?** Yes. Set a password when uploading. Downloaders must enter it before downloading the file.

**Are my files encrypted?** Yes. All WebRTC communications are encrypted using DTLS.

**Which browsers are supported?** CheezyPizza works in all major modern browsers. See the [Browser Support](#browser-support) section above for feature-level detail.

## License

CheezyPizza is released under the [BSD 3-Clause license](https://github.com/hariharjeevan/cheezypizza/blob/main/LICENSE).

Based on [FilePizza](https://github.com/kern/filepizza) by Alex Kern and Neeraj Baid.