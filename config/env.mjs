// config/env.mjs

import dotenv from "dotenv";

dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 3000),

  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

  JWT_SECRET: process.env.JWT_SECRET || "fusion-secret",

  APP_NAME: "Fusion ERP",
  APP_VERSION: "1.5.0"
};

export default env;