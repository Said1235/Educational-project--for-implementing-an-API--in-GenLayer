# ◈ GenLayer API Template

> A production-ready REST API template for building on top of **GenLayer Intelligent Contracts** — deployable on Vercel, Railway, or Heroku in minutes.

This template accompanies the tutorial:
**[Build AI-Verified APIs on the Blockchain with GenLayer](https://dev.to)**

---

## What is this?

This is a minimal, clean starting point for building a REST API backed by a GenLayer Intelligent Contract.

**The contract** (`contract/my_contract.py`) is a Python file that runs on GenLayer — a blockchain where smart contracts can call AI models natively.

**The API** (`api/index.js`) wraps the contract with REST endpoints. It works as both a Vercel serverless function and an Express server.

---

## Quick start

```bash
# 1. Clone
git clone https://github.com/your-username/genlayer-api-template.git
cd genlayer-api-template

# 2. Install
npm install

# 3. Deploy the contract
#    → Go to studio.genlayer.com
#    → New Contract → paste contract/my_contract.py → Deploy
#    → Copy the contract address

# 4. Configure
cp .env.example .env
# Edit .env → set CONTRACT_ADDRESS=0xYour...

# 5. Run locally
node server.js
# → http://localhost:3000
```

---

## Deploy

### Vercel (recommended)
```bash
npm install -g vercel
vercel env add CONTRACT_ADDRESS
vercel --prod
```

### Railway
Push to GitHub → connect repo on railway.app → add `CONTRACT_ADDRESS` env var.

### Heroku
```bash
heroku create my-api
heroku config:set CONTRACT_ADDRESS=0xYour...
git push heroku main
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | API info |
| GET | `/health` | Health check |
| GET | `/entries` | List all entries |
| GET | `/entries/count` | Total count |
| GET | `/entries/:id` | Full entry data |
| GET | `/entries/:id/status` | Status only |
| POST | `/entries` | Submit entry |
| POST | `/entries/:id/evaluate` | Run AI evaluation |
| POST | `/entries/:id/done` | Mark done |
| POST | `/rpc` | Raw JSON-RPC proxy |

---

## Auth

Write endpoints require a wallet private key:
```
X-Private-Key: 0xyourprivatekey
```
Or set `PRIVATE_KEY` in your `.env`. If neither is provided, a studionet key is auto-generated (free, only works on studionet).

---

## Example usage

```bash
# Submit
curl -X POST http://localhost:3000/entries \
  -H "Content-Type: application/json" \
  -d '{ "text": "AI consensus is the future of trust" }'

# Response
{ "ok": true, "id": "0", "txHash": "0x...", "status": "pending" }

# Evaluate with AI (30–90 seconds)
curl -X POST http://localhost:3000/entries/0/evaluate

# Read back
curl http://localhost:3000/entries/0
```

---

## Project structure

```
├── api/
│   └── index.js        ← All endpoints — Vercel serverless + Express router
├── contract/
│   └── my_contract.py  ← GenLayer Intelligent Contract
├── .env.example
├── .gitignore
├── package.json
├── Procfile            ← Heroku: "web: node server.js"
├── server.js           ← Express entry for Railway / Heroku
└── vercel.json
```

---

## Key rules for GenLayer contracts

| Rule | Why |
|------|-----|
| First line must be `# { "Depends": "py-genlayer:test" }` | GenVM needs to know the SDK version |
| `float` is not supported in calldata | Always cast scores: `str(parsed.get("score", "0"))` |
| Read storage before `nondet` blocks | `text = str(self.entries[id])` — then use `text` inside `def run_ai()` |
| All view methods return `typing.Any` | Prevents `"Value must be an instance of str"` from genlayer-js |
| `endpoint` must be absolute URL | `window.location.origin + '/api/rpc'` — never relative |

---

## Real-world example

This template is the foundation of **EngageChain** — a live AI consensus layer built on GenLayer:

- 🌐 App: [engagechain.vercel.app](https://engagechain.vercel.app)
- ⚡ API Demo: [engagechain-api-use.vercel.app](https://engagechain-api-use.vercel.app)
- 📚 Docs: [engagechaindocs.netlify.app](https://engagechaindocs.netlify.app)
- 📦 Full source: [github.com/Said1235/Engagechain-api](https://github.com/Said1235/Engagechain-api)

---

## License

MIT
