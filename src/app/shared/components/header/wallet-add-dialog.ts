import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';

interface WalletBankData {
  id: string;
  name: string;
  accountName: string;
  branchCode: string;
  branchName: string;
  accountNumber: string;
  reference: string;
}

interface WalletAddFundsData {
  balance: number;
  banks: WalletBankData[];
  summary: {
    accountLabel: string;
  };
}

@Component({
  selector: 'app-wallet-add-funds-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule
  ],
  templateUrl: './wallet-add-dialog.html',
  styleUrls: ['./wallet-add-dialog.scss']
})
export class WalletAddFundsDialog {
  private readonly dialogRef = inject(MatDialogRef<WalletAddFundsDialog>);
  private readonly data = inject<WalletAddFundsData>(MAT_DIALOG_DATA);

  readonly banks = signal(this.data.banks);
  readonly balance = signal(this.data.balance);
  readonly summary = signal(this.data.summary);
  readonly selectedBankId = signal(this.data.banks[0]?.id ?? '');
  readonly selectedBank = computed(
    () => this.banks().find(bank => bank.id === this.selectedBankId()) ?? this.banks()[0]
  );

  close() {
    this.dialogRef.close();
  }
}
