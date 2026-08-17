import { FILE_IV_LENGTH } from './FileCryptoFormat';

export const CryptoService = {
    /** Generate a random 256-bit AES-GCM key. Returns the CryptoKey and its 64-char hex representation. */
    async generateKey(): Promise<{ cryptoKey: CryptoKey; keyHex: string }> {
        const cryptoKey = await window.crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt']
        );
        const raw = await window.crypto.subtle.exportKey('raw', cryptoKey);
        const keyHex = Array.from(new Uint8Array(raw))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        return { cryptoKey, keyHex };
    },

    /** Import a 64-char hex key string as a CryptoKey for decryption. */
    async importKey(keyHex: string): Promise<CryptoKey> {
        if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
            throw new Error('Invalid AES-256 file key.');
        }
        const keyBytes = new Uint8Array(
            keyHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16))
        );
        return window.crypto.subtle.importKey(
            'raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']
        );
    },

    /**
     * Encrypt a chunk buffer with AES-GCM.
     * Returns a Uint8Array: [12-byte IV][ciphertext + 16-byte auth tag].
     */
    async encryptChunk(cryptoKey: CryptoKey, chunkBuffer: ArrayBuffer, additionalData?: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
        const iv = window.crypto.getRandomValues(new Uint8Array(FILE_IV_LENGTH));
        const algorithm: AesGcmParams = { name: 'AES-GCM', iv, tagLength: 128 };
        if (additionalData) algorithm.additionalData = additionalData;
        const ciphertext = await window.crypto.subtle.encrypt(
            algorithm,
            cryptoKey,
            chunkBuffer
        );
        const result = new Uint8Array(FILE_IV_LENGTH + ciphertext.byteLength);
        result.set(iv, 0);
        result.set(new Uint8Array(ciphertext), FILE_IV_LENGTH);
        return result;
    },

    /**
     * Decrypt an encrypted chunk buffer.
     * Input format: [12-byte IV][ciphertext + 16-byte auth tag].
     */
    async decryptChunk(
        cryptoKey: CryptoKey,
        encryptedWithIv: ArrayBuffer | Uint8Array<ArrayBuffer>,
        additionalData?: Uint8Array<ArrayBuffer>,
    ): Promise<ArrayBuffer> {
        const encryptedBytes = encryptedWithIv instanceof Uint8Array
            ? encryptedWithIv
            : new Uint8Array(encryptedWithIv);
        if (encryptedBytes.byteLength <= FILE_IV_LENGTH + 16) {
            throw new Error('Encrypted chunk is too small.');
        }

        const iv = encryptedBytes.subarray(0, FILE_IV_LENGTH);
        const ciphertext = encryptedBytes.subarray(FILE_IV_LENGTH);
        const algorithm: AesGcmParams = { name: 'AES-GCM', iv, tagLength: 128 };
        if (additionalData) algorithm.additionalData = additionalData;
        return window.crypto.subtle.decrypt(
            algorithm,
            cryptoKey,
            ciphertext
        );
    },
};
