# POC e.firma — Angular 20 (standalone)

Proyecto Angular **listo para `npm i`** que consume el backend Node de la POC:
- Autollenado de RFC al seleccionar **.cer** (`/api/cert-preview`).
- Envío de **.cer + .key + pass + RFC** a `/api/efirma` y muestra del JSON.

## Uso
1) Asegúrate de tener corriendo el backend Node en `http://localhost:3000` (zip: *sat-efirma-poc.zip*).
2) Instala dependencias:
   ```bash
   npm i
   ```
3) Inicia:
   ```bash
   npm start
   # abre http://localhost:4200
   ```

> El `serve` ya tiene configurado `proxy.conf.json`, así que no necesitas pasar `--proxy-config`.
