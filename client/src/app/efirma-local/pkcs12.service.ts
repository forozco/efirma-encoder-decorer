import { Injectable } from '@angular/core';
import * as forge from 'node-forge';

export interface CertificateInfo {
  subject: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  serialNumber: string;
  version: number;
  signatureAlgorithm: string;
  publicKeyAlgorithm: string;
  publicKeySize: number;
  extensions?: any[];
  subjectFields?: {
    commonName?: string;
    serialNumber?: string;
    organizationName?: string;
    organizationalUnit?: string;
    country?: string;
    state?: string;
    locality?: string;
    email?: string;
  };
  issuerFields?: {
    commonName?: string;
    organizationName?: string;
    organizationalUnit?: string;
    country?: string;
  };
  fingerprints?: {
    sha1?: string;
    sha256?: string;
  };
}

export interface PKCS12Result {
  ok: boolean;
  blob?: Blob;
  base64?: string;
  error?: string;
  certInfo?: CertificateInfo;
  fullData?: any; // JSON completo con toda la información
}

@Injectable({
  providedIn: 'root'
})
export class Pkcs12Service {
  // Contraseña fija para generar el PKCS#12
  private readonly FIXED_P12_PASSWORD = 'y71&G!0O7';

  /**
   * Genera un archivo PKCS#12 (.p12) a partir de archivos .cer, .key y contraseña
   * @param cerFile Archivo de certificado (.cer)
   * @param keyFile Archivo de llave privada (.key)
   * @param password Contraseña de la llave privada (.key del SAT)
   * @param keyPassword Contraseña de la llave privada (opcional, por defecto usa la misma que password)
   * @returns Promise con el resultado de la operación
   * @note El archivo PKCS#12 generado siempre usará la contraseña fija "y71&G!0O7"
   */
  async generatePKCS12(
    cerFile: File,
    keyFile: File,
    password: string,
    keyPassword?: string
  ): Promise<PKCS12Result> {
    try {
      // Usar la misma contraseña para la llave si no se proporciona una diferente
      const privateKeyPassword = keyPassword || password;

      // Leer certificado como ArrayBuffer (formato DER del SAT)
      const certDer = await this.readFileAsArrayBuffer(cerFile);
      const certAsn1 = forge.asn1.fromDer(forge.util.createBuffer(certDer));
      const certificate = forge.pki.certificateFromAsn1(certAsn1);

      // Leer llave privada como ArrayBuffer (formato DER encriptado del SAT)
      const keyDer = await this.readFileAsArrayBuffer(keyFile);
      const keyBuffer = forge.util.createBuffer(new Uint8Array(keyDer));

      // Desencriptar la llave privada (las llaves del SAT están en formato PKCS#8 encriptado)
      let privateKey: forge.pki.PrivateKey;
      try {
        // Parsear el ASN.1
        const keyAsn1 = forge.asn1.fromDer(keyBuffer);

        // Desencriptar PKCS#8
        const decryptedKeyInfo = forge.pki.decryptPrivateKeyInfo(keyAsn1, privateKeyPassword);

        if (!decryptedKeyInfo) {
          throw new Error('Contraseña incorrecta');
        }

        // Convertir a llave privada
        privateKey = forge.pki.privateKeyFromAsn1(decryptedKeyInfo);

        if (!privateKey) {
          throw new Error('No se pudo extraer la llave privada');
        }
      } catch (error: any) {
        console.error('Error desencriptando llave:', error);
        throw new Error(`No se pudo desencriptar la llave privada. ${error.message || 'Verifica que la contraseña sea correcta.'}`);
      }

      // Extraer información detallada del certificado
      const subjectFields = this.extractFields(certificate.subject.attributes);
      const issuerFields = this.extractFields(certificate.issuer.attributes);

      // Calcular fingerprints
      const certDerForFingerprint = forge.asn1.toDer(certAsn1).getBytes();
      const md1 = forge.md.sha1.create();
      md1.update(certDerForFingerprint);
      const sha1Fingerprint = md1.digest().toHex().toUpperCase().match(/.{2}/g)?.join(':') || '';

      const md256 = forge.md.sha256.create();
      md256.update(certDerForFingerprint);
      const sha256Fingerprint = md256.digest().toHex().toUpperCase().match(/.{2}/g)?.join(':') || '';

      // Información del certificado
      const certInfo: CertificateInfo = {
        subject: certificate.subject.attributes.map(attr =>
          `${attr.shortName || attr.name}=${attr.value}`
        ).join(', '),
        issuer: certificate.issuer.attributes.map(attr =>
          `${attr.shortName || attr.name}=${attr.value}`
        ).join(', '),
        validFrom: certificate.validity.notBefore.toISOString(),
        validTo: certificate.validity.notAfter.toISOString(),
        serialNumber: certificate.serialNumber,
        version: certificate.version + 1, // Version is 0-indexed
        signatureAlgorithm: (certificate as any).signatureOid || 'unknown',
        publicKeyAlgorithm: 'RSA',
        publicKeySize: (certificate.publicKey as any).n?.bitLength() || 0,
        extensions: certificate.extensions?.map(ext => ({
          name: ext.name,
          id: ext.id,
          critical: ext.critical,
          value: this.formatExtensionValue(ext)
        })) || [],
        subjectFields,
        issuerFields,
        fingerprints: {
          sha1: sha1Fingerprint,
          sha256: sha256Fingerprint
        }
      };

      // Información completa en formato JSON
      const fullData = {
        certificate: {
          version: certInfo.version,
          serialNumber: certInfo.serialNumber,
          signature: {
            algorithm: certInfo.signatureAlgorithm
          },
          issuer: {
            raw: certInfo.issuer,
            fields: issuerFields
          },
          validity: {
            notBefore: certInfo.validFrom,
            notAfter: certInfo.validTo,
            isValid: new Date() >= certificate.validity.notBefore && new Date() <= certificate.validity.notAfter
          },
          subject: {
            raw: certInfo.subject,
            fields: subjectFields
          },
          publicKey: {
            algorithm: certInfo.publicKeyAlgorithm,
            size: certInfo.publicKeySize,
            exponent: (certificate.publicKey as any).e?.toString() || 'unknown',
            modulus: (certificate.publicKey as any).n?.toString(16).toUpperCase() || 'unknown'
          },
          extensions: certInfo.extensions,
          fingerprints: certInfo.fingerprints
        },
        privateKey: {
          type: 'RSA',
          format: 'PKCS#8',
          encrypted: true,
          size: (privateKey as any).n?.bitLength() || 0
        },
        pkcs12: {
          format: 'PKCS#12',
          algorithm: '3des',
          friendlyName: 'E.Firma SAT'
        }
      };

      // Crear PKCS#12 con contraseña fija
      const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
        privateKey,
        [certificate],
        this.FIXED_P12_PASSWORD, // Usar contraseña fija en lugar de la proporcionada por el usuario
        {
          algorithm: '3des', // Algoritmo compatible con la mayoría de sistemas
          friendlyName: 'E.Firma SAT',
          generateLocalKeyId: true
        }
      );

      // Convertir a formato binario (DER)
      const p12Der = forge.asn1.toDer(p12Asn1).getBytes();

      // Crear Blob para descarga
      const bytes = new Uint8Array(p12Der.length);
      for (let i = 0; i < p12Der.length; i++) {
        bytes[i] = p12Der.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: 'application/x-pkcs12' });

