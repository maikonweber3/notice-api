/**
 * PM2 — produção na VPS (Postgres existente em iputa-postgres:5433)
 * Uso: pm2 start ecosystem.config.cjs --env production
 */
module.exports = {
  apps: [
    {
      name: "notice-api",
      cwd: __dirname,
      script: "src/api/server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env_production: {
        NODE_ENV: "production",
      },
    },
    {
      name: "notice-worker",
      cwd: __dirname,
      script: "src/worker/cron.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "256M",
      env_production: {
        NODE_ENV: "production",
      },
    },
    {
      name: "notice-shopee-worker",
      cwd: __dirname,
      script: "src/worker/shopeeCron.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "256M",
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
