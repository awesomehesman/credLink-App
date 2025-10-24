import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';

interface WalletWithdrawProfile {
  accountName: string;
  bank: string;
  branchCode: string;
  branchName: string;
  accountNumber: string;
  ficaVerified: boolean;
}

interface WalletWithdrawData {
  balance: {
    accountLabel: string;
    available: number;
    pending: number;
    locked: number;
    unsettled: number;
  };
  profile: WalletWithdrawProfile;
}

@Component({
  selector: 'app-wallet-withdraw-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    ReactiveFormsModule
  ],
  templateUrl: './wallet-withdraw-dialog.html',
  styleUrls: ['./wallet-withdraw-dialog.scss']
})
export class WalletWithdrawDialog {
  private readonly dialogRef = inject(MatDialogRef<WalletWithdrawDialog>);
  private readonly data = inject<WalletWithdrawData>(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);

  readonly summary = signal(this.data.balance);
  readonly profile = signal(this.data.profile);

  readonly form = this.fb.group({
    amount: [0, [Validators.required, Validators.min(0.01), this.maxAvailableValidator.bind(this)]],
    confirm: [false, Validators.requiredTrue]
  });

  get amount() {
    return this.form.get('amount');
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.dialogRef.close(this.form.value);
  }

  close() {
    this.dialogRef.close();
  }

  private maxAvailableValidator(control: AbstractControl): ValidationErrors | null {
    const available = this.summary().available;
    const value = Number(control.value);
    if (isNaN(value)) return { invalidAmount: true };
    if (value > available) return { exceedsAvailable: { available } };
    return null;
  }
}
