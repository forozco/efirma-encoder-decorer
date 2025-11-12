import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Pkcs12Service, PKCS12Result } from './pkcs12.service';

@Component({
  standalone: true,
  selector: 'app-efirma-local',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './efirma-local.component.html',
  styleUrl: './efirma-local.component.css'
})
export class EfirmaLocalComponent {
  form = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(4)]],
    filename: ['certificado', Validators.required]
  });

  private cerFile: File | null = null;
  private keyFile: File | null = null;

  cerFileName = signal<string | null>(null);
  keyFileName = signal<string | null>(null);
  loading = signal(false);
  result = signal<PKCS12Result | null>(null);
  showCertInfo = signal(false);
  showBase64 = signal(false);
  showFullData = signal(false);

  constructor(
    private fb: FormBuilder,
    private pkcs12Service: Pkcs12Service
  ) {}

  onCerSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.cerFile = file;
    this.cerFileName.set(file?.name || null);
    this.result.set(null);

    // Auto-completar el nombre del archivo de salida basado en el .cer
    if (file) {
      const baseName = file.name.replace(/\.(cer|crt)$/i, '');
      this.form.patchValue({ filename: baseName });
    }
  }

  onKeySelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.keyFile = file;
    this.keyFileName.set(file?.name || null);
    this.result.set(null);
  }

  canSubmit(): boolean {
    return !!(this.cerFile && this.keyFile && this.form.valid);
  }

  toggleCertInfo() {
    this.showCertInfo.set(!this.showCertInfo());
  }

  toggleBase64() {
    this.showBase64.set(!this.showBase64());
  }

  toggleFullData() {
    this.showFullData.set(!this.showFullData());
  }

  copyFullDataToClipboard() {
    const fullData = this.result()?.fullData;
    if (fullData) {
      const jsonString = JSON.stringify(fullData, null, 2);
      navigator.clipboard.writeText(jsonString).then(() => {
        alert('JSON completo copiado al portapapeles');
      });
    }
  }

  copyBase64ToClipboard() {
    const base64 = this.result()?.base64;
    if (base64) {
      navigator.clipboard.writeText(base64).then(() => {
        alert('String base64 copiado al portapapeles');
      });
    }
  }

  downloadP12File() {
    const result = this.result();
    if (result?.ok && result.blob) {
      const filename = this.form.value.filename || 'certificado';
      this.pkcs12Service.downloadBlob(result.blob, `${filename}.p12`);
    }
  }

  async onSubmit() {
    if (!this.canSubmit() || !this.cerFile || !this.keyFile) return;

    this.loading.set(true);
    this.result.set(null);

    const password = this.form.value.password!;

    try {
      const result = await this.pkcs12Service.generatePKCS12(
        this.cerFile,
        this.keyFile,
        password
      );

      this.result.set(result);
    } catch (error: any) {
      this.result.set({
        ok: false,
        error: error?.message || 'Error inesperado'
      });
    } finally {
      this.loading.set(false);
    }
  }

  reset() {
    this.form.reset({ filename: 'certificado', password: '' });
    this.cerFile = null;
    this.keyFile = null;
    this.cerFileName.set(null);
    this.keyFileName.set(null);
    this.result.set(null);
    this.showCertInfo.set(false);
    this.showBase64.set(false);
    this.showFullData.set(false);

    // Limpiar inputs de archivos
    const cerInput = document.getElementById('cerFile') as HTMLInputElement;
    const keyInput = document.getElementById('keyFile') as HTMLInputElement;
    if (cerInput) cerInput.value = '';
    if (keyInput) keyInput.value = '';
  }

  formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  }
}
