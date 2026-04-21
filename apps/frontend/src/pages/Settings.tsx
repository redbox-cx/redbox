import { useEffect } from 'react';
import { TopBar } from '../components/dashboard/TopBar';
import { useAuth } from '../context/AuthContext';
import { SettingsProfileCard } from '../components/settings/SettingsProfileCard';
import { SettingsAvatarCard } from '../components/settings/SettingsAvatarCard';
import { SettingsPasswordCard } from '../components/settings/SettingsPasswordCard';
import { SettingsInvitesCard } from '../components/settings/SettingsInvitesCard';
import { SettingsDeleteCard } from '../components/settings/SettingsDeleteCard';
import { SettingsBlockedSendersCard } from '../components/settings/SettingsBlockedSendersCard';

export function Settings() {
    const { user, updateUser, logout } = useAuth();

    useEffect(() => {
        document.documentElement.classList.add('dash-page', 'settings-page');
        return () => { document.documentElement.classList.remove('dash-page', 'settings-page'); };
    }, []);

    const memberSince = user?.createdAt
        ? new Date(user.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })
        : '—';

    return (
        <div className="dash-layout">
            <div className="blob blob-1" />
            <div className="blob blob-2" />
            <TopBar />
            <main className="settings-container">
                <h1 className="dash-greeting">Settings</h1>
                <div className="settings-grid">
                    <SettingsProfileCard username={user?.username} avatar={user?.avatar} memberSince={memberSince} />
                    <SettingsAvatarCard currentAvatar={user?.avatar} onSaved={avatar => updateUser({ avatar })} />
                    <SettingsPasswordCard onLogout={logout} />
                    <SettingsInvitesCard />
                    <SettingsBlockedSendersCard />
                    <SettingsDeleteCard onLogout={logout} />
                </div>
            </main>
        </div>
    );
}
