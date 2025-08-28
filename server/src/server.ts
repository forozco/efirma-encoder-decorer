import express, { Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import { X509Certificate, createPrivateKey, createSign, createVerify } from "node:crypto";
import { join } from "node:path";

// --- Helpers ---
function hexToDecimalString(hex: string): string {
  const clean = hex.replace(/[:\s]/g, "");
  return BigInt("0x" + clean).toString(10);
}
function getSubjectAttr(subject: string, name: string): string | undefined {
  // Usar múltiples separadores: coma, barra, salto de línea
  const re = new RegExp(`(?:^|[,/\\n])\s*${name}\s*=\s*([^,\/\\n]+)`, "i");
  return subject.match(re)?.[1]?.trim();
}
function extractRFC(cert: X509Certificate): string | undefined {
  // Intentar múltiples formas de extraer el RFC
  const rfc = getSubjectAttr(cert.subject, "SERIALNUMBER") ||
             getSubjectAttr(cert.subject, "OID.2.5.4.5") ||
             getSubjectAttr(cert.subject, "RFC") ||
             getSubjectAttr(cert.subject, "x500UniqueIdentifier");
  
  // DEBUG mínimo
  console.log('RFC extraído:', JSON.stringify(rfc));
  
  return rfc;
}
function normalizeRFC(v: string | undefined): string | undefined {
  if (!v) return v;
  // Eliminar TODOS los espacios, guiones, y caracteres de control
  return v.toUpperCase().replace(/[\s\-\u0000-\u001f\u007f-\u009f]/g, "").trim();
}

// --- App setup ---
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(join(process.cwd(), "public")));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (!/\.cer$|\.key$/i.test(file.originalname)) {
      return cb(new Error("Solo .cer y .key"));
    }
    cb(null, true);
  }
});

// --- PREVIEW: extrae datos del .cer para autollenar RFC en el formulario ---
app.post("/api/cert-preview", upload.single("cer"), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: "Falta el .cer" });

    const cert = new X509Certificate(req.file.buffer);

    const rfc = extractRFC(cert)?.toUpperCase() ?? null;
    const serialHex = cert.serialNumber.toUpperCase();
    const noCertificado = hexToDecimalString(serialHex);

    res.json({
      ok: true,
      rfc,
      noCertificado,
      noCertificadoHex: serialHex,
      validoDesde: cert.validFrom,
      validoHasta: cert.validTo,
      subject: cert.subject
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error leyendo .cer";
    console.error('Error en cert-preview:', err);
    res.status(400).json({ ok: false, error: message });
  }
});

