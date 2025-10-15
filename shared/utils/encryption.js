const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Get encryption key from environment
 * In production, this should be a strong random key stored securely
 */
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  // Derive a key from the master key
  return crypto.scryptSync(key, 'salt', KEY_LENGTH);
}

/**
 * Encrypt a string value
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted text in format: iv:encrypted:authTag
 */
function encrypt(text) {
  if (!text) return null;
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Return format: iv:encrypted:authTag (all in hex)
  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

/**
 * Decrypt an encrypted string
 * @param {string} encrypted - Encrypted text in format: iv:encrypted:authTag
 * @returns {string} - Decrypted plain text
 */
function decrypt(encrypted) {
  if (!encrypted) return null;
  
  const key = getEncryptionKey();
  const parts = encrypted.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  const authTag = Buffer.from(parts[2], 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Mask a string for display (show only last 4 characters)
 * @param {string} str - String to mask
 * @returns {string} - Masked string like "****1234"
 */
function maskString(str) {
  if (!str || str.length <= 4) return '****';
  return '****' + str.slice(-4);
}

module.exports = {
  encrypt,
  decrypt,
  maskString,
};
