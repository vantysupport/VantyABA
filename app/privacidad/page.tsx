// app/privacidad/page.tsx
// Política de Privacidad de la plataforma Vanty (nivel plataforma, multi-centro).
// Bilingüe (ES/EN): el idioma se toma de la cookie `vanty_locale` que fija el middleware.

import { cookies } from 'next/headers'
import LegalPage, { Lista, Destacado, type SeccionLegal } from '@/components/legal/LegalPage'
import {
  Building2, Database, Target, Scale, Share2, ShieldCheck, Sparkles, Baby, UserCheck, LogIn, Archive,
  RefreshCw, Mail, KeyRound, Lock, ServerCog, BadgeCheck, Ban,
} from 'lucide-react'
import { PLATFORM_NAME } from '@/lib/branding'
import { localeServidor, metadatosPagina } from '@/lib/seo'

export async function generateMetadata() {
  const en = (await localeServidor()) === 'en'
  return metadatosPagina(en
    ? { ruta: '/privacidad', en, title: `Privacy Policy · ${P}`, description: `How ${P} protects the personal and clinical data of the families served by the centers that use the platform.` }
    : { ruta: '/privacidad', en, title: `Política de Privacidad · ${P}`, description: `Cómo ${P} protege los datos personales y clínicos de las familias atendidas en los centros que usan la plataforma.` })
}

// Nombre comercial completo de la plataforma en los documentos legales
const P = `${PLATFORM_NAME} ABA`

