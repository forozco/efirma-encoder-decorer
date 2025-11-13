# POC — Acceso con e.firma (.cer + .key + contraseña + RFC)

POC en **TypeScript/Node** que:
- Lee un **.cer** del SAT (X.509 DER), extrae **RFC**, **noCertificado** (serial en decimal y hex), **vigencia**, **issuer/subject** y **fingerprint**.
- Descifra una **.key** (PKCS#8 DER cifrada) con su **contraseña** y **firma** un mensaje de prueba.
- **Verifica** que la firma valida con la **llave pública** del .cer (correspondencia key/cert).
- **Autollenado de RFC** en el formulario: al elegir el **.cer**, el frontend consulta `/api/cert-preview` y rellena el campo RFC.
- Compara el **RFC capturado** vs. el **RFC extraído** del certificado y reporta discrepancias.

## Requisitos
- Node.js **>= 18.17** (usa `X509Certificate` nativo de `crypto`).
- npm.

## Instalación y ejecución
```bash
npm i
npm run dev
# abre http://localhost:3000
```

## Endpoints
- `POST /api/cert-preview` — FormData con `cer` → devuelve `{ rfc, noCertificado, ... }` para autollenar el formulario.
- `POST /api/efirma` — FormData con `cer`, `key`, `passphrase`, `rfc` → valida y responde JSON con:
  ```jsonc
  {
    "ok": true,
    "cer": {
      "rfc": "XXXX010101XX0",
      "noCertificado": "30001000000300023708",
      "noCertificadoHex": "01:23:...",
      "validoDesde": "...",
      "validoHasta": "...",
      "issuer": "...",
      "subject": "...",
      "fingerprintSHA256": "AA:BB:...",
      "certificadoBase64": "..." // DER→Base64 (sin PEM headers)
    },
    "key": { "tipo": "rsa", "bits": 2048 },
    "verificacion": {
      "rfcInput": "XXXX010101XX0",
      "rfcCoincide": true,
      "publicKeyMatchesPrivateKey": true,
      "firmaPruebaBase64": "..."  // firma RSA-SHA256 sobre "sat-efirma-poc"
    }
  }
  ```

## Notas
- Los archivos se procesan **en memoria** y **no se guardan**.
- Esta POC es para uso **local**. En producción:
  - Forzar **HTTPS** y limitar el tamaño de archivos.
  - No registrar (loggear) **clave privada** ni **contraseñas**.
  - Manejar errores sin filtrar mensajes del runtime.
  - Agregar autenticación si vas a exponer endpoints.
- Para **CFDI** puedes reutilizar:
  - `noCertificado` (serial en **decimal**).
  - `certificadoBase64` (DER → Base64) para el nodo `<cfdi:Comprobante Certificado="...">`.
  - Con la `key` puedes firmar la **cadena original** (RSA-SHA256 PKCS#1 v1.5) para el `sello`.

## Estructura
```
sat-efirma-poc/
├─ public/
│  └─ index.html
├─ src/
│  └─ server.ts
├─ package.json
├─ tsconfig.json
└─ README.md
```
