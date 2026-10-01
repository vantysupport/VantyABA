// app/terminos/page.tsx
// Términos de Servicio de la plataforma Vanty (nivel plataforma, multi-centro).
// Bilingüe (ES/EN): el idioma se toma de la cookie `vanty_locale`.

import { cookies } from 'next/headers'
import {
  FileCheck2, LayoutGrid, UserCog, ShieldAlert, FolderLock, Sparkles, EyeOff, CreditCard, Activity,
  Copyright, Scale, PauseCircle, RefreshCw, Landmark, Mail, Stethoscope, KeyRound, HeartHandshake,
} from 'lucide-react'
import { PLATFORM_NAME } from '@/lib/branding'
import { EMPRESA } from '@/lib/empresa'
import { localeServidor, metadatosPagina } from '@/lib/seo'
import LegalPage, { Lista, Destacado, type SeccionLegal } from '@/components/legal/LegalPage'

// Nombre comercial completo de la plataforma en los documentos legales
const P = `${PLATFORM_NAME} ABA`

export async function generateMetadata() {
  const en = (await localeServidor()) === 'en'
  return metadatosPagina(en
    ? { ruta: '/terminos', en, title: `Terms of Service · ${P}`, description: `Conditions of use of the ${P} clinical-management platform.` }
    : { ruta: '/terminos', en, title: `Términos de Servicio · ${P}`, description: `Condiciones de uso de la plataforma de gestión clínica ${P}.` })
}

