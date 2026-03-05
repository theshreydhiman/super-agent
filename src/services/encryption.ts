import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// Cache the derived key so scryptSync is only called once per process lifetime
let cachedKey: Buffer | null = null;

function getKey(): Buffer {
    if (cachedKey) return cachedKey;

    const key = config.encryptionKey;
    if (!key || key === 'default-encryption-key-change-me') {
        throw new Error(
            'ENCRYPTION_KEY must be set to a secure value. ' +
            'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
        );
    }
    cachedKey = crypto.scryptSync(key, 'super-agent-salt', 32);
    return cachedKey;
}

export function encrypt(plaintext: string): string {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
}

export function decrypt(ciphertext: string): string {
    const key = getKey();
    const parts = ciphertext.split(':');

    if (parts.length !== 3) {
        throw new Error('Invalid encrypted value format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

export function maskSecret(value: string): string {
    if (!value || value.length <= 8) return '****';
    return value.substring(0, 4) + '****' + value.substring(value.length - 4);
}
