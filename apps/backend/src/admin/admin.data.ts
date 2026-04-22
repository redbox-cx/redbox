export type AdminChartRange = '24h' | '7d' | '30d' | 'total';
export type AdminUserStatus = 'active' | 'banned' | 'locked' | 'pending';
export type AdminLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AdminChartPoint {
  time: string;
  value: number;
}

export type AdminHistory = Record<AdminChartRange, AdminChartPoint[]>;

export interface AdminStatusCard {
  value: number | string;
  subtitle?: string;
  isPositive?: boolean;
  isAlert?: boolean;
}

export interface AdminContentReport {
  id: string;
  reportedUser: {
    username: string;
    uuid: string;
    joinDate: string;
  };
  timestamp: string;
  link: string;
  fileSize: string;
  fileCreationDate: string;
  reason: string;
  reporterEmail: string | null;
  hasContentPassword?: boolean;
  contentPassword?: string | null;
  contentPasswordAvailable?: boolean;
}

export interface AdminBugReport {
  id: string;
  subject: string;
  timestamp: string;
  description: string;
  attachments: string[];
  reporterEmail: string | null;
}

export interface AdminArchivedReport {
  id: string;
  originalType: string;
  subject: string;
  timestamp: string;
  resolvedBy: string;
  actionTaken: string;
}

export interface AdminUserRecord {
  id: string;
  username: string;
  email: string;
  uuid: string;
  joined: string;
  status: AdminUserStatus;
  storageUsed: string;
  lastLoginAt: string;
  lastLoginIp: string;
  createdAt: string;
}

export interface AdminAuditLogRecord {
  id: string;
  timestamp: string;
  timestampIso: string;
  adminId: string;
  adminUsername: string;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  ipAddress: string;
  reason: string;
  meta: Record<string, unknown>;
}

export interface AdminRouteRecord {
  route: string;
  paused: boolean;
  pausedBy: string | null;
  pausedAt: string | null;
  reason: string | null;
}

export interface AdminMailSender {
  id: string;
  address: string;
  label: string;
  initials: string;
  color: string;
}

export interface AdminMailTemplate {
  name: string;
  subject: string;
  body: string;
}

export interface AdminMailAttachment {
  id?: string;
  name: string;
  size: number;
  type: string;
  downloadUrl?: string | null;
  isDownloadable?: boolean;
}

export interface AdminMailRecord {
  id: string;
  sender: AdminMailSender;
  recipients: string[];
  isBroadcast: boolean;
  subject: string;
  body: string;
  isHtml: boolean;
  template: string | null;
  attachments: AdminMailAttachment[];
  sentAt: string;
  canRecall: boolean;
  recalledAt: string | null;
}

export interface AdminBlogPostRecord {
  id: string;
  title: string | null;
  subtitle: string;
  markdown: string;
  status: 'draft' | 'published' | 'withdrawn';
  storageName: string;
  contentSize: number;
  categories: string[];
  author: {
    name: string;
    title: string | null;
  };
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  withdrawnAt: string | null;
}

export interface AdminLogRecord {
  timestamp: string;
  level: AdminLogLevel;
  message: string;
  meta: Record<string, unknown>;
}

export const ADMIN_DASHBOARD_STATS = {
  userCount: { value: 1248, subtitle: '+34 in last 7 days', isPositive: true },
  globalStorage: { value: '142.5 GB', subtitle: '+4.2 GB in last 7 days', isPositive: true },
  totalTraffic: { value: '4.2 TB', subtitle: 'Stable', isPositive: false },
  openReports: { value: 3 },
} satisfies Record<string, AdminStatusCard>;

export const ADMIN_STORAGE_BREAKDOWN = [
  { name: 'Uploads', value: 1200, color: '#951d2a' },
  { name: 'Mail', value: 450, color: '#2b2732' },
  { name: 'Bin', value: 150, color: '#9ca3af' },
  { name: 'System', value: 200, color: '#e5e7eb' },
  { name: 'Free', value: 400, color: '#ffffff' },
];

