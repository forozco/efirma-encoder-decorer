import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-container">
      <nav class="nav">
        <div class="nav-content">
          <h1 class="nav-title">E.Firma SAT — POC Angular 20</h1>
          <div class="nav-right">
            <div class="nav-links">
              <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="nav-link">
                <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path>
                </svg>
                Verificador (Backend)
              </a>
              <a routerLink="/efirma-local" routerLinkActive="active" class="nav-link">
                <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                Generador PKCS#12 (Local)
              </a>
              <a routerLink="/decode-base64" routerLinkActive="active" class="nav-link">
                <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
                Decodificador Base64
              </a>
            </div>
            <button (click)="toggleTheme()" class="theme-toggle" [title]="themeService.theme() === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'">
              <svg *ngIf="themeService.theme() === 'light'" class="theme-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
              </svg>
              <svg *ngIf="themeService.theme() === 'dark'" class="theme-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
              </svg>
            </button>
          </div>
        </div>
      </nav>
      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      background-color: #f7fafc;
      transition: background-color 0.3s;
    }

    .nav {
      background-color: #fff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      position: sticky;
      top: 0;
      z-index: 50;
      transition: background-color 0.3s, box-shadow 0.3s;
    }

    .nav-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 1rem 1.5rem;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .nav-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: #2d3748;
      margin: 0;
      transition: color 0.3s;
    }

    .nav-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .nav-links {
      display: flex;
      gap: 1rem;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      color: #4a5568;
      text-decoration: none;
      font-weight: 500;
      transition: all 0.2s;
      font-size: 0.95rem;
    }

    .nav-link:hover {
      background-color: #edf2f7;
      color: #2d3748;
    }

    .nav-link.active {
      background-color: #4299e1;
      color: white;
    }

    .nav-icon {
      width: 1.25rem;
      height: 1.25rem;
    }

    .theme-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem;
      border: none;
      border-radius: 0.5rem;
      background-color: #edf2f7;
      color: #4a5568;
      cursor: pointer;
      transition: all 0.2s;
    }

    .theme-toggle:hover {
      background-color: #e2e8f0;
    }

    .theme-icon {
      width: 1.25rem;
      height: 1.25rem;
    }

    .main-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 1rem;
    }

    /* Dark Mode Styles */
    :host-context(.dark-mode) .app-container {
      background-color: #1a202c;
    }

    :host-context(.dark-mode) .nav {
      background-color: #2d3748;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }

    :host-context(.dark-mode) .nav-title {
      color: #f7fafc;
    }

    :host-context(.dark-mode) .nav-link {
      color: #cbd5e0;
    }

    :host-context(.dark-mode) .nav-link:hover {
      background-color: #4a5568;
      color: #f7fafc;
    }

    :host-context(.dark-mode) .nav-link.active {
      background-color: #4299e1;
      color: white;
    }

    :host-context(.dark-mode) .theme-toggle {
      background-color: #4a5568;
      color: #f7fafc;
    }

    :host-context(.dark-mode) .theme-toggle:hover {
      background-color: #718096;
    }

    @media (max-width: 768px) {
      .nav-content {
        flex-direction: column;
        align-items: flex-start;
      }

      .nav-right {
        width: 100%;
        justify-content: space-between;
      }

      .nav-links {
        flex-direction: column;
        width: 100%;
      }

      .nav-link {
        width: 100%;
      }

      .nav-title {
        font-size: 1.1rem;
      }

      .main-content {
        padding: 0.5rem;
      }
    }
  `]
})
export class AppComponent {
  constructor(public themeService: ThemeService) {}

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
