# How can the browser turn canvas frames into a video?

Research for [#8](https://github.com/natenolting/digital-fluid/issues/8) under the keyframe-animator map ([#1](https://github.com/natenolting/digital-fluid/issues/1)). Researched 2026-09-30 against primary sources: specs, MDN browser-compat-data, caniuse raw data, browser release notes and bug trackers, and each library's README, docs, npm metadata and source code. Fetched pages were treated as data, not instructions. One page (the ffmpeg Trac H.264 wiki) returned an anti-bot block page, so it was discarded and is not cited.

## Recommendation

**Use WebCodecs through [Mediabunny](https://github.com/Vanilagy/mediabunny) for MP4, and gifenc for GIF. Do not use MediaRecorder or ffmpeg.wasm.**

- **MP4:** render each frame, then call `await canvasSource.add(i / fps, 1 / fps)`. Mediabunny encodes each frame at the timestamp you give it, not at wall-clock time [3][4]. A frame that takes 300 ms to generate still lands exactly one frame after the previous one. `await` on `add()` gives you backpressure [4].
- **Codec:** before export, probe with `getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width, height })` [5][6]. Use H.264 in MP4 when it is available. Otherwise, fall back to VP9 or AV1. The browser supplies the encoder, so which codecs exist depends on the browser and OS [5][11].
- **Canvas size:** round the export canvas width and height to even numbers. Mediabunny throws on odd sizes for AVC and HEVC [7].
- **GIF:** use [gifenc](https://github.com/mattdesl/gifenc) (MIT, 9 KB) with one fixed palette that you build yourself: a short ramp from paper colour to ink colour. Skip quantisation.
- **Node fallback:** keep it available, but only as a fallback. `generate()` is already DOM-free, so a node script with `@napi-rs/canvas` that pipes RGBA frames into native `ffmpeg` is cheap to add later for renders too long or too large for a browser tab.

## Comparison

| | WebCodecs + Mediabunny | MediaRecorder on `canvas.captureStream()` | GIF encoder (gifenc / gif.js) | ffmpeg.wasm | Node script + native ffmpeg |
|---|---|---|---|---|---|
| **Output** | MP4, MOV, WebM, MKV and more; H.264, HEVC, VP8, VP9, AV1 video [3][5] | Chrome: WebM, plus MP4 since 126 [16]. Safari: MP4 with H.264 [18]. Firefox: no MP4, the bug is still open [17] | Animated GIF only | Anything ffmpeg does; x264, x265 and libvpx are in the build [20] | Anything ffmpeg does |
| **Frame-exact?** | **Yes.** Timestamps come from the frame, not the clock [2][4] | **No.** Frames are taken as the canvas is painted. `requestFrame()` picks *when* a frame is taken, but no API sets its timestamp [14][15] | Yes. You set a per-frame delay (gifenc in ms [8]; GIF stores 1/100 s [10]) | Yes. You write numbered frames to its virtual FS and encode offline [20] | Yes |
| **Chrome** | 94+ [11] | MediaRecorder 47+, `captureStream` 51+ [11] | Any (plain JS) | Any (Wasm + worker) | n/a |
| **Firefox** | 130+ desktop only; not on Android [11][12][13] | 25+ / 43+ [11] | Any | Any | n/a |
| **Safari** | 16.4+ video only; full (with audio) from 26 [11][12][19] | 14.1+ / 11+ [11] | Any | Any | n/a |
| **Speed** | Uses the browser's (often hardware) encoder [3] | Real time: the video lasts as long as the capture did | gifenc: 150 frames at 1024x1024 in about 2.1 s with 4 workers, about 5 s on the main thread [8] | Their benchmark: 128.8 s single-thread and 60.4 s multi-thread, against 5.2 s for native ffmpeg [22] | Native speed |
| **Bundle** | README claims "as small as 5 kB gzipped" [3]. Measured: MP4 + `CanvasSource` + `BufferTarget` tree-shaken = 180 KB min / 48.6 KB gzip (esbuild 0.25, mediabunny 1.61.0) | 0 (built in) | gifenc: 9 KB before gzip [8] | Core `.wasm` alone is 32.2 MB (measured, `@ffmpeg/core@0.12.10`) | 0 in the app |
| **Licence** | MPL-2.0 [3][24] | n/a | gifenc MIT, gif.js MIT [8][9][24] | Wrapper MIT; core GPL-2.0-or-later [21][24] | `@napi-rs/canvas` MIT, `skia-canvas` MIT [25][26][24] |
| **Main gotcha** | Codec availability varies; even sizes for AVC/HEVC | Not frame-exact; container varies by browser | 256-colour limit; delay in 1/100 s | Huge download; mt needs COOP/COEP; 2 GB cap | Not in the app; needs ffmpeg installed |

### 1. WebCodecs + an MP4 muxer (Mediabunny)

- **`mp4-muxer` and `webm-muxer` are deprecated.** Their READMEs and npm entries say "superseded by Mediabunny"; mp4-muxer "will not receive any new features or bug fixes" [23][24]. Last releases: mp4-muxer 5.2.2 and webm-muxer 5.1.4, both July 2025 [24]. Mediabunny is at 1.61.0, published 2026-09-29 [24].
- **API fit.** `new CanvasSource(canvas, { codec, bitrate })` wraps an `HTMLCanvasElement` or `OffscreenCanvas`. `add(timestamp, duration)` builds a `VideoSample` from the canvas's current pixels at that timestamp [4][7]. `keyFrameInterval` defaults to 2 s [4]. `Mp4OutputFormat` has a `fastStart` option (`'in-memory'`, `'reserve'`, `'fragmented'`) [6].
- **Spec basis.** The WebCodecs spec (W3C Working Draft, 21 Sep 2026) builds `VideoFrame` from a `CanvasImageSource` with a required timestamp in microseconds. Encoded chunks carry that timestamp. `encodeQueueSize` and the `dequeue` event provide backpressure [2].
- **Browser support** (MDN browser-compat-data for `VideoEncoder`, `VideoFrame` and `isConfigSupported`): Chrome 94, Firefox 130, Safari 16.4 [11]. Firefox 130 enabled WebCodecs "on desktop platforms" only [13]. caniuse marks Safari 16.4 to 18.7 as "Video-only support" and 26.0+ as full [12]. MDN labels `VideoEncoder` "Limited availability", not Baseline [1]. It needs a secure context (localhost counts) and works in dedicated workers [1].
- **Codec availability is a runtime question.** Mediabunny's docs: "The availability of the codecs provided by the WebCodecs API depends on the browser and thus cannot be guaranteed by this library" [5]. MDN's codec-selection guide recommends trying candidates with `isConfigSupported()` [27]. In Firefox the encoder is platform-backed: FFmpeg on Linux (H.264 needs a system ffmpeg newer than version 57), VideoToolbox on macOS, where H.264 High profile support was added [28]. Unverified: I found no primary source on which encoder Firefox uses on Windows. The probe-and-fall-back rule covers this.
- **Even dimensions.** In mediabunny `src/media-source.ts` (v1.61.0), an odd width or height with `avc` or `hevc` throws: "both width and height must be even numbers. Make sure to round your dimensions to the nearest even number" [7]. The export canvas size comes from paper size in mm × `pxPerMm`, so it can be odd. Round it.
- **Max resolution.** Mediabunny picks the AVC level from a table that goes up to level 6.2, which allows 139,264 macroblocks per frame [7]. The real limit is whatever the device's encoder accepts. Probe with `canEncodeVideo(codec, { width, height })` [6].
- **Node.** Encoding needs WebCodecs, which Node does not have. Mediabunny offers `@mediabunny/server` for Node, Bun and Deno, and custom-encoder hooks (`CustomVideoEncoder`) [3][5].
- **No GIF output.** Mediabunny writes video containers, not GIF [3][5].

### 2. MediaRecorder on `canvas.captureStream()`

- `captureStream(0)` plus `track.requestFrame()` lets you pick *which* frames go in [15]. The spec says a frame is taken "when [[frameCaptureRequested]] is true and the canvas is painted", and it gives no way to set timestamps [14]. The recorder stamps each frame with capture time. With frames that take tens to hundreds of ms, playback speed follows generation speed, not the animation clock. That rules it out here.
- Container depends on the browser. Chrome 126 added MP4 muxing [16]. Safari records MP4 with H.264 and AAC [18]. Firefox's MediaRecorder rejects `video/mp4`, and Mozilla staff suggest WebCodecs plus a third-party muxer instead [17].
- The canvas must be origin-clean, or `captureStream()` throws `SecurityError` [15]. That is not a problem for this app: it draws only paths.

### 3. GIF encoders

- **gifenc** (MIT, v1.0.3, repo last pushed 2024-09) [8][24]. You call `quantize(rgba, maxColors)` or supply your own palette, then `applyPalette(rgba, palette)` maps each pixel to the nearest palette colour. Formats: `rgb565`, `rgb444`, `rgba4444`. Delay is in ms. Works in workers. It has no dithering, and its README calls it "best suited for simple flat-style vector graphics" [8], which matches this sketch.
- **gif.js** (MIT, last npm release 0.2.0 in Dec 2016, repo last pushed 2023-10) [9][24]. It uses NeuQuant and has built-in workers and dithering. Default frame delay is 500 ms [9]. It is effectively unmaintained, so gifenc wins.
- **2-colour palette.** The GIF89a spec allows colour tables of 2^(N+1) entries, from 2 to 256 [10], so a pure two-colour GIF is valid. But canvas strokes are anti-aliased, so edges contain in-between shades. Mapping them to just ink and paper gives jagged lines. Build one fixed palette for all frames, for example a 4- to 16-step ramp from paper to ink. That keeps edges smooth and stops palette flicker between frames (an inference from how `applyPalette` works [8]). If you go through ffmpeg instead, the equivalents are `palettegen` `max_colors` and `paletteuse` `dither=none` [29].
- **Frame timing.** GIF stores delay in 1/100 s [10]. 25 fps (4/100 s) and 50 fps (2/100 s) are exact. 30 fps (3.33/100 s) is not.

### 4. ffmpeg.wasm

- Runs in a worker and downloads `ffmpeg-core` (Wasm) at load time. You write frames into its in-memory file system, then run ffmpeg commands [20]. `@ffmpeg/core` measures 32.2 MB of `.wasm` (unpkg, v0.12.10).
- Their own benchmark: 128.8 s single-thread and 60.4 s multi-thread, against 5.2 s for native ffmpeg [22]. The multi-thread core needs `SharedArrayBuffer` [20], which needs cross-origin isolation (COOP and COEP headers) [30]. Vite dev and preview would need those headers set. The FAQ also calls the multi-thread core "more unstable" [21].
- Hard 2 GB Wasm memory limit. Node support was dropped in 0.12 [21].
- Licence: `@ffmpeg/ffmpeg` is MIT, but `@ffmpeg/core` follows FFmpeg's licences and is GPL-2.0-or-later on npm [21][24]. Shipping it means GPL obligations for the bundle.
- It only makes sense if you need a format that WebCodecs can't encode. For MP4 or GIF output here, it is the slowest and heaviest option.

### 5. Fallback: Node script with DOM-free `generate()` + node canvas + ffmpeg

- `generate()` in `src/generate.ts` has no DOM access. `drawCanvas()` in `src/render.ts` uses only `fillRect`, `setTransform`, `moveTo`, `lineTo` and `stroke`, which both Node canvases implement. Its parameter type is `CanvasRenderingContext2D`, so a Node caller would need a looser type or a cast.
- **`@napi-rs/canvas`**: Skia binding, MIT, "0 System dependencies", ships prebuilt binaries [25]. **`skia-canvas`**: MIT, prebuilt binaries, can write multipage image sequences; its README does not mention video export [26].
- Pipe raw RGBA into ffmpeg's `rawvideo` demuxer (`-f rawvideo -pixel_format rgba -video_size WxH -framerate N -i -`). Raw video has no header, so you must pass size, pixel format and frame rate [31]. Encode with libx264. Native speed, no size cap, and the result is frame-exact by construction.
- Cost: it runs outside the app. You need Node plus an installed ffmpeg, and a way to hand it the keyframes (a JSON file, which the map's "Saving an animation" question may settle). Use it for 4K or long renders, or where a browser encoder refuses the size.

## Sources

1. MDN, `VideoEncoder`: https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder
2. W3C, WebCodecs (Working Draft, 21 September 2026): https://www.w3.org/TR/webcodecs/
3. Mediabunny README and introduction: https://github.com/Vanilagy/mediabunny and https://mediabunny.dev/guide/introduction
4. Mediabunny, Media sources (`CanvasSource`, `VideoSampleSource`, backpressure, `keyFrameInterval`): https://mediabunny.dev/guide/media-sources
5. Mediabunny, Supported formats and codecs: https://mediabunny.dev/guide/supported-formats-and-codecs
6. Mediabunny 1.61.0 type definitions (`getFirstEncodableVideoCodec`, `canEncodeVideo`, `fastStart`): `dist/mediabunny.d.ts` in https://www.npmjs.com/package/mediabunny
7. Mediabunny 1.61.0 source: `src/media-source.ts` (odd-dimension check for avc/hevc; `CanvasSource.add` creating `VideoSample(canvas, { timestamp, duration })`), `src/codec.ts` (`AVC_LEVEL_TABLE`), `src/output-format.ts` (Mp4 supported codecs): https://github.com/Vanilagy/mediabunny/tree/main/src
8. gifenc README: https://github.com/mattdesl/gifenc
9. gif.js README: https://github.com/jnordberg/gif.js
10. GIF89a specification: https://www.w3.org/Graphics/GIF/spec-gif89a.txt
11. MDN browser-compat-data (`api/VideoEncoder.json`, `api/VideoFrame.json`, `api/MediaRecorder.json`, `api/HTMLCanvasElement.json`): https://github.com/mdn/browser-compat-data/tree/main/api
12. caniuse, WebCodecs (raw data note #1 "Video-only support" for Safari 16.4 to 18.7; Firefox for Android unsupported): https://caniuse.com/webcodecs and https://github.com/Fyrd/caniuse/blob/main/features-json/webcodecs.json
13. Firefox 130 release notes ("Enabled the Web Codecs API on desktop platforms"): https://www.firefox.com/en-US/firefox/130.0/releasenotes/
14. W3C, Media Capture from DOM Elements (`captureStream`, `requestFrame`): https://w3c.github.io/mediacapture-fromelement/
15. MDN, `HTMLCanvasElement.captureStream()`: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream
16. Chrome 126 release notes (MediaRecorder MP4 muxing): https://developer.chrome.com/release-notes/126
17. Mozilla Bugzilla 1631143, "The 'video/mp4' mime type is not supported in MediaRecorder" (open): https://bugzilla.mozilla.org/show_bug.cgi?id=1631143
18. WebKit blog, MediaRecorder API: https://webkit.org/blog/11353/mediarecorder-api/
19. WebKit blog, WebKit features in Safari 16.4 ("video portion of Web Codecs API"): https://webkit.org/blog/13966/webkit-features-in-safari-16-4/
20. ffmpeg.wasm docs, Overview and Usage (worker architecture, core-mt, SharedArrayBuffer requirement, bundled libraries): https://ffmpegwasm.netlify.app/docs/overview and https://ffmpegwasm.netlify.app/docs/getting-started/usage
21. ffmpeg.wasm FAQ (licence, 2 GB limit, Node dropped, mt stability): https://ffmpegwasm.netlify.app/docs/faq
22. ffmpeg.wasm Performance: https://ffmpegwasm.netlify.app/docs/performance
23. mp4-muxer README (deprecation notice): https://github.com/Vanilagy/mp4-muxer
24. npm registry metadata (`npm view`, 2026-09-30) for mediabunny, mp4-muxer, webm-muxer, gifenc, gif.js, @ffmpeg/ffmpeg, @ffmpeg/core, @ffmpeg/core-mt, @napi-rs/canvas, skia-canvas; GitHub API repo metadata for gif.js, gifenc, mediabunny: https://www.npmjs.com/
25. `@napi-rs/canvas` README: https://github.com/Brooooooklyn/canvas
26. `skia-canvas` README: https://github.com/samizdatco/skia-canvas
27. MDN, WebCodecs codec selection: https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API/Codec_selection
28. Mozilla Bugzilla 1749047, "[WebCodecs] Implement VideoEncoder on Linux" (fixed, 123): https://bugzilla.mozilla.org/show_bug.cgi?id=1749047
29. FFmpeg filters documentation (`palettegen`, `paletteuse`): https://ffmpeg.org/ffmpeg-filters.html#palettegen
30. MDN, `SharedArrayBuffer` security requirements: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer#security_requirements
31. FFmpeg formats documentation (`rawvideo` demuxer): https://ffmpeg.org/ffmpeg-formats.html#rawvideo
