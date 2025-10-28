import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

const SESSION_KEY = 'credlink-session';

export interface Credentials {
  email?: string;
  username?: string;
  password: string;
  name?: string;
}

export interface AuthResult {
  ok: boolean;
  message?: string;
}

interface AuthResponse {
  token: string;
  expires: string;
  user: ApiUser;
}

interface ApiUser {
  id: string;
  email: string;
  name?: string;
  status?: string;
  created?: string;
  approved?: boolean;
}

interface StoredSession {
  token: string;
  expires: string;
  user: ApiUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  private _authed = signal<boolean>(false);
  private _approved = signal<boolean>(false);
  private _userId = signal<string | null>(null);
  private _username = signal<string | null>(null);
  private _token = signal<string | null>(null);
  private _expires = signal<string | null>(null);
  private _profile = signal<ApiUser | null>(null);

  readonly authenticated = computed(() => this._authed());

  constructor() {
    this.restoreSession();
  }

  private restoreSession() {
    const saved = localStorage.getItem(SESSION_KEY);
    if (!saved) return;
    try {
      const session: StoredSession = JSON.parse(saved);
      if (session?.token && session?.user?.id) {
        this.applySession(session);
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  private applySession(session: AuthResponse | StoredSession) {
    const normalized = this.normalizeSession(session);
    if (!normalized) {
      console.warn('Unable to normalize auth session', session);
      return;
    }
    const user = normalized.user;
    this._authed.set(true);
    this._userId.set(user?.id ?? null);
    this._username.set(user?.email ?? user?.name ?? null);
    this._profile.set(user ?? null);
    this._token.set(normalized.token);
    this._expires.set(normalized.expires ?? null);
    this._approved.set(
      this.resolveApproval(user?.status, user?.approved ?? (session as any)?.approved)
    );
    this.persistSession();
  }

  private persistSession() {
    const token = this._token();
    const user = this._profile();
    if (!token || !user) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    const payload: StoredSession = {
      token,
      expires: this._expires() ?? '',
      user,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  }

  private resolveApproval(status?: string | null, approvedFlag?: boolean | null) {
    if (typeof approvedFlag === 'boolean') return approvedFlag;
    if (!status) return true;
    const normalized = status.toLowerCase();
    if (['approved', 'verified', 'active', 'completed', 'enabled'].includes(normalized)) {
      return true;
    }
    if (normalized.includes('pending') || normalized.includes('review')) return false;
    return true;
  }

  private extractErrorMessage(error: unknown, fallback: string) {
    if (!error) return fallback;
    const err = error as any;
    const candidates = [
      err?.error?.message,
      err?.error?.error,
      err?.error?.detail,
      err?.message,
      err?.statusText,
    ];
    const message = candidates.find((value) => typeof value === 'string' && value.trim());
    if (message) return (message as string).trim();

    if (err?.error && typeof err.error === 'object') {
      try {
        for (const value of Object.values(err.error)) {
          if (typeof value === 'string' && value.trim()) return value.trim();
          if (Array.isArray(value)) {
            const nested = value.find((entry) => typeof entry === 'string' && entry.trim());
            if (typeof nested === 'string') return nested.trim();
          }
        }
      } catch {
        // ignore object parsing errors
      }
    }

    return fallback;
  }

  token() {
    return this._token();
  }

  isAuthenticated() {
    return this._authed();
  }

  isApproved() {
    return this._approved();
  }

  username() {
    return this._username();
  }

  userId() {
    return this._userId();
  }

  async logout(): Promise<boolean> {
    let ok = true;
    try {
      await firstValueFrom(this.http.post(`${this.baseUrl}/api/auth/logout`, {}));
    } catch (error) {
      console.error('Logout failed', error);
      ok = false;
    } finally {
      this.clearSession();
    }
    return ok;
  }

  async signIn(creds: Credentials): Promise<AuthResult> {
    const email = (creds.email ?? creds.username)?.toString().trim().toLowerCase();
    const password = creds.password?.toString().trim();
    if (!email || !password) {
      return { ok: false, message: 'Username and password are required' };
    }
    const payload = { username: email, password };
    try {
      const response = await firstValueFrom(
        this.http.post<AuthResponse>(`${this.baseUrl}/api/auth/login`, payload)
      );
      const normalized = this.normalizeSession(response);
      if (!normalized) {
        console.error('Unexpected login response', response);
        return { ok: false, message: 'Unexpected response from server' };
      }
      this.applySession(normalized);
      return { ok: true };
    } catch (error) {
      console.error('Login failed', error);
      const message = this.extractErrorMessage(error, 'Incorrect username or password');
      return { ok: false, message };
    }
  }

  async signUp(creds: Credentials): Promise<AuthResult> {
    const identifier = (creds.email ?? creds.username)?.toString().trim().toLowerCase();
    const password = creds.password?.toString().trim();
    if (!identifier || !password) {
      return { ok: false, message: 'Username and password are required' };
    }
    const payload = {
      email: identifier,
      username: (creds.username ?? creds.email ?? identifier)?.toString().trim().toLowerCase(),
      password,
      name: creds.name ?? identifier,
    };
    try {
      const response = await firstValueFrom(
        this.http.post<AuthResponse>(`${this.baseUrl}/api/auth/register`, payload)
      );
      const normalized = this.normalizeSession(response);
      if (!normalized) {
        console.error('Unexpected registration response', response);
        return { ok: false, message: 'Registration failed' };
      }
      this.applySession(normalized);
      return { ok: true };
    } catch (error) {
      console.error('Registration failed', error);
      const message = this.extractErrorMessage(error, 'Unable to complete registration');
      return { ok: false, message };
    }
  }

  async registerLocally(data: any): Promise<AuthResult> {
    const username = (data?.email ?? data?.username ?? '').toString().trim().toLowerCase();
    const password = data?.password?.toString().trim();
    const name = `${data?.firstName ?? ''} ${data?.lastName ?? ''}`.trim() || username;
    if (!username || !password) {
      return { ok: false, message: 'Email and password are required' };
    }
    return this.signUp({ email: username, username, password, name });
  }

  setApproved(value: boolean) {
    this._approved.set(value);
    const user = this._profile();
    if (user) {
      this._profile.set({ ...user, status: value ? 'approved' : 'pending' });
      this.persistSession();
    }
  }

  signOut() {
    this.clearSession();
  }

  private clearSession() {
    this._authed.set(false);
    this._approved.set(false);
    this._userId.set(null);
    this._username.set(null);
    this._token.set(null);
    this._expires.set(null);
    this._profile.set(null);
    localStorage.removeItem(SESSION_KEY);
  }

  private normalizeSession(session: AuthResponse | StoredSession | any): StoredSession | null {
    if (!session || typeof session !== 'object') return null;
    const token = this.pickString(session, ['token', 'accessToken', 'access_token', 'jwt']);
    if (!token) return null;
    const expires =
      this.pickString(session, ['expires', 'expiry', 'expiresAt', 'expires_at', 'exp']) ?? '';

    const userSource =
      (session as any).user ??
      (session as any).profile ??
      (session as any).account ??
      (session as any).data ??
      session;

    const user = this.normalizeUser(userSource, session);

    if (user && !user.id) {
      const fallbackId = this.pickString(session, [
        'userId',
        'user_id',
        'id',
        'accountId',
        'account_id',
        'profileId',
        'profile_id',
        'lenderId',
        'borrowerId',
      ]);

      if (fallbackId) {
        user.id = fallbackId;
      }
    }

    if (!user?.id) {
      console.warn('Auth session missing user id', session);
    }

    return {
      token,
      expires,
      user: user ?? { id: '', email: '' },
    };
  }

  private normalizeUser(raw: any, fallback?: any): ApiUser | null {
    if (!raw || typeof raw !== 'object') {
      if (!fallback || typeof fallback !== 'object') return null;
      raw = fallback;
    }
    const firstName = this.pickString(raw, ['firstName', 'firstname', 'givenName']);
    const lastName = this.pickString(raw, ['lastName', 'lastname', 'surname']);
    const name = this.pickString(raw, ['name', 'fullName', 'displayName']) ??
      ([firstName, lastName].filter(Boolean).join(' ') || undefined);
    const email =
      this.pickString(raw, ['email', 'userEmail', 'username', 'mail'])?.toLowerCase() ?? '';
    const id =
      this.pickString(raw, [
        'id',
        'userId',
        'user_id',
        'accountId',
        'account_id',
        'profileId',
        'profile_id',
        'lenderId',
        'borrowerId',
        'lender_id',
        'borrower_id',
      ]) ?? '';
    const status =
      this.pickString(raw, [
        'status',
        'accountStatus',
        'approvalStatus',
        'kycStatus',
        'state',
        'profileStatus',
      ]) ?? undefined;
    const created =
      this.pickString(raw, ['created', 'createdAt', 'created_at', 'registeredAt']) ?? undefined;
    const approved =
      this.pickBoolean(raw, ['approved', 'isApproved', 'active', 'enabled', 'verified']) ?? false;

    return {
      id,
      email,
      name,
      status,
      created,
      approved,
    };
  }

  private pickString(source: any, keys: string[]): string | undefined {
    if (!source || typeof source !== 'object') return undefined;
    for (const key of keys) {
      const value = (source as any)[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
      }
    }
    return undefined;
  }

  private pickBoolean(source: any, keys: string[]): boolean | undefined {
    if (!source || typeof source !== 'object') return undefined;
    for (const key of keys) {
      if (key in source) {
        const value = (source as any)[key];
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          const normalized = value.toLowerCase();
          if (['true', 'yes', '1', 'approved', 'active', 'verified', 'enabled'].includes(normalized)) {
            return true;
          }
          if (['false', 'no', '0', 'pending'].includes(normalized)) {
            return false;
          }
        }
        if (typeof value === 'number') {
          if (value === 1) return true;
          if (value === 0) return false;
        }
      }
    }
    return undefined;
  }
}
