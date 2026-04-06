const IV_LENGTH = 12; // bytes — standard for AES-GCM

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
    async encryptChunk(cryptoKey: CryptoKey, chunkBuffer: ArrayBuffer): Promise<Uint8Array> {
        const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
        const ciphertext = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            cryptoKey,
            chunkBuffer
        );
        const result = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
        result.set(iv, 0);
        result.set(new Uint8Array(ciphertext), IV_LENGTH);
        return result;
    },

    /**
     * Decrypt an encrypted chunk buffer.
     * Input format: [12-byte IV][ciphertext + 16-byte auth tag].
     */
    async decryptChunk(cryptoKey: CryptoKey, encryptedWithIv: ArrayBuffer): Promise<ArrayBuffer> {
        const iv = new Uint8Array(encryptedWithIv.slice(0, IV_LENGTH));
        const ciphertext = encryptedWithIv.slice(IV_LENGTH);
        return window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            cryptoKey,
            ciphertext
        );
    },
};
