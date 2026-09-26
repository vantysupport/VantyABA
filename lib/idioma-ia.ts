// Regla de idioma para las respuestas de ARIA: siempre en el idioma activo de la app,
// aunque los datos del expediente, el historial o las instrucciones estén en español.
// Se agrega al final del prompt de sistema y otra vez justo antes de la pregunta del usuario
// (así pesa más que el historial previo, que puede venir en otro idioma).

export function esIngles(locale?: string | null) {
  return String(locale || '').toLowerCase().startsWith('en')
}

export function reglaIdiomaRespuesta(locale?: string | null): string {
  return esIngles(locale)
    ? 'LANGUAGE — MANDATORY: The user has the app in ENGLISH. Write your ENTIRE answer in natural English, including greetings, headings, lists and any data you quote. The clinical record, instructions and earlier messages may be in Spanish: translate whatever you use into English. Never answer in Spanish.'
    : 'IDIOMA OBLIGATORIO: el usuario tiene la app en ESPAÑOL. Responde todo en español, aunque algún dato o mensaje previo esté en otro idioma.'
}
