/* ================================================================
   ZEBRA ETIQUETAS HOSPITALARES — Frontend App
   ================================================================ */

const API = {
  async get(url) {
    const r = await fetch(url);
    if (r.status === 401) { window.location.href = '/login.html'; return null; }
    return r.json();
  },
  async post(url, body) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (r.status === 401) { window.location.href = '/login.html'; return null; }
    return r.json();
  },
  async put(url, body) {
    const r = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return r.json();
  },
  async del(url) {
    const r = await fetch(url, { method: 'DELETE' });
    return r.json();
  }
};

// ── Estado global ─────────────────────────────────────────────
let state = {
  paciente: null,
  modelos: [],
  impressoras: [],
  logsPage: 0,
  modeloEditId: null,
  impEditId: null
};

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await carregarUsuario();
  await Promise.all([carregarModelos(), carregarImpressoras()]);
  setupNavTabs();
  setupBusca();
  setupImpressao();
  setupModelos();
  setupImpressoras();
  setupConfig();
});

// ─────────────────────────────────────────────────────────────
// NAVEGAÇÃO
// ─────────────────────────────────────────────────────────────
function setupNavTabs() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${tab}`).classList.add('active');

      if (tab === 'logs') carregarLogs(true);
      if (tab === 'config') carregarConfigBanco();
    });
  });

  document.getElementById('btnLogout').addEventListener('click', async () => {
    await API.post('/api/auth/logout', {});
    window.location.href = '/login.html';
  });
}

async function carregarUsuario() {
  const data = await API.get('/api/auth/me');
  if (data && data.autenticado) {
    document.getElementById('userBadge').textContent = data.nome;
  }
}

// ─────────────────────────────────────────────────────────────
// BUSCA DE PACIENTES
// ─────────────────────────────────────────────────────────────
function setupBusca() {
  // Mode toggle
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const modo = btn.dataset.mode;
      document.getElementById('busca-atendimento').style.display = modo === 'atendimento' ? 'block' : 'none';
      document.getElementById('busca-nome').style.display = modo === 'nome' ? 'block' : 'none';
      esconderErro();
    });
  });

  // Busca por atendimento
  document.getElementById('btnBuscarAtendimento').addEventListener('click', buscarPorAtendimento);
  document.getElementById('inputAtendimento').addEventListener('keydown', e => {
    if (e.key === 'Enter') buscarPorAtendimento();
  });

  // Busca por nome
  document.getElementById('btnBuscarNome').addEventListener('click', buscarPorNome);
  document.getElementById('inputNome').addEventListener('keydown', e => {
    if (e.key === 'Enter') buscarPorNome();
  });

  // Limpar paciente
  document.getElementById('btnLimpar').addEventListener('click', limparPaciente);
}

async function buscarPorAtendimento() {
  const nr = document.getElementById('inputAtendimento').value.trim();
  if (!nr) return;

  setLoadingBusca(true);
  esconderErro();

  const data = await API.get(`/api/paciente/atendimento/${encodeURIComponent(nr)}`);
  setLoadingBusca(false);

  if (!data) return;
  if (data.error) { mostrarErroBusca(data.error); return; }
  exibirPaciente(data);
}

async function buscarPorNome() {
  const nome = document.getElementById('inputNome').value.trim();
  if (nome.length < 3) { mostrarErroBusca('Digite pelo menos 3 caracteres'); return; }

  setLoadingBusca(true);
  esconderErro();
  document.getElementById('resultadosNome').innerHTML = '';

  const data = await API.get(`/api/paciente/nome?q=${encodeURIComponent(nome)}`);
  setLoadingBusca(false);

  if (!data) return;
  if (data.error) { mostrarErroBusca(data.error); return; }
  if (!Array.isArray(data) || data.length === 0) {
    mostrarErroBusca('Nenhum paciente encontrado');
    return;
  }

  const lista = document.getElementById('resultadosNome');
  lista.innerHTML = '';
  data.forEach(pac => {
    const el = document.createElement('div');
    el.className = 'paciente-item';
    el.innerHTML = `
      <div class="paciente-item-nome">${pac.nome}</div>
      <div class="paciente-item-info">
        Atend: ${pac.atendimento} · Pront: ${pac.prontuario} · 
        ${pac.sexo || ''} · Leito: ${pac.leito || '—'}
      </div>
    `;
    el.addEventListener('click', () => {
      exibirPaciente(pac);
      lista.innerHTML = '';
    });
    lista.appendChild(el);
  });
}

function exibirPaciente(pac) {
  state.paciente = pac;

  const campos = [
    { label: 'Nome', value: pac.nome, full: true, destaque: true },
    { label: 'Prontuário', value: pac.prontuario },
    { label: 'Atendimento', value: pac.atendimento },
    { label: 'Sexo', value: pac.sexo },
    { label: 'Dt. Nascimento', value: pac.data_nascimento },
    { label: 'Idade', value: pac.idade },
    { label: 'Mãe', value: pac.mae },
    { label: 'Data Entrada', value: pac.data_entrada },
    { label: 'Leito', value: pac.leito },
    { label: 'Clínica', value: pac.clinica },
    { label: 'CNS', value: pac.cns }
  ].filter(c => c.value);

  const grid = document.getElementById('dadosPaciente');
  grid.innerHTML = `<div class="paciente-grid">` +
    campos.map(c => `
      <div class="paciente-field ${c.full ? 'paciente-nome' : ''}">
        <div class="paciente-label">${c.label}</div>
        <div class="paciente-value ${c.destaque ? 'paciente-destaque' : ''}">${c.value}</div>
      </div>
    `).join('') +
    `</div>`;

  document.getElementById('cardPaciente').style.display = 'block';
  document.getElementById('btnImprimir').disabled = false;

  // Auto-preview
  gerarPreview();
}

function limparPaciente() {
  state.paciente = null;
  document.getElementById('cardPaciente').style.display = 'none';
  document.getElementById('btnImprimir').disabled = true;
  document.getElementById('previewImg').style.display = 'none';
  document.querySelector('.preview-placeholder').style.display = 'flex';
  document.getElementById('inputAtendimento').value = '';
  document.getElementById('inputNome').value = '';
  document.getElementById('resultadosNome').innerHTML = '';
}

function setLoadingBusca(v) {
  document.getElementById('busca-loading').style.display = v ? 'flex' : 'none';
}

function mostrarErroBusca(msg) {
  const el = document.getElementById('busca-erro');
  el.textContent = msg;
  el.style.display = 'block';
}

function esconderErro() {
  document.getElementById('busca-erro').style.display = 'none';
}

// ─────────────────────────────────────────────────────────────
// IMPRESSÃO
// ─────────────────────────────────────────────────────────────
function setupImpressao() {
  document.getElementById('btnPreview').addEventListener('click', gerarPreview);
  document.getElementById('btnImprimir').addEventListener('click', imprimir);

  document.getElementById('selModelo').addEventListener('change', () => {
    if (state.paciente) gerarPreview();
  });
}

async function gerarPreview() {
  if (!state.paciente) return;

  const modeloId = document.getElementById('selModelo').value;
  if (!modeloId) return;

  const previewImg = document.getElementById('previewImg');
  const placeholder = document.querySelector('.preview-placeholder');
  const loading = document.getElementById('previewLoading');

  placeholder.style.display = 'none';
  previewImg.style.display = 'none';
  loading.style.display = 'flex';

  try {
    const data = await API.post('/api/impressao/preview-zpl', {
      paciente: state.paciente,
      modeloId: parseInt(modeloId)
    });

    if (data && data.zpl) {
      const modelo = state.modelos.find(m => m.id == modeloId);
      const largura = modelo ? modelo.largura_mm : 100;
      const altura = modelo ? modelo.altura_mm : 30;

      // Usa Labelary API para renderizar o ZPL como imagem
      const zplEncoded = encodeURIComponent(data.zpl);
      // dpmm: 8 (203dpi), 6 (152dpi). Usamos 8.
      const labelaryUrl = `https://api.labelary.com/v1/printers/8dpmm/labels/${largura}x${altura}/0/`;

      const resp = await fetch(labelaryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'image/png' },
        body: `data=${zplEncoded}`
      });

      if (resp.ok) {
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        previewImg.src = url;
        previewImg.style.display = 'block';
      } else {
        // Fallback: mostra ZPL texto
        previewImg.style.display = 'none';
        placeholder.innerHTML = `<pre style="font-size:10px;color:var(--text-dim);text-align:left;max-height:150px;overflow:auto">${data.zpl.substring(0, 500)}</pre>`;
        placeholder.style.display = 'flex';
      }
    }
  } catch (e) {
    placeholder.innerHTML = `<span style="font-size:11px;color:var(--text-dim)">Preview não disponível (sem internet para Labelary)</span>`;
    placeholder.style.display = 'flex';
  }

  loading.style.display = 'none';
}

