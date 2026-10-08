/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import type { ServerResponse } from 'node:http';
import { defineConfig, type Connect, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { MOCK_TRACKS } from './src/mock/data';
import { buildToneWav } from './src/mock/wav';

/**
 * Sirve audio de prueba con soporte real de cabeceras Range (HTTP 206),
 * entregado a ritmo limitado para que el búfer del navegador se vea crecer.
 * Solo se usa en modo mock (VITE_USE_MOCK=true).
 */
function mockMediaPlugin(): Plugin {
  const cache = new Map<string, Uint8Array>();
  const CHUNK_BYTES = 8 * 1024;
  const CHUNK_INTERVAL_MS = 250;

  const handler: Connect.NextHandleFunction = (req, res: ServerResponse, next) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    const match = /^\/mock-media\/([\w-]+)\.wav$/.exec(url.pathname);
    if (!match) {
      next();
      return;
    }
    const track = MOCK_TRACKS.find((t) => t.id === match[1]);
    if (!track) {
      res.statusCode = 404;
      res.end();
      return;
    }
    let data = cache.get(track.id);
    if (!data) {
      data = buildToneWav(track.seed, track.durationSec);
      cache.set(track.id, data);
    }
    const total = data.byteLength;
    let start = 0;
    let end = total - 1;
    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
      if (m) {
        if (m[1]) start = Number(m[1]);
        if (m[2]) end = Math.min(Number(m[2]), total - 1);
        if (!m[1] && m[2]) {
          start = Math.max(total - Number(m[2]), 0);
          end = total - 1;
        }
      }
      if (start > end || start >= total) {
        res.statusCode = 416;
        res.setHeader('Content-Range', `bytes */${total}`);
        res.end();
        return;
      }
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
    } else {
      res.statusCode = 200;
    }
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', String(end - start + 1));
    res.setHeader('Cache-Control', 'no-store');

    let offset = start;
    const timer = setInterval(() => {
      if (res.destroyed || res.writableEnded) {
        clearInterval(timer);
        return;
      }
      const stop = Math.min(offset + CHUNK_BYTES, end + 1);
      res.write(data.subarray(offset, stop));
      offset = stop;
      if (offset > end) {
        clearInterval(timer);
        res.end();
      }
    }, CHUNK_INTERVAL_MS);
    req.on('close', () => clearInterval(timer));
  };

  return {
    name: 'cauce-mock-media',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  plugins: [vue(), mockMediaPlugin()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
  },
});
