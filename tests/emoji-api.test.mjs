import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/emoji.js';

function mockResponse() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; }
  };
}

function mediaResponse(status, type, bytes = new Uint8Array([1, 2, 3])) {
  return {
    ok: status === 200,
    headers: { get: name => name === 'content-type' ? type : null },
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  };
}

test('emoji proxy serves the animated GIF before static fallbacks', async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async url => {
    urls.push(String(url));
    return mediaResponse(200, 'image/gif');
  };
  try {
    const response = mockResponse();
    await handler({ method: 'GET', query: { name: '150633-staff' } }, response);
    assert.equal(urls.length, 1);
    assert.match(urls[0], /150633-staff\.gif$/);
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['Content-Type'], 'image/gif');
    assert.deepEqual([...response.body], [1, 2, 3]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('emoji proxy falls back to WebP when the GIF is unavailable', async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async url => {
    urls.push(String(url));
    return urls.length === 1
      ? mediaResponse(404, 'text/html')
      : mediaResponse(200, 'image/webp; charset=binary');
  };
  try {
    const response = mockResponse();
    await handler({ method: 'GET', query: { name: '150633-staff' } }, response);
    assert.match(urls[0], /\.gif$/);
    assert.match(urls[1], /\.webp$/);
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['Content-Type'], 'image/webp');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('emoji proxy falls back to PNG when animated formats are unavailable', async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async url => {
    urls.push(String(url));
    return urls.length < 3
      ? mediaResponse(404, 'text/html')
      : mediaResponse(200, 'image/png');
  };
  try {
    const response = mockResponse();
    await handler({ method: 'GET', query: { name: '150633-staff' } }, response);
    assert.match(urls[0], /\.gif$/);
    assert.match(urls[1], /\.webp$/);
    assert.match(urls[2], /\.png$/);
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['Content-Type'], 'image/png');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('emoji proxy rejects invalid names without making upstream requests', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw Error('Unexpected fetch'); };
  try {
    const response = mockResponse();
    await handler({ method: 'GET', query: { name: '../other-host' } }, response);
    assert.equal(response.statusCode, 400);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
