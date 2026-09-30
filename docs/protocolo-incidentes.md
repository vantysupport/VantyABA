# Protocolo interno de incidentes de seguridad · Vanty

Documento interno. Aplica a cualquier incidente que afecte datos personales tratados por Vanty, tanto los de sus
propios bancos (usuarios, clientes, reclamos) como la información clínica que trata por cuenta de los centros.

Base legal: Ley N.º 29733 y su Reglamento (D.S. 016-2024-JUS, art. 36).
- Como **encargado** (datos de los centros), Vanty debe informar **de forma inmediata** al centro responsable.
- El **centro** (responsable) debe notificar a la ANPD **dentro de 48 horas** desde que conoce el incidente
  cuando involucra datos sensibles, gran volumen, muchas personas o puede afectar derechos y libertades.
- Para sus propios bancos, **Vanty es el responsable** y le aplica directamente ese plazo de 48 horas.

## Metas internas (más estrictas que la ley)

| Momento | Meta |
|---|---|
| Detección → escalamiento interno | **Menos de 4 horas** |
| Escalamiento → primer aviso a cada centro afectado | En cuanto haya información suficiente para decir qué pasó y a quién afecta. **No esperar a terminar la investigación.** |
| Seguimiento al centro | Cada 24 horas mientras el incidente siga abierto, o cuando haya información nueva |
| Incidente en bancos propios de Vanty (usuarios, clientes, reclamos) | Si corresponde, notificar a la ANPD **dentro de 48 horas** desde que se conoció |

Objetivo: que el centro conserve margen dentro de sus 48 horas si tiene que reportar a la ANPD.

## Qué cuenta como incidente
- Acceso no autorizado a cuentas o datos (credenciales filtradas, cuenta comprometida, error de permisos entre centros).
- Datos enviados a quien no correspondía (correo o informe a la familia equivocada, archivo público por error).
- Pérdida o borrado no intencional de datos.
- Filtración o compromiso de claves: Supabase, Groq, DeepInfra, Tavily, Lemon Squeezy, Gmail o Vercel.
- Incidente comunicado por un subencargado (Supabase, Vercel, Groq, etc.).

## Pasos
1. **Contener (de inmediato).** Cambiar claves comprometidas, cerrar sesiones y desactivar cuentas afectadas, retirar
   archivos públicos, y bloquear la función afectada si hace falta (por ejemplo, desactivar la IA de un centro).
2. **Evaluar (dentro de las 4 horas).** Qué pasó, desde cuándo, qué datos (¿sensibles?, ¿de menores?), qué
   centros y cuántas personas. Revisar el registro de auditoría (`audit_log`) y los registros de Supabase y Vercel.
3. **Avisar a cada centro afectado.** Por correo a la cuenta que creó el centro, usando la plantilla de abajo.
4. **Colaborar.** Dar al centro la información que necesite para su reporte a la ANPD y a las familias.
5. **Corregir.** Arreglar la causa y verificar que no se repita.
6. **Registrar.** Completar la ficha del registro interno, incluso si el incidente resultó menor.

## Plantilla de aviso al centro

> **Asunto:** Aviso de incidente de seguridad · Vanty ABA
>
> Estimado/a [nombre], como encargado del tratamiento de la información de [centro] le informamos que el
> [fecha y hora] tomamos conocimiento de un incidente de seguridad:
>
> - **Qué ocurrió:** [descripción breve]
> - **Datos y personas afectadas:** [categorías de datos; número aproximado de pacientes, familias o usuarios]
> - **Posibles consecuencias:** [...]
> - **Medidas adoptadas:** [...] · **Medidas propuestas:** [...]
>
> Seguimos investigando y le enviaremos información adicional en cuanto la tengamos. Si el incidente
> requiere comunicarlo a la ANPD, la normativa establece un plazo de 48 horas desde su conocimiento.
> Estamos a su disposición para lo que necesite. Contacto: vantysupport@gmail.com · 924 685 557.

## Registro interno de incidentes

Se completa una ficha por incidente y se conserva **como mínimo 2 años**. Se puede llevar en una hoja de cálculo
privada con estas columnas:

| Campo | Contenido |
|---|---|
| N.° | INC-AAAA-NNN |
| Detectado | Fecha y hora; quién lo detectó y cómo |
| Descripción | Qué pasó y cuál fue la causa |
| Datos afectados | Categorías (¿sensibles?, ¿menores?) y cantidad de registros |
| Titulares afectados | Número aproximado; centros afectados |
| Banco | Propio de Vanty (PN-2026-322/323/324) o de un centro (encargo) |
| Contención | Medidas y hora |
| Aviso a centros | A quién, fecha y hora |
| Aviso a la ANPD | Si correspondía (bancos propios): fecha y hora, o por qué no correspondía |
| Aviso a titulares | Si correspondía: fecha y medio |
| Corrección | Qué se cambió para que no se repita |
| Cierre | Fecha y responsable |

## Evidencias que conviene guardar
- Captura de **Groq → Data Controls** con el *ZDR global* activado, con la fecha. Respalda lo que dice la Política
  de privacidad. Repetirla cada vez que cambie la cuenta o el plan.
- Captura del plan de **Supabase** y de su política de respaldos (retención de copias). Respalda el plazo de
  "no más de 30 días" del Acuerdo de Encargo.
- Las constancias de inscripción de los bancos de datos ante la ANPD.
