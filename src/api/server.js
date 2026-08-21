import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { registerRoutes } from "./routes.js";
import { restoreSession, stopSession } from "../integrations/whatsapp/gateway.js";
import { drainWhatsAppQueue } from "../services/whatsappOfferService.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: config.corsOrigin });

await app.register(swagger, {
  openapi: {
    info: {
      title: "Notice API",
      description:
        "API pública de notícias, catálogo Shopee Affiliate, ranking de ofertas e grupos de WhatsApp. Rotas internas (X, WhatsApp session, ingestão) não são documentadas aqui.",
      version: "1.2.0",
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
  await stopSession({ logout: false });
  await pool.end();
});

app.listen({ port: config.port, host: "0.0.0.0" }).then(async () => {
  try {
    await restoreSession();
  } catch (error) {
    app.log.error(error, "Falha ao restaurar sessão WhatsApp");
  }

  if (config.whatsappPublishEnabled) {
    setInterval(() => {
      drainWhatsAppQueue({ max: 5 }).catch((error) => {
        app.log.error(error, "Falha ao drenar fila WhatsApp");
      });
    }, config.whatsappDrainMs);
  }
}).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
