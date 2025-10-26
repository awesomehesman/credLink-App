import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PersonalInfoPayload {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  idKind?: string;
  governmentId?: string;
  idExpiry?: string | null;
  address?: {
    street?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
  };
  preferencesJson?: string | null;
  autoReply?: boolean;
  lenderDisplayName?: string;
  businessName?: string | null;
  riskAppetite?: string | null;
}

interface ApiUserResponse {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  idKind?: string;
  governmentId?: string;
  idExpiry?: string;
  address?: {
    street?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
  };
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  async fetchPersonalInfo(): Promise<ApiUserResponse | null> {
    try {
      const user = await firstValueFrom(
        this.http.get<ApiUserResponse>(`${this.baseUrl}/api/users/me`)
      );
      return user ?? null;
    } catch (error: any) {
      if (error?.status === 404) {
        return null;
      }
      console.error('Unable to load personal info', error);
      throw error;
    }
  }

  async savePersonalInfo(formValue: Record<string, unknown>): Promise<boolean> {
    const payload = this.toPayload(formValue);
    try {
      await firstValueFrom(
        this.http.put(`${this.baseUrl}/api/users/me/personal-info`, payload)
      );
      return true;
    } catch (error) {
      console.error('Unable to save personal info', error);
      throw error;
    }
  }

  private toPayload(formValue: Record<string, unknown>): PersonalInfoPayload {
    const firstName = this.asString(formValue['firstName']);
    const middleName = this.asString(formValue['middleName']);
    const lastName = this.asString(formValue['lastName']);
    const email = this.asString(formValue['email'])?.toLowerCase();
    const phoneNumber = this.asString(formValue['phone']);
    const dateOfBirth = this.toIsoDate(formValue['dateOfBirth']);
    const governmentId = this.asString(formValue['nationalIdOrPassport']);
    const idExpiry = this.toIsoDateOrNull(formValue['idExpiry']);
    const street = this.asString(formValue['street']);
    const city = this.asString(formValue['city']);
    const province = this.asString(formValue['province']);
    const postalCode = this.asString(formValue['postalCode']);
    const country = this.asString(formValue['country']);

    const payload: PersonalInfoPayload = {
      firstName,
      middleName: middleName ?? undefined,
      lastName,
      email: email ?? undefined,
      phoneNumber,
      dateOfBirth,
      idKind: governmentId ? 'NationalID' : undefined,
      governmentId,
      idExpiry,
      address: {
        street,
        city,
        province,
        postalCode,
        country,
      },
      autoReply: false,
      preferencesJson: null,
      lenderDisplayName: [firstName, lastName].filter(Boolean).join(' ') || undefined,
      businessName: null,
      riskAppetite: null,
    };

    return this.compactObject(payload) as PersonalInfoPayload;
  }

  private toIsoDate(value: unknown): string | undefined {
    if (!value) return undefined;
    if (value instanceof Date) {
      return value.toISOString();
    }
    const parsed = new Date(value as string);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }

  private toIsoDateOrNull(value: unknown): string | null | undefined {
    const iso = this.toIsoDate(value);
    return iso ?? null;
  }

  private asString(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined;
    const trimmed = String(value).trim();
    return trimmed.length ? trimmed : undefined;
  }

  private compactObject<T>(value: T): T {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return value;
    }
    const result: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
      if (val === undefined) return;
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        const compacted = this.compactObject(val);
        if (Object.keys(compacted as Record<string, unknown>).length) {
          result[key] = compacted;
        }
      } else {
        result[key] = val;
      }
    });
    return result as T;
  }
}
