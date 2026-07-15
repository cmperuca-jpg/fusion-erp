import { Router } from "express";
import { CANONICAL_PORTALS } from "../../../config/modules.config.mjs";

const router = Router();

router.get("/status", (_req, res) => {
  res.json({
    ok: true,
    version: "3.0.0-portals",
    canonical: CANONICAL_PORTALS,
    policy: {
      deleteLegacyNow: false,
      redirectLegacyPages: true,
      mountLegacyApis: false
    },
    timestamp: new Date().toISOString()
  });
});

export default router;
