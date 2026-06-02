import axios from "axios";
import { config } from "./config.js";

export const httpClient = axios.create({
  timeout: config.requestTimeoutMs,
  headers: {
    "User-Agent": config.userAgent,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  },
});
