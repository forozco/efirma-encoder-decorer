# POC e.firma — Encoder - Decoder

Este paquete contiene **frontend Angular 20** y **backend Node/Express** listos para correr.

## Requisitos
- Node 18+
- npm

## Cómo correr
En dos terminales:

**Backend (Express)**
```bash
cd server
npm i
npm run dev         # http://localhost:3000
```

**Frontend (Angular 20)**
```bash
cd client
npm i
npm start           # http://localhost:4200 (proxy /api → :3000)
```

## Funcionalidades

### 1. Procesamiento con Backend (Modo Original)
- `POST /api/cert-preview`: recibe un `.cer` y devuelve RFC, noCertificado, vigencia, etc. (para autollenar).
- `POST /api/efirma`: recibe `.cer + .key + pass + RFC` y valida correspondencia, vigencia y firma de prueba.

### 2. Procesamiento Local (Sin Backend)
El cliente ahora incluye funcionalidad para procesar archivos e.firma **completamente en el navegador**, sin necesidad de enviar datos al backend:

- **Generación de PKCS#12 (.p12)**: Convierte archivos `.cer` y `.key` del SAT a formato PKCS#12
- **Contraseña fija**: El archivo .p12 generado siempre usa la contraseña `y71&G!0O7`
- **Extracción de información**: Obtiene datos completos del certificado (RFC, vigencia, algoritmos, fingerprints, etc.)
- **Exportación múltiple**:
  - Descarga del archivo .p12
  - Copia de string base64
  - Exportación de JSON completo con toda la información del certificado
- **Decodificación de PKCS#12**: Permite cargar y decodificar archivos .p12 existentes

**Tecnologías utilizadas**:
- `node-forge`: Librería criptográfica para procesamiento de certificados y llaves en el navegador
- Procesamiento 100% client-side (los archivos nunca salen del navegador)

**Rutas disponibles en el cliente**:
- `/efirma-local`: Generación de PKCS#12 desde archivos .cer y .key
- `/decode-base64`: Decodificación de archivos PKCS#12 existentes

> Seguridad: POC para uso local. Los archivos se procesan en memoria y no se guardan.