      // Convertir a base64 para mostrar como string
      const base64 = forge.util.encode64(p12Der);

      return {
        ok: true,
        blob,
        base64,
        certInfo,
        fullData
      };

    } catch (error: any) {
      console.error('Error generando PKCS#12:', error);
      return {
        ok: false,
        error: error?.message || 'Error desconocido al generar el archivo PKCS#12'
      };
    }
  }

  /**
   * Lee un archivo como ArrayBuffer
   */
  private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Extrae campos individuales de los atributos del certificado
   */
  private extractFields(attributes: any[]): any {
    const fields: any = {};

    attributes.forEach(attr => {
      const shortName = attr.shortName || attr.name;
      const value = attr.value;

      switch (shortName) {
        case 'CN':
          fields.commonName = value;
          break;
        case 'serialNumber':
          fields.serialNumber = value;
          break;
        case 'O':
          fields.organizationName = value;
          break;
        case 'OU':
          fields.organizationalUnit = value;
          break;
        case 'C':
          fields.country = value;
          break;
        case 'ST':
          fields.state = value;
          break;
        case 'L':
          fields.locality = value;
          break;
        case 'emailAddress':
          fields.email = value;
          break;
      }
    });

    return fields;
  }

  /**
   * Formatea el valor de una extensión para mejor legibilidad
   */
  private formatExtensionValue(ext: any): any {
    try {
      if (ext.name === 'keyUsage') {
        return {
          digitalSignature: ext.digitalSignature || false,
          nonRepudiation: ext.nonRepudiation || false,
          keyEncipherment: ext.keyEncipherment || false,
          dataEncipherment: ext.dataEncipherment || false,
          keyAgreement: ext.keyAgreement || false,
          keyCertSign: ext.keyCertSign || false,
          cRLSign: ext.cRLSign || false,
          encipherOnly: ext.encipherOnly || false,
          decipherOnly: ext.decipherOnly || false
        };
      }

      if (ext.name === 'extKeyUsage') {
        return ext.value || ext;
      }

      if (ext.name === 'subjectAltName') {
        return ext.altNames?.map((alt: any) => ({
          type: alt.type,
          value: alt.value
        })) || [];
      }

      if (ext.name === 'basicConstraints') {
        return {
          cA: ext.cA || false,
          pathLenConstraint: ext.pathLenConstraint
        };
      }

      return ext.value || 'N/A';
    } catch {
      return 'N/A';
    }
  }

  /**
   * Decodifica un string base64 de PKCS#12 y extrae su información
   * @param base64String String base64 del archivo PKCS#12
   * @param password Contraseña para desencriptar el PKCS#12
   * @returns Promise con la información del certificado
   */
  async decodePKCS12FromBase64(
    base64String: string,
    password: string
  ): Promise<{ ok: boolean; certInfo?: CertificateInfo; fullData?: any; error?: string }> {
    try {
      // Decodificar base64 a bytes
      const p12Der = forge.util.decode64(base64String);
      const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12Der));

      // Parsear PKCS#12
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

      // Extraer certificado y llave privada
      const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const certBag = bags[forge.pki.oids.certBag]?.[0];

      if (!certBag) {
        throw new Error('No se encontró un certificado en el archivo PKCS#12');
      }

      const certificate = certBag.cert;
      if (!certificate) {
        throw new Error('No se pudo extraer el certificado');
      }

      // Extraer información detallada del certificado
      const subjectFields = this.extractFields(certificate.subject.attributes);
      const issuerFields = this.extractFields(certificate.issuer.attributes);

      // Calcular fingerprints
      const certDerForFingerprint = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes();
      const md1 = forge.md.sha1.create();
      md1.update(certDerForFingerprint);
      const sha1Fingerprint = md1.digest().toHex().toUpperCase().match(/.{2}/g)?.join(':') || '';

      const md256 = forge.md.sha256.create();
      md256.update(certDerForFingerprint);
      const sha256Fingerprint = md256.digest().toHex().toUpperCase().match(/.{2}/g)?.join(':') || '';

      // Información del certificado
      const certInfo: CertificateInfo = {
        subject: certificate.subject.attributes.map(attr =>
          `${attr.shortName || attr.name}=${attr.value}`
        ).join(', '),
        issuer: certificate.issuer.attributes.map(attr =>
          `${attr.shortName || attr.name}=${attr.value}`
        ).join(', '),
        validFrom: certificate.validity.notBefore.toISOString(),
        validTo: certificate.validity.notAfter.toISOString(),
        serialNumber: certificate.serialNumber,
        version: certificate.version + 1,
        signatureAlgorithm: (certificate as any).signatureOid || 'unknown',
        publicKeyAlgorithm: 'RSA',
        publicKeySize: (certificate.publicKey as any).n?.bitLength() || 0,
        extensions: certificate.extensions?.map(ext => ({
          name: ext.name,
          id: ext.id,
          critical: ext.critical,
          value: this.formatExtensionValue(ext)
        })) || [],
        subjectFields,
        issuerFields,
        fingerprints: {
          sha1: sha1Fingerprint,
          sha256: sha256Fingerprint
        }
      };

      // Información completa en formato JSON
      const fullData = {
        certificate: {
          version: certInfo.version,
          serialNumber: certInfo.serialNumber,
          signature: {
            algorithm: certInfo.signatureAlgorithm
          },
          issuer: {
            raw: certInfo.issuer,
            fields: issuerFields
          },
          validity: {
            notBefore: certInfo.validFrom,
            notAfter: certInfo.validTo,
            isValid: new Date() >= certificate.validity.notBefore && new Date() <= certificate.validity.notAfter
          },
          subject: {
            raw: certInfo.subject,
            fields: subjectFields
          },
          publicKey: {
            algorithm: certInfo.publicKeyAlgorithm,
            size: certInfo.publicKeySize,
            exponent: (certificate.publicKey as any).e?.toString() || 'unknown',
            modulus: (certificate.publicKey as any).n?.toString(16).toUpperCase() || 'unknown'
          },
          extensions: certInfo.extensions,
          fingerprints: certInfo.fingerprints
        },
        pkcs12: {
          format: 'PKCS#12',
          containsCertificate: true,
          containsPrivateKey: true,
          base64Length: base64String.length
        }
      };

      return {
        ok: true,
        certInfo,
        fullData
      };

    } catch (error: any) {
      console.error('Error decodificando PKCS#12:', error);
      return {
        ok: false,
        error: error?.message || 'Error desconocido al decodificar el PKCS#12'
      };
    }
  }

  /**
   * Descarga un blob como archivo
   */
  downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
