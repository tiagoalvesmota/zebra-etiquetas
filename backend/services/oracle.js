/**
 * Serviço de conexão com Oracle (TASY)
 * Lê as credenciais do banco local (config_banco)
 */
let oracledb;
try {
  oracledb = require('oracledb');
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  oracledb.fetchAsString = [oracledb.DATE, oracledb.NUMBER];
} catch (e) {
  console.warn('⚠️  oracledb não instalado. Modo demonstração ativo.');
}

const crypto = require('./crypto');

let _localDb = null;

function setLocalDb(db) {
  _localDb = db;
}

function getConfig() {
  if (!_localDb) throw new Error('Banco local não inicializado');
  const cfg = _localDb.prepare('SELECT * FROM config_banco WHERE id = 1').get();
  if (!cfg) throw new Error('Configuração de banco não encontrada');
  return {
    host: cfg.host,
    port: cfg.porta || 1521,
    service: cfg.servico,
    user: cfg.usuario,
    password: crypto.decrypt(cfg.senha_enc)
  };
}

async function getConnection() {
  const cfg = getConfig();
  if (!cfg.host) throw new Error('Configuração de banco Oracle não definida');

  return oracledb.getConnection({
    user: cfg.user,
    password: cfg.password,
    connectString: `${cfg.host}:${cfg.port}/${cfg.service}`
  });
}

/**
 * Busca paciente por número de atendimento
 */
async function buscarPorAtendimento(nrAtendimento) {
  if (!oracledb) return getMockPaciente(nrAtendimento);

  const conn = await getConnection();
  try {
    const sql = `
      SELECT DISTINCT
        a.nr_atendimento                                                                                                            AS ATENDIMENTO,
        a.cd_pessoa_fisica                                                                                                          AS PRONTUARIO,
        UPPER(TRANSLATE(NVL(b.nm_pessoa_fisica, Obter_dados_pf(a.cd_pessoa_fisica,'NSOC')),
          'áéíóúàèìòùãõâêîôôäëïöüçÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÄËÏÖÜÇ',
          'aeiouaeiouaoaeiooaeioucAEIOUAEIOUAOAEIOOAEIOUC'))                                                                        AS NOME,
        CASE 
          WHEN Obter_dados_pf(a.cd_pessoa_fisica,'SE') = 'F' THEN 'Feminino'
          WHEN Obter_dados_pf(a.cd_pessoa_fisica,'SE') = 'M' THEN 'Masculino'
          WHEN Obter_dados_pf(a.cd_pessoa_fisica,'SE') = 'I' THEN 'Indeterminado'
          ELSE 'Nao informado'
        END                                                                                                                         AS SEXO,
        Obter_dados_pf(a.cd_pessoa_fisica,'DN')                                                                                    AS DATA_NASCIMENTO,
        Obter_Idade(dt_nascimento, sysdate,'S')                                                                                    AS IDADE,
        UPPER(TRANSLATE(Obter_nome_pai_mae(a.cd_pessoa_fisica,'M'),
          'áéíóúàèìòùãõâêîôôäëïöüçÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÄËÏÖÜÇ',
          'aeiouaeiouaoaeiooaeioucAEIOUAEIOUAOAEIOOAEIOUC'))                                                                        AS MAE,
        Obter_dados_pf(a.cd_pessoa_fisica,'CNS')                                                                                   AS CNS,
        a.dt_entrada                                                                                                                AS DATA_ENTRADA,
        Obter_unidade_atendimento(a.nr_atendimento,'A','U')                                                                        AS LEITO,
        UPPER(TRANSLATE(Obter_Clinica_Atendimento(a.nr_atendimento),
          'áéíóúàèìòùãõâêîôôäëïöüçÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÄËÏÖÜÇ',
          'aeiouaeiouaoaeiooaeioucAEIOUAEIOUAOAEIOOAEIOUC'))                                                                        AS CLINICA,
        SYSDATE                                                                                                                     AS DATA
      FROM atendimento_paciente a
      LEFT JOIN pessoa_fisica b ON a.cd_pessoa_fisica = b.cd_pessoa_fisica
      WHERE a.nr_atendimento = :nr_atendimento
    `;

    const result = await conn.execute(sql, { nr_atendimento: nrAtendimento.toString() });

    if (!result.rows || result.rows.length === 0) return null;

    const row = result.rows[0];
    return normalizarPaciente(row);
  } finally {
    await conn.close();
  }
}

