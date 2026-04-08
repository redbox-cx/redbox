const IV_LEN = 12;

function hexToBytes(hex: string): Uint8Array {
    return new Uint8Array(hex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
}

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

export const BinCrypto = {
    async generateBinKey(): Promise<{ cryptoKey: CryptoKey; keyHex: string }> {
        const cryptoKey = await window.crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
        );
        const raw = await window.crypto.subtle.exportKey('raw', cryptoKey);
        const keyHex = bytesToHex(new Uint8Array(raw));
        return { cryptoKey, keyHex };
    },
    async importKey(keyHex: string): Promise<CryptoKey> {
        const bytes = hexToBytes(keyHex);
        return window.crypto.subtle.importKey(
            'raw', bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
            { name: 'AES-GCM' }, false, ['decrypt']
        );
    },
    async encryptText(cryptoKey: CryptoKey, plaintext: string): Promise<string> {
        const iv = window.crypto.getRandomValues(new Uint8Array(IV_LEN));
        const encoded = new TextEncoder().encode(plaintext);
        const ciphertext = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv }, cryptoKey, encoded
        );
        const result = new Uint8Array(IV_LEN + ciphertext.byteLength);
        result.set(iv, 0);
        result.set(new Uint8Array(ciphertext), IV_LEN);
        return bytesToBase64(result);
    },
    async decryptText(cryptoKey: CryptoKey, b64: string): Promise<string> {
        const bytes = base64ToBytes(b64);
        const iv = bytes.slice(0, IV_LEN);
        const ciphertext = bytes.slice(IV_LEN);
        const decrypted = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv }, cryptoKey, ciphertext
        );
        return new TextDecoder().decode(decrypted);
    },
};
