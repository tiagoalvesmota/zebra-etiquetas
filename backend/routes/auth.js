const express = require('express');
const bcrypt = require('bcryptjs');

module.exports = function(db) {
  const router = express.Router();

  // POST /api/auth/login
  router.post('/login', (req, res) => {
    const { login, senha } = req.body;
    if (!login || !senha) {
      return res.status(400).json({ error: 'Login e senha obrigatórios' });
    }

    const usuario = db.prepare('SELECT * FROM usuarios WHERE login = ? AND ativo = 1').get(login.trim());
    if (!usuario) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    const senhaOk = bcrypt.compareSync(senha, usuario.senha_hash);
    if (!senhaOk) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    req.session.userId = usuario.id;
    req.session.userNome = usuario.nome;
    req.session.userPerfil = usuario.perfil;

    res.json({ ok: true, nome: usuario.nome, perfil: usuario.perfil });
  });

  // POST /api/auth/logout
  router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ ok: true });
  });

  // GET /api/auth/me
  router.get('/me', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ autenticado: false });
    res.json({
      autenticado: true,
      id: req.session.userId,
      nome: req.session.userNome,
      perfil: req.session.userPerfil
    });
  });

  // GET /api/auth/usuarios (admin)
  router.get('/usuarios', requireAdmin, (req, res) => {
    const usuarios = db.prepare('SELECT id, nome, login, perfil, ativo, criado_em FROM usuarios').all();
    res.json(usuarios);
  });

  // POST /api/auth/usuarios (admin)
  router.post('/usuarios', requireAdmin, (req, res) => {
    const { nome, login, senha, perfil } = req.body;
    if (!nome || !login || !senha) {
      return res.status(400).json({ error: 'Nome, login e senha obrigatórios' });
    }
    const hash = bcrypt.hashSync(senha, 10);
    try {
      const info = db.prepare('INSERT INTO usuarios (nome, login, senha_hash, perfil) VALUES (?, ?, ?, ?)')
        .run(nome, login, hash, perfil || 'operador');
      res.json({ ok: true, id: info.lastInsertRowid });
    } catch (e) {
      if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Login já existe' });
      throw e;
    }
  });

  // PUT /api/auth/senha
  router.put('/senha', (req, res) => {
    const { senhaAtual, novaSenha } = req.body;
    if (!senhaAtual || !novaSenha) return res.status(400).json({ error: 'Campos obrigatórios' });

    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.session.userId);
    if (!bcrypt.compareSync(senhaAtual, usuario.senha_hash)) {
      return res.status(400).json({ error: 'Senha atual incorreta' });
    }
    const novoHash = bcrypt.hashSync(novaSenha, 10);
    db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(novoHash, req.session.userId);
    res.json({ ok: true });
  });

  function requireAdmin(req, res, next) {
    if (req.session.userPerfil !== 'admin') {
      return res.status(403).json({ error: 'Acesso restrito ao administrador' });
    }
    next();
  }

  return router;
};
