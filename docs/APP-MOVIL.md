# Vanty ABA: instrucciones para construir la app móvil nativa

Este documento es para el asistente o desarrollador que construirá la **app móvil de Vanty ABA desde cero**.
Junto con este documento recibes la carpeta del proyecto web (`VantyABA`, Next.js). Úsala como **referencia
de cómo funciona todo**: pantallas, textos, reglas y llamadas a la API. **No copies su diseño**: la app debe
diseñarse para celular.

---

## 1. Qué es Vanty y qué debe hacer la app

Vanty ABA (vanty.xyz) es una plataforma clínica para centros de terapia ABA y del desarrollo infantil en
Latinoamérica. Cada **centro** tiene un equipo y las **familias** de sus pacientes, que son niños.

| Rol (`profiles.role`) | Quién es | ¿En la app móvil? |
|---|---|---|
| `padre` | Familia del paciente | **Sí: versión 1** |
| `especialista`, `terapeuta` | Terapeutas | Sí: versión 2 |
| `jefe`, `admin` | Dirección del centro | No: usan la web |
| `secretaria` | Recepción y pagos | No: usan la web |
| `programador` | Dueño de la plataforma | No |

**Objetivo de la versión 1:** app para familias, en español e inglés, que se sienta nativa al estilo de Duolingo:
- Seguir el progreso del hijo o hija.
- Ver y gestionar citas.
- Practicar en casa con racha diaria.
- Hablar con ARIA (asistente de IA) y con el centro.
- Notificaciones motivadoras.
- Un widget en la pantalla de inicio.

Si un usuario con otro rol inicia sesión en la versión 1, se le muestra un mensaje amable: *"Por ahora la app es
para familias. Ingresa desde vanty.xyz en tu computadora."* Incluye un botón para cerrar sesión.

---

## 2. Stack recomendado

- **Expo (React Native) + TypeScript + expo-router**. Es el mismo lenguaje que la web, así que se pueden
  reutilizar tipos y lógica.
- **@supabase/supabase-js** con la sesión guardada en `expo-secure-store` (o AsyncStorage con cifrado).
- **expo-notifications** para las notificaciones push (Expo Push Service, que usa FCM en Android y APNs en iOS).
- **react-native-android-widget** (u otra librería equivalente) para el widget de Android.
- **EAS Build** para compilar y publicar.
- Proyecto en un **repositorio nuevo** (por ejemplo `vanty-app`), separado de la web.
- Identificador del paquete: **`xyz.vanty.app`**. Nombre visible: **Vanty ABA**.

---

## 3. Conexión con Supabase (misma base que la web)

- **Proyecto:** `vanty-2-0`, región sa-east-1.
- **URL:** `https://ylcnfqkhivqwjeifuhbl.supabase.co`
- **Clave:** usa solo la **anon / publishable key**, como variable `EXPO_PUBLIC_SUPABASE_ANON_KEY`. El dueño
  te la dará.
- ⛔ **Nunca** pongas en la app la *service role key* ni ninguna otra clave secreta (Groq, Lemon, Resend…).
  Todo lo que necesite claves secretas se hace llamando a la API de la web (sección 4).

**Seguridad:** todas las tablas tienen **RLS**. Con la sesión del usuario, Supabase solo devuelve lo que ese
usuario puede ver. Por ejemplo, una familia solo ve sus `children` (`parent_id = auth.uid()`), sus `appointments`,
sus `notifications`, etc. No intentes saltarte RLS.

**Inicio de sesión:** debe funcionar igual que en la web (`app/login`, `app/auth/callback`):
- Correo y contraseña: `supabase.auth.signInWithPassword`.
- **Google** y **Microsoft** (OAuth con PKCE): redirección a `vantyaba://auth/callback` usando
  `expo-auth-session` / `WebBrowser.openAuthSessionAsync`, y luego `exchangeCodeForSession`.
- Recuperar contraseña: llamar a `POST https://vanty.xyz/api/auth/reset-password` con el correo, igual que
  la web. El enlace del correo abre la web y el cambio se completa ahí.
