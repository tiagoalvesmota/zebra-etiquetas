require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

// Inicializa banco SQLite para sessões e logs
const Database = require('better-sqlite3');
const dbPath = path.join(__dirname, '../data/app.db');

// Garante que pasta data existe
if (!fs.existsSync(path.join(__dirname, '../data'))) {
  fs.mkdirSync(path.join(__dirname, '../data'), { recursive: true });
}

const localDb = new Database(dbPath);
initLocalDb(localDb);

const app = express();

// ── Segurança ──────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false // Desativado para facilitar assets locais
}));

// ── Parsers ────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Sessão ─────────────────────────────────────────────
const SQLiteStore = require('connect-sqlite3')(session);
app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: path.join(__dirname, '../data') }),
  secret: process.env.SESSION_SECRET || 'dev_secret_mude_em_producao',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // true apenas com HTTPS
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000 // 8 horas
  }
}));

// ── Arquivos estáticos ─────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend/public')));

// ── Middleware de autenticação ─────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  if (req.headers['content-type'] === 'application/json') {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  res.redirect('/login.html');
}

app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

// ── Rotas ──────────────────────────────────────────────
const authRoutes = require('./routes/auth')(localDb);
const pacienteRoutes = require('./routes/paciente')();
const impressaoRoutes = require('./routes/impressao')(localDb);
const modeloRoutes = require('./routes/modelo')(localDb);
const configRoutes = require('./routes/config')(localDb);

app.use('/api/auth', authRoutes);
app.use('/api/paciente', requireAuth, pacienteRoutes);
app.use('/api/impressao', requireAuth, impressaoRoutes);
app.use('/api/modelo', requireAuth, modeloRoutes);
app.use('/api/config', requireAuth, configRoutes);

// ── 404 ────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// ── Error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERRO]', err.message);
  res.status(500).json({ error: 'Erro interno do servidor', detail: err.message });
});

// ── Inicia servidor ────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🏥 Zebra Etiquetas Hospitalares`);
  console.log(`📡 Servidor rodando em http://0.0.0.0:${PORT}`);
  console.log(`📋 Acesse via navegador: http://localhost:${PORT}\n`);
});

// ── Init banco local ───────────────────────────────────
function initLocalDb(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      login TEXT UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL,
      perfil TEXT DEFAULT 'operador',
      ativo INTEGER DEFAULT 1,
      criado_em TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS modelos_etiqueta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      descricao TEXT,
      largura_mm INTEGER DEFAULT 100,
      altura_mm INTEGER DEFAULT 30,
      zpl_template TEXT NOT NULL,
      padrao INTEGER DEFAULT 0,
      criado_em TEXT DEFAULT (datetime('now','localtime')),
      atualizado_em TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS impressoras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      ip TEXT NOT NULL,
      porta INTEGER DEFAULT 9100,
      modelo TEXT DEFAULT 'ZD220',
      setor TEXT,
      ativo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS log_impressoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      usuario_nome TEXT,
      nr_atendimento TEXT,
      paciente_nome TEXT,
      impressora_ip TEXT,
      modelo_etiqueta TEXT,
      status TEXT DEFAULT 'ok',
      erro TEXT,
      impresso_em TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS config_banco (
      id INTEGER PRIMARY KEY DEFAULT 1,
      host TEXT,
      porta INTEGER DEFAULT 1521,
      servico TEXT,
      usuario TEXT,
      senha_enc TEXT,
      atualizado_em TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // Cria usuário admin padrão se não existir
  const bcrypt = require('bcryptjs');
  const adminExiste = db.prepare('SELECT id FROM usuarios WHERE login = ?').get('admin');
  if (!adminExiste) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(`INSERT INTO usuarios (nome, login, senha_hash, perfil) VALUES (?, ?, ?, ?)`)
      .run('Administrador', 'admin', hash, 'admin');
    console.log('👤 Usuário admin criado: admin / admin123 (troque a senha!)');
  }

  // Insere modelo de etiqueta padrão se não existir
  const modeloExiste = db.prepare('SELECT id FROM modelos_etiqueta WHERE padrao = 1').get();
  if (!modeloExiste) {
    const zplPadrao = getZplPadrao();
    db.prepare(`INSERT INTO modelos_etiqueta (nome, descricao, largura_mm, altura_mm, zpl_template, padrao) 
                VALUES (?, ?, ?, ?, ?, ?)`)
      .run('Etiqueta Padrão 100x30', 'Modelo padrão com logo Unimed', 100, 30, zplPadrao, 1);
  }

  // Insere config banco padrão
  const cfgExiste = db.prepare('SELECT id FROM config_banco WHERE id = 1').get();
  if (!cfgExiste) {
    const crypto = require('./services/crypto');
    db.prepare(`INSERT INTO config_banco (id, host, porta, servico, usuario, senha_enc) VALUES (1, ?, ?, ?, ?, ?)`)
      .run(
        process.env.DB_HOST || '',
        parseInt(process.env.DB_PORT) || 1521,
        process.env.DB_SERVICE || '',
        process.env.DB_USER || '',
        crypto.encrypt(process.env.DB_PASSWORD || '')
      );
  }
}

