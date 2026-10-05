import { normalizeOutput, toModelInput, U2NET_SIZE } from '@/domain/segmentation';

/**
 * Runs the U²-Netp background-removal model in the browser with
 * onnxruntime-web (WASM). The runtime and model are self-hosted under
 * /ort and /models (see scripts/copy-ort.mjs) and loaded lazily on first use,
 * then cached by the browser.
 */

interface OrtTensor {
  data: Float32Array;
}
interface OrtSession {
  inputNames: string[];
  outputNames: string[];
  run(feeds: Record<string, unknown>): Promise<Record<string, OrtTensor>>;
}
interface Ort {
  env: { wasm: { wasmPaths: string; numThreads: number } };
  Tensor: new (type: 'float32', data: Float32Array, dims: number[]) => unknown;
  InferenceSession: { create(url: string, options?: object): Promise<OrtSession> };
}

declare global {
  interface Window {
    ort?: Ort;
  }
}

const ORT_SCRIPT = '/ort/ort.wasm.min.js';
const MODEL_URL = '/models/u2netp.onnx';

let sessionPromise: Promise<{ ort: Ort; session: OrtSession }> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(el);
  });
}

async function init() {
  if (!window.ort) await loadScript(ORT_SCRIPT);
  const ort = window.ort!;
  ort.env.wasm.wasmPaths = '/ort/';
  // Multi-threading needs cross-origin isolation, which the site doesn't set.
  ort.env.wasm.numThreads = 1;
  const session = await ort.InferenceSession.create(MODEL_URL, { executionProviders: ['wasm'] });
  return { ort, session };
}

function getSession() {
  if (!sessionPromise) {
    sessionPromise = init().catch((e) => {
      sessionPromise = null; // allow retry on the next photo
      throw e;
    });
  }
  return sessionPromise;
}

/** Starts downloading the runtime + model in the background (e.g. when the register screen opens). */
export function preloadSegmentation() {
  getSession().catch(() => {});
}

/**
 * Returns the garment probability map (0..1) at U2NET_SIZE × U2NET_SIZE for
 * an image source, or null if the model couldn't be loaded.
 */
export async function segmentGarment(source: CanvasImageSource): Promise<Float32Array | null> {
  let loaded: Awaited<ReturnType<typeof getSession>>;
  try {
    loaded = await getSession();
  } catch (e) {
    console.warn('[segment] background-removal model unavailable, using basic cut-out', e);
    return null;
  }
  const { ort, session } = loaded;
  const canvas = document.createElement('canvas');
  canvas.width = U2NET_SIZE;
  canvas.height = U2NET_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, U2NET_SIZE, U2NET_SIZE);
  const { data } = ctx.getImageData(0, 0, U2NET_SIZE, U2NET_SIZE);
  const input = new ort.Tensor('float32', toModelInput(data), [1, 3, U2NET_SIZE, U2NET_SIZE]);
  const out = await session.run({ [session.inputNames[0]]: input });
  return normalizeOutput(out[session.outputNames[0]].data);
}
