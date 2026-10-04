# Park Radar — Vision Demo

One-screen Express demo of the `camera-worker` vision input: a new frame every minute, masked parking areas, and cyan area labels.

## Run

Requires Node.js 22+.

```bash
npm install
npx playwright install chromium
npm start
```

Open [http://localhost:3000](http://localhost:3000).

The default built-in animated feed keeps the demo usable without an external camera or an API key. A configured external source is never replaced with a fake frame: the UI shows an error and retries it every minute.

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
