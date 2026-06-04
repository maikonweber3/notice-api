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
      description: "API para noticias coletadas com filtros, stats e ingestao manual.",
      version: "1.0.0",
    },
    components: {
      securitySchemes: {
        runnerToken: {
          type: "apiKey",
          in: "header",
          name: "Authorization",
          description: "Bearer token (RUNNER_TOKEN). Alternativa: header X-Runner-Token.",
        },
      },
    },
  },
});

await app.register(swaggerUi, {
  routePrefix: "/docs",
});

await registerRoutes(app);

app.addHook("onClose", async () => {
  await pool.end();
});

app.listen({ port: config.port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
