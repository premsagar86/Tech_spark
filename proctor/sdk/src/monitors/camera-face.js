// Webcam face-presence monitor.
//
// PRIVACY: this never stores, uploads, or draws a recognisable frame anywhere.
// It samples the video into a tiny offscreen canvas, asks a detector "how many
// faces?", and emits only an integer + timestamp. No image data leaves the page.
//
// Detector strategy (first that works wins):
//   1. A caller-supplied detector — `Proctor.init({ camera: { detector } })`.
//      Contract: `async (videoEl) => ({ faces: number }) | null`. This is where
//      you plug MediaPipe FaceDetector or face-api.js for real multi-face
//      counting. Bundle the model files with your app (no CDN — the exam page's
//      CSP blocks third-party fetches).
//   2. The native Shape Detection API (`window.FaceDetector`) where the browser
//      exposes it.
//   3. A luminance fallback that can only tell "camera is black / covered"
//      (=> no_face) — it cannot count faces. Used so the monitor still does
//      something useful when no real model is wired in.
//
// Emits:
//   no_face      — sustained absence of a face for `noFaceGraceMs`
//   multi_face   — more than one face in a sample (only with a real detector)
//   camera_lost  — the track ended / was revoked mid-exam
//   camera_denied— getUserMedia rejected at start (handled by the consent gate,
//                  but reported for completeness)

export function createCameraFaceMonitor({ report, opts = {} }) {
  const sampleMs = opts.sampleMs ?? 2500;
  const noFaceGraceMs = opts.noFaceGraceMs ?? 6000;
  const userDetector = opts.detector || null;

  let stream = null;
  let video = null;
  let canvas = null;
  let ctx = null;
  let nativeDetector = null;
  let timer = null;
  let noFaceSince = null;
  let lastMultiReport = 0;

  async function acquire() {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false });
    video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play().catch(() => {});
    canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 120;
    ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (!userDetector && "FaceDetector" in window) {
      try {
        // eslint-disable-next-line no-undef
        nativeDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
      } catch {
        nativeDetector = null;
      }
    }

    stream.getVideoTracks().forEach((t) => {
      t.addEventListener("ended", () => report("camera_lost", { reason: "track_ended" }));
    });
  }

  async function countFaces() {
    if (userDetector) {
      const r = await userDetector(video).catch(() => null);
      return r && typeof r.faces === "number" ? r.faces : null;
    }
    if (nativeDetector) {
      const faces = await nativeDetector.detect(video).catch(() => null);
      return Array.isArray(faces) ? faces.length : null;
    }
    // Luminance fallback: mean brightness + variance. A covered lens / closed
    // laptop reads near-black and near-zero variance -> treat as no_face.
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
    const mean = sum / (data.length / 4);
    return mean < 12 ? 0 : null; // null = "can't tell, assume a face is there"
  }

  async function tick() {
    let faces;
    try {
      faces = await countFaces();
    } catch {
      return;
    }
    if (faces === null) {
      noFaceSince = null;
      return;
    }
    if (faces === 0) {
      if (noFaceSince === null) noFaceSince = Date.now();
      else if (Date.now() - noFaceSince >= noFaceGraceMs) {
        report("no_face", { forMs: Date.now() - noFaceSince });
        noFaceSince = Date.now(); // re-arm so it re-reports if still absent
      }
    } else {
      noFaceSince = null;
      if (faces > 1 && Date.now() - lastMultiReport > 4000) {
        lastMultiReport = Date.now();
        report("multi_face", { faces });
      }
    }
  }

  return {
    async start() {
      try {
        await acquire();
      } catch (err) {
        report("camera_denied", { name: err?.name || "error" });
        throw err;
      }
      timer = setInterval(tick, sampleMs);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      if (video) {
        video.srcObject = null;
        video = null;
      }
    },
    get active() {
      return !!stream;
    },
  };
}