function secciones(en: boolean): SeccionLegal[] {
  const L = (e: string, s: string) => (en ? e : s)
  return [
    {
      id: 'aceptacion', Icon: FileCheck2, title: L('Acceptance of the terms', 'Aceptación de los términos'),
      body: <><p>{L(`${P} is provided under the trade name "${EMPRESA.nombreComercial}", with Peruvian taxpayer number (RUC) ${EMPRESA.ruc}. Contact: ${EMPRESA.email}.`,
        `${P} es prestado bajo el nombre comercial "${EMPRESA.nombreComercial}", con RUC ${EMPRESA.ruc}. Contacto: ${EMPRESA.email}.`)}</p><p>{L(`These Terms of Service govern access to and use of the ${P} platform. By creating an account or using the platform, you declare that you have read, understood and accepted these terms, as well as the Privacy Policy. If you do not agree, you must refrain from using the platform.`,
        `Estos Términos de Servicio regulan el acceso y uso de la plataforma ${P}. Al crear una cuenta o utilizar la plataforma, declaras haber leído, comprendido y aceptado estos términos, así como la Política de Privacidad. Si no estás de acuerdo, debes abstenerte de utilizar la plataforma.`)}</p></>,
    },
    {
      id: 'servicio', Icon: LayoutGrid, title: L('Description of the service', 'Descripción del servicio'),
      body: <>
        <p>{L(`${P} is a software platform for child development and therapy centers. It allows professionals to manage clinical records, assessments, therapy programs and sessions, and allows families to follow their children's progress, check appointments and communicate with the therapy team.`,
          `${P} es una plataforma de software para centros de desarrollo infantil y terapia. Permite a los profesionales gestionar historias clínicas, evaluaciones, programas terapéuticos y sesiones, y a las familias seguir el progreso de sus hijos, consultar sus citas y comunicarse con el equipo terapéutico.`)}</p>
        <p>{L(`${P} is a technology provider: it does not provide health services. The clinical care is provided exclusively by each center and its professionals.`,
          `${P} es un proveedor tecnológico: no presta servicios de salud. La atención clínica la brinda exclusivamente cada centro y sus profesionales.`)}</p>
      </>,
    },
    {
      id: 'cuentas', Icon: UserCog, title: L('Accounts and access', 'Cuentas y acceso'),
      body: <Lista items={[
        [L('Access by invitation or registration:', 'Acceso por invitación o registro:'), L('accounts are created by the center or through the links it provides, with a role that determines the permitted functions.', 'las cuentas se crean por el centro o mediante los enlaces que este proporciona, con un rol que determina las funciones permitidas.')],
        [L('Truthful information:', 'Información veraz:'), L('you agree to provide accurate data and keep it up to date.', 'te comprometes a proporcionar datos exactos y mantenerlos actualizados.')],
        [L('Custody of credentials:', 'Custodia de credenciales:'), L('you are responsible for keeping your password confidential and for the activity carried out from your account. We recommend enabling two-step verification.', 'eres responsable de mantener la confidencialidad de tu contraseña y de la actividad realizada desde tu cuenta. Recomendamos activar la verificación en dos pasos.')],
        [L('Notice of unauthorized access:', 'Aviso de accesos no autorizados:'), L('if you detect improper use of your account, you must notify your center immediately.', 'si detectas un uso indebido de tu cuenta, debes notificarlo de inmediato a tu centro.')],
      ]} />,
    },
    {
      id: 'uso', Icon: ShieldAlert, title: L('Acceptable use', 'Uso aceptable'),
      body: <>
        <p>{L('The platform must be used exclusively for the clinical, administrative and communication purposes for which it was designed. In particular, it is prohibited to:', 'La plataforma debe utilizarse exclusivamente para los fines clínicos, administrativos y de comunicación para los que fue diseñada. En particular, queda prohibido:')}</p>
        <Lista items={[
          ['', L('share access credentials or allow third parties to use your account;', 'compartir credenciales de acceso o permitir que terceros usen tu cuenta;')],
          ['', L('attempt to access information of other users, patients or centers;', 'intentar acceder a información de otros usuarios, pacientes o centros;')],
          ['', L('upload unlawful content or content that infringes the rights of third parties;', 'cargar contenido ilícito o que vulnere derechos de terceros;')],
          ['', L('interfere with the operation or security of the platform, or use automated means to extract information.', 'interferir con el funcionamiento o la seguridad de la plataforma, o utilizar medios automatizados para extraer información.')],
        ]} />
      </>,
    },
    {
      id: 'datos', Icon: FolderLock, title: L('Clinical information and personal data', 'Información clínica y datos personales'),
      body: <p>{L(`Each center is the data controller of the clinical information it records, and patients or their representatives keep the rights that the law grants them over their personal data. ${P} processes that information as a data processor, on the center's behalf and solely to provide the service, in accordance with the Privacy Policy, the Data Processing Agreement (vanty.xyz/acuerdo-encargo) and Peru's Personal Data Protection Law (Law No. 29733).`,
        `Cada centro es responsable del tratamiento de la información clínica que registra, y los pacientes o sus representantes mantienen los derechos que la legislación les reconoce sobre sus datos personales. ${P} trata esa información como encargado del tratamiento, por cuenta del centro y únicamente para prestar el servicio, conforme a la Política de Privacidad, al Acuerdo de Encargo de Tratamiento (vanty.xyz/acuerdo-encargo) y a la Ley de Protección de Datos Personales (Ley N.º 29733).`)}</p>,
    },
    {
      id: 'ia', Icon: Sparkles, title: L('Artificial intelligence', 'Inteligencia artificial'),
      body: <>
        <p>{L(`${P} includes ARIA, an assistant based on artificial intelligence that helps draft reports, summarize information and answer questions.`, `${P} incluye ARIA, un asistente basado en inteligencia artificial que ayuda a redactar informes, resumir información y responder consultas.`)}</p>
        <Destacado>{L('The results generated by ARIA are advisory: they do not constitute a diagnosis or replace the judgment of a qualified professional. Clinical decisions are the exclusive responsibility of the professional in charge, who must review any AI-generated content before using it.',
          'Los resultados generados por ARIA son orientativos: no constituyen un diagnóstico ni sustituyen el criterio de un profesional calificado. Las decisiones clínicas son responsabilidad exclusiva del profesional a cargo, quien debe revisar todo contenido generado por IA antes de utilizarlo.')}</Destacado>
      </>,
    },
    {
      id: 'confidencialidad', Icon: EyeOff, title: L('Confidentiality', 'Confidencialidad'),
      body: <p>{L('All clinical information is strictly confidential. Users agree not to disclose, copy or use for purposes other than care any information about patients, families or professionals that they have accessed through the platform.',
        'Toda la información clínica es estrictamente confidencial. Los usuarios se comprometen a no divulgar, copiar ni utilizar con fines ajenos a la atención la información de pacientes, familias o profesionales a la que accedan a través de la plataforma.')}</p>,
    },
    {
      id: 'planes', Icon: CreditCard, title: L('Plans and payments', 'Planes y pagos'),
      body: <p>{L('Centers access the platform under the plan they contract, which defines the available features and usage limits. Commercial conditions are agreed with each center. Family access to the portal is managed by the center, and any purchase made in a center\'s store is governed by that center\'s conditions. Prices do not include IGV (VAT), which is added when applicable.',
        'Los centros acceden a la plataforma según el plan contratado, que define las funcionalidades disponibles y los límites de uso. Las condiciones comerciales se acuerdan con cada centro. El acceso de las familias al portal lo gestiona el centro, y cualquier compra realizada en la tienda de un centro se rige por las condiciones de dicho centro. Los precios no incluyen IGV, que se agrega cuando corresponde.')}</p>,
    },
    {
      id: 'disponibilidad', Icon: Activity, title: L('Service availability', 'Disponibilidad del servicio'),
      body: <p>{L('We work to keep the platform available continuously. However, interruptions may occur due to scheduled maintenance, updates or causes beyond our control. Whenever possible, we will give advance notice of scheduled maintenance.',
        'Trabajamos para mantener la plataforma disponible de forma continua. No obstante, pueden producirse interrupciones por mantenimiento programado, actualizaciones o causas ajenas a nuestro control. Siempre que sea posible, avisaremos con anticipación de los mantenimientos programados.')}</p>,
    },
    {
      id: 'propiedad', Icon: Copyright, title: L('Intellectual property', 'Propiedad intelectual'),
      body: <p>{L(`The software, design, trademarks and content of the platform belong to ${P} or its licensors. Use of the platform does not grant any right over them beyond what is necessary to use the service. Content uploaded by centers and users remains theirs.`,
        `El software, el diseño, las marcas y los contenidos de la plataforma pertenecen a ${P} o a sus licenciantes. El uso de la plataforma no otorga ningún derecho sobre ellos más allá del necesario para utilizar el servicio. El contenido cargado por los centros y usuarios sigue siendo de su titularidad.`)}</p>,
    },
    {
      id: 'responsabilidad', Icon: Scale, title: L('Limitation of liability', 'Limitación de responsabilidad'),
      body: <p>{L(`${P} is not responsible for clinical decisions made by professionals, for the accuracy of information entered by users, or for damages arising from improper use of the platform. To the extent permitted by law, ${P}'s liability is limited to direct damages attributable to its willful misconduct or gross negligence.`,
        `${P} no es responsable de las decisiones clínicas adoptadas por los profesionales, de la exactitud de la información ingresada por los usuarios ni de los daños derivados de un uso indebido de la plataforma. En la medida permitida por la ley, la responsabilidad de ${P} se limita a los daños directos imputables a su dolo o culpa inexcusable.`)}</p>,
    },
    {
      id: 'suspension', Icon: PauseCircle, title: L('Suspension and termination', 'Suspensión y terminación'),
      body: <p>{L('Accounts that breach these terms or put the security of the platform or of other users at risk may be suspended or cancelled. Users may request the closure of their account at any time through their center; clinical information will be kept for the periods required by law.',
        'Podrán suspenderse o cancelarse las cuentas que incumplan estos términos o pongan en riesgo la seguridad de la plataforma o de otros usuarios. Los usuarios pueden solicitar el cierre de su cuenta en cualquier momento a través de su centro; la información clínica se conservará durante los plazos que exija la ley.')}</p>,
    },
    {
      id: 'cambios', Icon: RefreshCw, title: L('Changes to these terms', 'Modificaciones'),
      body: <p>{L('We may update these terms to reflect changes in the service or in regulations. Relevant changes will be communicated through a notice within the platform before they take effect. Continued use of the platform after that date implies acceptance of the new terms.',
        'Podemos actualizar estos términos para reflejar cambios en el servicio o en la normativa. Los cambios relevantes se comunicarán mediante un aviso dentro de la plataforma antes de su entrada en vigor. El uso continuado de la plataforma tras esa fecha implica la aceptación de los nuevos términos.')}</p>,
    },
    {
      id: 'ley', Icon: Landmark, title: L('Governing law and jurisdiction', 'Ley aplicable y jurisdicción'),
      body: <p>{L('These terms are governed by the laws of the Republic of Peru. Any dispute will be submitted to the competent courts of Peru, without prejudice to the rights that consumer protection regulations grant to users.',
        'Estos términos se rigen por las leyes de la República del Perú. Cualquier controversia se someterá a los jueces y tribunales competentes del Perú, sin perjuicio de los derechos que la normativa de protección al consumidor reconozca a los usuarios.')}</p>,
    },
    {
      id: 'contacto', Icon: Mail, title: L('Contact', 'Contacto'),
      body: <p>{L(`For questions about your account or the care you receive, contact your center through the channels available in the platform. For matters related to the ${P} platform, you may write to us through the support section or at ${EMPRESA.email}. To file a claim or complaint, use our virtual Complaints Book at vanty.xyz/libro-de-reclamaciones.`,
        `Para consultas sobre tu cuenta o la atención que recibes, comunícate con tu centro a través de los canales disponibles en la plataforma. Para asuntos relacionados con la plataforma ${P}, puedes escribirnos desde la sección de soporte o a ${EMPRESA.email}. Si deseas presentar un reclamo o una queja, usa nuestro Libro de Reclamaciones virtual en vanty.xyz/libro-de-reclamaciones.`)}</p>,
    },
  ]
}

