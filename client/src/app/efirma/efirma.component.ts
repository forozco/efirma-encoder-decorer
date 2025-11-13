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
    console.log('Extrayendo RFC del subject:', subject);
    
    // Buscar el RFC en el campo x500UniqueIdentifier (este es el RFC real)
    const rfcMatch = subject.match(/x500UniqueIdentifier=([A-Z]{4}[0-9]{6}[A-Z0-9]{2,3})/i);
    if (rfcMatch) {
      const rfc = rfcMatch[1].toUpperCase();
      console.log('RFC encontrado en x500UniqueIdentifier:', rfc);
      return rfc;
    }
    
    // Si hay serialNumber con CURP, extraer solo los primeros 13 caracteres (que es el RFC)
    const curpMatch = subject.match(/serialNumber=([A-Z]{4}[0-9]{6}[A-Z0-9]{2,3})/i);
    if (curpMatch) {
      const rfc = curpMatch[1].toUpperCase();
      console.log('RFC extraído de CURP en serialNumber:', rfc);
      return rfc;
    }
    
    // Último intento: buscar cualquier patrón de RFC en el subject
    const anyRfcMatch = subject.match(/([A-Z]{4}[0-9]{6}[A-Z0-9]{2,3})/i);
    if (anyRfcMatch) {
      const rfc = anyRfcMatch[1].toUpperCase();
      console.log('RFC encontrado por patrón genérico:', rfc);
      return rfc;
    }
    
    console.warn('No se pudo extraer RFC del subject:', subject);
    return null;
  }

  private normalizeRfc(rfc: string): string {
    // Limpiar el RFC: remover espacios, convertir a mayúsculas
    return rfc.trim().toUpperCase().replace(/\s+/g, '');
  }

  private isValidRfcFormat(rfc: string): boolean {
    // Validar que el RFC tenga el formato correcto:
    // - 4 letras iniciales
    // - 6 dígitos (fecha de nacimiento)
    // - 2-3 caracteres finales (homoclave + dígito verificador)
    const rfcPattern = /^[A-Z]{4}[0-9]{6}[A-Z0-9]{2,3}$/;
    return rfcPattern.test(rfc);
  }

  private extractRfcFromCurp(curp: string): string | null {
    // El CURP tiene 18 caracteres, los primeros 13 forman el RFC
    // CURP: OOPF890915HMCRRR03 (18 caracteres)
    // RFC:  OOPF890915J95      (13 caracteres)
    
    if (curp && curp.length >= 13) {
      const potentialRfc = curp.substring(0, 13).toUpperCase();
      if (this.isValidRfcFormat(potentialRfc)) {
        console.log('RFC extraído de CURP:', potentialRfc, 'desde CURP:', curp);
        return potentialRfc;
      }
    }
    return null;
  }

  private isRfcMismatchWarning(message: string): boolean {
    // Detecta si un mensaje es una advertencia de RFC no coincidente
    const patterns = [
      /RFC capturado.*no coincide/i,
      /RFC.*no coincide.*certificado/i,
      /RFC.*diferente/i,
      /RFC.*mismatch/i,
      /RFC.*no match/i
    ];
    
    return patterns.some(pattern => pattern.test(message));
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
          
          let rfc: string | null = null;
          
          // Prioridad 1: Siempre intentar extraer del subject primero (más confiable)
          if (p?.subject) {
            rfc = this.extractRfcFromSubject(p.subject);
            console.log('RFC extraído del subject:', rfc);
          }
          
          // Prioridad 2: Si no se pudo extraer del subject, usar el campo rfc del backend
          // pero verificar que no sea el serialNumber por error
          if (!rfc && p?.rfc) {
            // Verificar si el RFC del backend parece válido (formato correcto)
            const normalizedBackendRfc = this.normalizeRfc(p.rfc);
            if (this.isValidRfcFormat(normalizedBackendRfc)) {
              rfc = normalizedBackendRfc;
              console.log('RFC obtenido del backend:', rfc);
            } else {
              console.warn('RFC del backend no tiene formato válido:', p.rfc);
            }
          }
          
          if (rfc) {
            // Normalizar el RFC antes de establecerlo
            const normalizedRfc = this.normalizeRfc(rfc);
            this.form.controls.rfc.setValue(normalizedRfc);
            // Actualizar el preview con el RFC extraído y normalizado
            this.preview.set({ ...p, rfc: normalizedRfc });
            console.log('RFC final establecido:', normalizedRfc);
          } else {
            console.warn('No se pudo obtener un RFC válido del certificado');
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
          
          // Primero, asegurar que tenemos el RFC correcto del certificado
          if (r.cer && r.cer.subject) {
            const extractedRfc = this.extractRfcFromSubject(r.cer.subject);
            if (extractedRfc) {
              const normalizedExtractedRfc = this.normalizeRfc(extractedRfc);
              r.cer.rfc = normalizedExtractedRfc;
              console.log('RFC extraído del subject en respuesta:', normalizedExtractedRfc);
            }
          }
          
          // Si el RFC en r.cer.rfc parece ser un CURP (18 caracteres), extraer el RFC de él
          if (r.cer?.rfc && r.cer.rfc.length === 18) {
            const rfcFromCurp = this.extractRfcFromCurp(r.cer.rfc);
            if (rfcFromCurp) {
              console.log('RFC original era CURP:', r.cer.rfc);
              r.cer.rfc = rfcFromCurp;
              console.log('RFC extraído del CURP:', rfcFromCurp);
            }
          }
          
          // Revalidar la coincidencia con el RFC correcto
          if (r.verificacion && r.cer?.rfc) {
            const sentRfc = this.normalizeRfc(r.verificacion.rfcInput || '');
            const certRfc = this.normalizeRfc(r.cer.rfc);
            
            console.log('RFC enviado:', sentRfc);
            console.log('RFC del certificado:', certRfc);
            
            r.verificacion.rfcCoincide = sentRfc === certRfc;
            console.log('RFC coincide (recalculado):', r.verificacion.rfcCoincide);
            
            // Si ahora los RFC coinciden, filtrar el mensaje de advertencia específico
            if (r.verificacion.rfcCoincide && r.issues) {
              r.issues = r.issues.filter(issue => {
                if (this.isRfcMismatchWarning(issue)) {
                  console.log('Filtrando advertencia de RFC no coincidente:', issue);
                  return false;
                }
                return true;
              });
              
              // Si no hay más issues, remover el array
              if (r.issues.length === 0) {
                r.issues = undefined;
                console.log('Todas las advertencias de RFC filtradas');
              }
            }
          }
          
          // Normalizar el RFC de la respuesta si existe (fallback)
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
