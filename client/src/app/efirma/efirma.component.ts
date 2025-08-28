import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { EfirmaService } from './efirma.service';
import { EfirmaResponse, CertPreview } from '../models';

@Component({
  standalone: true,
  selector: 'app-efirma',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './efirma.component.html',
  styleUrl: './efirma.component.css'
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