function secciones(en: boolean): SeccionLegal[] {
  const L = (e: string, s: string) => (en ? e : s)
  return [
    {
      id: 'identidad', Icon: Building2, title: L('Who we are and scope', 'Quiénes somos y alcance'),
      body: <>
        <p>{L(`${P} is a clinical-management platform for child development and therapy centers (ABA, ASD, ADHD and related areas). It enables each center to manage its patients' clinical records and to communicate securely with families.`,
          `${P} es una plataforma de gestión clínica para centros de desarrollo infantil y terapia (ABA, TEA, TDAH y áreas afines). Permite a cada centro gestionar la información clínica de sus pacientes y comunicarse de forma segura con las familias.`)}</p>
        <p>{L(`Each center that uses ${P} acts as the data controller for the information of its patients and families. ${P} acts as the data processor: it processes that information on the center's behalf, following its instructions and solely to provide the service.`,
          `Cada centro que utiliza ${P} actúa como responsable del tratamiento de los datos de sus pacientes y familias. ${P} actúa como encargado del tratamiento: procesa dicha información por cuenta del centro, siguiendo sus instrucciones y únicamente para prestar el servicio.`)}</p>
      </>,
    },
    {
      id: 'datos', Icon: Database, title: L('Information we process', 'Información que tratamos'),
      body: <>
        <p>{L('We process only the information necessary to provide the service:', 'Tratamos únicamente la información necesaria para prestar el servicio:')}</p>
        <Lista items={[
          [L('Account data:', 'Datos de cuenta:'), L('full name, email address, phone number and, optionally, a profile photo.', 'nombre completo, correo electrónico, teléfono y, de forma opcional, fotografía de perfil.')],
          [L('Patient data:', 'Datos del paciente:'), L('name, date of birth, diagnosis, assessments, therapy programs, session records and progress. This is sensitive health data and receives reinforced protection.', 'nombre, fecha de nacimiento, diagnóstico, evaluaciones, programas terapéuticos, registros de sesión y progreso. Se trata de datos sensibles de salud y reciben protección reforzada.')],
          [L('Content you share:', 'Contenido que compartes:'), L('forms, messages, audio, images and documents exchanged with the center.', 'formularios, mensajes, audios, imágenes y documentos intercambiados con el centro.')],
          [L('Technical data:', 'Datos técnicos:'), L('connection and access logs, kept for a limited time for security purposes.', 'registros de conexión y acceso, conservados por un tiempo limitado con fines de seguridad.')],
        ]} />
      </>,
    },
    {
      id: 'finalidades', Icon: Target, title: L('Purposes of processing', 'Finalidades del tratamiento'),
      body: <>
        <Lista items={[
          [L('Clinical care:', 'Atención clínica:'), L('managing the clinical record and therapeutic follow-up of the patient.', 'gestionar la historia clínica y el seguimiento terapéutico del paciente.')],
          [L('Reports:', 'Reportes:'), L('preparing progress reports for families and professionals.', 'elaborar informes de progreso para familias y profesionales.')],
          [L('Communication:', 'Comunicación:'), L('sending appointment notices, reminders and messages from the center.', 'enviar avisos de citas, recordatorios y comunicaciones del centro.')],
          [L('Security and continuity:', 'Seguridad y continuidad:'), L('protecting accounts, preventing misuse and keeping the service running.', 'proteger las cuentas, prevenir usos indebidos y mantener el servicio operativo.')],
        ]} />
        <Destacado>{L('Your data is never used for advertising, profiling for commercial purposes, or sold to third parties.', 'Tus datos nunca se utilizan con fines publicitarios, para elaborar perfiles comerciales ni se venden a terceros.')}</Destacado>
      </>,
    },
    {
      id: 'base-legal', Icon: Scale, title: L('Legal basis', 'Base legal'),
      body: <p>{L('Processing is based on the consent of the data subject or, in the case of minors, of their parent or legal guardian; on the performance of the health service requested from the center; and on compliance with the legal obligations applicable to clinical records.',
        'El tratamiento se basa en el consentimiento del titular o, tratándose de menores de edad, de su padre, madre o tutor legal; en la ejecución del servicio de salud solicitado al centro; y en el cumplimiento de las obligaciones legales aplicables a los registros clínicos.')}</p>,
    },
    {
      id: 'destinatarios', Icon: Share2, title: L('Recipients and service providers', 'Destinatarios y proveedores'),
      body: <>
        <p>{L('Information is only accessible to:', 'La información solo es accesible por:')}</p>
        <Lista items={[
          [L('The center\'s clinical team', 'El equipo clínico del centro'), L('directly involved in the patient\'s care, according to their role.', 'directamente involucrado en la atención del paciente, según su rol.')],
          [L('Technology providers', 'Proveedores tecnológicos'), L('that support the service (database, hosting and file storage) under confidentiality and security obligations.', 'que soportan el servicio (base de datos, alojamiento y almacenamiento de archivos), sujetos a obligaciones de confidencialidad y seguridad.')],
          [L('The artificial intelligence provider', 'El proveedor de inteligencia artificial'), L('that processes ARIA queries, receiving only the minimum context required for each response.', 'que procesa las consultas de ARIA, recibiendo solo el contexto mínimo necesario para cada respuesta.')],
          [L('Competent authorities,', 'Autoridades competentes,'), L('exclusively when required by law or court order.', 'exclusivamente cuando lo exija la ley o un mandato judicial.')],
        ]} />
        <p className="mt-3">{L('Some of these providers may host data outside Peru. In such cases, cross-border data flows are carried out with appropriate safeguards, in accordance with applicable regulations.', 'Algunos de estos proveedores pueden alojar datos fuera del Perú. En esos casos, el flujo transfronterizo se realiza con garantías adecuadas, conforme a la normativa aplicable.')}</p>
      </>,
    },
    {
      id: 'seguridad', Icon: ShieldCheck, title: L('Information security', 'Seguridad de la información'),
      body: <>
        <p>{L('We apply technical and organizational measures proportional to the sensitivity of the data:', 'Aplicamos medidas técnicas y organizativas proporcionales a la sensibilidad de los datos:')}</p>
        <Lista items={[
          [L('Encryption at rest', 'Cifrado en reposo'), L('with AES-256.', 'con AES-256.')],
          [L('Encryption in transit', 'Cifrado en tránsito'), L('through TLS connections on every communication.', 'mediante conexiones TLS en todas las comunicaciones.')],
          [L('Isolation by center:', 'Aislamiento por centro:'), L('row-level security policies (Row Level Security) ensure each center only accesses its own records.', 'políticas de seguridad a nivel de fila (Row Level Security) garantizan que cada centro acceda únicamente a sus propios registros.')],
          [L('Role-based access', 'Acceso por roles'), L('(director, administrator, specialist, therapist, secretary, family), following the principle of least privilege.', '(dirección, administración, especialista, terapeuta, secretaría, familia), bajo el principio de mínimo privilegio.')],
          [L('Optional two-step verification', 'Verificación en dos pasos opcional'), L('for every account.', 'para todas las cuentas.')],
        ]} />
      </>,
    },
    {
      id: 'ia', Icon: Sparkles, title: L('Responsible use of artificial intelligence', 'Uso responsable de la inteligencia artificial'),
      body: <>
        <p>{L('ARIA is the platform\'s assistant, based on language models. Its use follows these principles:', 'ARIA es el asistente de la plataforma, basado en modelos de lenguaje. Su uso se rige por los siguientes principios:')}</p>
        <Lista items={[
          [L('Data minimization:', 'Minimización:'), L('only the context strictly necessary for each query is sent.', 'se envía únicamente el contexto estrictamente necesario para cada consulta.')],
          [L('No training:', 'Sin entrenamiento:'), L('clinical information is not used to train artificial intelligence models.', 'la información clínica no se utiliza para entrenar modelos de inteligencia artificial.')],
          [L('Human oversight:', 'Supervisión humana:'), L('ARIA is a support tool; it does not issue diagnoses or replace the professional judgment of the therapy team.', 'ARIA es una herramienta de apoyo; no emite diagnósticos ni sustituye el criterio profesional del equipo terapéutico.')],
        ]} />
      </>,
    },
    {
      id: 'menores', Icon: Baby, title: L('Protection of minors', 'Protección de menores de edad'),
      body: <>
        <p>{L('Minors\' data is processed with the consent of their parent or legal guardian and with the highest level of confidentiality:', 'Los datos de menores de edad se tratan con el consentimiento de su padre, madre o tutor legal y con el más alto nivel de confidencialidad:')}</p>
        <Lista items={[
          [L('Restricted access:', 'Acceso restringido:'), L('only the responsible parent or guardian and the professionals assigned to the case.', 'solo el padre, madre o tutor responsable y los profesionales asignados al caso.')],
          [L('No commercial use:', 'Sin uso comercial:'), L('the minor\'s data is never used for advertising or marketing profiles.', 'los datos del menor nunca se utilizan para publicidad ni perfiles de marketing.')],
          [L('Control for the guardian:', 'Control del tutor:'), L('they may exercise the minor\'s rights at any time.', 'puede ejercer en cualquier momento los derechos del menor.')],
        ]} />
      </>,
    },
    {
      id: 'derechos', Icon: UserCheck, title: L('Your rights', 'Tus derechos'),
      body: <>
        <p>{L('Under Peru\'s Personal Data Protection Law (Law No. 29733) and its regulations, you may exercise free of charge the rights of:', 'Conforme a la Ley de Protección de Datos Personales (Ley N.º 29733) y su reglamento, puedes ejercer de forma gratuita los derechos de:')}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
          {[
            [L('Access', 'Acceso'), L('Know which data we process, for what purpose and for how long.', 'Conocer qué datos tratamos, con qué finalidad y por cuánto tiempo.')],
            [L('Rectification', 'Rectificación'), L('Correct data that is inaccurate, outdated or incomplete.', 'Corregir datos inexactos, desactualizados o incompletos.')],
            [L('Erasure', 'Cancelación'), L('Request deletion, subject to legal clinical-record retention obligations.', 'Solicitar su supresión, sujeta a las obligaciones legales de conservación clínica.')],
            [L('Objection', 'Oposición'), L('Object to processing for specific purposes.', 'Oponerte al tratamiento para finalidades concretas.')],
            [L('Information', 'Información'), L('Be informed about the conditions of processing.', 'Ser informado sobre las condiciones del tratamiento.')],
            [L('Portability', 'Portabilidad'), L('Receive a copy of your information in a structured format.', 'Recibir una copia de tu información en un formato estructurado.')],
          ].map(([t, d]) => (
            <div key={t} className="rounded-v-sm border border-v-border bg-v-bg p-3.5">
              <p className="text-sm font-semibold text-v-text">{t}</p>
              <p className="mt-0.5 text-[13px] leading-snug">{d}</p>
            </div>
          ))}
        </div>
        <p className="mt-4">{L('Requests are submitted to the center that provides your care, which is the data controller; the platform assists it in responding within the legal deadlines. If you consider your request was not properly addressed, you may file a claim with the National Authority for Personal Data Protection (Ministry of Justice and Human Rights of Peru).',
          'Las solicitudes se presentan ante el centro que te atiende, como responsable del tratamiento; la plataforma le presta el apoyo necesario para responder dentro de los plazos legales. Si consideras que tu solicitud no fue debidamente atendida, puedes presentar un reclamo ante la Autoridad Nacional de Protección de Datos Personales del Ministerio de Justicia y Derechos Humanos.')}</p>
      </>,
    },
    {
      id: 'terceros', Icon: LogIn, title: L('Google and Microsoft services', 'Servicios de Google y Microsoft'),
      body: <>
        <p>{L('If you sign in with Google or Microsoft, we only receive your name, email address and profile photo to create and manage your account. We do not access your email, files or other services.',
          'Si inicias sesión con Google o Microsoft, solo recibimos tu nombre, correo electrónico y fotografía de perfil para crear y gestionar tu cuenta. No accedemos a tu correo, archivos ni a otros servicios.')}</p>
        <p>{L('If you link Google Calendar or Outlook Calendar, access is limited to creating and updating the events of your appointments. You may revoke it at any time from My profile → Linked calendars.',
          'Si vinculas Google Calendar u Outlook Calendar, el acceso se limita a crear y actualizar los eventos de tus citas. Puedes revocarlo en cualquier momento desde Mi perfil → Calendarios vinculados.')}</p>
      </>,
    },
    {
      id: 'conservacion', Icon: Archive, title: L('Data retention', 'Conservación de los datos'),
      body: <p>{L('Clinical information is kept while care is active and, afterwards, for the minimum period required by applicable health regulations on clinical records. Once that period ends, it is securely deleted or anonymized. Account data is deleted when the account is closed, except where the law requires otherwise.',
        'La información clínica se conserva mientras la atención esté activa y, posteriormente, durante el plazo mínimo que exige la normativa sanitaria aplicable a las historias clínicas. Vencido dicho plazo, se elimina o anonimiza de forma segura. Los datos de cuenta se eliminan al cerrarse la cuenta, salvo que la ley disponga lo contrario.')}</p>,
    },
    {
      id: 'cambios', Icon: RefreshCw, title: L('Changes to this policy', 'Cambios en esta política'),
      body: <p>{L('We may update this policy to reflect improvements to the service or regulatory changes. Relevant changes will be communicated through a notice within the platform, and the date of the last update will always appear at the top of this document.',
        'Podemos actualizar esta política para reflejar mejoras en el servicio o cambios normativos. Los cambios relevantes se comunicarán mediante un aviso dentro de la plataforma, y la fecha de la última actualización figurará siempre al inicio de este documento.')}</p>,
    },
    {
      id: 'contacto', Icon: Mail, title: L('Contact', 'Contacto'),
      body: <p>{L(`For questions about the processing of your data, contact the center that provides your care through the channels available in the platform. For matters related to the ${P} platform, you may write to us through the support section.`,
        `Para consultas sobre el tratamiento de tus datos, comunícate con el centro que te atiende a través de los canales disponibles en la plataforma. Para asuntos relacionados con la plataforma ${P}, puedes escribirnos desde la sección de soporte.`)}</p>,
    },
  ]
}

