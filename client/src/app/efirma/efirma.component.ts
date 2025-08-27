import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { EfirmaService } from './efirma.service';
import { EfirmaResponse, CertPreview } from '../models';

@Component({
  standalone: true,
  selector: 'app-efirma',
  imports: [CommonModule, ReactiveFormsModule],
  template: `
  <div class="card">
    <form [formGroup]="form" class="row" (ngSubmit)="onSubmit()">
      <label>Certificado (.cer)
        <input type="file" accept=".cer" (change)="onCerSelected($event)" required />
      </label>
      <div class="muted" *ngIf="preview()">
        <div *ngIf="preview()?.rfc">RFC detectado en .cer: <b>{{ preview()?.rfc }}</b></div>
        <div *ngIf="preview()?.noCertificado">No. Certificado: <code>{{ preview()?.noCertificado }}</code></div>
        <div *ngIf="preview()?.validoDesde">Vigencia: {{ preview()?.validoDesde }} → {{ preview()?.validoHasta }}</div>
      </div>

      <label>Clave privada (.key)
        <input type="file" accept=".key" (change)="onKeySelected($event)" required />
      </label>

      <label>Contraseña de clave privada
        <input type="password" formControlName="passphrase" placeholder="Contraseña" required />
      </label>

      <label>RFC
        <input type="text" formControlName="rfc" placeholder="RFC (se autollenará desde el .cer)" />
      </label>

      <button type="submit" [disabled]="!canSubmit()">Enviar</button>
    </form>
  </div>

  <div class="card loading-card" *ngIf="loading()">
    <div class="loading-content">
      <div class="spinner"></div>
      <span>Procesando…</span>
    </div>
  </div>

  <div class="result-container" *ngIf="result() as r">
    <div class="card">
      <h3>Resultado de la validación</h3>

      <!-- Errores -->
      <div class="error-section" *ngIf="r.error">
        <div class="error-message">
          <span class="error-icon">⚠️</span>
          <strong>Error:</strong> {{ r.error }}
        </div>
      </div>

      <!-- Issues -->
      <div class="issues-section" *ngIf="r.issues?.length">
        <div class="issues-header">
          <span class="warning-icon">⚠️</span>
          <strong>Advertencias:</strong>
        </div>
        <ul class="issues-list">
          <li *ngFor="let issue of r.issues" class="issue-item">{{ issue }}</li>
        </ul>
      </div>

      <!-- Información del certificado -->
      <div class="cert-info" *ngIf="r.cer">
        <h4>📄 Información del Certificado</h4>
        <div class="info-grid">
          <div class="info-item" *ngIf="r.cer.rfc">
            <label>RFC:</label>
            <span class="info-value rfc">{{ r.cer.rfc }}</span>
          </div>
          <div class="info-item" *ngIf="r.cer.nombreORazonSocial">
            <label>Nombre:</label>
            <span class="info-value">{{ r.cer.nombreORazonSocial }}</span>
          </div>
          <div class="info-item" *ngIf="r.cer.noCertificado">
            <label>No. Certificado:</label>
            <span class="info-value">{{ r.cer.noCertificado }}</span>
          </div>
          <div class="info-item" *ngIf="r.cer.validoDesde">
            <label>Vigencia:</label>
            <span class="info-value">{{ r.cer.validoDesde }} → {{ r.cer.validoHasta }}</span>
          </div>
        </div>
      </div>

      <!-- Información de la clave -->
      <div class="key-info" *ngIf="r.key">
        <h4>🔑 Información de la Clave</h4>
        <div class="info-grid">
          <div class="info-item">
            <label>Tipo:</label>
            <span class="info-value">{{ r.key.tipo?.toUpperCase() }}</span>
          </div>
          <div class="info-item">
            <label>Bits:</label>
            <span class="info-value">{{ r.key.bits }}</span>
          </div>
        </div>
      </div>

      <!-- Verificación -->
      <div class="verification-info" *ngIf="r.verificacion">
        <h4>✅ Verificación</h4>
        <div class="verification-grid">
          <div class="verification-item">
            <label>RFC enviado:</label>
            <span class="info-value">{{ r.verificacion.rfcInput || 'No especificado' }}</span>
          </div>
          <div class="verification-item">
            <label>RFC del certificado:</label>
            <span class="info-value">{{ r.cer?.rfc || 'No encontrado' }}</span>
          </div>
          <div class="verification-item">
            <label>RFC coincide:</label>
            <span class="verification-status" [class.success]="r.verificacion.rfcCoincide" [class.error]="!r.verificacion.rfcCoincide">
              {{ r.verificacion.rfcCoincide ? '✅ Sí' : '❌ No' }}
            </span>
          </div>
          <div class="verification-item">
            <label>Claves coinciden:</label>
            <span class="verification-status" [class.success]="r.verificacion.publicKeyMatchesPrivateKey" [class.error]="!r.verificacion.publicKeyMatchesPrivateKey">
              {{ r.verificacion.publicKeyMatchesPrivateKey ? '✅ Sí' : '❌ No' }}
            </span>
          </div>
        </div>

        <!-- Información de depuración del RFC -->
        <div class="rfc-debug" *ngIf="!r.verificacion.rfcCoincide">
          <h5>🔍 Información de depuración del RFC</h5>
          <div class="debug-info">
            <div>
              <strong>RFC enviado:</strong>
              <code>"{{ r.verificacion.rfcInput }}"</code>
              ({{ (r.verificacion.rfcInput || '').length }} caracteres)
            </div>
            <div>
              <strong>RFC del certificado:</strong>
              <code>"{{ r.cer?.rfc }}"</code>
              ({{ (r.cer?.rfc || '').length }} caracteres)
            </div>
            <div class="debug-suggestion">
              💡 <strong>Sugerencia:</strong>
              <span *ngIf="!r.verificacion.rfcInput">No se envió RFC al servidor. Asegúrate de que el campo RFC esté lleno.</span>
              <span *ngIf="r.verificacion.rfcInput && r.cer?.rfc && r.verificacion.rfcInput !== r.cer.rfc">
                Los RFC no coinciden exactamente. Revisa espacios en blanco, mayúsculas/minúsculas o caracteres especiales.
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- JSON completo (colapsible) -->
      <div class="json-section">
        <button type="button" class="json-toggle" (click)="toggleJsonView()">
          {{ showJson() ? '📄 Ocultar JSON completo' : '📄 Mostrar JSON completo' }}
        </button>
        <div class="json-container" *ngIf="showJson()">
          <pre class="json-content">{{ r | json }}</pre>
        </div>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .loading-card {
      text-align: center;
      padding: 2rem;
    }

    .loading-content {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
    }

    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid #f3f3f3;
      border-top: 2px solid #5a0f2d;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .result-container {
      margin-top: 1rem;
    }

    .error-section {
      margin-bottom: 1rem;
    }

    .error-message {
      background: #ffebee;
      border: 1px solid #f44336;
      border-radius: 8px;
      padding: 1rem;
      color: #c62828;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .issues-section {
      margin-bottom: 1rem;
      background: #fff3e0;
      border: 1px solid #ff9800;
      border-radius: 8px;
      padding: 1rem;
    }

    .issues-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
      color: #f57c00;
    }

    .issues-list {
      margin: 0;
      padding-left: 1.5rem;
    }

    .issue-item {
      color: #ef6c00;
      margin-bottom: 0.25rem;
    }

    .cert-info, .key-info, .verification-info {
      margin-bottom: 1.5rem;
      padding: 1rem;
      background: #f8f9fa;
      border-radius: 8px;
      border: 1px solid #e9ecef;
      color: #212529;
    }

    .cert-info h4, .key-info h4, .verification-info h4 {
      margin: 0 0 1rem 0;
      color: #495057;
      font-size: 1.1rem;
    }

    .info-grid, .verification-grid {
      display: grid;
      gap: 0.75rem;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    }

    .info-item, .verification-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .info-item label, .verification-item label {
      font-weight: 600;
      font-size: 0.9rem;
      color: #495057;
      margin-bottom: 0.25rem;
    }

    .info-value {
      padding: 0.5rem;
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.9rem;
      color: #212529;
      word-break: break-word;
    }

    .info-value.rfc {
      background: #e3f2fd;
      border-color: #2196f3;
      font-weight: bold;
      color: #1976d2;
    }

    .verification-status {
      padding: 0.5rem;
      border-radius: 4px;
      font-weight: bold;
    }

    .verification-status.success {
      background: #e8f5e8;
      color: #2e7d32;
      border: 1px solid #4caf50;
    }

    .verification-status.error {
      background: #ffebee;
      color: #c62828;
      border: 1px solid #f44336;
    }

    .rfc-debug {
      margin-top: 1rem;
      padding: 1rem;
      background: #fff8e1;
      border: 1px solid #ffb300;
      border-radius: 8px;
    }

    .rfc-debug h5 {
      margin: 0 0 0.75rem 0;
      color: #ef6c00;
      font-size: 1rem;
    }

    .debug-info {
      font-family: monospace;
      font-size: 0.9rem;
      line-height: 1.6;
    }

    .debug-info > div {
      margin-bottom: 0.5rem;
    }

    .debug-info code {
      background: #ffecb3;
      padding: 2px 6px;
      border-radius: 3px;
      border: 1px solid #ffb300;
    }

    .debug-suggestion {
      margin-top: 0.75rem;
      padding: 0.75rem;
      background: #e3f2fd;
      border: 1px solid #2196f3;
      border-radius: 6px;
      color: #1565c0;
    }

    .json-section {
      margin-top: 1.5rem;
    }

    .json-toggle {
      width: 100%;
      padding: 0.75rem;
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: background-color 0.2s;
    }

    .json-toggle:hover {
      background: #5a6268;
    }

    .json-container {
      margin-top: 1rem;
    }

    .json-content {
      max-height: 400px;
      overflow: auto;
      background: #1e1e1e;
      color: #d4d4d4;
      border: 1px solid #444;
      border-radius: 8px;
      padding: 1rem;
      font-size: 0.8rem;
      line-height: 1.4;
      white-space: pre-wrap;
      word-break: break-all;
    }

    @media (max-width: 768px) {
      .info-grid, .verification-grid {
        grid-template-columns: 1fr;
      }

      .json-content {
        font-size: 0.7rem;
      }
    }

    /* Asegurar visibilidad en modo oscuro */
    @media (prefers-color-scheme: dark) {
      .cert-info, .key-info, .verification-info {
        background: #343a40;
        border-color: #495057;
        color: #f8f9fa;
      }

      .cert-info h4, .key-info h4, .verification-info h4 {
        color: #f8f9fa;
      }

      .info-item label, .verification-item label {
        color: #adb5bd;
      }

      .info-value {
        background: #495057;
        border-color: #6c757d;
        color: #f8f9fa;
      }

      .info-value.rfc {
        background: #1e3a8a;
        border-color: #3b82f6;
        color: #93c5fd;
      }

      .rfc-debug {
        background: #374151;
        border-color: #6b7280;
      }

      .rfc-debug h5 {
        color: #fbbf24;
      }

      .debug-info code {
        background: #4b5563;
        border-color: #6b7280;
        color: #f9fafb;
      }

      .debug-suggestion {
        background: #1e3a8a;
        border-color: #3b82f6;
        color: #93c5fd;
      }
    }
  `]
})
export class EfirmaComponent {
  form = this.fb.group({
    rfc: [''],
    passphrase: ['', Validators.required]
  });

