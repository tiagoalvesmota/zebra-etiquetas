const express = require('express');
const crypto = require('../services/crypto');

module.exports = function(db) {
  const router = express.Router();

  // GET /api/config/banco
  router.get('/banco', (req, res) => {
    const cfg = db.prepare('SELECT host, porta, servico, usuario FROM config_banco WHERE id = 1').get();
    res.json(cfg || {});
  });

  // PUT /api/config/banco
  router.put('/banco', (req, res) => {
    const { host, porta, servico, usuario, senha } = req.body;
    if (!host || !servico || !usuario) {
      return res.status(400).json({ error: 'Host, serviço e usuário obrigatórios' });
    }

    const cfgExiste = db.prepare('SELECT id FROM config_banco WHERE id = 1').get();
    
    if (cfgExiste) {
      // Se não foi enviada senha nova, mantém a existente
      if (senha) {
        const senhaEnc = crypto.encrypt(senha);
        db.prepare('UPDATE config_banco SET host=?, porta=?, servico=?, usuario=?, senha_enc=?, atualizado_em=datetime("now","localtime") WHERE id=1')
          .run(host, porta || 1521, servico, usuario, senhaEnc);
      } else {
        db.prepare('UPDATE config_banco SET host=?, porta=?, servico=?, usuario=?, atualizado_em=datetime("now","localtime") WHERE id=1')
          .run(host, porta || 1521, servico, usuario);
      }
    } else {
      const senhaEnc = crypto.encrypt(senha || '');
      db.prepare('INSERT INTO config_banco (id, host, porta, servico, usuario, senha_enc) VALUES (1,?,?,?,?,?)')
        .run(host, porta || 1521, servico, usuario, senhaEnc);
    }

    res.json({ ok: true });
  });

  // POST /api/config/banco/testar
  router.post('/banco/testar', async (req, res) => {
    try {
      let oracledb;
      try { oracledb = require('oracledb'); } catch(e) {
        return res.json({ ok: false, erro: 'Driver oracledb não instalado' });
      }

      const cfg = db.prepare('SELECT * FROM config_banco WHERE id = 1').get();
      if (!cfg) return res.status(400).json({ erro: 'Configuração não encontrada' });

      const senha = crypto.decrypt(cfg.senha_enc);
      const conn = await oracledb.getConnection({
        user: cfg.usuario,
        password: senha,
        connectString: `${cfg.host}:${cfg.porta}/${cfg.servico}`
      });
      await conn.close();
      res.json({ ok: true, mensagem: 'Conexão bem-sucedida!' });
    } catch (e) {
      res.json({ ok: false, erro: e.message });
    }
  });

  return router;
};
