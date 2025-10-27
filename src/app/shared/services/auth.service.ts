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
    const user = session.user;
    this._authed.set(true);
    this._userId.set(user?.id ?? null);
    this._username.set(user?.email ?? user?.name ?? null);
    this._profile.set(user ?? null);
    this._token.set(session.token);
    this._expires.set(session.expires ?? null);
    this._approved.set(this.resolveApproval(user?.status));
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

  private resolveApproval(status?: string | null) {
    if (!status) return true;
    const normalized = status.toLowerCase();
    return ['approved', 'verified', 'active'].includes(normalized);
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

  async signIn(creds: Credentials) {
    const email = (creds.email ?? creds.username)?.toString().trim().toLowerCase();
    const password = creds.password?.toString().trim();
    if (!email || !password) return false;
    const payload = { username: email, password };
    try {
      const response = await firstValueFrom(
        this.http.post<AuthResponse>(`${this.baseUrl}/api/auth/login`, payload)
      );
      this.applySession(response);
      return true;
    } catch (error) {
      console.error('Login failed', error);
      return false;
    }
  }

  async signUp(creds: Credentials) {
    const identifier = (creds.email ?? creds.username)?.toString().trim().toLowerCase();
    const password = creds.password?.toString().trim();
    if (!identifier || !password) return false;
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
      this.applySession(response);
      return true;
    } catch (error) {
      console.error('Registration failed', error);
      return false;
    }
  }

  async registerLocally(data: any) {
    const username = (data?.email ?? data?.username ?? '').toString().trim().toLowerCase();
    const password = data?.password?.toString().trim();
    const name = `${data?.firstName ?? ''} ${data?.lastName ?? ''}`.trim() || username;
    if (!username || !password) return false;
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
    this._authed.set(false);
    this._approved.set(false);
    this._userId.set(null);
    this._username.set(null);
    this._token.set(null);
    this._expires.set(null);
    this._profile.set(null);
    localStorage.removeItem(SESSION_KEY);
  }
}
