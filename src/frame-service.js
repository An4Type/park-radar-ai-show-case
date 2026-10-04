import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { prepareInputs } from '../camera-worker/src/analyze.js';
import { captureCamera } from '../camera-worker/src/capture.js';

const asErrorMessage = (error) => error instanceof Error ? error.message : String(error);
const retryMessage = (intervalMs) => intervalMs === 60000
  ? 'Camera unavailable. Retrying in 1 minute.'
  : `Camera unavailable. Retrying in ${Math.round(intervalMs / 1000)} seconds.`;

/**
 * Captures a frame and retains only the latest vision-focused PNG in memory.
 * The visual transform is camera-worker's prepareInputs(), not a client-side imitation.
 */
export class FrameService {
  constructor({ camera, intervalMs, outputDir, logger = console }) {
    this.camera = camera;
    this.intervalMs = intervalMs;
    this.outputDir = outputDir;
    this.logger = logger;
    this.browser = null;
    this.timer = null;
    this.running = false;
    this.inFlight = null;
    this.originalFrame = null;
    this.visionFrame = null;
    this.snapshot = {
      status: 'starting',
      version: 0,
      capturedAt: null,
      refreshedAt: null,
      source: null,
      message: 'Starting camera worker…',
      areas: camera.parkingAreas.map(({ id, capacity }) => ({ id, capacity: capacity ?? null })),
      intervalMs,
    };
  }

  getState() {
    return { ...this.snapshot, areas: [...this.snapshot.areas] };
  }

  getVisionFrame() {
    return this.visionFrame;
  }

  getOriginalFrame() {
    return this.originalFrame;
  }

  async start() {
    if (this.running) return;
    this.running = true;
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--autoplay-policy=no-user-gesture-required'],
      });
      await this.#refreshAndSchedule();
    } catch (error) {
      this.#setUnavailable(error);
    }
  }

  async refreshNow() {
    if (!this.browser) return this.start();
    return this.#refresh();
  }

  async stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await this.inFlight?.catch(() => undefined);
    await this.browser?.close();
    this.browser = null;
  }

  async #refreshAndSchedule() {
    const startedAt = Date.now();
    await this.#refresh();
    if (!this.running || !this.browser) return;
    const wait = Math.max(50, this.intervalMs - (Date.now() - startedAt));
    this.timer = setTimeout(() => {
      void this.#refreshAndSchedule();
    }, wait);
    this.timer.unref?.();
  }

  async #refresh() {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.#doRefresh().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  async #doRefresh() {
    this.snapshot = {
      ...this.snapshot,
      status: this.snapshot.version ? 'refreshing' : 'starting',
      message: 'Capturing the next video frame…',
    };

    let captured;
    try {
      captured = await this.#capture(this.camera);
    } catch (error) {
      this.#setUnavailable(error);
      return;
    }

    try {
      // This is exactly the worker's full-frame visual input: black outside of selected
      // polygons, cyan contours, and white area labels. It also makes masked zoom crops,
      // just as the worker would before asking a vision model.
      const { frame } = await prepareInputs(this.browser, captured.png, this.camera.parkingAreas);
      this.originalFrame = captured.png;
      this.visionFrame = frame;
      this.snapshot = {
        ...this.snapshot,
        status: 'ready',
        version: this.snapshot.version + 1,
        capturedAt: captured.capturedAt,
        refreshedAt: new Date().toISOString(),
        source: { id: captured.camera.id, name: captured.camera.name, mediaType: captured.camera.mediaType },
        message: 'Frame is ready for the vision model.',
      };
    } catch (error) {
      this.#setUnavailable(error);
    }
  }

  async #capture(camera) {
    // prepareInputs handles the areas. Suppressing capture-time crops avoids saving
    // throwaway files while preserving the same screenshot behaviour as camera-worker.
    const result = await captureCamera(this.browser, { ...camera, parkingAreas: [] }, this.outputDir);
    if (!result.ok) throw new Error(result.error ?? 'Camera capture failed');
    const png = await readFile(join(this.outputDir, camera.id, result.filename));
    return { camera, png, capturedAt: result.capturedAt };
  }

  #setUnavailable(error) {
    this.logger.error(JSON.stringify({ service: 'vision-demo', event: 'frame_unavailable', message: asErrorMessage(error) }));
    this.snapshot = {
      ...this.snapshot,
      status: 'error',
      refreshedAt: new Date().toISOString(),
      message: retryMessage(this.intervalMs),
    };
  }
}