async function imprimir() {
  if (!state.paciente) return;

  const modeloId = document.getElementById('selModelo').value;
  const impressoraId = document.getElementById('selImpressora').value;
  const copias = document.getElementById('inputCopias').value;

  if (!modeloId) { mostrarStatus('impressao-status', 'Selecione um modelo de etiqueta', 'erro'); return; }
  if (!impressoraId) { mostrarStatus('impressao-status', 'Selecione uma impressora', 'erro'); return; }

  const btn = document.getElementById('btnImprimir');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  const data = await API.post('/api/impressao/imprimir', {
    paciente: state.paciente,
    modeloId: parseInt(modeloId),
    impressoraId: parseInt(impressoraId),
    copias: parseInt(copias)
  });

  btn.disabled = false;
  btn.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4V2h8v2M4 12H2V7a2 2 0 012-2h8a2 2 0 012 2v5h-2M4 9h8v5H4V9z"/></svg> Imprimir`;

  if (data && data.ok) {
    mostrarStatus('impressao-status', `✓ ${data.mensagem}`, 'ok');
  } else if (data) {
    mostrarStatus('impressao-status', `✗ ${data.error}${data.detalhe ? ': ' + data.detalhe : ''}`, 'erro');
  }
}

// ─────────────────────────────────────────────────────────────
// MODELOS
// ─────────────────────────────────────────────────────────────
async function carregarModelos() {
  const data = await API.get('/api/modelo');
  if (!data) return;
  state.modelos = data;
  renderizarModelos();
  atualizarSelectModelos();
}

