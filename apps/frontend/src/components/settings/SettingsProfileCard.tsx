import { getAvatarSrc } from '../../config/avatars';

interface Props {
    username?: string;
    avatar?: string;
    memberSince: string;
}

export function SettingsProfileCard({ username, avatar, memberSince }: Props) {
    return (
        <div className="glass-panel settings-card settings-profile-card">
            <div className="settings-profile-avatar">
                <img src={getAvatarSrc(avatar ?? '')} alt="avatar" className="settings-big-avatar" />
            </div>
            <div className="settings-profile-info">
                <p className="settings-profile-username">{username}</p>
                <p className="settings-profile-since">Member since {memberSince}</p>
            </div>
        </div>
    );
}