- **Verificación en dos pasos:** si el usuario tiene un factor verificado (`mfa.listFactors`) y la sesión está
  en `aal1`, pide el código TOTP (`mfa.challenge` / `mfa.verify`) antes de entrar. Revisa en `proxy.ts` y en
  `app/mfa-required` cómo lo hace la web.
- Las familias se crean cuando el centro las invita (`app/invitar/[token]`). En la versión 1 la app **no** crea
  centros. El registro de una familia nueva puede abrir `https://vanty.xyz/es/invitar/<token>` en el navegador.

### Tablas que la app lee directamente (con la sesión del usuario)

| Tabla | Para qué | Columnas útiles |
|---|---|---|
| `profiles` | Datos del usuario | `id, email, full_name, role, phone, avatar_url, centro_id, nombre_confirmado, terminos_version, terminos_aceptados_at, ia_consentimiento` |
| `centros` | Nombre, logo y estado del centro | `id, name, logo_url, telefono, email, status, trial_ends_at, paid_until, ia_estado` |
| `children` | Hijos e hijas (puede haber varios) | `id, name, apodo, birth_date, diagnosis, parent_id, centro_id, specialist_id, is_active` |
| `appointments` | Citas | `id, child_id, appointment_date, appointment_time, service_type, status, modalidad, video_link, specialist_id` |
| `notifications` | Avisos de la app | `id, user_id, title, message, type, is_read, child_id, metadata, created_at` |
| `chat_familias` | Chat familia ↔ centro (Realtime) | `id, child_id, content, sender_id, sender_role, sender_name, read_by, message_type, file_url, created_at` |
| `parent_forms` | Formularios que el centro envía | `id, child_id, form_title, deadline, status` |

Hay más tablas, como programas ABA, sesiones o registros de práctica. Antes de leer una tabla, revisa cómo la
usa la web en `app/padre/components/*`. Si la web la lee mediante `/api/...`, haz lo mismo.

### Escrituras

- **Regla:** si la web escribe a través de una ruta `/api/...`, la app usa **la misma ruta**. Esas rutas validan
  permisos, envían correos y notificaciones al centro, sincronizan calendarios, etc.
- Escrituras directas permitidas: marcar notificaciones como leídas, enviar mensajes en `chat_familias` (o
  `/api/chat-familias`, igual que la web), editar el propio nombre y teléfono en `profiles`, y aceptar términos.
- **Nunca** borres citas. Reprogramar o cancelar es una **solicitud** al centro (`app/padre/components/SolicitudCita.tsx`).

---

## 4. API de la web (para todo lo que usa IA, archivos o lógica del servidor)

- **Base:** `https://vanty.xyz`
- **Autenticación:** encabezado `Authorization: Bearer <session.access_token>` en cada llamada.
  La web hace lo mismo con `lib/admin-fetch.ts`.
- Las rutas validan al usuario con `lib/api-auth.ts → getApiCaller()`, que ya acepta el token Bearer.

> ⚠️ **Requisito previo pendiente en la web:** el middleware `proxy.ts` hoy solo reconoce la sesión por
> **cookie**, así que una llamada desde la app (solo con Bearer, sin cookies) recibe **401** antes de llegar a la
> ruta. Hay que adaptar `proxy.ts` para que, en `/api/*`, si no hay cookie:
> 1. Verifique el token Bearer con `supabase.auth.getClaims(token)`.
> 2. Haga la consulta de admisión (perfil, estado del centro y consentimiento de IA) con un cliente que use ese
>    token.
> 3. Calcule el MFA pendiente con el `aal` del JWT y los factores verificados del usuario.
>
> Es un cambio de seguridad: debe hacerse con revisión del dueño, en el repositorio de la web. Hasta entonces,
> prueba la API con una sesión de navegador.

### Respuestas especiales que la app debe manejar

