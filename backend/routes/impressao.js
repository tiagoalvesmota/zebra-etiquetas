const express = require('express');
const { gerarZPL, enviarParaImpressora, testarImpressora } = require('../services/zpl');

module.exports = function(db) {
  const router = express.Router();

  // POST /api/impressao/imprimir
  router.post('/imprimir', async (req, res) => {
    const { paciente, impressoraId, modeloId, copias } = req.body;

    if (!paciente || !impressoraId || !modeloId) {
      return res.status(400).json({ error: 'Dados incompletos: paciente, impressoraId e modeloId obrigatórios' });
    }

    const impressora = db.prepare('SELECT * FROM impressoras WHERE id = ? AND ativo = 1').get(impressoraId);
    if (!impressora) return res.status(404).json({ error: 'Impressora não encontrada' });

    const modelo = db.prepare('SELECT * FROM modelos_etiqueta WHERE id = ?').get(modeloId);
    if (!modelo) return res.status(404).json({ error: 'Modelo de etiqueta não encontrado' });

    const qtd = Math.min(Math.max(parseInt(copias) || 1, 1), 10);

    // Gera ZPL substituindo variáveis
    let zpl = gerarZPL(modelo.zpl_template, paciente);

    // Ajusta quantidade de cópias no ZPL
    zpl = zpl.replace(/\^PQ\d+,\d+,\d+,[YN]/, `^PQ${qtd},0,1,Y`);

    try {
      await enviarParaImpressora(impressora.ip, impressora.porta, zpl);

      // Log de impressão
      db.prepare(`
        INSERT INTO log_impressoes (usuario_id, usuario_nome, nr_atendimento, paciente_nome, impressora_ip, modelo_etiqueta, status)
        VALUES (?, ?, ?, ?, ?, ?, 'ok')
      `).run(
        req.session.userId,
        req.session.userNome,
        paciente.atendimento,
        paciente.nome,
        impressora.ip,
        modelo.nome
      );

      res.json({ ok: true, mensagem: `${qtd} etiqueta(s) enviadas para ${impressora.nome} (${impressora.ip})` });
    } catch (err) {
      // Log de erro
      db.prepare(`
        INSERT INTO log_impressoes (usuario_id, usuario_nome, nr_atendimento, paciente_nome, impressora_ip, modelo_etiqueta, status, erro)
        VALUES (?, ?, ?, ?, ?, ?, 'erro', ?)
      `).run(
        req.session.userId,
        req.session.userNome,
        paciente.atendimento,
        paciente.nome,
        impressora.ip,
        modelo.nome,
        err.message
      );

      res.status(500).json({ error: 'Falha ao enviar para impressora', detalhe: err.message });
    }
  });

  // POST /api/impressao/preview-zpl
  router.post('/preview-zpl', (req, res) => {
    const { paciente, modeloId } = req.body;
    if (!paciente || !modeloId) return res.status(400).json({ error: 'Dados incompletos' });

    const modelo = db.prepare('SELECT * FROM modelos_etiqueta WHERE id = ?').get(modeloId);
    if (!modelo) return res.status(404).json({ error: 'Modelo não encontrado' });

    const zpl = gerarZPL(modelo.zpl_template, paciente);
    res.json({ zpl });
  });

  // GET /api/impressao/impressoras
  router.get('/impressoras', (req, res) => {
    const impressoras = db.prepare('SELECT * FROM impressoras ORDER BY nome').all();
    res.json(impressoras);
  });

  // POST /api/impressao/impressoras
  router.post('/impressoras', (req, res) => {
    const { nome, ip, porta, modelo, setor } = req.body;
    if (!nome || !ip) return res.status(400).json({ error: 'Nome e IP obrigatórios' });

    const info = db.prepare('INSERT INTO impressoras (nome, ip, porta, modelo, setor) VALUES (?, ?, ?, ?, ?)')
      .run(nome, ip, porta || 9100, modelo || 'ZD220', setor || '');
    res.json({ ok: true, id: info.lastInsertRowid });
  });

  // PUT /api/impressao/impressoras/:id
  router.put('/impressoras/:id', (req, res) => {
    const { nome, ip, porta, modelo, setor, ativo } = req.body;
    db.prepare('UPDATE impressoras SET nome=?, ip=?, porta=?, modelo=?, setor=?, ativo=? WHERE id=?')
      .run(nome, ip, porta || 9100, modelo || 'ZD220', setor || '', ativo !== false ? 1 : 0, req.params.id);
    res.json({ ok: true });
  });

  // DELETE /api/impressao/impressoras/:id
  router.delete('/impressoras/:id', (req, res) => {
    db.prepare('DELETE FROM impressoras WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // POST /api/impressao/testar/:id
  router.post('/testar/:id', async (req, res) => {
    const impressora = db.prepare('SELECT * FROM impressoras WHERE id = ?').get(req.params.id);
    if (!impressora) return res.status(404).json({ error: 'Impressora não encontrada' });

    const resultado = await testarImpressora(impressora.ip, impressora.porta);
    res.json({ ...resultado, ip: impressora.ip, porta: impressora.porta });
  });

  // GET /api/impressao/logs
  router.get('/logs', (req, res) => {
    const { limite, pagina } = req.query;
    const lim = Math.min(parseInt(limite) || 50, 200);
    const offset = (parseInt(pagina) || 0) * lim;

    const logs = db.prepare(`
      SELECT * FROM log_impressoes 
      ORDER BY impresso_em DESC 
      LIMIT ? OFFSET ?
    `).all(lim, offset);

    const total = db.prepare('SELECT COUNT(*) as total FROM log_impressoes').get().total;
    res.json({ logs, total });
  });

  return router;
};
