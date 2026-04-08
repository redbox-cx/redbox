const modules = import.meta.glob('../assets/avatars/*', { eager: true, as: 'url' }) as Record<string, string>;

export interface AvatarEntry {
    key: string;   // enum value
    src: string;   // resolved image URL
}

export const AVATAR_LIST: AvatarEntry[] = Object.entries(modules)
    .map(([path, src]) => {
        const filename = path.split('/').pop() ?? '';
        const key = filename.replace(/\.[^.]+$/, ''); // strip extension
        return { key, src };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

const AVATAR_MAP: Record<string, string> = Object.fromEntries(
    AVATAR_LIST.map(({ key, src }) => [key, src])
);

// Fallback: first available avatar, or empty string
const FALLBACK = AVATAR_LIST[0]?.src ?? '';

export function getAvatarSrc(avatarKey: string): string {
    return AVATAR_MAP[avatarKey] ?? FALLBACK;
}
