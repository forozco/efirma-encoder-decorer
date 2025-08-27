# POC e.firma — Fullstack (Angular 20 + Node/Express)

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

## Qué hace
- `POST /api/cert-preview`: recibe un `.cer` y devuelve RFC, noCertificado, vigencia, etc. (para autollenar).
- `POST /api/efirma`: recibe `.cer + .key + pass + RFC` y valida correspondencia, vigencia y firma de prueba.

> Seguridad: POC para uso local. Los archivos se procesan en memoria y no se guardan.
