import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface WalletState {
  available: number;
  committed: number;
  pending: number;
  unsettled: number;
}

export interface WalletBank {
  id: string;
  name: string;
  accountName: string;
  branchCode: string;
  branchName: string;
  accountNumber: string;
  reference: string;
}

export interface WalletWithdrawProfile {
  accountName: string;
  bank: string;
  branchCode: string;
  branchName: string;
  accountNumber: string;
  ficaVerified: boolean;
}

interface ApiWallet {
  available?: number;
  committed?: number;
  pending?: number;
  unsettled?: number;
}

interface HoldResponse {
  holdId?: string;
  id?: string;
  wallet?: ApiWallet;
}

export const WALLET_BANKS: WalletBank[] = [
  {
    id: 'absa',
    name: 'ABSA',
    accountName: 'CredLink Nominees (RF) (PTY) LTD',
    branchCode: '632005',
    branchName: 'Melrose Arch',
    accountNumber: '4096150463',
    reference: 'CL-ABSA-784563',
  },
  {
    id: 'fnb',
    name: 'FNB',
    accountName: 'CredLink Nominees (RF) (PTY) LTD',
    branchCode: '255005',
    branchName: 'Sandton City',
    accountNumber: '62145698712',
    reference: 'CL-FNB-784563',
  },
  {
    id: 'standard',
    name: 'Standard Bank',
    accountName: 'CredLink Nominees (RF) (PTY) LTD',
    branchCode: '051001',
    branchName: 'Rosebank',
    accountNumber: '000245879',
    reference: 'CL-SB-784563',
  },
];

export const DEFAULT_WITHDRAW_PROFILE: WalletWithdrawProfile = {
  accountName: 'K Hesman',
  bank: 'Capitec',
  branchCode: '470010',
  branchName: '470010',
  accountNumber: '154899XXXX',
  ficaVerified: true,
};

@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  private readonly state = signal<WalletState>({
    available: 0,
    committed: 0,
    pending: 0,
    unsettled: 0,
  });

  private readonly holds: Array<{ id: string; amount: number }> = [];

  constructor() {
    void this.refresh();
  }

  snapshot() {
    return this.state();
  }

  available() {
    return this.state().available;
  }

  committed() {
    return this.state().committed;
  }

  summary() {
    const snapshot = this.state();
    return {
      accountLabel: 'CredLink Wallet (ZAR)',
      available: snapshot.available,
      pending: snapshot.pending,
      locked: snapshot.committed,
      unsettled: snapshot.unsettled,
    };
  }

  banks(): WalletBank[] {
    return WALLET_BANKS;
  }

  withdrawProfile(): WalletWithdrawProfile {
    return DEFAULT_WITHDRAW_PROFILE;
  }

  async refresh(): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) return;
    try {
      const dto = await firstValueFrom(
        this.http.get<ApiWallet>(`${this.baseUrl}/api/wallet/${userId}`)
      );
      this.applyWallet(dto);
    } catch (error) {
      console.error('Unable to load wallet', error);
    }
  }

  async deposit(amount: number, reference?: string): Promise<boolean> {
    if (!this.validateAmount(amount)) return false;
    const userId = this.auth.userId();
    if (!userId) return false;
    const payload = {
      amount: this.normalizeAmount(amount),
      reference: reference ?? this.generateReference('DEP'),
    };
    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/api/wallet/${userId}/deposit`, payload)
      );
      await this.refresh();
      return true;
    } catch (error) {
      console.error('Deposit failed', error);
      return false;
    }
  }

  async withdraw(amount: number, reference?: string): Promise<boolean> {
    if (!this.validateAmount(amount)) return false;
    await this.refresh();
    if (this.state().available < amount) return false;
    const userId = this.auth.userId();
    if (!userId) return false;
    const payload = {
      amount: this.normalizeAmount(amount),
      reference: reference ?? this.generateReference('WD'),
    };
    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/api/wallet/${userId}/withdraw`, payload)
      );
      await this.refresh();
      return true;
    } catch (error) {
      console.error('Withdraw failed', error);
      return false;
    }
  }

  async hold(amount: number, reference?: string): Promise<boolean> {
    if (!this.validateAmount(amount)) return false;
    await this.refresh();
    if (this.state().available < amount) return false;
    const userId = this.auth.userId();
    if (!userId) return false;
    const payload = {
      amount: this.normalizeAmount(amount),
      reference: reference ?? this.generateReference('HOLD'),
    };
    try {
      const response = await firstValueFrom(
        this.http.post<HoldResponse>(
          `${this.baseUrl}/api/wallet/${userId}/hold`,
          payload
        )
      );
      const holdId = response?.holdId ?? response?.id ?? payload.reference;
      if (holdId) {
        this.holds.push({ id: holdId, amount: payload.amount });
      }
      if (response?.wallet) {
        this.applyWallet(response.wallet);
      } else {
        await this.refresh();
      }
      return true;
    } catch (error) {
      console.error('Unable to place wallet hold', error);
      return false;
    }
  }

  async release(amount: number): Promise<boolean> {
    if (!this.validateAmount(amount)) return false;
    const userId = this.auth.userId();
    if (!userId) return false;
    const normalized = this.normalizeAmount(amount);
    const index = this.holds.findIndex(
      (hold) => Math.abs(hold.amount - normalized) < 0.01
    );
    const hold = index >= 0 ? this.holds.splice(index, 1)[0] : undefined;
    const payload = hold?.id
      ? { holdId: hold.id, amount: normalized }
      : { amount: normalized, reference: this.generateReference('REL') };
    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/api/wallet/${userId}/release`, payload)
      );
      await this.refresh();
      return true;
    } catch (error) {
      console.error('Unable to release wallet hold', error);
      if (hold) {
        this.holds.push(hold); // restore for future attempts
      }
      return false;
    }
  }

  async syncCommitted(): Promise<void> {
    await this.refresh();
  }

  private applyWallet(dto: ApiWallet | null | undefined) {
    if (!dto) return;
    const normalized: WalletState = {
      available: this.normalizeAmount(dto.available ?? this.state().available),
      committed: this.normalizeAmount(dto.committed ?? this.state().committed),
      pending: this.normalizeAmount(dto.pending ?? this.state().pending),
      unsettled: this.normalizeAmount(dto.unsettled ?? this.state().unsettled),
    };
    this.state.set(normalized);
  }

  private validateAmount(amount: number) {
    return typeof amount === 'number' && amount > 0;
  }

  private normalizeAmount(value: number) {
    return +Number(value ?? 0).toFixed(2);
  }

  private generateReference(prefix: string) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }
}
