# Park Radar — Detection API

Backend-only Express service for the `camera-worker` vision input. It captures one configured parking-camera frame, masks the configured areas, and exposes the latest annotated frame through one API route.

## Run

Requires Node.js 22+ and a configured camera source.

```bash
npm install
npx playwright install chromium
cp .env.example .env
npm start
```

Call `GET http://localhost:3000/api/detection`. It returns `202` while the first capture is pending, `200` with the latest annotated PNG as a data URI in `image` and the unmasked capture in `originalImage` when ready, or `503` if capture failed. Add `?refresh=true` to queue a fresh capture while receiving the latest result.

There is no served frontend or demo feed. A configured external source is never replaced with a fake frame; the API returns its capture error and retries at the configured interval.

## Connect the showcase frontend

The `park-radar-showcase` repository reads this endpoint from its browser UI. For local development it uses `http://localhost:3000/api/detection` by default: start this API, then run the showcase with `npx wrangler dev`.

When both applications are deployed, set `apiUrl` in the showcase's `public/config.js` to this API's public `/api/detection` URL. The endpoint is read-only and allows browser requests from every origin by default. Restrict it in production with the exact deployed showcase origin (no trailing slash):

```bash
CORS_ORIGINS=https://your-showcase.workers.dev npm start
```

Multiple origins, including a local development URL, can be comma-separated.

## External camera

Set environment variables for a page with a `<video>` element:

```bash
CAMERA_URL='http://live.uci.agh.edu.pl/video/stream1.shtml' \
CAMERA_MEDIA_TYPE=video \
CAMERA_SELECTOR=video \
CAMERA_READY_SELECTOR=video \
npm start
```

Use `CAMERA_AREAS_JSON` to replace the marked polygons. The validation is shared with `camera-worker`.

## Docker

The Playwright image already includes Chromium:

```bash
docker build -t park-radar-vision-demo .
docker run --rm -p 3000:3000 park-radar-vision-demo
```
