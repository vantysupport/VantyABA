# App de Android (Google Play)

La app es una **Trusted Web Activity (TWA)**: abre `https://vanty.xyz` a pantalla completa con Chrome.
Toda la lógica sigue en la web, así que cada cambio publicado en Vercel ya aparece en la app sin subir
otra versión. Solo hay que subir una versión nueva si cambia el ícono, el nombre o el paquete.

- Proyecto: carpeta `android/` (ábrela tal cual en Android Studio).
- Paquete: `xyz.vanty.app` (no se puede cambiar después de publicar).
- Abre `https://vanty.xyz/login?app=android`; la web detecta la app (`lib/app-android.ts`) y oculta
  las compras (planes y tokens), porque Google Play exige su propio sistema de cobro para eso.

## 1. Compilar el paquete firmado (.aab)

1. Android Studio → **Open** → carpeta `android`. Espera a que termine "Gradle sync"
   (si ofrece actualizar el plugin de Android Gradle, acepta).
2. **Build → Generate Signed App Bundle or APK → Android App Bundle → Next**.
3. **Key store path → Create new…**: guárdalo FUERA del repositorio (p. ej. `Documentos/vanty-upload.jks`),
   con contraseña segura, alias `upload`, validez 25 años. **Guarda el archivo y las contraseñas en un lugar
   seguro**: sin ellos no podrás subir actualizaciones.
4. Variante **release** → **Create**. El archivo queda en `android/app/release/app-release.aab`.

## 2. Google Play Console

1. **Crear app**: nombre "Vanty ABA", idioma español (Latinoamérica), App, Gratis.
2. **Integridad de la app → Firma de apps de Google Play**: deja que Google administre la clave de firma.
3. Sube el `.aab` en **Pruebas → Prueba interna** (o cerrada) y publica para tu correo.
4. Copia las huellas **SHA-256** de "Certificado de la clave de firma de apps" y "Certificado de la clave
   de subida" (misma pantalla de Integridad).

## 3. Vincular la web con la app (sin barra del navegador)

En Vercel → Settings → Environment Variables:

```
ANDROID_SHA256_FINGERPRINTS = AA:BB:...(firma de Google Play),CC:DD:...(clave de subida)
```

Redeploy y comprueba `https://vanty.xyz/.well-known/assetlinks.json`. Si la app muestra una barra con la
dirección arriba, las huellas no coinciden.

## 4. Ficha y formularios obligatorios

- **Política de privacidad**: `https://vanty.xyz/privacidad`
- **Eliminación de cuenta** (URL): `https://vanty.xyz/privacidad#eliminar` — dentro de la app: Mi perfil → Eliminar cuenta.
- **Acceso a la app**: crea una cuenta de prueba (director) y entrega correo y contraseña a Google.
- **Seguridad de los datos**: igual que `docs/app-store-privacidad.md` (nombre, correo, teléfono, datos de salud,
  mensajes, fotos/archivos; cifrados en tránsito; el usuario puede pedir su eliminación; no se venden).
- **Apps de salud**: declara que es software de gestión clínica para profesionales; no es un dispositivo médico.
- **Público objetivo**: adultos (18+). Los menores no usan la app; sus datos los registra el centro.
- **Anuncios**: no contiene anuncios.
- **Capturas**: teléfono (mín. 2) + ícono 512×512 (`public/icons/icon-512x512.png`) + gráfico de funciones 1024×500.

Las cuentas personales nuevas de Google Play deben hacer una **prueba cerrada con al menos 12 personas
durante 14 días** antes de poder publicar en producción.
