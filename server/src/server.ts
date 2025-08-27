import express from "express";
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
  fileFilter: (_req, file, cb) => {
    if (!/\.cer$|\.key$/i.test(file.originalname)) {
      return cb(new Error("Solo .cer y .key"));
    }
    cb(null, true);
  }
});

// --- PREVIEW: extrae datos del .cer para autollenar RFC en el formulario ---
app.post("/api/cert-preview", upload.single("cer"), async (req, res) => {
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
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message ?? "Error leyendo .cer" });
  }
});

// --- Endpoint principal: valida .cer + .key + pass + RFC ---
app.post(
  "/api/efirma",
  upload.fields([{ name: "cer", maxCount: 1 }, { name: "key", maxCount: 1 }]),
  async (req, res) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]>;
      const passphrase = (req.body?.passphrase ?? "").toString();
      const rfcInput = normalizeRFC((req.body?.rfc ?? "").toString());

      const issues: string[] = [];

      if (!files?.cer?.[0] || !files?.key?.[0]) {
        return res.status(400).json({ ok: false, error: "Falta el .cer o el .key" });
      }
      if (!passphrase) return res.status(400).json({ ok: false, error: "Falta la contraseña" });
      if (!rfcInput) issues.push("No se capturó RFC (se validará solo contra el certificado).");

      const cerBuf = files.cer[0].buffer;
      const keyBuf = files.key[0].buffer;

      // Leer certificado
      const cert = new X509Certificate(cerBuf);
      const rfcFromCert = normalizeRFC(extractRFC(cert));
      const nombreORazonSocial = getSubjectAttr(cert.subject, "CN");
      const serialHex = cert.serialNumber.toUpperCase();
      const noCertificado = hexToDecimalString(serialHex);

      // DEBUG simplificado
      console.log('RFC Input:', rfcInput, '| RFC Cert:', rfcFromCert, '| Coinciden:', rfcInput === rfcFromCert);

      // Vigencia
      const now = new Date();
      const notBefore = new Date(cert.validFrom);
      const notAfter = new Date(cert.validTo);
      if (now < notBefore) issues.push("El certificado aún no es vigente (NotBefore).");
      if (now > notAfter) issues.push("El certificado está vencido (NotAfter).");

      // RFC vs input
      if (rfcInput && rfcFromCert && rfcInput !== rfcFromCert) {
        issues.push(`El RFC capturado (${rfcInput}) no coincide con el del certificado (${rfcFromCert}).`);
      }

      // Descifrar .key y probar correspondencia firmando/verificando
      const keyObj = createPrivateKey({
        key: keyBuf,
        format: "der",
        type: "pkcs8",
        passphrase
      });

      // Firma de prueba (como el sello CFDI: RSA-SHA256 PKCS#1 v1.5)
      const probe = Buffer.from("sat-efirma-poc");
      const signer = createSign("RSA-SHA256");
      signer.update(probe);
      const firma = signer.sign(keyObj);
      const firmaB64 = firma.toString("base64");

      const verifier = createVerify("RSA-SHA256");
      verifier.update(probe);
      const keyMatches = verifier.verify(cert.publicKey, firma);
      if (!keyMatches) issues.push("La clave privada no corresponde a la llave pública del .cer.");

      const bits = (keyObj.asymmetricKeyDetails as any)?.modulusLength ?? undefined;
      const payload = {
        ok: issues.length === 0,
        issues,
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
          rfcCoincide: !!(rfcInput && rfcFromCert && rfcInput === rfcFromCert),
          publicKeyMatchesPrivateKey: keyMatches,
          firmaPruebaBase64: firmaB64
        }
      };

      res.json(payload);
    } catch (err: any) {
      res.status(400).json({ ok: false, error: err?.message ?? "Error procesando archivos" });
    }
  }
);

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`POC lista en http://localhost:${PORT}`));
