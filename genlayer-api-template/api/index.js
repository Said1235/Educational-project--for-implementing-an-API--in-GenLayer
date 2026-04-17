/**
 * GenLayer API Template — api/index.js
 *
 * Dual-mode:
 *   • Vercel serverless function  → just deploy, no server needed
 *   • Express router              → used by server.js for Railway / Heroku
 *
 * ENDPOINTS:
 *   GET  /                   → API info
 *   GET  /health             → health check
 *   GET  /entries            → get_all()
 *   GET  /entries/count      → get_count()
 *   GET  /entries/:id        → get_entry(id)
 *   GET  /entries/:id/status → get_status(id)
 *   POST /entries            → submit(text)        ← write, needs X-Private-Key
 *   POST /entries/:id/evaluate  → evaluate(id)     ← write, needs X-Private-Key
 *   POST /entries/:id/done   → mark_done(id, note) ← write, needs X-Private-Key
 *   POST /rpc                → raw JSON-RPC proxy
 *
 * AUTH:
 *   Write endpoints require a wallet private key.
 *   Pass it as the header: X-Private-Key: 0xyourkey
 *   OR set PRIVATE_KEY in your environment variables.
 *   If neither is set, a fresh studionet key is auto-generated.
 *
 * ENV VARS:
 *   CONTRACT_ADDRESS  (required)  Your deployed contract address
 *   GENLAYER_RPC      (optional)  Default: studionet
 *   PRIVATE_KEY       (optional)  Default signing key
 *   PORT              (optional)  Default: 3000
 */

'use strict';

// Load Express if available (for Railway/Heroku via server.js)
const { Router } = (() => {
  try { return require('express'); }
  catch (_) { return { Router: null }; }
})();

// ── Configuration ─────────────────────────────────────────────────────────────
const RPC      = process.env.GENLAYER_RPC     || 'https://studio.genlayer.com:8443/api';
const CONTRACT = process.env.CONTRACT_ADDRESS || '';
const ZERO     = '0x0000000000000000000000000000000000000000';

// ── GenLayer READ — no wallet needed ─────────────────────────────────────────
/**
 * Calls a @gl.public.view method on the contract.
 * Uses gen_call — reads are free, instant, and need no signature.
 *
 * @param {string} method   - Contract method name
 * @param {any[]}  args     - Method arguments
 * @returns {Promise<any>}  - The method's return value
 */
async function read(method, args = []) {
  if (!CONTRACT) throw new Error('CONTRACT_ADDRESS env var is not set');

  const response = await fetch(RPC, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id:      Date.now(),
      method:  'gen_call',
      params: [{
        from:   ZERO,
        to:     CONTRACT,
        type:   'read',
        data:   { function: method, args },
        status: 'accepted',
      }],
    }),
  });

  const json = await response.json();
  if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
  return json.result;
}

// ── GenLayer WRITE — requires wallet signature ────────────────────────────────
/**
 * Calls a @gl.public.write method on the contract.
 * Signs the transaction with the provided private key.
 * Waits for FINALIZED status (AI consensus can take 30–120 seconds).
 *
 * @param {string}  method     - Contract method name
 * @param {any[]}   args       - Method arguments
 * @param {string}  privateKey - Wallet private key (or undefined for auto)
 * @returns {Promise<{txHash, result}>}
 */
async function write(method, args = [], privateKey) {
  if (!CONTRACT) throw new Error('CONTRACT_ADDRESS env var is not set');

  // Load genlayer-js (ESM) — handles signing and broadcasting
  const { createClient, createAccount } = await import('https://esm.sh/genlayer-js@latest');
  const { studionet }                   = await import('https://esm.sh/genlayer-js@latest/chains');

  // Resolve the signing account
  let account;
  const key = privateKey || process.env.PRIVATE_KEY;
  if (key) {
    // Use the provided private key
    const { privateKeyToAccount } = await import('https://esm.sh/viem@latest/accounts');
    account = privateKeyToAccount(key.startsWith('0x') ? key : '0x' + key);
  } else {
    // Auto-generate — works on studionet only (free, auto-funded)
    account = createAccount();
  }

  const client = createClient({
    chain:    studionet,
    account,
    endpoint: RPC,  // ← must be absolute URL; viem fails with relative paths
  });

  // Broadcast the transaction
  const txHash = await client.writeContract({
    address:      CONTRACT,
    functionName: method,
    args,
    value:        BigInt(0),
  });

  // Wait for full consensus (FINALIZED = AI validators agreed)
  // AI evaluation can take 30–120 seconds — retries: 120 = up to 6 minutes
  const receipt = await client.waitForTransactionReceipt({
    hash:     txHash,
    status:   'FINALIZED',
    interval: 3000,
    retries:  120,
  });

  // Per GenLayer docs: check execution result even after finalization
  if (receipt?.txExecutionResultName && receipt.txExecutionResultName !== 'FINISHED_WITH_RETURN') {
    throw new Error('Contract execution failed: ' + receipt.txExecutionResultName);
  }

  return {
    txHash,
    result: receipt?.result ?? receipt?.return_value ?? null,
  };
}

