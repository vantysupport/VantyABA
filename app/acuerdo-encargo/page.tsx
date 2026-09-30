// app/acuerdo-encargo/page.tsx
// Acuerdo de Encargo de Tratamiento de Datos Personales (DPA) entre cada centro (responsable) y Vanty (encargado).
// Lo acepta la persona que crea el centro (casilla de /crear-centro) y la dirección desde el aviso de términos.
// Bilingüe (ES/EN): el idioma se toma de la cookie `vanty_locale`.

import { cookies } from 'next/headers'
import {
  Handshake, Database, Target, UserCheck, Server, ShieldCheck, Siren, Globe, Building2, Trash2,
  ClipboardCheck, FileSignature, Lock, Clock, Bell,
} from 'lucide-react'
import LegalPage, { Lista, Destacado, type SeccionLegal } from '@/components/legal/LegalPage'
import { localeServidor, metadatosPagina } from '@/lib/seo'
import { EMPRESA } from '@/lib/empresa'

const P = 'Vanty ABA'

export async function generateMetadata() {
  const en = (await localeServidor()) === 'en'
  return metadatosPagina(en
    ? { ruta: '/acuerdo-encargo', en, title: `Data Processing Agreement · ${P}`, description: `Agreement between each center (data controller) and ${P} (data processor) on the processing of clinical data.` }
    : { ruta: '/acuerdo-encargo', en, title: `Acuerdo de Encargo de Tratamiento · ${P}`, description: `Acuerdo entre cada centro (responsable) y ${P} (encargado) sobre el tratamiento de la información clínica.` })
}

