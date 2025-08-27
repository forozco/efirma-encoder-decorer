export interface CertPreview {
  ok: boolean;
  rfc?: string | null;
  noCertificado?: string;
  noCertificadoHex?: string;
  validoDesde?: string;
  validoHasta?: string;
  subject?: string;
  error?: string;
}

export interface EfirmaResponse {
  ok: boolean;
  error?: string;
  issues?: string[];
  cer?: {
    rfc?: string;
    nombreORazonSocial?: string;
    noCertificado?: string;
    noCertificadoHex?: string;
    validoDesde?: string;
    validoHasta?: string;
    issuer?: string;
    subject?: string;
    fingerprintSHA256?: string;
    certificadoBase64?: string;
  };
  key?: { tipo?: string; bits?: number };
  verificacion?: {
    rfcInput?: string;
    rfcCoincide?: boolean;
    publicKeyMatchesPrivateKey?: boolean;
    firmaPruebaBase64?: string;
  };
}