function getZplPadrao() {
  return `^XA
^CI28
^PW799
^LL240
^LH0,0
^MMT
^PR4,4
~SD15

^FO5,5
^GFA,529,1560,24,:Z64:eJy9lMGKwyAQhmekwuJJId7DnopPYWH3bsC8j3gq+xQeJU+5mtg0kLHQPezk1PD3y5eZiQBvllnOVe9PRJXbjIgvAYDPRFkAQeVTyWuiZCefATTFd7R+zSvK/0We5PtOvjSI0tfDno9nvhtwnrGJ69nyxk+m9DS0xpglxubvJE4TVu15cmpCbP7ZPGeQzSLCk885Ir957qX23D75jMXIILMMJovyjNVfDgiIZaSyXFoiNP+SDyyWkaZymcyC2flb3loL2mIZ+c6PMYY0pnE0iSVR+at/rZoGpyxa3P1ZqPkAYzZBJLbzH3nrSP6SRrNUn80feM0XIQVH/wwirvz0kdr7rny/5a114EA7bnWbL5iNf4UrmCSK/7Y/oPa8VFY5/Mf9ecX3ff7j12H/nXKTuxH7f/jnke8l4OVLn/n3T/i8nv0Hte7PyT/f053iO7zc4PvMz0uK8Woe+cP3q3CS5Pf70+n/fhb9of+i03/yfPOdfOFj5/whz8/Chw6ffoF3D3mAX6k=:B426

^FT186,31
^A0N,17,18
^FDPaciente:^FS

^FT186,63
^A0N,28,28
^FB560,1,0,L,0
^FD{{NOME}}^FS

^FO5,72
^GB720,0,8^FS

^FT5,109
^A0N,23,23
^FDProntuario/Ficha:^FS

^FT425,109
^A0N,23,23
^FDAtendimento:^FS

^FT5,136
^A0N,23,23
^FDMae...........:^FS

^FT5,164
^A0N,23,23
^FDSexo...........:^FS

^FT5,193
^A0N,23,23
^FDDt. Nasc:^FS

^FT197,109
^A0N,23,23
^FD{{PRONTUARIO}}^FS

^FT557,109
^A0N,23,23
^FD{{ATENDIMENTO}}^FS

^FT152,136
^A0N,23,23
^FB580,1,0,L,0
^FD{{MAE}}^FS

^FT152,165
^A0N,23,23
^FD{{SEXO}}^FS

^FT105,193
^A0N,23,23
^FD{{DATA_NASCIMENTO}}^FS

^PQ1,0,1,Y
^XZ`;
}