| Respuesta | Qué significa | Qué mostrar |
|---|---|---|
| `401` | Sesión vencida | Renovar el token (`refreshSession`) y reintentar; si falla, ir al login |
| `403 { error: 'centro_inactive' }` | El centro no tiene la suscripción al día | "El portal de {centro} no está disponible por ahora. La información de tu hijo/a está segura. Si necesitas algo urgente, comunícate con el centro." **Nunca hables de pagos con las familias.** |
| `403 { error: 'ia_no_autorizada', motivo }` | El centro o la familia no aceptó el uso de IA | Mostrar el consentimiento de IA (ver `components/ConsentimientoIA.tsx` y `lib/ia-consentimiento.ts`) |
| `429` | Límite de solicitudes | "Espera un momento e inténtalo de nuevo" |

### Rutas que usa el panel de familias (`app/padre`)

| Función | Ruta(s) | Referencia en la web |
|---|---|---|
| Límite de cuentas de familia | `GET /api/padre/limite` | `app/padre/page.tsx` |
| Racha de práctica | `GET /api/padre/racha?child_id=&hoy=YYYY-MM-DD` | `HomeView.tsx`, `lib/racha.ts` |
| Estadísticas y progreso | `GET /api/padre/stats` | `HomeView.tsx` |
| Citas | `/api/padre/citas` | `MisCitasView.tsx`, `SolicitudCita.tsx` |
| ARIA (chat de IA) | `/api/parent-chat` | `ChatInterface.tsx` |
| Chat con el centro | `/api/chat-familias` + Realtime en `chat_familias` | `ChatFamilias.tsx` |
| Practicar en casa | `/api/engagement-padres`, `/api/videos-actividad`, `/api/parent-wellbeing` | `EngagementView.tsx` |
| Programas ABA | `/api/programas-aba` | `ProgramasABAView.tsx` |
| Evaluación inicial | `/api/evaluacion-inicial` (+ `/anamnesis`, `/analizar`, `/recomendar-terapias`, `/seleccionar`, `/confirmar`) | `EvaluacionInicialView.tsx` |
| Formularios del centro | `/api/admin/forms`, `/api/analyze-parent-form-submission` | `ParentFormsView.tsx` |
| Videollamada | `/api/video-call` | `VideoCallModal` |
| Consentimiento de IA | `GET/POST /api/ia/consentimiento` | `ConsentimientoIA.tsx` |
| Eliminar mi cuenta | `POST /api/suscripcion/eliminar-cuenta` | `components/cuenta/SalidaCuenta.tsx` |
| Tokens de ARIA (saldo) | `GET /api/padre/tokens` | `ComprarTokensPadre.tsx` (**solo leer el saldo, no comprar**; ver sección 6) |

Antes de implementar una pantalla, **lee el componente y la ruta** de la web para respetar formatos, validaciones
y textos.

---

## 5. Pantallas de la versión 1 (familias)

Navegación con **pestañas abajo**:

1. **Inicio**
   - Saludo con ARIA.
   - Selector de hijo/a, si hay más de uno.
   - Tarjeta de **racha** con fuego y los días de la semana.
   - Próxima cita.
   - Último logro o progreso.
   - Tarea de práctica del día.
2. **Agenda**
   - Próximas citas y citas pasadas.
   - Detalle de la cita.
   - Botones "Pedir cambio" y "No podré asistir", que envían una **solicitud** al centro.
   - Botón "Unirme" para videollamadas.
3. **ARIA** (botón central destacado): chat de IA con respuestas en streaming si la ruta lo permite.
4. **Chat**: mensajes con el equipo del centro, en tiempo real, con adjuntos.
5. **Perfil y más**:
   - Datos personales e idioma (es/en).
   - Tema claro u oscuro.
   - Notificaciones.
   - Programas ABA, evaluación inicial, formularios y documentos.
   - Privacidad, ayuda y cerrar sesión.
   - **Eliminar mi cuenta.** Es obligatorio para Google Play y debe borrar solo los datos de la familia, no los del niño.

Estados especiales:
- **Sin hijos vinculados:** pantalla de bienvenida. "Tu centro vinculará a tu hijo/a", con un botón para recargar
  (ver el onboarding en `app/padre/page.tsx`).
- **Bloqueo por límite** (`/api/padre/limite` → `allowed:false`): mensaje y botón de contacto al centro.
- **Centro inactivo:** mensaje neutro, sin hablar de pagos (sección 4).