export const ADMIN_STORAGE_HISTORY: AdminHistory = {
  '24h': [
    { time: '00:00', value: 140 },
    { time: '12:00', value: 141 },
    { time: '23:59', value: 142.5 },
  ],
  '7d': [
    { time: 'Mon', value: 135 },
    { time: 'Tue', value: 136 },
    { time: 'Wed', value: 138 },
    { time: 'Thu', value: 138.5 },
    { time: 'Fri', value: 140 },
    { time: 'Sat', value: 141 },
    { time: 'Sun', value: 142.5 },
  ],
  '30d': [
    { time: 'Week 1', value: 130 },
    { time: 'Week 2', value: 135 },
    { time: 'Week 3', value: 138 },
    { time: 'Week 4', value: 142.5 },
  ],
  total: [
    { time: 'Jan', value: 100 },
    { time: 'Feb', value: 120 },
    { time: 'Mar', value: 135 },
    { time: 'Apr', value: 142.5 },
  ],
};

export const ADMIN_TRAFFIC_HISTORY: AdminHistory = {
  '24h': [
    { time: '00:00', value: 120 },
    { time: '08:00', value: 400 },
    { time: '16:00', value: 250 },
    { time: '23:59', value: 300 },
  ],
  '7d': [
    { time: 'Mon', value: 130 },
    { time: 'Tue', value: 180 },
    { time: 'Wed', value: 150 },
    { time: 'Thu', value: 250 },
    { time: 'Fri', value: 220 },
    { time: 'Sat', value: 300 },
    { time: 'Sun', value: 280 },
  ],
  '30d': [
    { time: 'Week 1', value: 1000 },
    { time: 'Week 2', value: 1200 },
    { time: 'Week 3', value: 900 },
    { time: 'Week 4', value: 1500 },
  ],
  total: [
    { time: 'Jan', value: 4000 },
    { time: 'Feb', value: 5000 },
    { time: 'Mar', value: 4500 },
    { time: 'Apr', value: 6000 },
  ],
};

export const ADMIN_USER_GROWTH_HISTORY: AdminHistory = {
  '24h': [
    { time: '00:00', value: 2 },
    { time: '12:00', value: 5 },
    { time: '23:59', value: 8 },
  ],
  '7d': [
    { time: 'Mon', value: 10 },
    { time: 'Tue', value: 15 },
    { time: 'Wed', value: 12 },
    { time: 'Thu', value: 20 },
    { time: 'Fri', value: 35 },
    { time: 'Sat', value: 30 },
    { time: 'Sun', value: 34 },
  ],
  '30d': [
    { time: 'Week 1', value: 100 },
    { time: 'Week 2', value: 150 },
    { time: 'Week 3', value: 130 },
    { time: 'Week 4', value: 200 },
  ],
  total: [
    { time: 'Jan', value: 400 },
    { time: 'Feb', value: 600 },
    { time: 'Mar', value: 900 },
    { time: 'Apr', value: 1248 },
  ],
};

export const ADMIN_REPORTS_HISTORY: AdminHistory = {
  '24h': [
    { time: '00:00', value: 1 },
    { time: '12:00', value: 0 },
    { time: '23:59', value: 3 },
  ],
  '7d': [
    { time: 'Mon', value: 5 },
    { time: 'Tue', value: 2 },
    { time: 'Wed', value: 0 },
    { time: 'Thu', value: 1 },
    { time: 'Fri', value: 4 },
    { time: 'Sat', value: 0 },
    { time: 'Sun', value: 3 },
  ],
  '30d': [
    { time: 'Week 1', value: 15 },
    { time: 'Week 2', value: 10 },
    { time: 'Week 3', value: 5 },
    { time: 'Week 4', value: 8 },
  ],
  total: [
    { time: 'Jan', value: 45 },
    { time: 'Feb', value: 30 },
    { time: 'Mar', value: 25 },
    { time: 'Apr', value: 38 },
  ],
};

export const ADMIN_DASHBOARD_CHARTS = {
  traffic: ADMIN_TRAFFIC_HISTORY,
  storage: ADMIN_STORAGE_HISTORY,
  'user-growth': ADMIN_USER_GROWTH_HISTORY,
  reports: ADMIN_REPORTS_HISTORY,
};

export const ADMIN_USER_COUNT = {
  totalUsers: 1248,
  newToday: 12,
  newLast7Days: 34,
  newLast30Days: 142,
};