export default async function TerminosPage() {
  const en = (await cookies()).get('vanty_locale')?.value === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  return (
    <LegalPage
      en={en}
      EyebrowIcon={FileCheck2}
      titleA={L('Terms of ', 'Términos de ')}
      titleB={L('Service', 'Servicio')}
      intro={L(`These terms establish the rules for using ${P}: what the platform offers, the responsibilities of each user and how we work together to protect the care of children and their families.`,
        `Estos términos establecen las reglas de uso de ${P}: qué ofrece la plataforma, las responsabilidades de cada usuario y cómo trabajamos juntos para proteger la atención de niñas, niños y sus familias.`)}
      updated={L('Last updated: September 2026', 'Última actualización: septiembre de 2026')}
      resumen={{
        titulo: L('At a glance', 'En resumen'),
        items: [
          [Stethoscope, L('Care is provided by the center', 'La atención la brinda el centro'), L(`${P} is the technology that supports it.`, `${P} es la tecnología que la respalda.`)],
          [KeyRound, L('Your account is personal', 'Tu cuenta es personal'), L('Do not share your credentials.', 'No compartas tus credenciales.')],
          [Sparkles, L('AI is a support tool', 'La IA es un apoyo'), L('It does not replace professional judgment.', 'No reemplaza el criterio profesional.')],
          [HeartHandshake, L('Confidentiality first', 'Confidencialidad ante todo'), L('Clinical information is only used for care.', 'La información clínica solo se usa para la atención.')],
        ],
      }}
      secciones={secciones(en)}
      otro={{ href: '/privacidad', label: L('Privacy Policy', 'Política de privacidad') }}
    />
  )
}