Antes de mostrar el contenido, al entrar:
1. Si `profiles.nombre_confirmado === false`, pedir nombre y apellido.
2. Si `profiles.terminos_version !== TERMINOS_VERSION` (valor actual en `lib/terminos.ts`, hoy `'2026-10'`),
   mostrar la aceptación de **Términos y Política de privacidad**, con enlaces a `https://vanty.xyz/terminos` y
   `https://vanty.xyz/privacidad`. Al aceptar, actualizar `terminos_version` y `terminos_aceptados_at`, y
   **comprobar que la fila se actualizó**. Ver `components/NombrePerfilGuard.tsx`.

---

## 6. Reglas de negocio y legales (obligatorias)

- **Pagos:** la app **no vende nada**: ni planes ni tokens, ni enlaces a Lemon Squeezy ni a la página de precios.
  Google Play obliga a usar su propio sistema de cobro para ventas dentro de la app. La suscripción del centro la
  paga la dirección en la web.
  - Si se agotan los mensajes de ARIA, mostrar: *"Llegaste al límite de hoy. Vuelve mañana."*
  - No ofrecer compras.
- **A las familias nunca se les habla de pagos ni de la suscripción del centro.**
- **Datos de menores y de salud:**
  - Sin SDKs de publicidad ni de analítica que envíen datos personales.
  - No guardar datos clínicos en caché sin cifrar.
  - Cerrar sesión borra la caché.
- **IA:** respetar el consentimiento (`centros.ia_estado` y `profiles.ia_consentimiento`). Sin consentimiento, no
  llamar a rutas de IA y mostrar el aviso. Ver `lib/ia-consentimiento.ts`.
- **Idiomas:** español (por defecto) e inglés. Los textos de la web están en `messages/es.json` y `messages/en.json`.
- **Crédito:** los reportes en PDF o Word que se descarguen ya traen "Generado con tecnología de Vanty ABA"
  porque los genera la web.

---

## 7. Notificaciones push estilo Duolingo

La web ya envía **web push** (`lib/push.ts`, `public/sw.js`):
- Con imágenes de ARIA (`public/push/aria-*.png`, `banner-*.jpg`).
- Con el estilo por tipo de aviso (`estiloAviso`).
- Con enlace a la vista (`?vista=agenda`, etc.).

Hay tareas programadas en `app/api/cron`. Para la app nativa:

1. **En la web** (cambio pequeño, con revisión):
   - Nueva tabla `push_tokens_moviles` (`id, user_id, token, plataforma, centro_id, created_at, updated_at`), con
     RLS para que cada usuario solo vea y gestione sus propios tokens.
   - Ruta `POST /api/push/movil` para registrar o borrar el token de Expo.
   - En `lib/push.ts`, `enviarPush` también envía a los tokens móviles por la Expo Push API, con el mismo título,
     texto, imagen y `vista`.
   - Las migraciones van en `supabase/migrations/` con el siguiente número correlativo.
2. **En la app:**
   - Pedir permiso de notificaciones **después** de explicar para qué sirven, no al abrir la app.
   - Registrar el token de Expo.
   - Al tocar una notificación, abrir la pantalla indicada por `vista`.
3. **Contenido estilo Duolingo:**
   - Recordatorio de racha ("¡No pierdas tu racha de 5 días con Mateo! 🔥").
   - Cita de mañana.
   - Logro nuevo.
   - Mensaje del centro.
   - Formulario por vencer.

   Usa la voz de ARIA, sin exagerar la frecuencia (máximo 1–2 al día) y respeta las preferencias del perfil.

---

## 8. Widget de pantalla de inicio (Android)

Widget **"Mi hijo/a hoy"**:
- Racha actual 🔥.
- Próxima cita (día y hora).
- Botón para abrir la app en "Practicar en casa".

Lee los datos con la sesión guardada:
- `appointments` y `/api/padre/racha`.
- Se actualiza cada ~30 minutos y al abrir la app.
- Si no hay sesión, muestra "Inicia sesión en Vanty".
- No muestra diagnósticos ni datos clínicos en el widget, porque son visibles en la pantalla bloqueada.

