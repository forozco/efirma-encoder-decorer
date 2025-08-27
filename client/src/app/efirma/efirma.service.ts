import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CertPreview, EfirmaResponse } from '../models';

// Con proxy.conf.json, BASE puede ser vacío. Si no usas proxy, cambia a 'http://localhost:3000'.
const BASE = '';

@Injectable({ providedIn: 'root' })
export class EfirmaService {
  constructor(private http: HttpClient) {}

  certPreview(cerFile: File): Observable<CertPreview> {
    const fd = new FormData();
    fd.append('cer', cerFile);
    return this.http.post<CertPreview>(`${BASE}/api/cert-preview`, fd);
  }

  efirma(cerFile: File, keyFile: File, passphrase: string, rfc: string): Observable<EfirmaResponse> {
    const fd = new FormData();
    fd.append('cer', cerFile);
    fd.append('key', keyFile);
    fd.append('passphrase', passphrase);
    fd.append('rfc', rfc);
    return this.http.post<EfirmaResponse>(`${BASE}/api/efirma`, fd);
  }
}