// ── Raw proxy ─────────────────────────────────────────────────────────────────
async function proxy(body) {
  const res = await fetch(RPC, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  return res.json();
}

// ── Route dispatcher ──────────────────────────────────────────────────────────
async function handleRequest(method, path, body, headers) {
  body = body || {};
  const pk = headers['x-private-key'] || headers['X-Private-Key'];

  // ── GET / ───────────────────────────────────────────────────────────
  if (method === 'GET' && path === '/') {
    return {
      name:     'My GenLayer API',
      version:  '1.0.0',
      contract: CONTRACT || '(set CONTRACT_ADDRESS)',
      rpc:      RPC,
      endpoints: {
        'GET  /entries':              'List all entries',
        'GET  /entries/count':        'Total count',
        'GET  /entries/:id':          'Full entry data',
        'GET  /entries/:id/status':   'Status only',
        'POST /entries':              'Submit entry. Body: { text }',
        'POST /entries/:id/evaluate': 'Run AI evaluation',
        'POST /entries/:id/done':     'Mark done. Body: { note }',
        'POST /rpc':                  'Raw JSON-RPC proxy',
      },
    };
  }

  // ── GET /health ─────────────────────────────────────────────────────
  if (method === 'GET' && path === '/health') {
    return { status: 'ok', contract: CONTRACT || null, rpc: RPC };
  }

  // ── POST /rpc — raw proxy ───────────────────────────────────────────
  if (method === 'POST' && path === '/rpc') {
    return proxy(body);
  }

  // ── GET /entries ────────────────────────────────────────────────────
  if (method === 'GET' && path === '/entries') {
    return read('get_all', []);
  }

  // ── GET /entries/count ──────────────────────────────────────────────
  if (method === 'GET' && path === '/entries/count') {
    const total = await read('get_count', []);
    return { total: String(total) };
  }

  // ── GET /entries/:id ────────────────────────────────────────────────
  const matchId = path.match(/^\/entries\/([^/]+)$/);
  if (matchId && method === 'GET') {
    return read('get_entry', [matchId[1]]);
  }

  // ── GET /entries/:id/status ─────────────────────────────────────────
  const matchStatus = path.match(/^\/entries\/([^/]+)\/status$/);
  if (matchStatus && method === 'GET') {
    const status = await read('get_status', [matchStatus[1]]);
    return { id: matchStatus[1], status: String(status) };
  }

  // ── POST /entries — submit ──────────────────────────────────────────
  if (method === 'POST' && path === '/entries') {
    const { text } = body;
    if (!text || typeof text !== 'string') throw new Error('body.text is required (string)');
    if (text.trim().length === 0)          throw new Error('body.text cannot be empty');
    if (text.length > 500)                 throw new Error('body.text max 500 characters');

    const out = await write('submit', [text], pk);
    return { id: String(out.result), txHash: out.txHash, status: 'pending' };
  }

  // ── POST /entries/:id/evaluate ──────────────────────────────────────
  const matchEval = path.match(/^\/entries\/([^/]+)\/evaluate$/);
  if (matchEval && method === 'POST') {
    const out = await write('evaluate', [matchEval[1]], pk);
    return { id: matchEval[1], txHash: out.txHash, status: 'evaluated', result: out.result };
  }

  // ── POST /entries/:id/done ──────────────────────────────────────────
  const matchDone = path.match(/^\/entries\/([^/]+)\/done$/);
  if (matchDone && method === 'POST') {
    const { note } = body;
    if (!note || typeof note !== 'string') throw new Error('body.note is required (string)');
    const out = await write('mark_done', [matchDone[1], note], pk);
    return { id: matchDone[1], txHash: out.txHash, status: 'done', note };
  }

  // ── 404 ─────────────────────────────────────────────────────────────
  throw Object.assign(new Error('Not found: ' + method + ' ' + path), { status: 404 });
}

// ── Response helpers ──────────────────────────────────────────────────────────
function ok(res, data)  { res.status(200).json({ ok: true,  ...data }); }
function err(res, e)    { res.status(e.status || 500).json({ ok: false, error: e.message }); }
function parseQuery(u)  {
  try { const q = {}; new URL('http://x'+u).searchParams.forEach((v,k)=>q[k]=v); return q; }
  catch { return {}; }
}

// ── Vercel serverless export ──────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Private-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const path = (req.url || '/').replace(/^\/api/, '').split('?')[0] || '/';

  try {
    const data = await handleRequest(req.method, path, req.body, req.headers);
    ok(res, typeof data === 'object' && data !== null ? data : { data });
  } catch (e) { err(res, e); }
};

// ── Express router for server.js (Railway / Heroku) ───────────────────────────
if (Router) {
  const router = Router();
  router.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin',  '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Private-Key');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
  });
  router.all('*', async (req, res) => {
    try {
      const data = await handleRequest(req.method, req.path, req.body, req.headers);
      ok(res, typeof data === 'object' && data !== null ? data : { data });
    } catch (e) { err(res, e); }
  });
  module.exports.router = router;
}