---

## 9. Diseño y marca

- **Colores:**
  - Primario `#0069DB`.
  - Degradado de marca `#01ABFC → #0063D8`.
  - Fondo claro `#F3F8FE`, fondo oscuro `#081426`.
  - Éxito, aviso y peligro: los tokens `--v-*` de `app/globals.css`.
- **Tipografía:** *Plus Jakarta Sans* para el texto y *Poppins* (negrita) para los títulos. Los archivos están en `app/fonts`.
- **Mascota ARIA:**
  - Poses en `public/aria/pose-1..10.webp` y `aria-conecta.webp`.
  - Imágenes para push en `public/push`.
  - Úsala en estados vacíos, celebraciones y logros, como el búho de Duolingo.
- **Logo e íconos:** `public/brand/vanty-logo.png`, `vanty-mark-white.png` (marca blanca, sirve para el ícono
  adaptable y el de notificación) y `public/icons/icon-512x512.png`.
- **Pautas:**
  - Pensada para una mano.
  - Botones de 48 dp o más.
  - Tarjetas grandes.
  - Celebraciones animadas: confeti al completar práctica o al alcanzar un logro.
  - Vibración suave.
  - Jalar para actualizar.
  - Esqueletos de carga.
  - Modo oscuro.
  - Accesibilidad: tamaños de letra del sistema y lector de pantalla.
- El nombre y el logo del **centro** (`centros.name`, `centros.logo_url`) aparecen en el encabezado. La familia
  siente que es "la app de su centro, con tecnología Vanty".

---

## 10. Lo que NO debes hacer

- No usar la service role key ni claves secretas en la app.
- No cambiar el esquema de la base sin una migración revisada en el repositorio de la web.
  - ⚠️ **No agregues claves foráneas nuevas hacia `profiles`** (por ejemplo desde `centros` o `children`). Ya pasó:
    una FK nueva hizo ambiguas las consultas `profiles?select=centros(...)` (PostgREST error PGRST201, HTTP 300) y
    dejó sin acceso a todos los usuarios.
- No duplicar la lógica de las rutas `/api/*` en la app.
- No romper la web: cualquier cambio en el repositorio de la web debe compilar (`npm run build`) y no cambiar el
  comportamiento existente.
- No pedir permisos que no se usan (contactos, ubicación, etc.).

---

## 11. Publicación en Google Play

- Compilar con **EAS Build** (`eas build -p android --profile production`) y obtener un `.aab`.
- Play Console:
  - **Prueba interna**, luego **prueba cerrada** (las cuentas personales nuevas necesitan **12 testers durante
    14 días**) y después producción.
  - **Política de privacidad:** `https://vanty.xyz/privacidad`.
  - **Eliminación de cuenta:** `https://vanty.xyz/privacidad#eliminar`, además de la opción dentro de la app.
  - **Seguridad de los datos:** basarse en `docs/app-store-privacidad.md`.
  - **Apps de salud:** software de gestión clínica para centros. No es un dispositivo médico.
  - **Público objetivo:** adultos (18+). Sin anuncios.
  - **Acceso para revisión:** una cuenta de familia de prueba con datos ficticios.

---

## 12. Archivos de la web que conviene leer primero

```
app/padre/page.tsx                  ← estructura del panel de familias y estados especiales
app/padre/components/*.tsx          ← cada pantalla (HomeView, MisCitasView, ChatInterface, ChatFamilias, EngagementView…)
app/login, app/auth/callback        ← inicio de sesión, OAuth, invitaciones
proxy.ts                            ← reglas de acceso, MFA, estado del centro, consentimiento de IA
lib/api-auth.ts                     ← cómo las rutas identifican al usuario (acepta Bearer)
lib/terminos.ts, components/NombrePerfilGuard.tsx
lib/ia-consentimiento.ts, components/ConsentimientoIA.tsx
lib/push.ts, public/sw.js           ← notificaciones
lib/racha.ts                        ← racha de práctica
messages/es.json, messages/en.json  ← textos
app/globals.css                     ← colores y tokens de diseño
supabase/migrations/                ← esquema y políticas RLS
```
