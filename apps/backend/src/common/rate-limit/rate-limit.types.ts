export type RateLimitSubject =
  | 'ip'
  | 'user'
  | 'admin'
  | 'username-ip'
  | 'param-ip'
  | 'param-user'
  | 'mail-recipient';

export type RateLimitRule = {
  name: string;
  limit: number;
  windowSeconds: number;
  subject: RateLimitSubject;
  paramName?: string;
  message?: string;
};

export type RateLimitResult = {
  key: string;
  limit: number;
  remaining: number;
  ttlSeconds: number;
};
