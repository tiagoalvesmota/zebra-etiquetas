/**
 * Serviço de geração e envio de ZPL para impressoras Zebra
 */
const net = require('net');

/**
 * Gera ZPL preenchendo template com dados do paciente
 */
function gerarZPL(template, paciente) {
  const campos = {
    '{{NOME}}': truncar(paciente.nome || '', 35),
    '{{PRONTUARIO}}': paciente.prontuario || '',
    '{{ATENDIMENTO}}': paciente.atendimento || '',
    '{{MAE}}': truncar(paciente.mae || '', 30),
    '{{SEXO}}': paciente.sexo || '',
    '{{DATA_NASCIMENTO}}': paciente.data_nascimento || '',
    '{{IDADE}}': paciente.idade || '',
    '{{DATA_ENTRADA}}': paciente.data_entrada || '',
    '{{LEITO}}': paciente.leito || '',
    '{{CLINICA}}': paciente.clinica || '',
    '{{CNS}}': paciente.cns || '',
    // aliases alternativos (compatibilidade)
    '&NOME': truncar(paciente.nome || '', 35),
    '&prontuario': paciente.prontuario || '',
    '&atendimento': paciente.atendimento || '',
    '&mae': truncar(paciente.mae || '', 30),
    '&sexo': paciente.sexo || '',
    '&data_nascimento': paciente.data_nascimento || '',
  };

  let zpl = template;
  for (const [placeholder, valor] of Object.entries(campos)) {
    zpl = zpl.split(placeholder).join(valor);
  }

  return zpl;
}

/**
 * Envia ZPL para impressora Zebra via TCP/IP socket
 */
function enviarParaImpressora(ip, porta, zpl) {
  return new Promise((resolve, reject) => {
    porta = porta || 9100;
    const timeout = 8000; // 8 segundos

    const client = new net.Socket();
    let respondeu = false;

    client.setTimeout(timeout);

    client.connect(porta, ip, () => {
      client.write(zpl, 'utf8', () => {
        // Aguarda um breve momento antes de fechar (impressora pode ser lenta)
        setTimeout(() => {
          client.destroy();
          if (!respondeu) {
            respondeu = true;
            resolve({ ok: true, mensagem: `ZPL enviado para ${ip}:${porta}` });
          }
        }, 500);
      });
    });

    client.on('error', (err) => {
      if (!respondeu) {
        respondeu = true;
        reject(new Error(`Falha ao conectar em ${ip}:${porta} — ${err.message}`));
      }
    });

    client.on('timeout', () => {
      client.destroy();
      if (!respondeu) {
        respondeu = true;
        reject(new Error(`Timeout ao conectar em ${ip}:${porta}`));
      }
    });
  });
}

/**
 * Testa conectividade com impressora (só verifica se a porta está aberta)
 */
function testarImpressora(ip, porta) {
  return new Promise((resolve) => {
    porta = porta || 9100;
    const client = new net.Socket();
    let done = false;

    client.setTimeout(3000);

    client.connect(porta, ip, () => {
      client.destroy();
      if (!done) { done = true; resolve({ ok: true }); }
    });

    client.on('error', (err) => {
      if (!done) { done = true; resolve({ ok: false, erro: err.message }); }
    });

    client.on('timeout', () => {
      client.destroy();
      if (!done) { done = true; resolve({ ok: false, erro: 'Timeout' }); }
    });
  });
}

function truncar(str, max) {
  if (!str) return '';
  return str.length > max ? str.substring(0, max) : str;
}

module.exports = { gerarZPL, enviarParaImpressora, testarImpressora };
