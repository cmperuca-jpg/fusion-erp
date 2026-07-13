import express from 'express';
import { obterProgresso, listarPremiadosMes } from './fidelidade.service.mjs';
const router=express.Router();
router.get('/aluno/:alunoId',async(req,res)=>{try{res.json(await obterProgresso(req.params.alunoId));}catch(e){res.status(500).json({ok:false,mensagem:e.message});}});
router.get('/premiados',async(req,res)=>{try{res.json({ok:true,competencia:req.query.competencia||new Date().toISOString().slice(0,7),premiados:await listarPremiadosMes(req.query.competencia)});}catch(e){res.status(500).json({ok:false,mensagem:e.message});}});
export default router;
