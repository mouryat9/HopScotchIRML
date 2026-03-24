// PM2 Ecosystem Configuration for Hopscotch
// Manages backend, frontend, and cloudflare tunnel with auto-restart

const path = require('path');
const HOME = process.env.HOME || '/home/aietlab';
const ROOT = path.join(HOME, 'hopscotch');

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
      watch: false,
      env: {
        PATH: `${path.join(ROOT, 'hopscotchenv', 'bin')}:${process.env.PATH}`,
        VIRTUAL_ENV: path.join(ROOT, 'hopscotchenv'),
      },
    },
    {
      name: 'hopscotch-frontend',
      cwd: path.join(ROOT, 'hopscotch-ui'),
      script: 'node_modules/.bin/vite',
      args: '--host 0.0.0.0 --port 9581',
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
