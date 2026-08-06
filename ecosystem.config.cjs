/**
 * PM2 — produção na VPS
 * Postgres: container `iputa-postgres` em 127.0.0.1:5433 (volume iputa-api_pgdata;
 * notice-api usa o database `notice_api` nele). Subir só o Postgres:
 *   cd /root/iputa/iputa-api && docker compose up -d postgres
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
    {
      name: "notice-x-worker",
      cwd: __dirname,
      script: "src/worker/xCron.js",
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
      name: "notice-frontend",
      cwd: `${__dirname}/frontend`,
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3003",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env_production: {
        NODE_ENV: "production",
        PORT: "3003",
        HOSTNAME: "127.0.0.1",
        NEXT_PUBLIC_NOTICE_API_URL: "https://notice.muttercorp.com.br",
        NEXT_PUBLIC_SITE_URL: "https://news.muttercorp.com.br",
        NEXT_PUBLIC_ENABLE_ADMIN: "false",
      },
    },
  ],
};