export const ADMIN_STORAGE_COUNT = {
  percentUsed: '82%',
  usedAmount: '1.1 TB',
  totalAmount: 'of 2.0 TB used',
  totalAvailableBytes: 2199023255552,
  totalUsedBytes: 1209462790553,
  newUsedLast24hBytes: 2147483648,
  newUsedLast7dBytes: 4509715660,
  newUsedLast30dBytes: 22333829939,
  breakdown: ADMIN_STORAGE_BREAKDOWN,
  history: ADMIN_STORAGE_HISTORY,
};

export const ADMIN_TRAFFIC_SUMMARY = {
  totalTraffic: '4.2 TB',
  status: 'stable',
};

export const ADMIN_USERS_STATS = {
  totalUsers: { value: 1248, subtitle: '+34 this week', isPositive: true },
  activeBans: { value: 7, subtitle: '3 locked Â· 1 pending', isAlert: true },
  newToday: { value: 12, subtitle: 'Registrations today', isPositive: true },
  adminActions: { value: 24, subtitle: 'Manual actions (7d)' },
};

export const ADMIN_CONTENT_REPORTS: AdminContentReport[] = [
  {
    id: 'REP-9921',
    reportedUser: {
      username: 'crypto_king',
      uuid: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
      joinDate: '12 Jan 2024',
    },
    timestamp: '16 Apr 2026, 14:32',
    link: 'https://redbox.cx/dl/abc123xyz_malware.zip',
    fileSize: '14.2 MB',
    fileCreationDate: '14 Apr 2026, 08:15',
    reason:
      'This file contains a trojan virus. It tried to execute immediately after I downloaded it. Please remove it ASAP.',
    reporterEmail: 'victim@example.com',
  },
  {
    id: 'REP-9922',
    reportedUser: {
      username: 'anon_8821',
      uuid: '9f8e7d6c-5b4a-3928-1765-4d3c2b1a0f9e',
      joinDate: '05 Feb 2025',
    },
    timestamp: '15 Apr 2026, 09:15',
    link: 'https://redbox.cx/p/phishing-login-page',
    fileSize: '2.1 KB',
    fileCreationDate: '15 Apr 2026, 09:10',
    reason: 'Phishing attempt. The pastebin link redirects to a fake banking login portal.',
    reporterEmail: null,
  },
];

export const ADMIN_BUG_REPORTS: AdminBugReport[] = [
  {
    id: 'BUG-104',
    subject: 'Upload hangs at 99%',
    timestamp: '16 Apr 2026, 10:05',
    description:
      'When I try to upload files larger than 1GB, the progress bar gets stuck at 99% and never finishes. Tested on Chrome and Safari.',
    attachments: ['screenshot_error.png', 'console_log.txt'],
    reporterEmail: 'dev_tester@redbox.cx',
  },
  {
    id: 'BUG-105',
    subject: 'Dark mode glitch on mobile',
    timestamp: '14 Apr 2026, 22:40',
    description:
      'The header stays white when I switch to dark mode on my iPhone 14. Makes the menu unreadable.',
    attachments: ['screen_recording.mp4'],
    reporterEmail: null,
  },
];

export const ADMIN_ARCHIVED_REPORTS: AdminArchivedReport[] = [
  {
    id: 'ARC-8812',
    originalType: 'Content Report',
    subject: 'User: spammer_99 (Phishing Link)',
    timestamp: '10 Apr 2026, 16:20',
    resolvedBy: 'Admin',
    actionTaken:
      'User permanently banned. Associated files deleted and hash added to global blacklist.',
  },
  {
    id: 'ARC-8813',
    originalType: 'Bug Report',
    subject: 'Login page layout broken on Firefox',
    timestamp: '08 Apr 2026, 09:45',
    resolvedBy: 'DevTeam_Alex',
    actionTaken: 'Fixed CSS grid issue in patch v2.1.4. Issue closed.',
  },
  {
    id: 'ARC-8814',
    originalType: 'Law Enforcement',
    subject: 'DMCA Takedown Notice #40921',
    timestamp: '02 Apr 2026, 11:10',
    resolvedBy: 'Legal Dept',
    actionTaken:
      'Content taken down within 24h. Notification email sent to uploader regarding TOS violation.',
  },
  {
    id: 'ARC-8815',
    originalType: 'Content Report',
    subject: 'User: anon_112 (Gore Content)',
    timestamp: '01 Apr 2026, 23:55',
    resolvedBy: 'Moderator_Sarah',
    actionTaken: 'Content removed. User given a 7-day suspension.',
  },
];

