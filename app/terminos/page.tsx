// app/terminos/page.tsx
// Términos de Servicio · Bilingüe (ES/EN) — idioma desde la cookie `vanty_locale`.
import { cookies } from 'next/headers'

type Sec = { h: string; body: React.ReactNode }

const H2 = { fontSize: 18, fontWeight: 700, color: '#1e1b4b', marginBottom: 8 } as const

const CONTENT = {
  es: {
    title: 'Términos de Servicio',
    updated: 'Última actualización: abril 2025 · Pueblo Libre, Lima',
    rights: 'Todos los derechos reservados',
    link: 'Ver Política de Privacidad →',
    sections: [
      { h: '1. Aceptación de los términos', body: <p>Al crear una cuenta y usar la plataforma SANTI de Neuropsicología y Terapias SANTI, aceptás estos Términos de Servicio. Si no estás de acuerdo, por favor no uses la plataforma.</p> },
      { h: '2. Descripción del servicio', body: <p>SANTI es una plataforma digital de gestión clínica para el centro Neuropsicología y Terapias SANTI. Permite a los profesionales registrar y hacer seguimiento de programas ABA, y a las familias consultar el progreso de sus hijos, coordinar citas y comunicarse con el equipo terapéutico.</p> },
      { h: '3. Uso permitido', body: (
        <>
          <p>La plataforma es de uso exclusivo para:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li>Familias y pacientes activos del centro Neuropsicología y Terapias SANTI.</li>
            <li>Profesionales y terapeutas del equipo clínico.</li>
            <li>Personal administrativo autorizado.</li>
          </ul>
          <p style={{ marginTop: 8 }}>Queda prohibido compartir credenciales de acceso, usar la plataforma para fines distintos a la gestión clínica, o intentar acceder a información de otros usuarios.</p>
        </>
      ) },
      { h: '4. Naturaleza clínica del servicio', body: <p>La inteligencia artificial integrada en SANTI (ARIA) es una herramienta de apoyo clínico. Sus análisis y sugerencias son de carácter orientativo y <strong>no reemplazan el criterio del terapeuta certificado</strong>. Todas las decisiones clínicas son responsabilidad exclusiva del profesional a cargo.</p> },
      { h: '5. Confidencialidad', body: <p>Toda la información clínica es estrictamente confidencial. Los usuarios se comprometen a no divulgar datos de otros pacientes ni del equipo clínico obtenidos a través de la plataforma.</p> },
      { h: '6. Cuentas de usuario', body: <p>Sos responsable de mantener la seguridad de tu contraseña y de todas las actividades realizadas desde tu cuenta. Si detectás acceso no autorizado, notificanos de inmediato a aprendizaje.santi@gmail.com.</p> },
      { h: '7. Disponibilidad del servicio', body: <p>Nos esforzamos por mantener la plataforma disponible las 24 horas. Sin embargo, pueden ocurrir interrupciones por mantenimiento o causas técnicas. No nos hacemos responsables por pérdidas derivadas de la inactividad del servicio.</p> },
      { h: '8. Modificaciones', body: <p>Nos reservamos el derecho de modificar estos términos. Los cambios significativos serán notificados por correo electrónico con al menos 15 días de anticipación.</p> },
      { h: '9. Contacto', body: <p><strong>Neuropsicología y Terapias SANTI</strong><br/>Av. Brasil 2730, Pueblo Libre 15084<br/>📧 aprendizaje.santi@gmail.com<br/>📱 991 070 734</p> },
    ] as Sec[],
  },
  en: {
    title: 'Terms of Service',
    updated: 'Last updated: April 2025 · Pueblo Libre, Lima',
    rights: 'All rights reserved',
    link: 'View Privacy Policy →',
    sections: [
      { h: '1. Acceptance of the terms', body: <p>By creating an account and using the SANTI platform of Neuropsicología y Terapias SANTI, you accept these Terms of Service. If you do not agree, please do not use the platform.</p> },
      { h: '2. Description of the service', body: <p>SANTI is a digital clinical-management platform for the Neuropsicología y Terapias SANTI center. It allows professionals to record and track ABA programs, and families to review their children's progress, coordinate appointments and communicate with the therapeutic team.</p> },
      { h: '3. Permitted use', body: (
        <>
          <p>The platform is for the exclusive use of:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li>Active families and patients of the Neuropsicología y Terapias SANTI center.</li>
            <li>Professionals and therapists of the clinical team.</li>
            <li>Authorized administrative staff.</li>
          </ul>
          <p style={{ marginTop: 8 }}>It is prohibited to share access credentials, use the platform for purposes other than clinical management, or attempt to access other users' information.</p>
        </>
      ) },
      { h: '4. Clinical nature of the service', body: <p>The artificial intelligence integrated into SANTI (ARIA) is a clinical support tool. Its analyses and suggestions are advisory in nature and <strong>do not replace the judgment of the certified therapist</strong>. All clinical decisions are the exclusive responsibility of the professional in charge.</p> },
      { h: '5. Confidentiality', body: <p>All clinical information is strictly confidential. Users agree not to disclose data of other patients or of the clinical team obtained through the platform.</p> },
      { h: '6. User accounts', body: <p>You are responsible for keeping your password secure and for all activities carried out from your account. If you detect unauthorized access, notify us immediately at aprendizaje.santi@gmail.com.</p> },
      { h: '7. Service availability', body: <p>We strive to keep the platform available 24 hours a day. However, interruptions may occur due to maintenance or technical causes. We are not responsible for losses arising from service downtime.</p> },
      { h: '8. Modifications', body: <p>We reserve the right to modify these terms. Significant changes will be notified by email at least 15 days in advance.</p> },
      { h: '9. Contact', body: <p><strong>Neuropsicología y Terapias SANTI</strong><br/>Av. Brasil 2730, Pueblo Libre 15084<br/>📧 aprendizaje.santi@gmail.com<br/>📱 991 070 734</p> },
    ] as Sec[],
  },
}

export default async function TerminosPage() {
  const cookieStore = await cookies()
  const locale = cookieStore.get('vanty_locale')?.value === 'en' ? 'en' : 'es'
  const c = CONTENT[locale]

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '0 auto', padding: '48px 24px', color: '#1f2937', lineHeight: 1.7 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
        <div style={{ width: 36, height: 36, background: '#4f46e5', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#fff', fontSize: 18 }}>🧩</span>
        </div>
        <span style={{ fontWeight: 800, fontSize: 18, color: '#1e1b4b' }}>Neuropsicología y Terapias SANTI</span>
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1e1b4b', marginBottom: 8 }}>{c.title}</h1>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 40 }}>{c.updated}</p>

      {c.sections.map((s, i) => (
        <section key={i} style={{ marginBottom: i === c.sections.length - 1 ? 48 : 32 }}>
          <h2 style={H2}>{s.h}</h2>
          {s.body}
        </section>
      ))}

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <p style={{ fontSize: 12, color: '#9ca3af' }}>© 2025 Neuropsicología y Terapias SANTI · {c.rights}</p>
        <a href="/privacidad" style={{ fontSize: 12, color: '#4f46e5', textDecoration: 'none', fontWeight: 600 }}>{c.link}</a>
      </div>
    </div>
  )
}
