// Preguntas frecuentes de la portada. Se usan en la página y en los datos estructurados (FAQPage) para Google.
export function preguntasFaq(L: (en: string, es: string) => string) {
  return [
    { q: L('Do I need a card for the free trial?', '¿Necesito tarjeta para la prueba gratis?'),
      a: L('No. Create your center, invite your team and families, and use Vanty ABA during the trial. When it ends you choose the plan that fits you.', 'No. Crea tu centro, invita a tu equipo y a las familias, y usa Vanty ABA durante la prueba. Al terminar eliges el plan que te acomode.') },
    { q: L('How do families access?', '¿Cómo acceden las familias?'),
      a: L('You send them an invitation link by email or WhatsApp. They create their account and see their child\'s progress, appointments, messages and home activities from their phone.', 'Les envías un enlace de invitación por correo o WhatsApp. Crean su cuenta y ven el progreso, las citas, los mensajes y las actividades en casa de su hijo/a desde el celular.') },
    { q: L('Is my clinical data safe?', '¿Mis datos clínicos están seguros?'),
      a: L('Each center\'s data is isolated with row-level security, access is by role, you can enable two-step verification and every sensitive action is recorded.', 'Los datos de cada centro están aislados con seguridad a nivel de fila, el acceso es por rol, puedes activar la verificación en dos pasos y cada acción sensible queda registrada.') },
    { q: L('In which currency do I pay?', '¿En qué moneda pago?'),
      a: L('Latin America and North America pay in US dollars and Europe in euros. We show you the approximate amount in your local currency as a reference.', 'Latinoamérica y Norteamérica pagan en dólares y Europa en euros. Te mostramos el monto aproximado en tu moneda local como referencia.') },
    { q: L('Can I change plans later?', '¿Puedo cambiar de plan después?'),
      a: L('Yes. You can move up or down whenever your center grows or changes. Yearly plans include 2 months free.', 'Sí. Puedes subir o bajar de plan cuando tu centro crezca o cambie. Los planes anuales incluyen 2 meses gratis.') },
  ]
}
