/**
 * server.js — Express entry point for Railway / Heroku
 * For Vercel, the /api/index.js file is used directly as a serverless function.
 *
 * Usage:
 *   npm install
 *   cp .env.example .env
 *   node server.js
 */
const express = require('express');
const cors    = require('cors');
const { router } = require('./api/index.js');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/', router);

app.listen(PORT, () => {
  console.log(`\n◈  GenLayer API running`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Contract: ${process.env.CONTRACT_ADDRESS || '(not set)'}`);
  console.log(`   RPC:      ${process.env.GENLAYER_RPC || 'https://studio.genlayer.com:8443/api'}\n`);
});
