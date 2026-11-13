import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

/**
 * Opt-in webcam + hand-landmark runtime.
 *
 * Camera access only begins after start() is explicitly called by the UI.
 * The service does not decide what a gesture means; game-independent gesture
 * interpretation belongs in GestureRecognizer / GestureMapper.
 */
export class GestureInput extends EventTarget {
  #stream = null;
  #landmarker = null;
  #video = null;
  #frameId = 0;
  #lastVideoTime = -1;
  #running = false;
  #onLandmarks = null;

  get isRunning() {
    return this.#running;
  }

  async start(video, onLandmarks) {
    if (this.#running) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera access is unavailable. Use a secure context such as localhost or HTTPS.");
    }
    if (!(video instanceof HTMLVideoElement)) {
      throw new TypeError("GestureInput.start() needs a video element.");
    }

    this.#video = video;
    this.#onLandmarks = typeof onLandmarks === "function" ? onLandmarks : () => {};

    try {
      this.#stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 960 },
          height: { ideal: 540 },
          frameRate: { ideal: 30, max: 60 }
        }
      });

      video.srcObject = this.#stream;
      video.playsInline = true;
      video.muted = true;
      await video.play();

      const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
      try {
        this.#landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.58,
          minHandPresenceConfidence: 0.55,
          minTrackingConfidence: 0.55
        });
      } catch {
        this.#landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.58,
          minHandPresenceConfidence: 0.55,
          minTrackingConfidence: 0.55
        });
      }

      this.#running = true;
      this.dispatchEvent(new Event("started"));
      this.#tick();
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  #tick = () => {
    if (!this.#running || !this.#video || !this.#landmarker) return;

    if (this.#video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        this.#video.currentTime !== this.#lastVideoTime) {
      this.#lastVideoTime = this.#video.currentTime;
      try {
        const result = this.#landmarker.detectForVideo(this.#video, performance.now());
        this.#onLandmarks(result);
        this.dispatchEvent(new CustomEvent("landmarks", { detail: result }));
      } catch (error) {
        this.dispatchEvent(new CustomEvent("trackingerror", { detail: error }));
      }
    }

    this.#frameId = requestAnimationFrame(this.#tick);
  };

  async stop() {
    this.#running = false;
    if (this.#frameId) cancelAnimationFrame(this.#frameId);
    this.#frameId = 0;

    this.#stream?.getTracks().forEach((track) => track.stop());
    this.#stream = null;

    if (this.#video) {
      this.#video.pause();
      this.#video.srcObject = null;
    }
    this.#landmarker?.close();
    this.#landmarker = null;
    this.#video = null;
    this.#onLandmarks = null;
    this.#lastVideoTime = -1;
    this.dispatchEvent(new Event("stopped"));
  }

  async dispose() {
    await this.stop();
  }
}