export const ADMIN_USERS: AdminUserRecord[] = [
  {
    id: 'usr_1',
    username: 'alice_chen',
    email: 'alice@redbox.cx',
    uuid: '8c6ef262-5d0a-4016-a813-aec7f70b77ce',
    joined: '12 Jan 2026',
    status: 'active',
    storageUsed: '2.4 GB',
    lastLoginAt: '16 Apr 2026, 12:01',
    lastLoginIp: '91.23.11.4',
    createdAt: '2026-01-12T10:15:00.000Z',
  },
  {
    id: 'usr_2',
    username: 'bob_smith',
    email: 'bob@redbox.cx',
    uuid: 'fd837c6e-b444-44f2-9981-a5377214191a',
    joined: '10 Feb 2026',
    status: 'banned',
    storageUsed: '9.8 GB',
    lastLoginAt: '15 Apr 2026, 18:44',
    lastLoginIp: '91.23.11.8',
    createdAt: '2026-02-10T07:30:00.000Z',
  },
  {
    id: 'usr_3',
    username: 'carol_w',
    email: 'carol@redbox.cx',
    uuid: 'ae3e066f-8158-4f30-a2ff-ebd38841f0b8',
    joined: '05 Mar 2026',
    status: 'locked',
    storageUsed: '0.8 GB',
    lastLoginAt: '16 Apr 2026, 08:13',
    lastLoginIp: '91.23.12.1',
    createdAt: '2026-03-05T15:20:00.000Z',
  },
  {
    id: 'usr_4',
    username: 'dlee_99',
    email: 'dlee@redbox.cx',
    uuid: 'ac82b146-e3fd-4b03-838b-f00dd8de5187',
    joined: '15 Mar 2026',
    status: 'active',
    storageUsed: '12.7 GB',
    lastLoginAt: '16 Apr 2026, 09:22',
    lastLoginIp: '91.23.17.4',
    createdAt: '2026-03-15T11:05:00.000Z',
  },
  {
    id: 'usr_5',
    username: 'mks_dev',
    email: 'mks@redbox.cx',
    uuid: '67405b46-3ddf-474e-b5d7-f6eac6f31908',
    joined: '08 Feb 2026',
    status: 'pending',
    storageUsed: '0.1 GB',
    lastLoginAt: '13 Apr 2026, 20:14',
    lastLoginIp: '91.23.19.5',
    createdAt: '2026-02-08T21:30:00.000Z',
  },
  {
    id: 'usr_6',
    username: 'crypto_king',
    email: 'crypto_king@redbox.cx',
    uuid: '70862f03-d1f4-4932-b671-7fe64ad55f44',
    joined: '12 Jan 2024',
    status: 'banned',
    storageUsed: '18.2 GB',
    lastLoginAt: '14 Apr 2026, 02:30',
    lastLoginIp: '91.99.21.90',
    createdAt: '2024-01-12T08:00:00.000Z',
  },
];

export const ADMIN_AUDIT_LOGS: AdminAuditLogRecord[] = [
  {
    id: 'AUD-0001',
    timestamp: '16 Apr 2026, 14:32',
    timestampIso: '2026-04-16T14:32:00.000Z',
    adminId: 'adm_1',
    adminUsername: 'Admin',
    action: 'ban_user',
    targetType: 'user',
    targetId: 'usr_123',
    targetLabel: 'crypto_king',
    ipAddress: '91.23.11.4',
    reason: 'Phishing uploads',
    meta: { durationDays: 7 },
  },
  {
    id: 'AUD-0002',
    timestamp: '16 Apr 2026, 13:10',
    timestampIso: '2026-04-16T13:10:00.000Z',
    adminId: 'adm_1',
    adminUsername: 'Admin',
    action: 'pause_route',
    targetType: 'route',
    targetId: '/api/v1/register',
    targetLabel: '/api/v1/register',
    ipAddress: '91.23.11.4',
    reason: 'Spam wave',
    meta: {},
  },
];

export const ADMIN_ROUTES: AdminRouteRecord[] = [
  {
    route: '/api/v1/upload',
    paused: false,
    pausedBy: null,
    pausedAt: null,
    reason: null,
  },
  {
    route: '/api/v1/register',
    paused: true,
    pausedBy: 'Admin',
    pausedAt: '16 Apr 2026, 13:10',
    reason: 'Spam wave',
  },
];

