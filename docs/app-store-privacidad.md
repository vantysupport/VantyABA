# Privacidad en App Store y Google Play

Guía para llenar la sección de privacidad cuando Vanty ABA se publique como app en iOS o Android.
Apple exige declarar también los datos que reciben los servicios de terceros integrados
(Supabase, Groq, DeepInfra, Gmail, Lemon Squeezy, calendarios).

## App Store Connect → App Privacy

**¿Recopilas datos de esta app?** Sí.
**¿Se usan para rastreo (tracking)?** No, en ningún tipo de dato. No hay publicidad, analítica de terceros ni SDKs de anuncios.

| Tipo de dato (Apple) | Qué es en Vanty | ¿Vinculado a la identidad? | Finalidad |
|---|---|---|---|
| Contact Info → Name | Nombre de la cuenta | Sí | App Functionality |
| Contact Info → Email Address | Correo de la cuenta | Sí | App Functionality |
| Contact Info → Phone Number | Teléfono / WhatsApp (opcional) | Sí | App Functionality |
| Health & Fitness → Health | Diagnóstico, evaluaciones, programas y registros de sesión del paciente | Sí | App Functionality |
| User Content → Photos or Videos | Foto de perfil, logo, imágenes compartidas | Sí | App Functionality |
| User Content → Audio Data | Audios enviados al centro | Sí | App Functionality |
| User Content → Other User Content | Mensajes, formularios, documentos y consultas a ARIA | Sí | App Functionality |
| Identifiers → User ID | Id interno de la cuenta | Sí | App Functionality |
| Diagnostics → Other Diagnostic Data | Registros de errores y de acceso (seguridad) | Sí | App Functionality |
| Financial Info → Other Financial Info | Pagos que registra el centro (montos, conceptos) | Sí | App Functionality |

No declarar: Location, Contacts, Browsing History, Search History, Sensitive Info (fuera de salud), Usage Data de analítica,
Purchases (el cobro de la suscripción lo hace Lemon Squeezy en la web, fuera de la app).

**Privacy Policy URL:** https://vanty.xyz/privacidad

## Reglas de Apple que ya cumple Vanty

- **5.1.2(i) — datos personales enviados a IA de terceros.** La app debe decir con quién comparte los datos y pedir permiso
  explícito antes. Vanty muestra la ventana de consentimiento (proveedores Groq, Inc. y DeepInfra, Inc. como respaldo, EE. UU.) y no envía nada sin él:
  la dirección lo autoriza para el centro y cada familia para ARIA. Se puede desactivar en Configuración → Centro y en el Perfil.
- **Política de privacidad accesible** dentro de la app y en la ficha de la tienda.
- **Sin tracking**, así que no hace falta el aviso de App Tracking Transparency.

## Pendiente antes de publicar en las tiendas

- **Eliminar la cuenta desde la app (5.1.1(v)).** Apple exige que quien crea una cuenta pueda iniciar su eliminación dentro de la
  app. Hoy se pide por correo o al centro; hay que añadir un botón "Eliminar mi cuenta" en el perfil.
- **Cuenta de prueba para la revisión** (App Review Information), con datos ficticios, como la que se usó para Google.
- **Google Play → Data safety:** mismos datos que la tabla de arriba; marcar "Los datos se cifran en tránsito" y
  "Los usuarios pueden solicitar que se borren sus datos".
