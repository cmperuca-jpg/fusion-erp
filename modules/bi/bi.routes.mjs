import { Router } from "express";
import * as biService from "./bi.service.mjs";

const router = Router();

router.get("/executivo", async (req, res) => {
  try {
    const dashboard = await biService.gerarDashboardExecutivo(req.query);
    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

router.get("/financeiro", async (req, res) => {
  try {
    const dashboard = await biService.gerarBIFinanceiro(req.query);
    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

router.get("/academia", async (req, res) => {
  try {
    const dashboard = await biService.gerarBIAcademia(req.query);
    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

router.get("/academia-operacional", async (req, res) => {
  try {
    const dashboard = await biService.gerarBIAcademiaOperacional(req.query);
    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

export default router;
