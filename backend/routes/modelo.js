const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  // GET /api/modelo
  router.get('/', (req, res) => {
    const modelos = db.prepare('SELECT * FROM modelos_etiqueta ORDER BY padrao DESC, nome').all();
    res.json(modelos);
  });

  // GET /api/modelo/:id
  router.get('/:id', (req, res) => {
    const modelo = db.prepare('SELECT * FROM modelos_etiqueta WHERE id = ?').get(req.params.id);
    if (!modelo) return res.status(404).json({ error: 'Modelo não encontrado' });
    res.json(modelo);
  });

  // POST /api/modelo
  router.post('/', (req, res) => {
    const { nome, descricao, largura_mm, altura_mm, zpl_template } = req.body;
    if (!nome || !zpl_template) return res.status(400).json({ error: 'Nome e template ZPL obrigatórios' });

    const info = db.prepare(`
      INSERT INTO modelos_etiqueta (nome, descricao, largura_mm, altura_mm, zpl_template)
      VALUES (?, ?, ?, ?, ?)
    `).run(nome, descricao || '', largura_mm || 100, altura_mm || 30, zpl_template);

    res.json({ ok: true, id: info.lastInsertRowid });
  });

  // PUT /api/modelo/:id
  router.put('/:id', (req, res) => {
    const { nome, descricao, largura_mm, altura_mm, zpl_template, padrao } = req.body;

    if (padrao) {
      db.prepare('UPDATE modelos_etiqueta SET padrao = 0').run();
    }

    db.prepare(`
      UPDATE modelos_etiqueta 
      SET nome=?, descricao=?, largura_mm=?, altura_mm=?, zpl_template=?, padrao=?,
          atualizado_em=datetime('now','localtime')
      WHERE id=?
    `).run(nome, descricao || '', largura_mm || 100, altura_mm || 30, zpl_template, padrao ? 1 : 0, req.params.id);

    res.json({ ok: true });
  });

  // DELETE /api/modelo/:id
  router.delete('/:id', (req, res) => {
    const modelo = db.prepare('SELECT padrao FROM modelos_etiqueta WHERE id = ?').get(req.params.id);
    if (!modelo) return res.status(404).json({ error: 'Modelo não encontrado' });
    if (modelo.padrao) return res.status(400).json({ error: 'Não é possível excluir o modelo padrão' });

    db.prepare('DELETE FROM modelos_etiqueta WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  return router;
};
