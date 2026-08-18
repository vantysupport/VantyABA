// app/privacidad/page.tsx
// Política de Privacidad completa de la plataforma Vanty · Centro SANTI.
// Bilingüe (ES/EN) — el idioma se toma de la cookie `vanty_locale` que setea el middleware.
// Diseñada para verse profesional en modo claro y modo oscuro.

import { cookies } from 'next/headers'

export const metadata = {
  title: 'Política de Privacidad · Vanty',
  description: 'Cómo Vanty protege los datos clínicos de las familias del Centro SANTI.',
}

type Section = { id: string; title: string; body: React.ReactNode }

const SECTIONS_ES: Section[] = [
  {
    id: 'identidad',
    title: '1. Quiénes somos',
    body: (
      <>
        <p>
          <strong>Neuropsicología y Terapias SANTI</strong> es un centro especializado en intervención
          infantil ABA, TEA y TDAH ubicado en Av. Brasil 2730, Pueblo Libre 15084, Lima — Perú.
        </p>
        <p>
          Operamos la plataforma digital <strong>Vanty</strong> para la gestión clínica y la comunicación
          con familias. Esta política describe cómo recopilamos, usamos y protegemos los datos personales
          y clínicos confiados a nuestro cargo.
        </p>
      </>
    ),
  },
  {
    id: 'datos',
    title: '2. Qué información recopilamos',
    body: (
      <>
        <p>Recopilamos únicamente la información necesaria para brindar nuestros servicios:</p>
        <ul>
          <li><strong>Datos de cuenta:</strong> nombre completo, correo electrónico, número de teléfono, foto de perfil opcional.</li>
          <li><strong>Datos del paciente:</strong> nombre, fecha de nacimiento, diagnóstico clínico, historial de sesiones, programas ABA y progreso terapéutico.</li>
          <li><strong>Datos de uso:</strong> registros de sesiones ABA, formularios clínicos, evaluaciones, reportes generados y respuestas al chequeo mensual de bienestar.</li>
          <li><strong>Datos de Google / Microsoft (opcionales):</strong> nombre, correo y foto de perfil si elegís iniciar sesión con esos proveedores. No accedemos a Gmail, Drive ni Outlook salvo Calendar — y solo con tu autorización explícita.</li>
          <li><strong>Datos técnicos:</strong> direcciones IP y registros de acceso, conservados de forma limitada por motivos de seguridad.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'uso',
    title: '3. Cómo usamos la información',
    body: (
      <>
        <ul>
          <li>Gestionar el historial clínico y el seguimiento terapéutico del paciente.</li>
          <li>Generar reportes de progreso para familias y profesionales.</li>
          <li>Enviar notificaciones de citas, recordatorios y comunicados del centro.</li>
          <li>Permitir la comunicación segura entre la familia y el equipo clínico.</li>
          <li>Mejorar la calidad de los servicios clínicos y de la plataforma Vanty.</li>
        </ul>
        <p><em>Nunca utilizamos los datos clínicos con fines publicitarios ni los vendemos a terceros.</em></p>
      </>
    ),
  },
  {
    id: 'compartir',
    title: '4. Con quién compartimos la información',
    body: (
      <>
        <p>La información puede ser compartida únicamente con:</p>
        <ul>
          <li>El equipo clínico de Neuropsicología y Terapias SANTI directamente involucrado en la atención del paciente.</li>
          <li>Proveedores de infraestructura tecnológica (Supabase para base de datos, Vercel para alojamiento) bajo estrictas políticas de confidencialidad.</li>
          <li>Proveedores de inteligencia artificial (Anthropic, Groq) procesando consultas puntuales del Asistente ARIA. Los datos enviados se descartan tras generar la respuesta y no se usan para entrenar modelos.</li>
          <li>Autoridades sanitarias o judiciales, exclusivamente cuando la ley lo exija expresamente.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'seguridad',
    title: '5. Seguridad de los datos',
    body: (
      <>
        <p>Aplicamos múltiples capas de protección:</p>
        <ul>
          <li><strong>Cifrado AES-256</strong> de los datos en reposo (estándar bancario).</li>
          <li><strong>TLS 1.3</strong> en toda comunicación entre tu dispositivo y nuestros servidores.</li>
          <li><strong>Row Level Security (RLS)</strong> aplicada en cada tabla de la base de datos — cada cuenta solo puede acceder a los datos que le corresponden.</li>
          <li>Acceso del personal segmentado por <strong>roles</strong> (jefe, admin, especialista, terapeuta, secretaría, padre).</li>
          <li>Backups automáticos cifrados con redundancia geográfica.</li>
          <li>Auditoría de accesos a información sensible.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'ia',
    title: '6. Uso de Inteligencia Artificial (ARIA)',
    body: (
      <>
        <p>
          ARIA es nuestra asistente clínica basada en modelos de lenguaje. Su funcionamiento respeta los siguientes principios:
        </p>
        <ul>
          <li>Las consultas se procesan de forma contextual y se envía solo la información mínima necesaria.</li>
          <li>Los datos clínicos <strong>no se utilizan para entrenar modelos públicos</strong>.</li>
          <li>Cuando es técnicamente posible, los datos se anonimizan antes del procesamiento.</li>
          <li>Los reportes de análisis se generan a partir de tus datos pero los borradores temporales se descartan.</li>
          <li>El procesamiento por IA nunca reemplaza el criterio clínico del terapeuta.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'derechos',
    title: '7. Tus derechos (Ley 29733 · Perú)',
    body: (
      <>
        <p>Conforme a la Ley peruana de Protección de Datos Personales, tenés derecho a:</p>
        <ul>
          <li><strong>Acceso:</strong> solicitar una copia de los datos personales que conservamos.</li>
          <li><strong>Rectificación:</strong> corregir datos inexactos o desactualizados.</li>
          <li><strong>Eliminación:</strong> solicitar la baja de tu cuenta y de los datos asociados (sujeto a normativas de retención clínica).</li>
          <li><strong>Portabilidad:</strong> exportar tu información en un formato abierto y estructurado.</li>
          <li><strong>Oposición:</strong> limitar usos específicos de tus datos.</li>
          <li><strong>Información:</strong> conocer qué datos tenemos, con qué finalidad y por cuánto tiempo.</li>
        </ul>
        <p>
          Para ejercer cualquiera de estos derechos, escribinos a{' '}
          <a href="mailto:aprendizaje.santi@gmail.com" className="vanty-link">aprendizaje.santi@gmail.com</a>.
          Respondemos en un plazo máximo de 10 días hábiles.
        </p>
      </>
    ),
  },
  {
    id: 'google',
    title: '8. Inicio de sesión con Google / Microsoft',
    body: (
      <>
        <p>
          Si iniciás sesión con Google o Microsoft, utilizamos únicamente tu nombre, correo electrónico y foto de perfil
          para crear y gestionar tu cuenta. No accedemos a Gmail, Drive, OneDrive ni a ningún otro servicio sin tu
          consentimiento explícito.
        </p>
        <p>
          Si autorizás la sincronización con Google Calendar o Outlook Calendar, accedemos solo a la creación y
          actualización de eventos relacionados con tus citas en SANTI. Podés revocar este permiso en cualquier momento
          desde "Mi Perfil → Calendarios vinculados".
        </p>
      </>
    ),
  },
  {
    id: 'retencion',
    title: '9. Retención de datos',
    body: (
      <>
        <p>
          Los datos clínicos se conservan durante el período activo de atención y hasta <strong>5 años después</strong>{' '}
          del último servicio, conforme a las normativas peruanas de registros clínicos. Podés solicitar la eliminación
          anticipada en cualquier momento; en ese caso, conservaremos únicamente los registros mínimos requeridos
          por ley.
        </p>
      </>
    ),
  },
  {
    id: 'menores',
    title: '10. Protección especial de menores',
    body: (
      <>
        <p>
          Vanty está diseñada para gestionar datos de menores con el consentimiento expreso del padre, madre o tutor
          legal. Los datos del menor son tratados con el más alto nivel de confidencialidad:
        </p>
        <ul>
          <li>Solo el padre/tutor titular y los profesionales asignados al caso tienen acceso.</li>
          <li>No se utilizan los datos del menor para crear perfiles publicitarios ni de marketing.</li>
          <li>El padre/tutor puede revocar el acceso, descargar el expediente o solicitar la eliminación en cualquier momento.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'cambios',
    title: '11. Cambios en esta política',
    body: (
      <>
        <p>
          Podemos actualizar esta política para reflejar mejoras en nuestros servicios o cambios normativos.
          Notificaremos cualquier cambio relevante por correo electrónico y mediante un aviso destacado dentro de la
          plataforma. La fecha de última actualización siempre aparece al inicio de este documento.
        </p>
      </>
    ),
  },
  {
    id: 'contacto',
    title: '12. Contacto',
    body: (
      <>
        <p>Para cualquier consulta sobre esta política o sobre tus datos personales:</p>
        <p style={{ marginTop: 8 }}>
          <strong>Neuropsicología y Terapias SANTI</strong><br/>
          Av. Brasil 2730, Pueblo Libre 15084 — Lima, Perú<br/>
          📧 <a href="mailto:aprendizaje.santi@gmail.com" className="vanty-link">aprendizaje.santi@gmail.com</a><br/>
          📱 <a href="tel:+51991070734" className="vanty-link">+51 991 070 734</a>
        </p>
      </>
    ),
  },
]

const SECTIONS_EN: Section[] = [
  {
    id: 'identidad',
    title: '1. Who we are',
    body: (
      <>
        <p>
          <strong>Neuropsicología y Terapias SANTI</strong> is a center specialized in ABA, ASD and ADHD
          childhood intervention located at Av. Brasil 2730, Pueblo Libre 15084, Lima — Peru.
        </p>
        <p>
          We operate the digital platform <strong>Vanty</strong> for clinical management and communication
          with families. This policy describes how we collect, use and protect the personal and clinical
          data entrusted to us.
        </p>
      </>
    ),
  },
  {
    id: 'datos',
    title: '2. What information we collect',
    body: (
      <>
        <p>We collect only the information necessary to provide our services:</p>
        <ul>
          <li><strong>Account data:</strong> full name, email address, phone number, optional profile photo.</li>
          <li><strong>Patient data:</strong> name, date of birth, clinical diagnosis, session history, ABA programs and therapeutic progress.</li>
          <li><strong>Usage data:</strong> ABA session records, clinical forms, evaluations, generated reports and responses to the monthly wellbeing check-in.</li>
          <li><strong>Google / Microsoft data (optional):</strong> name, email and profile photo if you choose to sign in with those providers. We do not access Gmail, Drive or Outlook except Calendar — and only with your explicit authorization.</li>
          <li><strong>Technical data:</strong> IP addresses and access logs, retained on a limited basis for security reasons.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'uso',
    title: '3. How we use the information',
    body: (
      <>
        <ul>
          <li>Manage the patient's clinical history and therapeutic follow-up.</li>
          <li>Generate progress reports for families and professionals.</li>
          <li>Send appointment notifications, reminders and center announcements.</li>
          <li>Enable secure communication between the family and the clinical team.</li>
          <li>Improve the quality of clinical services and the Vanty platform.</li>
        </ul>
        <p><em>We never use clinical data for advertising purposes, nor do we sell it to third parties.</em></p>
      </>
    ),
  },
  {
    id: 'compartir',
    title: '4. Who we share the information with',
    body: (
      <>
        <p>Information may be shared only with:</p>
        <ul>
          <li>The clinical team of Neuropsicología y Terapias SANTI directly involved in the patient's care.</li>
          <li>Technology infrastructure providers (Supabase for the database, Vercel for hosting) under strict confidentiality policies.</li>
          <li>Artificial intelligence providers (Anthropic, Groq) processing specific queries from the ARIA Assistant. The data sent is discarded after generating the response and is not used to train models.</li>
          <li>Health or judicial authorities, exclusively when the law expressly requires it.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'seguridad',
    title: '5. Data security',
    body: (
      <>
        <p>We apply multiple layers of protection:</p>
        <ul>
          <li><strong>AES-256 encryption</strong> of data at rest (banking standard).</li>
          <li><strong>TLS 1.3</strong> on all communication between your device and our servers.</li>
          <li><strong>Row Level Security (RLS)</strong> applied to every table in the database — each account can only access the data that belongs to it.</li>
          <li>Staff access segmented by <strong>roles</strong> (director, admin, specialist, therapist, secretary, parent).</li>
          <li>Automatic encrypted backups with geographic redundancy.</li>
          <li>Auditing of access to sensitive information.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'ia',
    title: '6. Use of Artificial Intelligence (ARIA)',
    body: (
      <>
        <p>
          ARIA is our clinical assistant based on language models. Its operation respects the following principles:
        </p>
        <ul>
          <li>Queries are processed contextually and only the minimum necessary information is sent.</li>
          <li>Clinical data <strong>is not used to train public models</strong>.</li>
          <li>When technically possible, data is anonymized before processing.</li>
          <li>Analysis reports are generated from your data, but temporary drafts are discarded.</li>
          <li>AI processing never replaces the therapist's clinical judgment.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'derechos',
    title: '7. Your rights (Law 29733 · Peru)',
    body: (
      <>
        <p>Under the Peruvian Personal Data Protection Law, you have the right to:</p>
        <ul>
          <li><strong>Access:</strong> request a copy of the personal data we hold.</li>
          <li><strong>Rectification:</strong> correct inaccurate or outdated data.</li>
          <li><strong>Deletion:</strong> request the removal of your account and associated data (subject to clinical retention regulations).</li>
          <li><strong>Portability:</strong> export your information in an open, structured format.</li>
          <li><strong>Objection:</strong> limit specific uses of your data.</li>
          <li><strong>Information:</strong> know what data we hold, for what purpose and for how long.</li>
        </ul>
        <p>
          To exercise any of these rights, write to us at{' '}
          <a href="mailto:aprendizaje.santi@gmail.com" className="vanty-link">aprendizaje.santi@gmail.com</a>.
          We respond within a maximum of 10 business days.
        </p>
      </>
    ),
  },
  {
    id: 'google',
    title: '8. Sign in with Google / Microsoft',
    body: (
      <>
        <p>
          If you sign in with Google or Microsoft, we use only your name, email address and profile photo
          to create and manage your account. We do not access Gmail, Drive, OneDrive or any other service
          without your explicit consent.
        </p>
        <p>
          If you authorize synchronization with Google Calendar or Outlook Calendar, we access only the creation
          and update of events related to your SANTI appointments. You can revoke this permission at any time
          from "My Profile → Linked calendars".
        </p>
      </>
    ),
  },
  {
    id: 'retencion',
    title: '9. Data retention',
    body: (
      <>
        <p>
          Clinical data is retained during the active care period and for up to <strong>5 years after</strong>{' '}
          the last service, in accordance with Peruvian clinical records regulations. You may request early
          deletion at any time; in that case, we will keep only the minimum records required by law.
        </p>
      </>
    ),
  },
  {
    id: 'menores',
    title: '10. Special protection of minors',
    body: (
      <>
        <p>
          Vanty is designed to manage minors' data with the express consent of the parent or legal guardian.
          The minor's data is treated with the highest level of confidentiality:
        </p>
        <ul>
          <li>Only the holding parent/guardian and the professionals assigned to the case have access.</li>
          <li>The minor's data is not used to create advertising or marketing profiles.</li>
          <li>The parent/guardian may revoke access, download the record or request deletion at any time.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'cambios',
    title: '11. Changes to this policy',
    body: (
      <>
        <p>
          We may update this policy to reflect improvements in our services or regulatory changes.
          We will notify any relevant change by email and through a prominent notice within the platform.
          The date of the last update always appears at the top of this document.
        </p>
      </>
    ),
  },
  {
    id: 'contacto',
    title: '12. Contact',
    body: (
      <>
        <p>For any question about this policy or about your personal data:</p>
        <p style={{ marginTop: 8 }}>
          <strong>Neuropsicología y Terapias SANTI</strong><br/>
          Av. Brasil 2730, Pueblo Libre 15084 — Lima, Peru<br/>
          📧 <a href="mailto:aprendizaje.santi@gmail.com" className="vanty-link">aprendizaje.santi@gmail.com</a><br/>
          📱 <a href="tel:+51991070734" className="vanty-link">+51 991 070 734</a>
        </p>
      </>
    ),
  },
]

const UI = {
  es: {
    brand: 'Vanty · Neuropsicología y Terapias SANTI',
    title: 'Política de Privacidad',
    subtitle: 'Última actualización: abril 2025 · Pueblo Libre, Lima — Perú',
    tocAria: 'Índice de contenidos',
    toc: 'Índice',
    rights: 'Todos los derechos reservados',
    terms: 'Ver Términos de Servicio →',
  },
  en: {
    brand: 'Vanty · Neuropsicología y Terapias SANTI',
    title: 'Privacy Policy',
    subtitle: 'Last updated: April 2025 · Pueblo Libre, Lima — Peru',
    tocAria: 'Table of contents',
    toc: 'Contents',
    rights: 'All rights reserved',
    terms: 'View Terms of Service →',
  },
}

export default async function PrivacidadPage() {
  const cookieStore = await cookies()
  const locale = cookieStore.get('vanty_locale')?.value === 'en' ? 'en' : 'es'
  const SECTIONS = locale === 'en' ? SECTIONS_EN : SECTIONS_ES
  const ui = UI[locale]

  return (
    <div className="vanty-privacidad">
      {/* Estilos scoped — dark/light adaptativo + tipografía profesional */}
      <style>{`
        .vanty-privacidad {
          --vp-bg:        var(--background);
          --vp-card:      var(--card);
          --vp-surface:   var(--muted-bg);
          --vp-border:    var(--card-border);
          --vp-title:     var(--text-primary);
          --vp-body:      var(--text-secondary);
          --vp-muted:     var(--text-muted);
          --vp-accent:    #7c3aed;
          --vp-accent-2:  #db2777;

          min-height: 100vh;
          background: var(--vp-bg);
          color: var(--vp-body);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        .vanty-privacidad .vp-container {
          max-width: 780px;
          margin: 0 auto;
          padding: 32px 20px 64px;
        }

        .vanty-privacidad .vp-hero {
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 55%, #db2777 100%);
          border-radius: 24px;
          padding: 32px 28px;
          color: #fff;
          margin-bottom: 24px;
          box-shadow: 0 10px 30px rgba(124,58,237,0.20);
          position: relative;
          overflow: hidden;
        }
        .vanty-privacidad .vp-hero::before {
          content: '';
          position: absolute;
          top: -50px; right: -50px;
          width: 200px; height: 200px;
          background: rgba(255,255,255,0.10);
          border-radius: 50%;
        }
        .vanty-privacidad .vp-hero::after {
          content: '';
          position: absolute;
          bottom: -40px; left: 40px;
          width: 130px; height: 130px;
          background: rgba(255,255,255,0.07);
          border-radius: 50%;
        }
        .vanty-privacidad .vp-brand {
          display: flex; align-items: center; gap: 10px;
          font-weight: 800; font-size: 14px;
          opacity: 0.95;
          margin-bottom: 14px;
          position: relative; z-index: 1;
        }
        .vanty-privacidad .vp-brand-icon {
          width: 32px; height: 32px;
          background: rgba(255,255,255,0.20);
          backdrop-filter: blur(6px);
          border-radius: 9px;
          display: inline-flex;
          align-items: center; justify-content: center;
          font-size: 16px;
        }
        .vanty-privacidad .vp-title {
          font-size: 30px; font-weight: 900;
          line-height: 1.1; letter-spacing: -0.5px;
          margin: 0 0 6px;
          position: relative; z-index: 1;
        }
        .vanty-privacidad .vp-subtitle {
          font-size: 13px;
          opacity: 0.85;
          margin: 0;
          position: relative; z-index: 1;
        }
        .vanty-privacidad .vp-badges {
          display: flex; flex-wrap: wrap; gap: 6px;
          margin-top: 16px;
          position: relative; z-index: 1;
        }
        .vanty-privacidad .vp-badge {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 10px; font-weight: 700;
          padding: 4px 10px;
          background: rgba(255,255,255,0.18);
          backdrop-filter: blur(4px);
          border-radius: 999px;
          letter-spacing: 0.3px;
        }

        .vanty-privacidad .vp-toc {
          background: var(--vp-card);
          border: 1px solid var(--vp-border);
          border-radius: 16px;
          padding: 18px 22px;
          margin-bottom: 28px;
        }
        .vanty-privacidad .vp-toc-title {
          font-size: 11px; font-weight: 800;
          color: var(--vp-muted);
          text-transform: uppercase; letter-spacing: 1px;
          margin: 0 0 10px;
        }
        .vanty-privacidad .vp-toc-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 4px 18px;
          list-style: none;
          padding: 0; margin: 0;
        }
        .vanty-privacidad .vp-toc-list a {
          display: block;
          color: var(--vp-body);
          text-decoration: none;
          font-size: 13px;
          padding: 6px 0;
          font-weight: 500;
          transition: color .15s;
        }
        .vanty-privacidad .vp-toc-list a:hover {
          color: var(--vp-accent);
        }

        .vanty-privacidad section.vp-section {
          background: var(--vp-card);
          border: 1px solid var(--vp-border);
          border-radius: 16px;
          padding: 22px 24px;
          margin-bottom: 14px;
        }
        .vanty-privacidad section.vp-section h2 {
          font-size: 17px; font-weight: 800;
          color: var(--vp-title);
          margin: 0 0 10px;
          letter-spacing: -0.2px;
        }
        .vanty-privacidad section.vp-section p {
          font-size: 14px; line-height: 1.65;
          color: var(--vp-body);
          margin: 0 0 10px;
        }
        .vanty-privacidad section.vp-section p:last-child { margin-bottom: 0; }
        .vanty-privacidad section.vp-section ul {
          padding-left: 18px;
          margin: 6px 0 10px;
          color: var(--vp-body);
        }
        .vanty-privacidad section.vp-section li {
          font-size: 14px; line-height: 1.6;
          padding: 3px 0;
        }
        .vanty-privacidad section.vp-section strong {
          color: var(--vp-title);
        }
        .vanty-privacidad section.vp-section em {
          color: var(--vp-muted);
          font-style: italic;
        }
        .vanty-privacidad .vanty-link {
          color: var(--vp-accent);
          text-decoration: none;
          font-weight: 600;
          border-bottom: 1px dashed var(--vp-accent);
        }
        .vanty-privacidad .vanty-link:hover {
          border-bottom-style: solid;
        }

        .vanty-privacidad .vp-footer {
          margin-top: 32px;
          padding-top: 22px;
          border-top: 1px solid var(--vp-border);
          display: flex; justify-content: space-between; align-items: center;
          flex-wrap: wrap; gap: 12px;
        }
        .vanty-privacidad .vp-footer p {
          font-size: 12px; color: var(--vp-muted);
          margin: 0;
        }
        .vanty-privacidad .vp-footer a {
          font-size: 12px;
          color: var(--vp-accent);
          font-weight: 700;
          text-decoration: none;
        }
        .vanty-privacidad .vp-footer a:hover { text-decoration: underline; }

        @media (max-width: 600px) {
          .vanty-privacidad .vp-title { font-size: 24px; }
          .vanty-privacidad .vp-hero { padding: 26px 22px; border-radius: 20px; }
          .vanty-privacidad section.vp-section { padding: 18px 20px; }
        }
      `}</style>

      <div className="vp-container">
        {/* Hero */}
        <div className="vp-hero">
          <div className="vp-brand">
            <span className="vp-brand-icon">🧩</span>
            <span>{ui.brand}</span>
          </div>
          <h1 className="vp-title">{ui.title}</h1>
          <p className="vp-subtitle">{ui.subtitle}</p>
          <div className="vp-badges">
            <span className="vp-badge">🔑 AES-256</span>
            <span className="vp-badge">⚙️ TLS 1.3</span>
            <span className="vp-badge">🗄️ Row Level Security</span>
            <span className="vp-badge">✓ Ley 29733 (PE)</span>
          </div>
        </div>

        {/* Tabla de contenidos */}
        <nav className="vp-toc" aria-label={ui.tocAria}>
          <p className="vp-toc-title">{ui.toc}</p>
          <ul className="vp-toc-list">
            {SECTIONS.map(s => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Secciones */}
        {SECTIONS.map(s => (
          <section key={s.id} id={s.id} className="vp-section">
            <h2>{s.title}</h2>
            {s.body}
          </section>
        ))}

        {/* Footer */}
        <div className="vp-footer">
          <p>© {new Date().getFullYear()} Neuropsicología y Terapias SANTI · {ui.rights}</p>
          <a href="/terminos">{ui.terms}</a>
        </div>
      </div>
    </div>
  )
}
