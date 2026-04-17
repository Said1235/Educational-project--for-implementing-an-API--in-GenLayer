---
title: "Build AI-Verified APIs on the Blockchain with GenLayer — A Complete Guide"
published: true
description: "Learn what GenLayer is, why it matters, and how to build a production-ready REST API backed by a real Intelligent Contract — step by step."
tags: blockchain, ai, webdev, javascript
cover_image: https://dev-to-uploads.s3.amazonaws.com/uploads/articles/placeholder.png
canonical_url: 
series: Building on GenLayer
---

> 🔗 **Live demo:** [engagechain-api-use.vercel.app](https://engagechain-api-use.vercel.app) · **Full app:** [engagechain.vercel.app](https://engagechain.vercel.app) · **Docs:** [engagechaindocs.netlify.app](https://engagechaindocs.netlify.app)

---

## 👋 What you'll learn

By the end of this guide you will:

- Understand what GenLayer is and **why it is fundamentally different** from Ethereum
- Know the key benefits of building on GenLayer
- Have **deployed a real Intelligent Contract** with AI inside it
- Have a **working REST API** (deployable to Vercel, Railway, or Heroku in minutes) that anyone can consume

No crypto experience needed. If you know Python and Node.js, you're ready.

---

# 🧩 Part 1 — What Is GenLayer?

## The problem with existing blockchains

Smart contracts on Ethereum (and most blockchains) have one hard constraint: **they must be 100% deterministic.**

Every validator node on the network runs the same code, and they must all produce the *exact same result*. That's how consensus works.

This rule means you **cannot** do any of the following inside a smart contract:
- Call an external API
- Use an AI model
- Access real-world data
- Make any decision that depends on something outside the chain

The classic solution is an **oracle** — a separate service that fetches external data and feeds it to the contract. But oracles introduce trust assumptions: you're back to relying on a centralized intermediary.

## GenLayer's solution: Optimistic Democracy

GenLayer is a blockchain protocol that **removes the determinism constraint** — safely.

The core idea is called **Optimistic Democracy**, and it works like this:

```
Instead of: "All nodes must return IDENTICAL results"
GenLayer says: "All nodes must return EQUIVALENT results"
```

Here's the flow:

1. **The Leader** — one validator executes the contract. Calls the AI, gets a result.
2. **The Validators** — other nodes independently execute the same contract. Each calls the AI separately.
3. **Equivalence check** — instead of comparing bytes, GenLayer compares *meaning*. If the results are semantically equivalent, consensus is reached.
4. **Finalization** — the agreed result is stored on-chain, immutable.

> 💡 **Real example:** The leader's AI returns `"This proposal is innovative and positive"`. A validator's AI returns `"Novel and optimistic proposal"`. Different words — same meaning. **Consensus reached. ✓**

## The GenVM and Intelligent Contracts

GenLayer contracts run inside **GenVM**, a sandboxed Python runtime that provides special primitives unavailable in any other blockchain:

| Primitive | What it does |
|-----------|-------------|
| `gl.nondet.exec_prompt(task)` | Calls an LLM with a prompt, returns the response as a string |
| `gl.eq_principle.strict_eq(fn)` | Runs a non-deterministic function and coordinates consensus among validators |
| `gl.message.sender_address` | The address that signed the current transaction |
| `TreeMap[K, V]` | Persistent key-value storage that survives between transactions |

These contracts are called **Intelligent Contracts** — they can think, reason, and validate using AI, while still being verified by a decentralized network.

## A minimal Intelligent Contract

Here's the simplest possible GenLayer contract that calls an AI:

```python
# { "Depends": "py-genlayer:test" }
# ↑ Required first line — tells GenVM which SDK version to use

from genlayer import *
import json, typing

class HelloAI(gl.Contract):
    answers: TreeMap[str, str]  # persistent storage: question → answer

    def __init__(self):
        pass  # no initialization needed

    @gl.public.write
    def ask(self, question: str) -> typing.Any:
        """
        Sends a question to the LLM.
        Multiple validators each call the LLM independently.
        gl.eq_principle.strict_eq ensures they agree before storing.
        """

        def get_answer() -> str:
            # This runs inside each validator node
            raw = gl.nondet.exec_prompt(f"Answer this briefly: {question}")
            return raw.strip()

        # Reach consensus — validators compare answers for equivalence
        consensus_answer = gl.eq_principle.strict_eq(get_answer)

        # Store the agreed answer on-chain
        self.answers[question] = consensus_answer
        return consensus_answer

    @gl.public.view
    def get_answer(self, question: str) -> typing.Any:
        """Read-only — no gas, no wallet needed."""
        return self.answers.get(question, "Not answered yet")
```

That's it. **An AI runs inside the contract. Multiple validators verify the result. The answer is stored on-chain permanently.**

---

# 🚀 Part 2 — Why Build on GenLayer?

## Benefit 1: Native AI without oracles

On every other blockchain, AI is external. You have to trust the oracle, the API provider, and the data pipeline.

On GenLayer, **the LLM is inside the contract execution itself**. The AI call is part of the transaction — verified by every validator node. No oracle needed. No trust assumption.

```python
# This is valid GenLayer contract code.
# The AI call happens INSIDE the smart contract.
result = gl.nondet.exec_prompt("Analyze this proposal and return JSON.")
```

## Benefit 2: Python — no new language to learn

Ethereum requires Solidity. GenLayer requires Python. That's it.

- No new syntax
- Standard Python libraries available
- Familiar type system
- Clean, readable code

## Benefit 3: Non-determinism is a feature, not a bug

GenLayer embraces the fact that AI outputs vary. The Equivalence Principle lets you build contracts that work with fuzzy, semantic results — proposals, reviews, content analysis, governance votes — things that a deterministic contract simply cannot handle.

## Benefit 4: Frontend-agnostic by design

GenLayer exposes a standard JSON-RPC API. You can read contract state from any language with `fetch()`. Write transactions use `genlayer-js` (an npm package). No Metamask required for reads. Any frontend works.

```javascript
// Read any opinion from the contract — zero setup, no wallet
const res = await fetch('https://studio.genlayer.com:8443/api', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'gen_call',
    params: [{ from: '0x000...', to: CONTRACT_ADDRESS,
               type: 'read', data: { function: 'get_answer', args: ['What is Web3?'] },
               status: 'accepted' }]
  })
});
const { result } = await res.json();
```

## Benefit 5: Multiple use cases from one contract

The same pattern — submit input → AI evaluate → consensus → on-chain record — applies to:

- 🗳️ DAO governance pre-filtering
- 🛡️ Content moderation
- 🔍 Smart contract auditing
- ⭐ Review validation
- ⚖️ Dispute resolution
- 🔌 Any domain that needs trustless AI verification

---

# 🛠️ Part 3 — Build a Real API on GenLayer

Let's build **a production-ready REST API** backed by an Intelligent Contract. We'll use [EngageChain](https://github.com/Said1235/Engagechain-api) as our reference — a real contract live on GenLayer studionet.

## Architecture overview

```
Client (any language)
        │
        ▼
  REST API (Node.js)          ← You deploy this on Vercel / Railway
        │
        ▼
  /api/rpc  proxy             ← Serverless function, bypasses CORS
        │
        ▼
  GenLayer studionet          ← Blockchain + AI validators
        │
        ▼
  Intelligent Contract        ← Python, runs the LLM
```

> ⚠️ **Why the proxy?** Browsers cannot reach `studio.genlayer.com:8443` directly — CORS blocks it. A Vercel serverless function runs server-side, so it can make that request and return the result to your browser. All reads *and* writes go through it.

## Step 1 — Write the Intelligent Contract

Create `contract/my_contract.py`:

```python
# { "Depends": "py-genlayer:test" }

from genlayer import *
import json, typing

class MyContract(gl.Contract):
    # ── Persistent storage ────────────────────────────────────────────
    # All storage types must be str, bool, bigint, or sized integers.
    # Plain Python `int` and `float` are NOT supported in storage.
    entries:   TreeMap[str, str]   # id → input text
    results:   TreeMap[str, str]   # id → AI analysis JSON
    statuses:  TreeMap[str, str]   # id → pending | evaluated | done
    authors:   TreeMap[str, str]   # id → wallet address
    next_id:   str

    def __init__(self):
        self.next_id = "0"

    # ── WRITE: store new entry ────────────────────────────────────────
    @gl.public.write
    def submit(self, text: str) -> typing.Any:
        assert len(text) > 0,    "Text cannot be empty"
        assert len(text) <= 500, "Max 500 characters"

        entry_id = str(self.next_id)
        self.entries[entry_id]  = text
        self.results[entry_id]  = ""
        self.statuses[entry_id] = "pending"
        self.authors[entry_id]  = gl.message.sender_address.as_hex
        self.next_id            = str(int(self.next_id) + 1)

        return entry_id   # returned in transaction receipt

    # ── WRITE: run AI evaluation ──────────────────────────────────────
    @gl.public.write
    def evaluate(self, entry_id: str) -> typing.Any:
        assert entry_id in self.entries,             "Invalid ID"
        assert self.statuses[entry_id] == "pending", "Already evaluated"

        # ⚠️ Critical: read storage BEFORE the nondet block
        text = str(self.entries[entry_id])

        def run_ai() -> str:
            task = f"""Analyze this text and return ONLY valid JSON:
"{text}"

{{
  "summary": "one sentence",
  "sentiment": "positive or negative or neutral",
  "score": "0.85"
}}

Rules:
- score MUST be a quoted string "0.85", never a bare number
- Output ONLY the JSON. No markdown."""

            raw = gl.nondet.exec_prompt(task).replace("```json","").replace("```","").strip()
            parsed = json.loads(raw)

            # Always cast numeric fields to str — GenLayer cannot encode float
            parsed["score"] = str(parsed.get("score", "0"))

            return json.dumps(parsed, sort_keys=True)

        # Validators each run run_ai() and compare for equivalence
        result_str = gl.eq_principle.strict_eq(run_ai)

        self.results[entry_id]  = result_str
        self.statuses[entry_id] = "evaluated"

        return json.loads(result_str)

    # ── READ: get one entry (free, no wallet) ─────────────────────────
    @gl.public.view
    def get_entry(self, entry_id: str) -> typing.Any:
        assert entry_id in self.entries, "Invalid ID"
        return {
            "id":     entry_id,
            "text":   str(self.entries[entry_id]),
            "result": str(self.results[entry_id]),
            "status": str(self.statuses[entry_id]),
            "author": str(self.authors[entry_id]),
        }

    # ── READ: total count ─────────────────────────────────────────────
    @gl.public.view
    def get_count(self) -> typing.Any:
        return str(self.next_id)
```

### ⚠️ Common mistakes to avoid

```python
# ❌ WRONG — float cannot be stored or returned in calldata
score: float = 0.85

# ✅ CORRECT — always use str
score: str = "0.85"

# ❌ WRONG — int not supported in storage declarations
counts: TreeMap[str, int]

# ✅ CORRECT — use str or sized integer
counts: TreeMap[str, str]

# ❌ WRONG — reading storage inside nondet block (may fail)
def run_ai() -> str:
    text = self.entries[entry_id]  # ← don't do this
    ...

# ✅ CORRECT — read BEFORE the nondet block
text = str(self.entries[entry_id])  # ← read here
def run_ai() -> str:
    # use `text` from outer scope
    ...
```

## Step 2 — Deploy the Contract

1. Go to **[studio.genlayer.com](https://studio.genlayer.com)**
2. Click **New Contract** → paste your `my_contract.py`
3. Click **Deploy**
4. Copy the contract address (e.g. `0xAbC...123`)

> 💡 Studionet accounts are auto-created and auto-funded. No wallet or real tokens needed.

## Step 3 — Build the REST API

Create `api/index.js` — this works as both a **Vercel serverless function** and an **Express router** for Railway/Heroku:

```javascript
// api/index.js
'use strict';

const { Router } = (() => {
  try { return require('express'); }
  catch (_) { return { Router: null }; }
})();

// ── Config ────────────────────────────────────────────────────────────
const RPC      = process.env.GENLAYER_RPC || 'https://studio.genlayer.com:8443/api';
const CONTRACT = process.env.CONTRACT_ADDRESS || '';
const ZERO     = '0x0000000000000000000000000000000000000000';

// ── Read from contract (no wallet needed) ─────────────────────────────
async function read(method, args = []) {
  if (!CONTRACT) throw new Error('CONTRACT_ADDRESS env var not set');

  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: Date.now(), method: 'gen_call',
      params: [{ from: ZERO, to: CONTRACT, type: 'read',
                 data: { function: method, args }, status: 'accepted' }],
    }),
  });

  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

// ── Write to contract (requires wallet) ──────────────────────────────
async function write(method, args, privateKey) {
  if (!CONTRACT) throw new Error('CONTRACT_ADDRESS env var not set');

  // genlayer-js handles signing and broadcasting
  const { createClient, createAccount } = await import('https://esm.sh/genlayer-js@latest');
  const { studionet } = await import('https://esm.sh/genlayer-js@latest/chains');

  let account;
  const key = privateKey || process.env.PRIVATE_KEY;
  if (key) {
    const { privateKeyToAccount } = await import('https://esm.sh/viem@latest/accounts');
    account = privateKeyToAccount(key.startsWith('0x') ? key : '0x' + key);
  } else {
    account = createAccount(); // auto-generated studionet account (free)
  }

  const client = createClient({
    chain: studionet,
    account,
    endpoint: RPC,  // ← must be absolute URL
  });

  const txHash = await client.writeContract({
    address: CONTRACT, functionName: method, args, value: BigInt(0),
  });

  // Wait for AI consensus (~30–90 seconds for evaluate())
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash, status: 'FINALIZED', interval: 3000, retries: 120,
  });

  return {
    txHash,
    result: receipt?.result ?? receipt?.return_value ?? null,
  };
}

// ── Route handler ─────────────────────────────────────────────────────
async function handleRequest(method, path, body, headers) {
  const pk = headers['x-private-key'];

  // GET / — API info
  if (method === 'GET' && path === '/')
    return { name: 'My GenLayer API', contract: CONTRACT, rpc: RPC };

  // GET /entries — list all
  if (method === 'GET' && path === '/entries')
    return read('get_entry', ['0']); // example — extend as needed

  // GET /entries/count
  if (method === 'GET' && path === '/entries/count') {
    const total = await read('get_count', []);
    return { total: String(total) };
  }

  // GET /entries/:id
  const matchId = path.match(/^\/entries\/([^/]+)$/);
  if (matchId && method === 'GET')
    return read('get_entry', [matchId[1]]);

  // POST /entries — submit
  if (method === 'POST' && path === '/entries') {
    const { text } = body || {};
    if (!text) throw new Error('body.text is required');
    if (text.length > 500) throw new Error('text max 500 chars');
    const out = await write('submit', [text], pk);
    return { id: String(out.result), txHash: out.txHash, status: 'pending' };
  }

  // POST /entries/:id/evaluate
  const matchEval = path.match(/^\/entries\/([^/]+)\/evaluate$/);
  if (matchEval && method === 'POST') {
    const out = await write('evaluate', [matchEval[1]], pk);
    return { id: matchEval[1], txHash: out.txHash, status: 'evaluated', result: out.result };
  }

  throw Object.assign(new Error('Not found'), { status: 404 });
}

// ── Vercel export ─────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Private-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const path = (req.url || '/').replace(/^\/api/, '').split('?')[0] || '/';

  try {
    const data = await handleRequest(req.method, path, req.body, req.headers);
    res.status(200).json({ ok: true, ...data });
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: err.message });
  }
};

// ── Express router (Railway / Heroku) ────────────────────────────────
if (Router) {
  const router = Router();
  router.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
  });
  router.all('*', async (req, res) => {
    try {
      const data = await handleRequest(req.method, req.path, req.body, req.headers);
      res.status(200).json({ ok: true, ...data });
    } catch (err) {
      res.status(err.status || 500).json({ ok: false, error: err.message });
    }
  });
  module.exports.router = router;
}
```

## Step 4 — Configure and deploy

**`package.json`:**

```json
{
  "name": "my-genlayer-api",
  "version": "1.0.0",
  "scripts": { "start": "node server.js" },
  "engines": { "node": ">=18.x" },
  "dependencies": {
    "express": "^4.19.2",
    "cors": "^2.8.5"
  }
}
```

**`vercel.json`:**

```json
{
  "version": 2,
  "functions": {
    "api/**/*.js": { "maxDuration": 60 }
  }
}
```

**`.env`:**

```bash
# Required
CONTRACT_ADDRESS=0xYourContractAddressHere

# Optional
GENLAYER_RPC=https://studio.genlayer.com:8443/api
PRIVATE_KEY=0xyour_private_key  # or pass X-Private-Key header per request
```

**Deploy:**

```bash
# Vercel (recommended — auto-detects the /api folder)
npm install -g vercel
vercel env add CONTRACT_ADDRESS
vercel --prod

# Railway
# Push to GitHub → connect repo → add env vars in dashboard

# Heroku
heroku create
heroku config:set CONTRACT_ADDRESS=0xYour...
git push heroku main

# Local
npm install && node server.js
```

## Step 5 — Test it

```bash
# Health check
curl https://your-api.vercel.app/

# Submit an entry
curl -X POST https://your-api.vercel.app/entries \
  -H "Content-Type: application/json" \
  -d '{ "text": "AI consensus is the future of trust" }'

# Response
# { "ok": true, "id": "0", "txHash": "0xabc...", "status": "pending" }

# Evaluate with AI (~30–90 seconds — AI consensus takes time)
curl -X POST https://your-api.vercel.app/entries/0/evaluate

# Response
# { "ok": true, "id": "0", "status": "evaluated",
#   "result": { "summary": "...", "sentiment": "positive", "score": "0.91" } }

# Read back (free, no wallet)
curl https://your-api.vercel.app/entries/0
```

---

# 📁 Repository Template

Clone the ready-to-use template:

```bash
git clone https://github.com/Said1235/Engagechain-api.git
cd Engagechain-api
npm install
cp .env.example .env
# Add your CONTRACT_ADDRESS to .env
node server.js
```

**Project structure:**

```
my-genlayer-api/
├── api/
│   └── index.js        ← All endpoints (Vercel serverless + Express router)
├── contract/
│   └── my_contract.py  ← GenLayer Intelligent Contract
├── .env.example        ← Environment variable template
├── .gitignore
├── package.json
├── Procfile            ← For Heroku: "web: node server.js"
├── server.js           ← Express entry point for Railway/Heroku
└── vercel.json         ← Vercel configuration
```

---

# 🔑 Key Takeaways

| Concept | What to remember |
|---------|-----------------|
| GenLayer contracts are Python | No new language — just Python + the `genlayer` SDK |
| `float` is not supported in calldata | Always cast AI scores to `str`: `str(parsed.get("score", "0"))` |
| Read storage before `nondet` blocks | Access `self.field` outside `def run_ai()`, not inside |
| `-> typing.Any` on all view methods | Prevents `"Value must be an instance of str"` from genlayer-js |
| Endpoint must be absolute URL | `window.location.origin + '/api/rpc'` — never a relative path |
| FINALIZED takes 30–120 seconds | AI consensus is not instant — set `retries: 120` |

---

# 🧪 Try it live

- 🌐 **Live App:** [engagechain.vercel.app](https://engagechain.vercel.app)
- ⚡ **API Demo:** [engagechain-api-use.vercel.app](https://engagechain-api-use.vercel.app)
- 📚 **Docs:** [engagechaindocs.netlify.app](https://engagechaindocs.netlify.app)
- 📦 **GitHub:** [github.com/Said1235/Engagechain-api](https://github.com/Said1235/Engagechain-api)

---

*Built with ❤️ on GenLayer. Questions? Drop them in the comments — happy to help you ship your first Intelligent Contract.*