export const ADMIN_MAIL_SENDERS: AdminMailSender[] = [
  {
    id: 'admin',
    address: 'admin@team.redbox.cx',
    label: 'Admin',
    initials: 'AD',
    color: '#951d2a',
  },
  {
    id: 'no-reply',
    address: 'no-reply@team.redbox.cx',
    label: 'No Reply',
    initials: 'NR',
    color: '#6b7280',
  },
  {
    id: 'support',
    address: 'support@team.redbox.cx',
    label: 'Support',
    initials: 'SP',
    color: '#3b82f6',
  },
  {
    id: 'security',
    address: 'security@team.redbox.cx',
    label: 'Security',
    initials: 'SC',
    color: '#f59e0b',
  },
];

export const ADMIN_MAIL_TEMPLATES: AdminMailTemplate[] = [
  {
    name: 'Password Reset Warning',
    subject: 'Action Required: Reset Your Password',
    body: 'Dear user,\n\nWe noticed unusual activity...',
  },
  {
    name: 'Security Alert',
    subject: 'Security Alert on Your Account',
    body: 'Dear user,\n\nA new login was detected on your account from an unrecognized device.',
  },
];

export const ADMIN_MAILS: AdminMailRecord[] = [
  {
    id: 'mail_1',
    sender: ADMIN_MAIL_SENDERS[0],
    recipients: ['user@example.com'],
    isBroadcast: false,
    subject: 'Action Required: Reset Your Password',
    body: 'Dear user...',
    isHtml: false,
    template: 'Password Reset Warning',
    attachments: [
      { name: 'manual.pdf', size: 123456, type: 'application/pdf' },
    ],
    sentAt: '2026-04-16T14:30:00.000Z',
    canRecall: true,
    recalledAt: null,
  },
];

export const ADMIN_BLOG_POSTS: AdminBlogPostRecord[] = [
  {
    id: 'post_1',
    title: 'Platform Maintenance Update',
    subtitle: 'We are performing scheduled maintenance...',
    markdown: '# Platform Maintenance Update\n\nMaintenance details...',
    status: 'published',
    storageName: 'platform-maintenance-update.md',
    contentSize: 55,
    categories: ['Maintenance'],
    author: {
      name: 'Admin',
      title: 'System Administrator',
    },
    createdAt: '2026-04-16T12:00:00.000Z',
    updatedAt: '2026-04-16T12:20:00.000Z',
    publishedAt: '2026-04-16T12:30:00.000Z',
    withdrawnAt: null,
  },
  {
    id: 'post_2',
    title: 'Quarterly Security Review',
    subtitle: 'A short summary of the latest security work.',
    markdown: '# Quarterly Security Review\n\nSecurity review draft...',
    status: 'draft',
    storageName: 'quarterly-security-review.md',
    contentSize: 54,
    categories: ['Security'],
    author: {
      name: 'Admin',
      title: 'Security Team',
    },
    createdAt: '2026-04-15T09:00:00.000Z',
    updatedAt: '2026-04-15T10:00:00.000Z',
    publishedAt: null,
    withdrawnAt: null,
  },
];

export const ADMIN_BACKEND_LOGS: AdminLogRecord[] = [
  {
    timestamp: '2026-04-16T14:30:00.000Z',
    level: 'info',
    message: 'Server started',
    meta: {},
  },
  {
    timestamp: '2026-04-16T14:31:00.000Z',
    level: 'error',
    message: 'DB timeout',
    meta: { route: '/api/v1/upload' },
  },
  {
    timestamp: '2026-04-16T14:33:00.000Z',
    level: 'warn',
    message: 'Queue lag detected',
    meta: { worker: 'mail-sender' },
  },
];

export const ADMIN_FRONTEND_LOGS: AdminLogRecord[] = [
  {
    timestamp: '2026-04-16T14:30:00.000Z',
    level: 'warn',
    message: 'Chunk load retry',
    meta: {},
  },
  {
    timestamp: '2026-04-16T14:31:30.000Z',
    level: 'error',
    message: 'Dashboard widget failed to hydrate',
    meta: { component: 'OverviewChart' },
  },
];