export default async function PrivacidadPage() {
  const en = (await cookies()).get('vanty_locale')?.value === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  return (
    <LegalPage
      en={en}
      EyebrowIcon={ShieldCheck}
      titleA={L('Privacy ', 'Política de ')}
      titleB={L('Policy', 'Privacidad')}
      intro={L(`At ${P} we understand that we handle especially sensitive information: the health data of children and their families. This policy explains, clearly and transparently, what information we process, why we do it and how we protect it.`,
        `En ${P} entendemos que gestionamos información especialmente sensible: los datos de salud de niñas, niños y sus familias. Esta política explica, de forma clara y transparente, qué información tratamos, para qué lo hacemos y cómo la protegemos.`)}
      sellos={[[KeyRound, L('AES-256 encryption', 'Cifrado AES-256')], [Lock, 'TLS'], [ServerCog, 'Row Level Security'], [BadgeCheck, L('Law No. 29733 (Peru)', 'Ley N.º 29733')]]}
      updated={L('Last updated: September 2026', 'Última actualización: septiembre de 2026')}
      resumen={{
        titulo: L('At a glance', 'En resumen'),
        items: [
          [Lock, L('Protected data', 'Datos protegidos'), L('Encrypted at rest and in transit, isolated by center.', 'Cifrados en reposo y en tránsito, aislados por centro.')],
          [Ban, L('We never sell your data', 'Nunca vendemos tus datos'), L('No advertising or commercial profiling.', 'Sin publicidad ni perfiles comerciales.')],
          [Sparkles, L('AI with limits', 'IA con límites'), L('Not used to train models; it does not diagnose.', 'No se usa para entrenar modelos ni diagnostica.')],
          [UserCheck, L('You stay in control', 'Tú tienes el control'), L('Access, rectify or delete your information.', 'Accede, corrige o elimina tu información.')],
        ],
      }}
      secciones={secciones(en)}
      otro={{ href: '/terminos', label: L('Terms of Service', 'Términos de servicio') }}
    />
  )
}
