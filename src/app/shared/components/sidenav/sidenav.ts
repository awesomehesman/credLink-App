
import { Component, EventEmitter, Output, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidenav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatListModule, MatIconModule],
  templateUrl: './sidenav.html',
  styleUrl: './sidenav.scss'
})
export class Sidenav {
  @Output() navigate = new EventEmitter<void>();
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  handleNavigate() {
    this.navigate.emit();
  }

  async signOut() {
    const ok = await this.auth.logout();
    if (!ok) {
      console.warn('Signed out locally after API logout failed.');
    }
    this.navigate.emit();
    this.router.navigateByUrl('/');
  }
}