  private cerFile: File | null = null;
  private keyFile: File | null = null;

  preview = signal<CertPreview | null>(null);
  result = signal<EfirmaResponse | null>(null);
  loading = signal(false);
  showJson = signal(false);

  constructor(private fb: FormBuilder, private api: EfirmaService) {}

  toggleJsonView() {
    this.showJson.set(!this.showJson());
  }

  private extractRfcFromSubject(subject: string): string | null {
    // Buscar el RFC en el campo x500UniqueIdentifier
    const rfcMatch = subject.match(/x500UniqueIdentifier=([A-Z0-9]{12,13})/);
    return rfcMatch ? rfcMatch[1] : null;
  }

  private normalizeRfc(rfc: string): string {
    // Limpiar el RFC: remover espacios, convertir a mayúsculas
    return rfc.trim().toUpperCase().replace(/\s+/g, '');
  }

  onCerSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.cerFile = file;
    this.preview.set(null);
    if (file) {
      this.api.certPreview(file).subscribe({
        next: p => {
          this.preview.set(p);
          // Intentar obtener RFC del campo rfc, si no existe, extraerlo del subject
          let rfc = p?.rfc;
          if (!rfc && p?.subject) {
            rfc = this.extractRfcFromSubject(p.subject);
          }
          if (rfc) {
            // Normalizar el RFC antes de establecerlo
            const normalizedRfc = this.normalizeRfc(rfc);
            this.form.controls.rfc.setValue(normalizedRfc);
            // Actualizar el preview con el RFC extraído y normalizado
            this.preview.set({ ...p, rfc: normalizedRfc });
          }
        },
        error: () => {
          this.preview.set({ ok: false, error: 'No se pudo leer el .cer' } as any);
        }
      });
    }
  }

  onKeySelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    this.keyFile = input.files?.[0] || null;
  }

  canSubmit(): boolean {
    return !!(this.cerFile && this.keyFile && this.form.valid);
  }

  onSubmit() {
    if (!this.canSubmit() || !this.cerFile || !this.keyFile) return;
    this.loading.set(true);
    this.result.set(null);
    this.showJson.set(false); // Reset JSON view

    // Asegurar que tenemos el RFC del formulario y normalizarlo
    let rfc = this.form.value.rfc || '';
    if (rfc) {
      rfc = this.normalizeRfc(rfc);
      // Actualizar el formulario con el RFC normalizado
      this.form.controls.rfc.setValue(rfc, { emitEvent: false });
    }

    console.log('Enviando RFC al backend:', rfc); // Debug

    this.api.efirma(this.cerFile, this.keyFile, this.form.value.passphrase!, rfc)
      .subscribe({
        next: r => {
          console.log('Respuesta del backend:', r); // Debug
          // Si la respuesta no tiene RFC pero tenemos subject, intentar extraerlo
          if (r.cer && !r.cer.rfc && r.cer.subject) {
            const extractedRfc = this.extractRfcFromSubject(r.cer.subject);
            if (extractedRfc) {
              r.cer.rfc = this.normalizeRfc(extractedRfc);
            }
          }
          // Normalizar el RFC de la respuesta si existe
          if (r.cer?.rfc) {
            r.cer.rfc = this.normalizeRfc(r.cer.rfc);
          }
          this.result.set(r);
          this.loading.set(false);
        },
        error: err => {
          this.result.set({ ok: false, error: err?.message || 'Error' });
          this.loading.set(false);
        }
      });
  }
}