function secciones(en: boolean): SeccionLegal[] {
  const L = (e: string, s: string) => (en ? e : s)
  const encargado = `${EMPRESA.titular}, RUC ${EMPRESA.ruc}, ${L('trade name', 'nombre comercial')} "${EMPRESA.nombreComercial}"${EMPRESA.direccion ? `, ${EMPRESA.direccion}` : ''}`
  return [
    {
      id: 'partes', Icon: Handshake, title: L('Parties and purpose', 'Partes y objeto'),
      body: <>
        <p>{L(`This agreement is entered into between the center that contracts ${P} (the "Center"), as data controller, and ${encargado} ("Vanty"), as data processor, under Peru's Personal Data Protection Law (Law No. 29733) and its regulations.`,
          `Este acuerdo se celebra entre el centro que contrata ${P} (el "Centro"), como responsable del tratamiento, y ${encargado} ("Vanty"), como encargado del tratamiento, conforme a la Ley N.º 29733, Ley de Protección de Datos Personales, y su reglamento.`)}</p>
        <p>{L('Its purpose is to regulate how Vanty processes, on behalf of the Center, the personal data that the Center and its users record in the platform. It complements the Terms of Service and the Privacy Policy; in case of conflict regarding the processing of the Center\'s data, this agreement prevails.',
          'Su objeto es regular cómo Vanty trata, por cuenta del Centro, los datos personales que el Centro y sus usuarios registran en la plataforma. Complementa los Términos de Servicio y la Política de Privacidad; en caso de contradicción sobre el tratamiento de los datos del Centro, prevalece este acuerdo.')}</p>
      </>,
    },
    {
      id: 'datos', Icon: Database, title: L('Data and data subjects', 'Datos y titulares'),
      body: <>
        <Lista items={[
          [L('Patients (including minors):', 'Pacientes (incluidos menores de edad):'), L('identification data, date of birth, diagnosis, assessments, therapy programs, session records, progress, clinical documents and reports. This is sensitive health data.', 'datos de identificación, fecha de nacimiento, diagnóstico, evaluaciones, programas terapéuticos, registros de sesión, progreso, documentos e informes clínicos. Son datos sensibles de salud.')],
          [L('Families and guardians:', 'Familias y tutores:'), L('name, contact details, relationship with the patient, messages and forms.', 'nombre, datos de contacto, parentesco con el paciente, mensajes y formularios.')],
          [L('Center staff:', 'Personal del centro:'), L('name, email, phone, role, specialty and activity in the platform.', 'nombre, correo, teléfono, rol, especialidad y actividad en la plataforma.')],
          [L('Administrative data:', 'Datos administrativos:'), L('appointments, payments and receipts recorded by the Center.', 'citas, pagos y recibos que registra el Centro.')],
        ]} />
      </>,
    },
    {
      id: 'instrucciones', Icon: Target, title: L('Purpose and instructions', 'Finalidad e instrucciones'),
      body: <>
        <p>{L('Vanty processes the data only to provide the platform to the Center (clinical management, scheduling, communication with families, reports and, if the Center turns them on, AI features) and following the Center\'s documented instructions, which are the use and configuration it makes of the platform.',
          'Vanty trata los datos únicamente para prestar la plataforma al Centro (gestión clínica, agenda, comunicación con familias, informes y, si el Centro las activa, funciones de IA) y siguiendo las instrucciones documentadas del Centro, que son el uso y la configuración que hace de la plataforma.')}</p>
        <Destacado>{L('Vanty does not use the Center\'s data for its own purposes, does not sell it, does not use it for advertising and does not use it to train artificial intelligence models.',
          'Vanty no usa los datos del Centro para fines propios, no los vende, no los usa con fines publicitarios ni para entrenar modelos de inteligencia artificial.')}</Destacado>
      </>,
    },
    {
      id: 'obligaciones', Icon: Lock, title: L('Obligations of Vanty', 'Obligaciones de Vanty'),
      body: <Lista items={[
        [L('Confidentiality:', 'Confidencialidad:'), L('only people bound by confidentiality access the data, and only when necessary to provide or support the service.', 'solo acceden a los datos personas obligadas a confidencialidad, y únicamente cuando es necesario para prestar o dar soporte al servicio.')],
        [L('Security:', 'Seguridad:'), L('apply the technical and organizational measures described in this agreement.', 'aplicar las medidas técnicas y organizativas descritas en este acuerdo.')],
        [L('Legality:', 'Legalidad:'), L('inform the Center if, in its opinion, an instruction infringes data protection law.', 'informar al Centro si, en su opinión, una instrucción infringe la normativa de protección de datos.')],
        [L('Records:', 'Registros:'), L('keep activity and audit logs of relevant actions on the platform.', 'mantener registros de actividad y auditoría de las acciones relevantes en la plataforma.')],
      ]} />,
    },
    {
      id: 'subencargados', Icon: Server, title: L('Sub-processors', 'Subencargados'),
      body: <>
        <p>{L('The Center authorizes Vanty to use the following sub-processors, which are bound by confidentiality and security obligations equivalent to those of this agreement:',
          'El Centro autoriza a Vanty a utilizar los siguientes subencargados, sujetos a obligaciones de confidencialidad y seguridad equivalentes a las de este acuerdo:')}</p>
        <Lista items={[
          ['Supabase Inc.', L('database, authentication and file storage (servers in São Paulo, Brazil).', 'base de datos, autenticación y almacenamiento de archivos (servidores en São Paulo, Brasil).')],
          ['Vercel Inc.', L('hosting of the application (United States).', 'alojamiento de la aplicación (Estados Unidos).')],
          ['Google LLC', L('email delivery; and Google Calendar, only if a user links it (United States).', 'envío de correos; y Google Calendar, solo si un usuario lo vincula (Estados Unidos).')],
          ['Microsoft Corporation', L('Outlook Calendar, only if a user links it (United States).', 'Outlook Calendar, solo si un usuario lo vincula (Estados Unidos).')],
          ['Groq, Inc. · DeepInfra, Inc.', L('artificial intelligence, only if the Center turns on AI features; DeepInfra only as a backup (United States).', 'inteligencia artificial, solo si el Centro activa las funciones de IA; DeepInfra solo como respaldo (Estados Unidos).')],
          ['Tavily · OpenAlex', L('internet and academic search for ARIA; they only receive the general question, without patient data (United States).', 'búsqueda en internet y académica para ARIA; solo reciben la pregunta general, sin datos de pacientes (Estados Unidos).')],
        ]} />
        <p className="mt-3">{L('As an additional contractual commitment of Vanty (not a period required by Law No. 29733), Vanty will inform the Center of any change of sub-processor through the platform or by email at least 15 days in advance. If the Center objects on reasonable grounds, it may terminate the service without penalty.',
          'Como compromiso contractual adicional de Vanty (no como un plazo exigido por la Ley N.º 29733), Vanty informará al Centro de cualquier cambio de subencargado a través de la plataforma o por correo con al menos 15 días de anticipación. Si el Centro se opone por motivos razonables, podrá terminar el servicio sin penalidad.')}</p>
      </>,
    },
    {
      id: 'transferencias', Icon: Globe, title: L('International transfers', 'Transferencias internacionales'),
      body: <p>{L('Because the sub-processors host or process data outside Peru, the Center authorizes these cross-border data flows, which are carried out with appropriate safeguards under the applicable regulations.',
        'Como los subencargados alojan o procesan datos fuera del Perú, el Centro autoriza estos flujos transfronterizos, que se realizan con las garantías adecuadas conforme a la normativa aplicable.')}</p>,
    },
    {
      id: 'seguridad', Icon: ShieldCheck, title: L('Security measures', 'Medidas de seguridad'),
      body: <Lista items={[
        [L('Encryption', 'Cifrado'), L('at rest (AES-256) and in transit (TLS).', 'en reposo (AES-256) y en tránsito (TLS).')],
        [L('Isolation by center', 'Aislamiento por centro'), L('through row-level security policies.', 'mediante políticas de seguridad a nivel de fila.')],
        [L('Role-based access', 'Acceso por roles'), L('and two-step verification available for every account.', 'y verificación en dos pasos disponible para todas las cuentas.')],
        [L('Minimal data to AI', 'Datos mínimos a la IA'), L('only with the Center\'s prior authorization, which can be withdrawn at any time.', 'solo con la autorización previa del Centro, que puede retirar en cualquier momento.')],
        [L('Backups', 'Copias de respaldo'), L('and activity logs to detect and investigate incidents.', 'y registros de actividad para detectar e investigar incidentes.')],
      ]} />,
    },
    {
      id: 'incidentes', Icon: Siren, title: L('Security incidents', 'Incidentes de seguridad'),
      body: <>
        <p>{L('Vanty will notify the Center immediately and without undue delay from the moment it becomes aware of a security incident that affects personal data processed on behalf of the Center, by email to the account that created the center. The notice will include, as far as the information is available, the nature of the incident, the categories of data and data subjects affected, the possible consequences and the measures taken or proposed; Vanty will not wait to complete the investigation before giving the first notice.',
          'Vanty notificará al Centro de forma inmediata y sin dilación indebida desde que tome conocimiento de un incidente de seguridad que afecte datos personales tratados por cuenta del Centro, por correo a la cuenta que creó el centro. La notificación incluirá, en la medida en que la información esté disponible, la naturaleza del incidente, las categorías de datos y titulares afectados, las posibles consecuencias y las medidas adoptadas o propuestas; Vanty no esperará a completar la investigación para dar el primer aviso.')}</p>
        <p>{L('Vanty will cooperate with the Center so it can meet in time the notification obligations that correspond to it under the applicable regulations, including those towards the National Authority for Personal Data Protection and the data subjects, and will keep an internal record of incidents with the facts, their effects and the measures taken.',
          'Vanty colaborará con el Centro para que este pueda cumplir oportunamente las obligaciones de notificación que le correspondan conforme a la normativa aplicable, incluidas las que tenga frente a la Autoridad Nacional de Protección de Datos Personales y a los titulares, y mantendrá un registro interno de incidentes con los hechos, sus efectos y las medidas adoptadas.')}</p>
      </>,
    },
    {
      id: 'derechos', Icon: UserCheck, title: L('Data subjects\' rights', 'Derechos de los titulares'),
      body: <p>{L('Requests for access, rectification, erasure or objection concerning patients and families are answered by the Center, as controller. Vanty will provide the platform tools (editing, export and deletion) and, if it receives a request directly, will forward it to the Center without responding on its behalf.',
        'Las solicitudes de acceso, rectificación, cancelación u oposición sobre pacientes y familias las atiende el Centro, como responsable. Vanty pondrá a su disposición las herramientas de la plataforma (edición, exportación y eliminación) y, si recibe una solicitud directamente, la derivará al Centro sin responderla en su nombre.')}</p>,
    },
    {
      id: 'centro', Icon: Building2, title: L('Obligations of the Center', 'Obligaciones del Centro'),
      body: <Lista items={[
        [L('Legal basis:', 'Base legal:'), L('have the consent of patients or of their parents or legal guardians, or another legal basis, to record their data and, if it turns them on, to use the AI features.', 'contar con el consentimiento de los pacientes o de sus padres o tutores legales, u otra base legal, para registrar sus datos y, si las activa, para usar las funciones de IA.')],
        [L('Registration:', 'Inscripción:'), L('register its own personal data banks (patients) with the National Registry of Personal Data Protection when required.', 'inscribir sus propios bancos de datos personales (pacientes) ante el Registro Nacional de Protección de Datos Personales cuando corresponda.')],
        [L('Accounts:', 'Cuentas:'), L('manage who has access, deactivate accounts of people who stop working with it and keep credentials confidential.', 'gestionar quién tiene acceso, desactivar las cuentas de quienes dejen de trabajar con él y mantener la confidencialidad de las credenciales.')],
        [L('Accuracy:', 'Exactitud:'), L('record accurate data and only what is necessary for care.', 'registrar datos exactos y solo los necesarios para la atención.')],
      ]} />,
    },
    {
      id: 'fin', Icon: Trash2, title: L('Return and deletion', 'Devolución y eliminación'),
      body: <>
        <p>{L('While the service is active, the Center can export its information from the platform. When the Center deletes its account, Vanty deletes the Center\'s data, its files and the accounts linked only to that center, except what the law requires it to keep. Backups are deleted according to the backup retention cycle of our infrastructure provider (currently, no more than 30 days).',
          'Mientras el servicio esté activo, el Centro puede exportar su información desde la plataforma. Cuando el Centro elimina su cuenta, Vanty borra los datos del Centro, sus archivos y las cuentas vinculadas solo a ese centro, salvo lo que la ley le obligue a conservar. Las copias de respaldo se eliminan según el ciclo de retención de respaldos de nuestro proveedor de infraestructura (actualmente, no más de 30 días).')}</p>
        <p>{L('Clinical-record retention periods are the Center\'s responsibility: before deleting its account, the Center must keep, outside the platform, the information it is legally required to preserve.',
          'Los plazos de conservación de las historias clínicas son responsabilidad del Centro: antes de eliminar su cuenta, el Centro debe conservar, fuera de la plataforma, la información que la ley le obliga a mantener.')}</p>
      </>,
    },
    {
      id: 'auditoria', Icon: ClipboardCheck, title: L('Information and audit', 'Información y auditoría'),
      body: <p>{L(`Vanty will provide the Center, upon reasonable request to ${EMPRESA.email}, the information necessary to demonstrate compliance with this agreement, including the list of sub-processors and a description of the security measures in force.`,
        `Vanty pondrá a disposición del Centro, previa solicitud razonable a ${EMPRESA.email}, la información necesaria para demostrar el cumplimiento de este acuerdo, incluida la lista de subencargados y una descripción de las medidas de seguridad vigentes.`)}</p>,
    },
    {
      id: 'vigencia', Icon: FileSignature, title: L('Term and acceptance', 'Vigencia y aceptación'),
      body: <p>{L('The Center accepts this agreement when it creates its account in the platform or when its management accepts it in the platform notice, and it remains in force while Vanty processes data on its behalf. Vanty may update it to reflect regulatory or service changes; relevant changes will be announced in the platform and will require a new acceptance.',
        'El Centro acepta este acuerdo al crear su cuenta en la plataforma o cuando su dirección lo acepta en el aviso de la plataforma, y se mantiene vigente mientras Vanty trate datos por su cuenta. Vanty podrá actualizarlo para reflejar cambios normativos o del servicio; los cambios relevantes se anunciarán en la plataforma y requerirán una nueva aceptación.')}</p>,
    },
  ]
}