function renderizarModelos() {
  const lista = document.getElementById('listaModelos');
  if (!lista) return;

  if (state.modelos.length === 0) {
    lista.innerHTML = '<p style="color:var(--text-dim);font-size:12px">Nenhum modelo cadastrado.</p>';
    return;
  }

  lista.innerHTML = state.modelos.map(m => `
    <div class="modelo-item">
      <div class="modelo-item-info">
        <div class="modelo-item-nome">
          ${m.nome}
          ${m.padrao ? '<span class="modelo-badge-padrao">padrão</span>' : ''}
        </div>
        <div class="modelo-item-sub">${m.largura_mm}×${m.altura_mm}mm · ${m.descricao || ''}</div>
      </div>
      <button class="btn-edit" onclick="editarModelo(${m.id})">Editar</button>
      ${!m.padrao ? `<button class="btn-del" onclick="excluirModelo(${m.id}, '${m.nome}')">Excluir</button>` : ''}
    </div>
  `).join('');
}

function atualizarSelectModelos() {
  const sel = document.getElementById('selModelo');
  const atual = sel.value;
  sel.innerHTML = '';
  state.modelos.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.nome;
    if (m.padrao) opt.selected = true;
    sel.appendChild(opt);
  });
  if (atual) sel.value = atual;
}

