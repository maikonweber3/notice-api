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
      title: "Notice API",
      description:
        "API pública de notícias, catálogo Shopee Affiliate e banners. Rotas internas (X/tweet, ingestão, cleanup) não são documentadas aqui.",
      version: "1.1.0",
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
