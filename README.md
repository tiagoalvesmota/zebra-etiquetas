# 🏥 Zebra Etiquetas Hospitalares

Sistema de impressão de etiquetas de pacientes para **impressoras Zebra ZD220/ZD230** via ZPL, integrado com o sistema **TASY** (Oracle).

---

## 📦 Pré-requisitos

- **Node.js** 18+ (https://nodejs.org)
- **Oracle Instant Client** (para o driver `oracledb`)
  - Download: https://www.oracle.com/database/technologies/instant-client/downloads.html
  - Versão recomendada: Basic Light 21.x

---

## 🚀 Instalação

```bash
# 1. Entre na pasta do projeto
cd zebra-etiquetas

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas configurações

# 4. Inicie o servidor
npm start
```

O servidor estará disponível em: **http://SEU_IP:3000**

---

## ⚙️ Configuração do Oracle Instant Client

### Linux (Ubuntu/Debian)
```bash
# Instale o libaio
sudo apt-get install libaio1

# Extraia o Instant Client em /opt/oracle/instantclient
sudo mkdir -p /opt/oracle
sudo unzip instantclient-basiclite-linux.x64-21.x.x.x.x.zip -d /opt/oracle/
sudo sh -c "echo /opt/oracle/instantclient_21_x > /etc/ld.so.conf.d/oracle-instantclient.conf"
sudo ldconfig
```

### Windows
- Extraia o Instant Client para `C:\oracle\instantclient`
- Adicione ao PATH do sistema

---

## 🔑 Acesso inicial

| Campo  | Valor    |
|--------|----------|
| Login  | `admin`  |
| Senha  | `admin123` |

> ⚠️ **Altere a senha após o primeiro acesso!**

---

## 🖨️ Configurando a impressora Zebra

1. Acesse a aba **Impressoras** no sistema
2. Clique em **+ Nova Impressora**
3. Preencha:
   - Nome: `Recepção` (ou o setor desejado)
   - IP: IP da impressora na rede (ex: `192.168.1.100`)
   - Porta: `9100` (padrão Zebra)
   - Modelo: `ZD220` ou `ZD230`
4. Clique em **Testar Conexão** para verificar

### Descobrir o IP da impressora Zebra
- Na impressora: segure o botão Feed por 2 segundos → imprime página de configuração de rede
- Ou acesse pelo painel LCD (em modelos com display)

---

## 🗄️ Configurando o banco Oracle (TASY)

Acesse a aba **Configurações** e preencha:



---

## 📋 Variáveis ZPL disponíveis nos templates

| Variável           | Conteúdo                     |
|--------------------|------------------------------|
| `{{NOME}}`         | Nome completo do paciente     |
| `{{PRONTUARIO}}`   | Número do prontuário          |
| `{{ATENDIMENTO}}`  | Número do atendimento         |
| `{{MAE}}`          | Nome da mãe                   |
| `{{SEXO}}`         | Sexo                          |
| `{{DATA_NASCIMENTO}}` | Data de nascimento         |
| `{{LEITO}}`        | Leito/unidade                 |
| `{{CLINICA}}`      | Clínica de atendimento        |
| `{{CNS}}`          | Cartão Nacional de Saúde      |
| `{{DATA_ENTRADA}}` | Data de entrada               |
| `{{IDADE}}`        | Idade calculada               |

---

## 📁 Estrutura do projeto

```
zebra-etiquetas/
├── backend/
│   ├── server.js              # Servidor Express principal
│   ├── routes/
│   │   ├── auth.js            # Autenticação / usuários
│   │   ├── paciente.js        # Consulta TASY
│   │   ├── impressao.js       # Impressão + gestão de impressoras
│   │   ├── modelo.js          # CRUD de modelos de etiqueta
│   │   └── config.js          # Configuração banco Oracle
│   └── services/
│       ├── oracle.js          # Conexão e queries Oracle
│       ├── zpl.js             # Geração ZPL + envio TCP
│       └── crypto.js          # Criptografia AES-256
├── frontend/
│   └── public/
│       ├── index.html         # App principal
│       ├── login.html         # Tela de login
│       ├── css/app.css
│       └── js/app.js
├── data/                      # Criado automaticamente (SQLite)
├── .env.example
├── package.json
└── README.md
```

---

## 🔒 Segurança

- Sessões HTTP com cookie `httpOnly`
- Senhas de usuário com `bcrypt` (salt 10)
- Credenciais do Oracle criptografadas com AES-256-CBC
- Autenticação obrigatória para todas as rotas exceto `/login.html`

---

## 🛠️ Executar como serviço (Linux/systemd)

```ini
# /etc/systemd/system/zebra-etiquetas.service
[Unit]
Description=Zebra Etiquetas Hospitalares
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/zebra-etiquetas
ExecStart=/usr/bin/node backend/server.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable zebra-etiquetas
sudo systemctl start zebra-etiquetas
```
