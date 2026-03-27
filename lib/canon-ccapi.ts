/**
 * Canon CCAPI (Camera Control API) client for WiFi-connected Canon cameras.
 * Supports Canon EOS R3, R8, R5 Mark II over local network HTTP.
 *
 * CCAPI documentation reference:
 *   Base URL: http://<camera-ip>:8080
 *   Endpoints under /ccapi/ver100/...
 */

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface CameraInfo {
  productname?: string;
  serialnumber?: string;
  firmwareversion?: string;
  macaddress?: string;
  currentconnection?: string;
}

export interface ExposureSettings {
  iso?: string;
  av?: string; // Aperture value
  tv?: string; // Shutter speed (time value)
  exposure?: string;
}

export interface ContentEntry {
  name: string;
  url: string;
  kind?: string;
}

export interface ContentListResponse {
  url: string[];
  path: string[];
}

const CCAPI_PORT = 8080;
const CCAPI_BASE = '/ccapi/ver100';
const TIMEOUT_MS = 5000;

// Fetch with timeout wrapper for CCAPI requests
async function ccapiFetch(
  url: string,
  options: RequestInit = {},
  timeoutMs = TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

function baseUrl(ip: string): string {
  return `http://${ip}:${CCAPI_PORT}${CCAPI_BASE}`;
}

/**
 * Ping the camera to verify connectivity and get device info
 */
export async function getCameraInfo(ip: string): Promise<CameraInfo> {
  const res = await ccapiFetch(`${baseUrl(ip)}/deviceinformation`);
  if (!res.ok) throw new Error(`Camera returned ${res.status}`);
  return res.json();
}

/**
 * Get the current connection status by pinging
 */
export async function checkConnection(ip: string): Promise<boolean> {
  try {
    const res = await ccapiFetch(`${baseUrl(ip)}/deviceinformation`, {}, 3000);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Trigger the shutter (take a photo)
 * POST /ccapi/ver100/shooting/control/shutterbutton
 */
export async function triggerShutter(ip: string): Promise<void> {
  const res = await ccapiFetch(
    `${baseUrl(ip)}/shooting/control/shutterbutton`,
    {
      method: 'POST',
      body: JSON.stringify({ af: true }),
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Shutter failed (${res.status}): ${text}`);
  }
}

/**
 * Release the shutter button (half-press release for AF unlock)
 */
export async function releaseShutter(ip: string): Promise<void> {
  try {
    await ccapiFetch(
      `${baseUrl(ip)}/shooting/control/shutterbutton`,
      {
        method: 'POST',
        body: JSON.stringify({ af: false }),
      }
    );
  } catch {
    // Non-critical
  }
}

/**
 * Get current shooting settings (ISO, Av, Tv)
 */
export async function getShootingSettings(ip: string): Promise<ExposureSettings> {
  const results: ExposureSettings = {};

  const endpoints = [
    { key: 'iso' as const, path: '/shooting/settings/iso' },
    { key: 'av' as const, path: '/shooting/settings/av' },
    { key: 'tv' as const, path: '/shooting/settings/tv' },
    { key: 'exposure' as const, path: '/shooting/settings/exposure' },
  ];

  await Promise.all(
    endpoints.map(async ({ key, path }) => {
      try {
        const res = await ccapiFetch(`${baseUrl(ip)}${path}`, {}, 3000);
        if (res.ok) {
          const data = await res.json();
          results[key] = data.value ?? data.currentvalue ?? String(data);
        }
      } catch {
        // Setting not available on this model
      }
    })
  );

  return results;
}

/**
 * Set a shooting parameter (ISO, Av, Tv)
 */
export async function setShootingSetting(
  ip: string,
  setting: 'iso' | 'av' | 'tv',
  value: string
): Promise<void> {
  const res = await ccapiFetch(
    `${baseUrl(ip)}/shooting/settings/${setting}`,
    {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to set ${setting} to ${value}`);
  }
}

/**
 * Get live view frame URL.
 * The camera streams JPEG frames at /ccapi/ver100/shooting/liveview/flip
 */
export function getLiveViewUrl(ip: string): string {
  return `http://${ip}:${CCAPI_PORT}${CCAPI_BASE}/shooting/liveview/flip`;
}

/**
 * Start live view on camera
 */
export async function startLiveView(ip: string): Promise<void> {
  try {
    await ccapiFetch(
      `${baseUrl(ip)}/shooting/liveview`,
      { method: 'POST', body: JSON.stringify({ liveviewsize: 'medium' }) }
    );
  } catch {
    // Some models auto-start liveview
  }
}

/**
 * Stop live view on camera
 */
export async function stopLiveView(ip: string): Promise<void> {
  try {
    await ccapiFetch(
      `${baseUrl(ip)}/shooting/liveview`,
      { method: 'DELETE' }
    );
  } catch {
    // Non-critical
  }
}

/**
 * List storage contents (photos on the camera's card)
 * Returns URLs to JPEG files.
 */
export async function listContents(ip: string): Promise<string[]> {
  try {
    const res = await ccapiFetch(`${baseUrl(ip)}/contents/sd/100CANON`, {}, 8000);
    if (!res.ok) return [];
    const data: ContentListResponse = await res.json();
    return data.url ?? [];
  } catch {
    return [];
  }
}

/**
 * Get the latest photo URL from the camera
 * Polls /ccapi/ver100/event/polling to detect new images
 */
export async function pollForNewPhotos(
  ip: string,
  knownUrls: Set<string>
): Promise<string[]> {
  const allUrls = await listContents(ip);
  return allUrls.filter((url) => !knownUrls.has(url));
}

/**
 * Download a photo from the camera by URL and return a blob
 */
export async function downloadPhoto(photoUrl: string): Promise<Blob> {
  const res = await ccapiFetch(photoUrl, {}, 30000);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return res.blob();
}

/**
 * Detect Canon model from device info
 */
export function detectModel(info: CameraInfo): string {
  const name = (info.productname ?? '').toLowerCase();
  if (name.includes('r3')) return 'EOS R3';
  if (name.includes('r5') && name.includes('ii')) return 'EOS R5 Mark II';
  if (name.includes('r5')) return 'EOS R5';
  if (name.includes('r8')) return 'EOS R8';
  if (name.includes('r6') && name.includes('ii')) return 'EOS R6 Mark II';
  if (name.includes('r6')) return 'EOS R6';
  return info.productname ?? 'Canon EOS';
}

/**
 * Attempt to discover a Canon camera on a common local IP range.
 * Scans the last octet of a given subnet prefix.
 * This is a best-effort scan — not as reliable as mDNS/Bonjour.
 */
export async function scanLocalNetwork(
  subnetPrefix = '192.168.1',
  startIp = 1,
  endIp = 30
): Promise<{ ip: string; info: CameraInfo }[]> {
  const found: { ip: string; info: CameraInfo }[] = [];

  // Scan in small batches to avoid overwhelming the network
  const batchSize = 10;
  for (let i = startIp; i <= endIp; i += batchSize) {
    const batch = [];
    for (let j = i; j < Math.min(i + batchSize, endIp + 1); j++) {
      const ip = `${subnetPrefix}.${j}`;
      batch.push(
        getCameraInfo(ip)
          .then((info) => {
            found.push({ ip, info });
          })
          .catch(() => {
            // Not a Canon camera at this IP
          })
      );
    }
    await Promise.all(batch);
  }

  return found;
}
