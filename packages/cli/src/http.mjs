export async function requestJson(baseUrl, path, options = {}) {
  const url = `${baseUrl}${path}`;
  const { token, timeoutMs = 30_000, signal, ...fetchOptions } = options;
  const optionHeaders = normalizeHeaders(options.headers);
  const headers = {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...optionHeaders,
  };
  if (shouldGenerateIdempotencyKey(path, options, headers)) {
    headers["Idempotency-Key"] = `cli-${randomId()}`;
  }
  const res = await fetch(url, {
    ...fetchOptions,
    headers,
    signal: signal || AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      const contentType = res.headers.get("content-type") || "unknown content type";
      throw new Error(`Expected JSON from ${url} but received ${contentType} (HTTP ${res.status})`);
    }
  }
  if (!res.ok) {
    const message = body?.error?.message || body?.error || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

function normalizeHeaders(headers) {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...headers };
}

function hasHeader(headers, name) {
  const expected = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === expected);
}

function shouldGenerateIdempotencyKey(path, options, headers) {
  const method = String(options.method || "GET").toUpperCase();
  if (method !== "POST") return false;
  if (!path.endsWith("/chat/completions")) return false;
  if (hasHeader(headers, "Idempotency-Key") || hasHeader(headers, "X-Idempotency-Key")) return false;

  const body = parseJsonBody(options.body);
  return body && body.stream !== true;
}

function parseJsonBody(body) {
  if (!body) return null;
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  if (body && typeof body === "object" && !(body instanceof ArrayBuffer)) return body;
  return null;
}

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const value = Math.floor(Math.random() * 16);
    const nibble = ch === "x" ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
}