export default async function AcuerdoEncargoPage() {
  const en = (await cookies()).get('vanty_locale')?.value === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  return (
    <LegalPage
      en={en}
      EyebrowIcon={Handshake}
      titleA={L('Data Processing ', 'Acuerdo de Encargo ')}
      titleB={L('Agreement', 'de Tratamiento')}
      intro={L(`This agreement sets out how ${P} processes, on behalf of each center, the clinical and personal information of its patients, families and team.`,
        `Este acuerdo establece cómo ${P} trata, por cuenta de cada centro, la información clínica y personal de sus pacientes, familias y equipo.`)}
      updated={L('Last updated: October 2026', 'Última actualización: octubre de 2026')}
      resumen={{
        titulo: L('At a glance', 'En resumen'),
        items: [
          [Building2, L('The center decides', 'El centro decide'), L('It is the controller; Vanty processes on its behalf.', 'Es el responsable; Vanty trata por su cuenta.')],
          [Lock, L('Only for the service', 'Solo para el servicio'), L('No own use, no sale, no AI training.', 'Sin uso propio, sin venta, sin entrenar IA.')],
          [Bell, L('Incidents notified', 'Incidentes avisados'), L('Immediately, without undue delay.', 'De forma inmediata, sin dilación indebida.')],
          [Clock, L('Deletion on exit', 'Borrado al salir'), L('Data and files deleted when the account closes.', 'Datos y archivos borrados al cerrar la cuenta.')],
        ],
      }}
      secciones={secciones(en)}
      otro={{ href: '/privacidad', label: L('Privacy Policy', 'Política de privacidad') }}
    />
  )
}