// --- Endpoint principal: valida .cer + .key + pass + RFC ---
app.post(
  "/api/efirma",
  upload.fields([{ name: "cer", maxCount: 1 }, { name: "key", maxCount: 1 }]),
  async (req: Request, res: Response) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]>;
      const passphrase = (req.body?.passphrase ?? "").toString();
      const rfcInputRaw = (req.body?.rfc ?? "").toString();
      const rfcInput = normalizeRFC(rfcInputRaw);

      // DEBUG: Mostrar qué llega del formulario
      console.log('RFC Input Raw:', JSON.stringify(rfcInputRaw));
      console.log('RFC Input Normalizado:', JSON.stringify(rfcInput));

      if (!files?.cer?.[0] || !files?.key?.[0]) {
        return res.status(400).json({ ok: false, error: "Falta el .cer o el .key" });
      }
      if (!passphrase) return res.status(400).json({ ok: false, error: "Falta la contraseña" });

      const cerBuf = files.cer[0].buffer;
      const keyBuf = files.key[0].buffer;

      // Leer certificado
      const cert = new X509Certificate(cerBuf);
      
      // LOG COMPLETO DEL CERTIFICADO
      console.log('\n=== INFORMACIÓN COMPLETA DEL CERTIFICADO ===');
      console.log('Subject completo:', cert.subject);
      console.log('Issuer completo:', cert.issuer);
      console.log('Serial Number (hex):', cert.serialNumber);
      console.log('Valid From:', cert.validFrom);
      console.log('Valid To:', cert.validTo);
      console.log('Fingerprint SHA1:', cert.fingerprint);
      console.log('Fingerprint SHA256:', cert.fingerprint256);
      console.log('Key Usage:', cert.keyUsage);
      console.log('Subject Alternative Names:', cert.subjectAltName);
      console.log('Issuer Certificate:', cert.issuerCertificate);
      console.log('Public Key (primeros 100 chars):', cert.publicKey.export({ format: 'pem', type: 'spki' }).toString().substring(0, 100));
      
      const rfcFromCert = normalizeRFC(extractRFC(cert));
      const nombreORazonSocial = getSubjectAttr(cert.subject, "CN");
      const serialHex = cert.serialNumber.toUpperCase();
      const noCertificado = hexToDecimalString(serialHex);
      
      console.log('RFC extraído y normalizado:', rfcFromCert);
      console.log('Nombre/Razón Social (CN):', nombreORazonSocial);
      console.log('No. Certificado (decimal):', noCertificado);
      console.log('=== FIN INFO CERTIFICADO ===\n');

      // DEBUG simplificado
      console.log('RFC Input:', rfcInput, '| RFC Cert:', rfcFromCert, '| Coinciden:', rfcInput === rfcFromCert);

      // Vigencia
      const now = new Date();
      const notBefore = new Date(cert.validFrom);
      const notAfter = new Date(cert.validTo);
      
      // Validar vigencia del certificado
      if (now < notBefore) {
        return res.status(400).json({ ok: false, error: "El certificado aún no es vigente (NotBefore)." });
      }
      if (now > notAfter) {
        return res.status(400).json({ ok: false, error: "El certificado está vencido (NotAfter)." });
      }

      // RFC vs input - Solo advertir, no detener el proceso
      const rfcCoincide = !!(rfcInput && rfcFromCert && rfcInput === rfcFromCert);
      if (rfcInput && rfcFromCert && !rfcCoincide) {
        console.warn(`Advertencia: RFC capturado (${rfcInput}) no coincide con el del certificado (${rfcFromCert})`);
      }

      // Descifrar .key y probar correspondencia firmando/verificando
      const keyObj = createPrivateKey({
        key: keyBuf,
        format: "der",
        type: "pkcs8",
        passphrase
      });

      // LOG COMPLETO DE LA CLAVE PRIVADA
      console.log('\n=== INFORMACIÓN COMPLETA DE LA CLAVE PRIVADA ===');
      console.log('Tipo de clave:', keyObj.asymmetricKeyType);
      console.log('Tamaño de clave (bits):', (keyObj.asymmetricKeyDetails as any)?.modulusLength);
      console.log('Detalles asimétricos completos:', keyObj.asymmetricKeyDetails);
      console.log('Tamaño simétrico (si aplica):', keyObj.symmetricKeySize);
      
      try {
        const privateKeyPem = keyObj.export({ format: 'pem', type: 'pkcs8' }).toString();
        console.log('Clave privada PEM (primeros 200 chars):', privateKeyPem.substring(0, 200));
      } catch (err) {
        console.log('No se pudo exportar la clave privada:', err);
      }
      
      console.log('=== FIN INFO CLAVE PRIVADA ===\n');

      // Firma de prueba (como el sello CFDI: RSA-SHA256 PKCS#1 v1.5)
      const probe = Buffer.from("sat-efirma-poc");
      console.log('\n=== PROCESO DE VERIFICACIÓN ===');
      console.log('Mensaje a firmar:', probe.toString());
      console.log('Tamaño del mensaje:', probe.length, 'bytes');
      
      const signer = createSign("RSA-SHA256");
      signer.update(probe);
      const firma = signer.sign(keyObj);
      const firmaB64 = firma.toString("base64");
      
      console.log('Firma generada (Base64, primeros 100 chars):', firmaB64.substring(0, 100));
      console.log('Tamaño de la firma:', firma.length, 'bytes');

      const verifier = createVerify("RSA-SHA256");
      verifier.update(probe);
      const keyMatches = verifier.verify(cert.publicKey, firma);
      
      console.log('Verificación exitosa:', keyMatches);
      console.log('=== FIN VERIFICACIÓN ===\n');
      if (!keyMatches) {
        return res.status(400).json({ ok: false, error: "La clave privada no corresponde a la llave pública del .cer." });
      }

      const bits = (keyObj.asymmetricKeyDetails as any)?.modulusLength ?? undefined;
      const payload = {
        ok: true,
        cer: {
          rfc: rfcFromCert,
          nombreORazonSocial,
          noCertificado,
          noCertificadoHex: serialHex,
          validoDesde: cert.validFrom,
          validoHasta: cert.validTo,
          issuer: cert.issuer,
          subject: cert.subject,
          fingerprintSHA256: cert.fingerprint256,
          certificadoBase64: Buffer.from(cert.raw).toString("base64")
        },
        key: { tipo: keyObj.asymmetricKeyType, bits },
        verificacion: {
          rfcInput,
          rfcCoincide,
          publicKeyMatchesPrivateKey: keyMatches,
          firmaPruebaBase64: firmaB64
        }
      };

      console.log('\n=== RESUMEN FINAL ===');
      console.log('RFC Input:', rfcInput);
      console.log('RFC Certificado:', rfcFromCert);
      console.log('RFC Coincide:', rfcCoincide);
      console.log('Clave coincide con certificado:', keyMatches);
      console.log('Resultado general OK:', payload.ok);
      console.log('=== FIN RESUMEN ===\n');

      res.json(payload);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error procesando archivos";
      console.error('Error en efirma:', err);
      res.status(400).json({ ok: false, error: message });
    }
  }
);

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`POC lista en http://localhost:${PORT}`));