/**
 * Busca pacientes por nome (parcial)
 */
async function buscarPorNome(nome) {
  if (!oracledb) return [getMockPaciente('123456')];

  const conn = await getConnection();
  try {
    const sql = `
      SELECT DISTINCT
        a.nr_atendimento                                                            AS ATENDIMENTO,
        a.cd_pessoa_fisica                                                          AS PRONTUARIO,
        UPPER(TRANSLATE(NVL(b.nm_pessoa_fisica, Obter_dados_pf(a.cd_pessoa_fisica,'NSOC')),
          'áéíóúàèìòùãõâêîôôäëïöüçÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÄËÏÖÜÇ',
          'aeiouaeiouaoaeiooaeioucAEIOUAEIOUAOAEIOOAEIOUC'))                        AS NOME,
        CASE 
          WHEN Obter_dados_pf(a.cd_pessoa_fisica,'SE') = 'F' THEN 'Feminino'
          WHEN Obter_dados_pf(a.cd_pessoa_fisica,'SE') = 'M' THEN 'Masculino'
          ELSE 'Nao informado'
        END                                                                         AS SEXO,
        Obter_dados_pf(a.cd_pessoa_fisica,'DN')                                    AS DATA_NASCIMENTO,
        a.dt_entrada                                                                AS DATA_ENTRADA,
        Obter_unidade_atendimento(a.nr_atendimento,'A','U')                        AS LEITO
      FROM atendimento_paciente a
      LEFT JOIN pessoa_fisica b ON a.cd_pessoa_fisica = b.cd_pessoa_fisica
      WHERE UPPER(TRANSLATE(NVL(b.nm_pessoa_fisica, ''),
              'áéíóúàèìòùãõâêîôôäëïöüçÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÄËÏÖÜÇ',
              'aeiouaeiouaoaeiooaeioucAEIOUAEIOUAOAEIOOAEIOUC'))
            LIKE UPPER(:nome)
        AND a.dt_entrada >= SYSDATE - 30
      ORDER BY a.dt_entrada DESC
      FETCH FIRST 20 ROWS ONLY
    `;

    const nomeFormatado = `%${nome.replace(/\s+/g, '%')}%`;
    const result = await conn.execute(sql, { nome: nomeFormatado });

    if (!result.rows || result.rows.length === 0) return [];
    return result.rows.map(normalizarPaciente);
  } finally {
    await conn.close();
  }
}

function normalizarPaciente(row) {
  return {
    atendimento: row.ATENDIMENTO || '',
    prontuario: row.PRONTUARIO || '',
    nome: row.NOME || '',
    sexo: row.SEXO || '',
    data_nascimento: formatarData(row.DATA_NASCIMENTO),
    idade: row.IDADE || '',
    mae: row.MAE || '',
    cns: row.CNS || '',
    data_entrada: formatarData(row.DATA_ENTRADA),
    leito: row.LEITO || '',
    clinica: row.CLINICA || ''
  };
}

function formatarData(val) {
  if (!val) return '';
  if (typeof val === 'string') {
    // Tenta formatar DD/MM/YYYY
    if (val.includes('/')) return val;
    if (val.includes('-')) {
      const [y, m, d] = val.split('T')[0].split('-');
      return `${d}/${m}/${y}`;
    }
    return val;
  }
  if (val instanceof Date) {
    const d = val.getDate().toString().padStart(2, '0');
    const m = (val.getMonth() + 1).toString().padStart(2, '0');
    const y = val.getFullYear();
    return `${d}/${m}/${y}`;
  }
  return String(val);
}

function getMockPaciente(nr) {
  return {
    atendimento: nr || '123456',
    prontuario: '789012',
    nome: 'JOAO DA SILVA SANTOS',
    sexo: 'Masculino',
    data_nascimento: '15/03/1980',
    idade: '44 anos',
    mae: 'MARIA DA SILVA',
    cns: '123456789012345',
    data_entrada: new Date().toLocaleDateString('pt-BR'),
    leito: 'UH-201',
    clinica: 'CLINICA MEDICA'
  };
}

module.exports = { buscarPorAtendimento, buscarPorNome, setLocalDb };
