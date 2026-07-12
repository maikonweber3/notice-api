import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { registerRoutes } from "./routes.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: config.corsOrigin });

await app.register(swagger, {
  openapi: {
    info: {
      title: "News Scraper API",
      description:
        "API de noticias + plataforma Shopee Affiliate (busca live, catálogo Postgres e banners).",
      version: "1.1.0",
    },
    components: {
      securitySchemes: {
        runnerToken: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "RUNNER_TOKEN",
          description:
            "Token de administracao (variavel RUNNER_TOKEN). No Authorize, cole apenas o token — o Swagger adiciona o prefixo Bearer.",
        },
      },
    },
  },
});

await app.register(swaggerUi, {
  routePrefix: "/docs",
  uiConfig: {
    persistAuthorization: true,
  },
});

await registerRoutes(app);

app.addHook("onClose", async () => {
  await pool.end();
});

app.listen({ port: config.port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