function setupModelos() {
  document.getElementById('btnNovoModelo').addEventListener('click', () => {
    state.modeloEditId = null;
    document.getElementById('editorModeloTitulo').textContent = 'Novo Modelo';
    document.getElementById('modeloNome').value = '';
    document.getElementById('modeloDesc').value = '';
    document.getElementById('modeloLargura').value = 100;
    document.getElementById('modeloAltura').value = 30;
    document.getElementById('modeloZPL').value = getZplExemplo();
    document.getElementById('modeloPadrao').checked = false;
    document.getElementById('cardEditorModelo').style.display = 'block';
    document.getElementById('cardEditorModelo').scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('btnFecharEditor').addEventListener('click', () => {
    document.getElementById('cardEditorModelo').style.display = 'none';
  });

  document.getElementById('btnSalvarModelo').addEventListener('click', salvarModelo);
}

window.editarModelo = async function(id) {
  const modelo = state.modelos.find(m => m.id === id);
  if (!modelo) return;

  state.modeloEditId = id;
  document.getElementById('editorModeloTitulo').textContent = `Editar: ${modelo.nome}`;
  document.getElementById('modeloNome').value = modelo.nome;
  document.getElementById('modeloDesc').value = modelo.descricao || '';
  document.getElementById('modeloLargura').value = modelo.largura_mm;
  document.getElementById('modeloAltura').value = modelo.altura_mm;
  document.getElementById('modeloZPL').value = modelo.zpl_template;
  document.getElementById('modeloPadrao').checked = modelo.padrao === 1;
  document.getElementById('cardEditorModelo').style.display = 'block';
  document.getElementById('cardEditorModelo').scrollIntoView({ behavior: 'smooth' });
};

window.excluirModelo = async function(id, nome) {
  if (!confirm(`Excluir modelo "${nome}"?`)) return;
  const data = await API.del(`/api/modelo/${id}`);
  if (data.ok) {
    await carregarModelos();
  } else {
    alert(data.error);
  }
};

async function salvarModelo() {
  const body = {
    nome: document.getElementById('modeloNome').value.trim(),
    descricao: document.getElementById('modeloDesc').value.trim(),
    largura_mm: parseInt(document.getElementById('modeloLargura').value),
    altura_mm: parseInt(document.getElementById('modeloAltura').value),
    zpl_template: document.getElementById('modeloZPL').value.trim(),
    padrao: document.getElementById('modeloPadrao').checked
  };

  if (!body.nome || !body.zpl_template) {
    mostrarStatus('modelo-status', 'Nome e template ZPL são obrigatórios', 'erro');
    return;
  }

  let data;
  if (state.modeloEditId) {
    data = await API.put(`/api/modelo/${state.modeloEditId}`, body);
  } else {
    data = await API.post('/api/modelo', body);
  }

  if (data && data.ok) {
    mostrarStatus('modelo-status', 'Modelo salvo com sucesso!', 'ok');
    await carregarModelos();
    setTimeout(() => { document.getElementById('cardEditorModelo').style.display = 'none'; }, 1200);
  } else if (data) {
    mostrarStatus('modelo-status', data.error, 'erro');
  }
}

// ─────────────────────────────────────────────────────────────
// IMPRESSORAS
// ─────────────────────────────────────────────────────────────
async function carregarImpressoras() {
  const data = await API.get('/api/impressao/impressoras');
  if (!data) return;
  state.impressoras = data;
  renderizarImpressoras();
  atualizarSelectImpressoras();
}

function renderizarImpressoras() {
  const lista = document.getElementById('listaImpressoras');
  if (!lista) return;

  if (state.impressoras.length === 0) {
    lista.innerHTML = '<p style="color:var(--text-dim);font-size:12px">Nenhuma impressora cadastrada.</p>';
    return;
  }

  lista.innerHTML = state.impressoras.map(imp => `
    <div class="imp-item">
      <div class="imp-item-info">
        <div class="imp-item-nome">${imp.nome} <span style="font-size:10px;color:var(--text-muted)">(${imp.modelo})</span></div>
        <div class="imp-item-sub">${imp.ip}:${imp.porta} · ${imp.setor || 'Sem setor'} · ${imp.ativo ? 'Ativa' : 'Inativa'}</div>
      </div>
      <button class="btn-secondary btn-sm" onclick="testarImpressora(${imp.id})">Testar</button>
      <button class="btn-edit" onclick="editarImpressora(${imp.id})">Editar</button>
      <button class="btn-del" onclick="excluirImpressora(${imp.id}, '${imp.nome}')">Excluir</button>
    </div>
  `).join('');
}

function atualizarSelectImpressoras() {
  const sel = document.getElementById('selImpressora');
  const atual = sel.value;
  const placeholder = '<option value="">Selecione a impressora...</option>';
  sel.innerHTML = placeholder + state.impressoras
    .filter(i => i.ativo)
    .map(i => `<option value="${i.id}">${i.nome} (${i.ip})</option>`)
    .join('');
  if (atual) sel.value = atual;
}

function setupImpressoras() {
  document.getElementById('btnNovaImpressora').addEventListener('click', () => {
    state.impEditId = null;
    document.getElementById('editorImpTitulo').textContent = 'Nova Impressora';
    document.getElementById('impNome').value = '';
    document.getElementById('impSetor').value = '';
    document.getElementById('impIP').value = '';
    document.getElementById('impPorta').value = 9100;
    document.getElementById('impModelo').value = 'ZD220';
    document.getElementById('impEditId').value = '';
    document.getElementById('cardEditorImpressora').style.display = 'block';
    document.getElementById('cardEditorImpressora').scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('btnFecharEditorImp').addEventListener('click', () => {
    document.getElementById('cardEditorImpressora').style.display = 'none';
  });

  document.getElementById('btnSalvarImpressora').addEventListener('click', salvarImpressora);

  document.getElementById('btnTestarImpressora').addEventListener('click', async () => {
    const id = document.getElementById('impEditId').value;
    if (!id) {
      mostrarStatus('imp-status', 'Salve a impressora antes de testar', 'erro');
      return;
    }
    await testarImpressora(id);
  });
}

window.editarImpressora = function(id) {
  const imp = state.impressoras.find(i => i.id === id);
  if (!imp) return;

  state.impEditId = id;
  document.getElementById('editorImpTitulo').textContent = `Editar: ${imp.nome}`;
  document.getElementById('impNome').value = imp.nome;
  document.getElementById('impSetor').value = imp.setor || '';
  document.getElementById('impIP').value = imp.ip;
  document.getElementById('impPorta').value = imp.porta;
  document.getElementById('impModelo').value = imp.modelo;
  document.getElementById('impEditId').value = imp.id;
  document.getElementById('cardEditorImpressora').style.display = 'block';
  document.getElementById('cardEditorImpressora').scrollIntoView({ behavior: 'smooth' });
};

window.excluirImpressora = async function(id, nome) {
  if (!confirm(`Excluir impressora "${nome}"?`)) return;
  const data = await API.del(`/api/impressao/impressoras/${id}`);
  if (data.ok) await carregarImpressoras();
};

window.testarImpressora = async function(id) {
  mostrarStatus('imp-status', 'Testando conexão...', 'ok');
  const data = await API.post(`/api/impressao/testar/${id}`, {});
  if (data.ok) {
    mostrarStatus('imp-status', `✓ Impressora ${data.ip}:${data.porta} acessível`, 'ok');
  } else {
    mostrarStatus('imp-status', `✗ Falha: ${data.erro}`, 'erro');
  }
};

async function salvarImpressora() {
  const body = {
    nome: document.getElementById('impNome').value.trim(),
    setor: document.getElementById('impSetor').value.trim(),
    ip: document.getElementById('impIP').value.trim(),
    porta: parseInt(document.getElementById('impPorta').value),
    modelo: document.getElementById('impModelo').value,
    ativo: true
  };

  if (!body.nome || !body.ip) {
    mostrarStatus('imp-status', 'Nome e IP são obrigatórios', 'erro');
    return;
  }

  let data;
  const editId = document.getElementById('impEditId').value;
  if (editId) {
    data = await API.put(`/api/impressao/impressoras/${editId}`, body);
  } else {
    data = await API.post('/api/impressao/impressoras', body);
    if (data && data.id) {
      document.getElementById('impEditId').value = data.id;
      state.impEditId = data.id;
    }
  }

  if (data && data.ok) {
    mostrarStatus('imp-status', 'Impressora salva!', 'ok');
    await carregarImpressoras();
  } else if (data) {
    mostrarStatus('imp-status', data.error, 'erro');
  }
}

// ─────────────────────────────────────────────────────────────
// LOGS
// ─────────────────────────────────────────────────────────────
async function carregarLogs(reset = false) {
  if (reset) state.logsPage = 0;

  const data = await API.get(`/api/impressao/logs?limite=50&pagina=${state.logsPage}`);
  if (!data) return;

  document.getElementById('logTotal').textContent = `Total: ${data.total}`;

  const tbody = document.getElementById('logsBody');
  if (reset) tbody.innerHTML = '';

  data.logs.forEach(log => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${log.impresso_em}</td>
      <td>${log.usuario_nome || '—'}</td>
      <td>${log.nr_atendimento}</td>
      <td>${log.paciente_nome}</td>
      <td>${log.impressora_ip}</td>
      <td>${log.modelo_etiqueta}</td>
      <td><span class="badge-${log.status === 'ok' ? 'ok' : 'erro'}">${log.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById('btnCarregarMaisLogs')?.addEventListener('click', () => {
  state.logsPage++;
  carregarLogs(false);
});

// ─────────────────────────────────────────────────────────────
// CONFIGURAÇÕES
// ─────────────────────────────────────────────────────────────
function setupConfig() {
  document.getElementById('btnSalvarBanco').addEventListener('click', salvarConfigBanco);
  document.getElementById('btnTestarBanco').addEventListener('click', testarBanco);
  document.getElementById('btnAlterarSenha').addEventListener('click', alterarSenha);
}

async function carregarConfigBanco() {
  const data = await API.get('/api/config/banco');
  if (!data) return;
  document.getElementById('cfgHost').value = data.host || '';
  document.getElementById('cfgPorta').value = data.porta || 1521;
  document.getElementById('cfgServico').value = data.servico || '';
  document.getElementById('cfgUsuario').value = data.usuario || '';
}

async function salvarConfigBanco() {
  const data = await API.put('/api/config/banco', {
    host: document.getElementById('cfgHost').value.trim(),
    porta: parseInt(document.getElementById('cfgPorta').value),
    servico: document.getElementById('cfgServico').value.trim(),
    usuario: document.getElementById('cfgUsuario').value.trim(),
    senha: document.getElementById('cfgSenha').value
  });
  if (data && data.ok) mostrarStatus('banco-status', 'Configuração salva!', 'ok');
  else if (data) mostrarStatus('banco-status', data.error, 'erro');
}

async function testarBanco() {
  mostrarStatus('banco-status', 'Testando conexão Oracle...', 'ok');
  const data = await API.post('/api/config/banco/testar', {});
  if (data.ok) mostrarStatus('banco-status', `✓ ${data.mensagem}`, 'ok');
  else mostrarStatus('banco-status', `✗ ${data.erro}`, 'erro');
}

async function alterarSenha() {
  const data = await API.put('/api/auth/senha', {
    senhaAtual: document.getElementById('senhaAtual').value,
    novaSenha: document.getElementById('novaSenha').value
  });
  if (data && data.ok) {
    mostrarStatus('senha-status', 'Senha alterada com sucesso!', 'ok');
    document.getElementById('senhaAtual').value = '';
    document.getElementById('novaSenha').value = '';
  } else if (data) {
    mostrarStatus('senha-status', data.error, 'erro');
  }
}

// ─────────────────────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────────────────────
function mostrarStatus(elementId, msg, tipo) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = msg;
  el.className = `status-msg status-${tipo}`;
  el.style.display = 'block';
  if (tipo === 'ok') {
    setTimeout(() => { el.style.display = 'none'; }, 4000);
  }
}

function getZplExemplo() {
  return `^XA
^CI28
^PW799
^LL240
^LH0,0
^MMT
^PR4,4
~SD15

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
