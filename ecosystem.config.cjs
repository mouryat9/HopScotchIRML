// PM2 Ecosystem Configuration for Hopscotch
// Manages backend, frontend, and cloudflare tunnel with auto-restart

const path = require('path');
const HOME = process.env.HOME || '/home/aietlab';
const ROOT = path.join(HOME, 'hopscotch');

// Load ROOT/.env into process.env so secrets (MONGO_URI = the production
// Atlas cluster, RESEND_API_KEY) are always set when this config starts the
// apps - even from a shell that never sourced .env (e.g. `pm2 resurrect`
// after a reboot). Without this the backend silently falls back to the local
// stale Mongo, which has caused two production incidents. Only fills in vars
// that are not already set.
(function loadEnvFile() {
  const fs = require('fs');
  try {
    const txt = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      if (process.env[m[1]] === undefined || process.env[m[1]] === '') process.env[m[1]] = val;
    }
  } catch (e) { /* .env is optional */ }
})();

module.exports = {
  apps: [
    {
      name: 'hopscotch-backend',
      cwd: ROOT,
      interpreter: 'none',
      script: path.join(ROOT, 'hopscotchenv', 'bin', 'uvicorn'),
      args: 'app_chat:app --host 0.0.0.0 --port 9580',
      autorestart: true,
      restart_delay: 3000,       // wait 3s before restarting
      max_restarts: 50,          // max restarts within exp_backoff window
      min_uptime: 10000,         // consider started after 10s
      max_memory_restart: '2G', // auto-restart if memory exceeds 2GB
      watch: false,
      env: {
        PATH: `${path.join(ROOT, 'hopscotchenv', 'bin')}:${process.env.PATH}`,
        VIRTUAL_ENV: path.join(ROOT, 'hopscotchenv'),
        RESEND_API_KEY: process.env.RESEND_API_KEY || '',
        // MongoDB Atlas — shared between Lambda and GPU cluster
        // Set the real URI via shell env (do not commit the password)
        MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017',
        MONGO_DB_NAME: process.env.MONGO_DB_NAME || 'hopscotch',
        // LLM backend — TEMPORARY: forced to ollama while cluster recovers
        LLM_BACKEND: 'ollama',
        VLLM_URL: 'https://vllm.hopscotchai.us/v1/chat/completions',
        VLLM_MODEL: 'Qwen/Qwen2.5-14B-Instruct',
        LLM_MODEL: 'qwen2.5:14b',
      },
    },
    {
      name: 'hopscotch-frontend',
      cwd: path.join(ROOT, 'hopscotch-ui'),
      script: path.join(HOME, '.npm-global', 'bin', 'serve'),
      args: 'dist -s -l 9581',    // -s: SPA fallback, -l: listen port
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 50,
      min_uptime: 5000,
    },
    {
      name: 'hopscotch-tunnel',
      script: '/usr/local/bin/cloudflared',
      args: 'tunnel run hopscotch',
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 50,
      min_uptime: 5000,
    },
  ],
};
