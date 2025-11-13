import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Pkcs12Service, CertificateInfo } from '../efirma-local/pkcs12.service';

@Component({
  standalone: true,
  selector: 'app-decode-base64',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './decode-base64.component.html',
  styleUrl: './decode-base64.component.css'
})
export class DecodeBase64Component {
  form = this.fb.group({
    base64: ['', Validators.required],
    password: ['', Validators.required]
  });

  loading = signal(false);
  result = signal<{
    ok: boolean;
    certInfo?: CertificateInfo;
    fullData?: any;
    error?: string;
  } | null>(null);
  showCertInfo = signal(false);
  showFullData = signal(false);

  constructor(
    private fb: FormBuilder,
    private pkcs12Service: Pkcs12Service
  ) {}

  toggleCertInfo() {
    this.showCertInfo.set(!this.showCertInfo());
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

  async onSubmit() {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.result.set(null);

    const base64 = this.form.value.base64!.trim();
    const password = this.form.value.password!;

    try {
      const result = await this.pkcs12Service.decodePKCS12FromBase64(base64, password);
      this.result.set(result);
    } catch (error: any) {
      this.result.set({
        ok: false,
        error: error?.message || 'Error inesperado al decodificar'
      });
    } finally {
      this.loading.set(false);
    }
  }

  reset() {
    this.form.reset({ base64: '', password: '' });
    this.result.set(null);
    this.showCertInfo.set(false);
    this.showFullData.set(false);
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
