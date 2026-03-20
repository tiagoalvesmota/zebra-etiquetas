/**
 * Serviço de criptografia para senhas armazenadas
 * Usa AES-256-CBC
 */
const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const KEY = Buffer.from(
  (process.env.CRYPTO_KEY || 'chave_padrao_32_chars_aqui!!!!').padEnd(32).slice(0, 32)
);

function encrypt(text) {
  if (!text) return '';
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (e) {
    console.error('Erro ao criptografar:', e.message);
    return '';
  }
}

function decrypt(encryptedText) {
  if (!encryptedText) return '';
  try {
    const [ivHex, encrypted] = encryptedText.split(':');
    if (!ivHex || !encrypted) return encryptedText; // texto não criptografado
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    // Pode ser texto plano ainda não criptografado
    return encryptedText;
  }
}

module.exports = { encrypt, decrypt };
