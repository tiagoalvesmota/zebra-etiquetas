const express = require('express');
const oracle = require('../services/oracle');

module.exports = function() {
  const router = express.Router();

  // GET /api/paciente/atendimento/:nr
  router.get('/atendimento/:nr', async (req, res) => {
    try {
      const nr = req.params.nr.trim();
      if (!nr) return res.status(400).json({ error: 'Número de atendimento obrigatório' });

      const paciente = await oracle.buscarPorAtendimento(nr);
      if (!paciente) {
        return res.status(404).json({ error: `Atendimento ${nr} não encontrado` });
      }
      res.json(paciente);
    } catch (e) {
      console.error('[PACIENTE] Erro:', e.message);
      res.status(500).json({ error: 'Erro ao consultar banco de dados', detalhe: e.message });
    }
  });

  // GET /api/paciente/nome?q=joao
  router.get('/nome', async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || q.trim().length < 3) {
        return res.status(400).json({ error: 'Mínimo 3 caracteres para busca por nome' });
      }
      const pacientes = await oracle.buscarPorNome(q.trim());
      res.json(pacientes);
    } catch (e) {
      console.error('[PACIENTE] Erro busca nome:', e.message);
      res.status(500).json({ error: 'Erro ao consultar banco de dados', detalhe: e.message });
    }
  });

  return router;
};
