'use client'
import { useCentroBranding } from '@/components/CentroBrandingContext'

// Flujo de Evaluación Inicial — vista del PADRE.
// Estados visibles: intake → analizando → recomendación amigable + confirmación
//   → 2ª anamnesis → catálogo de terapias → esperando → respuesta del especialista.
//
// ⚠️ El padre NUNCA ve documentos clínicos internos, ni razonamiento técnico.

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n-context'
import { SECCIONES_INTAKE_EN, SECCIONES_PSICO_EN, SECCIONES_NEURO_EN } from './evaluacion-inicial-en'
import {
  ClipboardCheck, ClipboardList, Sparkles, Loader2, CheckCircle2, Check, Brain, Heart,
  ChevronRight, ChevronLeft, Send, Clock, MessageCircle, Image as ImageIcon, ThumbsUp, AlertCircle,
  HelpCircle, RefreshCw, Lock, Plus, Trash2,
  Baby, Users, School, Stethoscope, House, HeartPulse, Handshake, CloudRain, Puzzle, Backpack, GraduationCap,
  Search, Milk, Hospital, Siren, PersonStanding, MessagesSquare, Utensils, Bath, Shirt, Dices, Dna,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useToast } from '@/components/Toast'

type Props = { child: any; profile: any }

// Paleta para tarjetas de terapia (debe coincidir con CatalogoTerapiasView del admin)
const TERAPIA_COLORES: Record<string, { gradient: string; accent: string; accentDark: string }> = {
  indigo:   { gradient: 'from-sky-500 to-cyan-500',     accent: '#0284c7', accentDark: '#38bdf8' },
  purple:   { gradient: 'from-sky-500 to-fuchsia-500',  accent: '#0ea5e9', accentDark: '#c084fc' },
  pink:     { gradient: 'from-rose-500 to-rose-500',       accent: '#ec4899', accentDark: '#f472b6' },
  rose:     { gradient: 'from-rose-500 to-red-500',        accent: '#f43f5e', accentDark: '#fb7185' },
  amber:    { gradient: 'from-amber-500 to-orange-500',    accent: '#f59e0b', accentDark: '#fbbf24' },
  emerald:  { gradient: 'from-emerald-500 to-teal-500',    accent: '#10b981', accentDark: '#34d399' },
  cyan:     { gradient: 'from-cyan-500 to-sky-500',        accent: '#06b6d4', accentDark: '#22d3ee' },
  blue:     { gradient: 'from-sky-500 to-cyan-500',     accent: '#0284c7', accentDark: '#60a5fa' },
  orange:   { gradient: 'from-orange-500 to-red-500',      accent: '#f97316', accentDark: '#fb923c' },
  slate:    { gradient: 'from-slate-600 to-slate-700',     accent: '#64748b', accentDark: '#94a3b8' },
}

export type ColumnaTabla = { id: string; label: string; type?: 'text' | 'number' | 'date'; placeholder?: string; options?: string[] }

export type Pregunta =
  | { id: string; type: 'text' | 'textarea' | 'number'; label: string; placeholder?: string; required?: boolean }
  | { id: string; type: 'select' | 'radio'; label: string; options: string[]; required?: boolean }
  | { id: string; type: 'checkbox'; label: string; options: string[] }
  | { id: string; type: 'date'; label: string; required?: boolean }
  | { id: string; type: 'tabla_dinamica'; label: string; columns: ColumnaTabla[]; addLabel?: string; minRows?: number; required?: boolean }

export type Seccion = { titulo: string; descripcion?: string; icono: string; preguntas: Pregunta[] }

// ─── Primera ficha: INTAKE — "Ficha inicial para papás" ────────────────
// Estructura oficial: secciones que cubren datos del menor, padres,
// motivo de consulta, historia escolar, diagnósticos, terapias previas,
// dinámica familiar e información final / marketing.
const SECCIONES_INTAKE_ES: Seccion[] = [
  {
    titulo: 'Datos generales del menor', icono: '🧒',
    descripcion: 'Información básica del niño/a a evaluar.',
    preguntas: [
      { id: 'menor_nombre', type: 'text', label: 'Nombres y apellidos del menor', required: true },
      { id: 'menor_edad', type: 'text', label: 'Edad (años y meses)', placeholder: 'Ej: 7 años 3 meses', required: true },
      { id: 'menor_fecha_nacimiento', type: 'date', label: 'Fecha de nacimiento', required: true },
      { id: 'menor_grado', type: 'text', label: 'Grado educativo', placeholder: 'Ej: 2° de primaria' },
      { id: 'menor_institucion', type: 'text', label: 'Institución educativa' },
      { id: 'menor_residencia', type: 'text', label: 'Lugar de residencia (distrito / ciudad)' },
      { id: 'menor_contacto', type: 'text', label: 'Número de contacto', placeholder: 'Indica si es de mamá o papá', required: true },
    ],
  },
  {
    titulo: 'Datos generales de los padres', icono: '👨‍👩‍👧',
    preguntas: [
      { id: 'padre_nombre', type: 'text', label: 'Nombres y apellidos del papá' },
      { id: 'madre_nombre', type: 'text', label: 'Nombres y apellidos de la mamá' },
    ],
  },
  {
    titulo: 'Motivo de consulta', icono: '💬',
    descripcion: 'Cuéntanos en tus palabras qué te trae al centro.',
    preguntas: [
      { id: 'motivo_principal', type: 'textarea', label: '¿Cuál es su principal preocupación? Menciona una o varias.', required: true },
      { id: 'desde_cuando', type: 'radio', label: '¿Desde cuándo notas esta preocupación?', options: ['Menos de 1 mes', '1-3 meses', '3-6 meses', 'Más de 6 meses'], required: true },
      { id: 'como_manejo', type: 'textarea', label: '¿De qué manera lo has manejado? ¿Cómo has tratado de solucionarlo?' },
    ],
  },
  {
    titulo: 'Historia escolar', icono: '🏫',
    preguntas: [
      { id: 'experiencia_escolar', type: 'textarea', label: '¿Cómo ha sido la experiencia escolar de tu hijo/a hasta ahora?' },
      { id: 'rendimiento_academico', type: 'textarea', label: '¿Cómo crees que le va a nivel académico?' },
      { id: 'bullying', type: 'textarea', label: '¿Alguna vez ha sufrido bullying? ¿Algún dato escolar importante que desees mencionar?' },
    ],
  },
  {
    titulo: 'Diagnóstico y/o comorbilidades', icono: '🩺',
    preguntas: [
      { id: 'diagnostico_previo', type: 'textarea', label: '¿Cuenta con algún diagnóstico previo? ¿Cuál?' },
      { id: 'alergias_medicacion', type: 'textarea', label: '¿Cuenta con alergias o está recibiendo alguna medicación?' },
      { id: 'antecedentes_medicos', type: 'textarea', label: '¿Algún antecedente médico del niño/a o de algún familiar que consideres importante?' },
    ],
  },
  {
    titulo: 'Evaluaciones y terapias anteriores', icono: '📋',
    preguntas: [
      { id: 'evaluaciones_previas', type: 'textarea', label: '¿Realizaron evaluaciones anteriores? Si fue así, ¿cuáles fueron los resultados?' },
      { id: 'terapias_previas', type: 'textarea', label: '¿Ha recibido algún tipo de terapia anteriormente (psicología, terapia ocupacional, lenguaje, fisioterapia, etc.)? ¿Cómo le fue?' },
    ],
  },
  {
    titulo: 'Dinámica familiar', icono: '🏠',
    preguntas: [
      { id: 'conflictos_recientes', type: 'textarea', label: '¿Hubo conflictos en la familia o algún cambio fuerte en los últimos 6 meses (separación, mudanza, pérdida de un ser querido)?' },
      { id: 'manejo_conflictos', type: 'textarea', label: '¿Cómo manejan los conflictos en casa?' },
      { id: 'notas_adicionales', type: 'textarea', label: 'Notas adicionales: algo que desees mencionar y que no se haya cubierto en las preguntas anteriores.' },
    ],
  },
  {
    titulo: 'Información final', icono: '✨',
    descripcion: 'Para conocerte mejor.',
    preguntas: [
      { id: 'medio_conocimiento', type: 'select', label: '¿Por cuál medio nos conociste?', options: ['Instagram', 'Tiktok', 'Recomendación', 'Colegio', 'Otros'] },
      { id: 'medio_otros', type: 'text', label: 'Si elegiste "Otros", cuéntanos cuál:', placeholder: 'Ej: Facebook, búsqueda en Google, etc.' },
      { id: 'recibir_contenido', type: 'radio', label: '¿Deseas recibir información, consejos de crianza/familia y contenido sobre nuestros servicios en tu correo?', options: ['Sí', 'No'], required: true },
    ],
  },
]

// ─── Segunda ficha: ANAMNESIS PSICOLÓGICA / EMOCIONAL ───────────────────
// Estructura oficial — 7 secciones (I a VII).
const SECCIONES_PSICO_ES: Seccion[] = [
  // ─── I. Datos Generales y Familiares ───────────────────────────────────
  {
    titulo: 'I. Datos generales', icono: '🧒',
    descripcion: 'Información básica del niño/a.',
    preguntas: [
      { id: 'menor_nombre', type: 'text', label: 'Apellidos y nombres', required: true },
      { id: 'menor_sexo', type: 'radio', label: 'Sexo', options: ['Femenino', 'Masculino', 'Otro / prefiere no decir'] },
      { id: 'menor_edad', type: 'text', label: 'Edad (años y meses)', placeholder: 'Ej: 7 años 3 meses' },
      { id: 'menor_fecha_nacimiento', type: 'date', label: 'Fecha de nacimiento' },
      { id: 'menor_escolaridad', type: 'text', label: 'Escolaridad / grado', placeholder: 'Ej: 2° de primaria' },
      { id: 'menor_institucion', type: 'text', label: 'Institución educativa' },
      { id: 'menor_direccion', type: 'text', label: 'Dirección' },
      { id: 'menor_residencia', type: 'text', label: 'Lugar de residencia', placeholder: 'Distrito / ciudad' },
      { id: 'menor_tiempo_lima', type: 'text', label: 'Tiempo de residencia en Lima', placeholder: 'Ej: 5 años / siempre' },
      { id: 'menor_celular', type: 'text', label: 'Celular(es) de contacto' },
      { id: 'menor_correo', type: 'text', label: 'Correo(s) electrónico(s) de contacto' },
    ],
  },
  {
    titulo: 'I. Datos familiares', icono: '👨‍👩‍👧',
    descripcion: 'Personas que viven con el niño/a. Puedes agregar tantos familiares como necesites.',
    preguntas: [
      { id: 'datos_familiares', type: 'tabla_dinamica', label: 'Familiares que conviven con el niño/a',
        addLabel: '+ Agregar familiar', minRows: 2,
        columns: [
          { id: 'relacion', label: 'Relación', options: ['Madre', 'Padre', 'Hermano/a', 'Abuelo/a', 'Tío/a', 'Otro'] },
          { id: 'nombre', label: 'Nombres y apellidos' },
          { id: 'edad', label: 'Edad', type: 'number', placeholder: 'Años' },
          { id: 'instruccion', label: 'Grado de instrucción', placeholder: 'Ej: Superior, técnica' },
          { id: 'ocupacion', label: 'Ocupación' },
        ],
      },
    ],
  },

  // ─── II. Motivo de Consulta ────────────────────────────────────────────
  {
    titulo: 'II. Motivo de consulta', icono: '💬',
    descripcion: 'Las principales preocupaciones y su contexto.',
    preguntas: [
      { id: 'preocupaciones', type: 'textarea', label: '¿Cuáles son las preocupaciones principales (conducta, lenguaje, autovalimiento, emocional, etc.)? Describe cada una lo más detalladamente posible.', required: true },
      { id: 'desde_cuando', type: 'textarea', label: '¿Desde cuándo se observan estas conductas?', required: true },
      { id: 'situaciones_frecuentes', type: 'textarea', label: '¿En qué situaciones aparecen con mayor frecuencia?' },
      { id: 'entornos_afectados', type: 'checkbox', label: 'Entornos donde se manifiestan:', options: ['Casa', 'Colegio', 'Relaciones con pares', 'Familia extendida', 'Espacios públicos', 'Otros'] },
      { id: 'intentos_previos', type: 'textarea', label: '¿Qué han intentado para manejarlo? ¿Qué tan efectivo resultó?' },
      { id: 'opinion_profesores', type: 'textarea', label: 'Opinión de los profesores / equipo escolar' },
    ],
  },

  // ─── III. Historia del Desarrollo y Antecedentes ───────────────────────
  {
    titulo: 'III. Historia del desarrollo', icono: '🤰',
    descripcion: 'Embarazo, parto y primeros hitos.',
    preguntas: [
      { id: 'complicaciones_embarazo_parto', type: 'textarea', label: 'Complicaciones durante el embarazo y/o parto' },
      { id: 'hito_sostener_cabeza', type: 'text', label: 'Edad en que sostuvo la cabeza', placeholder: 'Meses' },
      { id: 'hito_sentarse', type: 'text', label: 'Edad en que se sentó solo/a', placeholder: 'Meses' },
      { id: 'hito_gatear', type: 'text', label: 'Edad en que gateó', placeholder: 'Meses' },
      { id: 'hito_caminar', type: 'text', label: 'Edad en que caminó', placeholder: 'Meses' },
      { id: 'hito_hablar', type: 'text', label: 'Edad en que comenzó a hablar', placeholder: 'Meses' },
    ],
  },
  {
    titulo: 'III. Antecedentes médicos y familiares', icono: '🩺',
    preguntas: [
      { id: 'alergias', type: 'textarea', label: '¿Cuenta con alergias? ¿Cuáles?' },
      { id: 'hospitalizaciones', type: 'textarea', label: 'Hospitalizaciones (motivo, edad, duración)' },
      { id: 'medicacion', type: 'textarea', label: '¿Está recibiendo medicación? ¿Cuál y desde cuándo?' },
      { id: 'diagnostico_previo', type: 'textarea', label: 'Diagnósticos previos' },
      { id: 'antecedentes_familiares', type: 'checkbox', label: 'Antecedentes familiares de:', options: ['Salud mental (depresión, ansiedad, etc.)', 'TEA / autismo', 'TDAH', 'Dificultades de aprendizaje', 'Dificultades de habla / lenguaje', 'Epilepsia / convulsiones', 'Discapacidad intelectual', 'Otros', 'Ninguno'] },
      { id: 'antecedentes_detalle', type: 'textarea', label: 'Si marcaste alguno, indica quién y de qué se trata' },
    ],
  },

  // ─── IV. Historia Escolar ──────────────────────────────────────────────
  {
    titulo: 'IV. Historia escolar', icono: '🏫',
    descripcion: 'Trayectoria y desempeño en el colegio.',
    preguntas: [
      { id: 'edu_edad_inicio', type: 'text', label: 'Edad de inicio escolar', placeholder: 'Años' },
      { id: 'edu_adaptacion', type: 'textarea', label: 'Adaptación en los diferentes niveles educativos (inicial, primaria, secundaria)' },
      { id: 'edu_gustos', type: 'textarea', label: 'Cursos / materias que más le gustan' },
      { id: 'edu_dificultades', type: 'textarea', label: 'Cursos / materias en los que presenta dificultades' },
      { id: 'edu_comentarios_colegio', type: 'textarea', label: 'Comentarios recurrentes del colegio sobre su hijo/a' },
      { id: 'edu_conducta_bullying', type: 'textarea', label: 'Problemas de conducta o bullying (recibido o ejercido)' },
      { id: 'edu_apoyos_previos', type: 'textarea', label: 'Apoyos previos recibidos (refuerzo, terapia psicopedagógica, etc.)' },
    ],
  },

  // ─── V. Áreas Específicas ──────────────────────────────────────────────
  {
    titulo: 'V. Área socioemocional', icono: '❤️',
    preguntas: [
      { id: 'soc_personalidad', type: 'textarea', label: '¿Cómo describirías la personalidad de tu hijo/a?' },
      { id: 'soc_expresion_emociones', type: 'radio', label: '¿Cómo expresa sus emociones?', options: ['Las habla con palabras', 'Las muestra con conducta', 'Se las guarda', 'Depende del momento'] },
      { id: 'soc_factores_frustracion', type: 'textarea', label: '¿Qué situaciones le generan frustración?' },
      { id: 'soc_reaccion_limites', type: 'textarea', label: '¿Cómo reacciona ante los límites o cuando se le dice "no"?' },
      { id: 'soc_autorregulacion', type: 'textarea', label: '¿Qué estrategias usa para calmarse? ¿Lo logra solo/a o necesita ayuda?' },
    ],
  },
  {
    titulo: 'V. Relaciones familiares', icono: '🏡',
    preguntas: [
      { id: 'fam_convivencia', type: 'textarea', label: '¿Cómo es la convivencia en casa?' },
      { id: 'fam_vinculos_afectivos', type: 'textarea', label: 'Vínculos afectivos: ¿con quién es más cercano/a? ¿con quién le cuesta?' },
      { id: 'fam_estilo_disciplina', type: 'radio', label: 'Estilo de disciplina predominante:', options: ['Permisivo', 'Autoritario', 'Negociador / democrático', 'Inconsistente', 'Otro'] },
      { id: 'fam_estrategias_disciplina', type: 'textarea', label: '¿Qué estrategias usan cuando hay un problema de conducta?' },
      { id: 'fam_conflictos', type: 'textarea', label: '¿Hay conflictos familiares actuales que sea importante conocer?' },
    ],
  },
  {
    titulo: 'V. Ámbito social', icono: '🤝',
    preguntas: [
      { id: 'social_amigos', type: 'radio', label: '¿Le es fácil hacer amigos?', options: ['Sí, muy fácil', 'Con algo de esfuerzo', 'Le cuesta', 'Casi no socializa'] },
      { id: 'social_juego_pref', type: 'radio', label: 'Cuando juega, prefiere:', options: ['Estar solo/a', 'Estar en grupo', 'Le es indistinto', 'Depende del momento'] },
      { id: 'social_fuera_colegio', type: 'textarea', label: '¿Cómo es su interacción social fuera del colegio? (familiares, vecinos, actividades extracurriculares)' },
      { id: 'social_manejo_conflictos', type: 'textarea', label: '¿Cómo maneja los conflictos con sus compañeros?' },
    ],
  },
  {
    titulo: 'V. Estado emocional actual', icono: '🌧️',
    descripcion: 'Tu honestidad nos ayuda a cuidar mejor a tu hijo/a.',
    preguntas: [
      { id: 'emo_sintomas', type: 'checkbox', label: 'Marca lo que observas actualmente:', options: ['Tristeza persistente', 'Irritabilidad o enojo frecuente', 'Miedos intensos', 'Cambios en el sueño', 'Cambios en el apetito', 'Pensamientos negativos sobre sí mismo/a', 'Aislamiento social', 'Miedo anticipatorio (a algo que va a pasar)', 'Conductas de riesgo', 'Está bien la mayor parte del tiempo'] },
      { id: 'emo_pensamientos_riesgo', type: 'textarea', label: '¿Ha expresado pensamientos preocupantes (no querer estar, hacerse daño, etc.)? Tu sinceridad nos ayuda a cuidarlo/a mejor.' },
      { id: 'emo_descripcion_general', type: 'textarea', label: '¿Cómo describirías el estado emocional general de tu hijo/a en este momento?' },
    ],
  },

  // ─── VI. Áreas Específicas según Edad ──────────────────────────────────
  {
    titulo: 'VI. Área específica según edad (2–6 años)', icono: '🧸',
    descripcion: 'Completa esta sección si tu hijo/a tiene entre 2 y 6 años. Si no, sáltala.',
    preguntas: [
      { id: 'edad26_juego_simbolico', type: 'textarea', label: 'Juego simbólico: ¿juega "de a que es..." (cocinar, ser doctor, etc.)? ¿Con qué frecuencia?' },
      { id: 'edad26_imitacion', type: 'textarea', label: 'Imitación: ¿imita acciones, sonidos, gestos de otros?' },
      { id: 'edad26_rutinas', type: 'textarea', label: 'Rutinas: ¿se adapta a rutinas o le cuesta? ¿Cómo reacciona a los cambios?' },
      { id: 'edad26_separacion', type: 'textarea', label: 'Separación del cuidador: ¿cómo reacciona al despedirse de mamá/papá?' },
    ],
  },
  {
    titulo: 'VI. Área específica según edad (7–11 años)', icono: '🎒',
    descripcion: 'Completa esta sección si tu hijo/a tiene entre 7 y 11 años. Si no, sáltala.',
    preguntas: [
      { id: 'edad711_autoconcepto', type: 'textarea', label: 'Autoconcepto: ¿cómo se ve a sí mismo/a? ¿Qué opinión tiene de sí?' },
      { id: 'edad711_frustracion', type: 'textarea', label: 'Manejo de la frustración: ¿qué hace cuando algo no le sale?' },
      { id: 'edad711_habilidades_sociales', type: 'textarea', label: 'Habilidades sociales: ¿cómo se relaciona con sus pares?' },
      { id: 'edad711_miedos', type: 'textarea', label: 'Miedos frecuentes: ¿qué le causa temor o ansiedad?' },
    ],
  },
  {
    titulo: 'VI. Área específica según edad (12–15 años)', icono: '🎓',
    descripcion: 'Completa esta sección si tu hijo/a tiene entre 12 y 15 años. Si no, sáltala.',
    preguntas: [
      { id: 'edad1215_autoestima', type: 'textarea', label: 'Autoestima / identidad: ¿cómo se valora a sí mismo/a?' },
      { id: 'edad1215_cambios_etapa', type: 'textarea', label: 'Gestión de los cambios propios de la adolescencia (corporales, emocionales, sociales)' },
      { id: 'edad1215_pares', type: 'textarea', label: 'Influencia de pares: ¿qué tan influenciable es por sus amigos?' },
      { id: 'edad1215_tecnologia', type: 'textarea', label: 'Uso de tecnología y redes sociales: cantidad de tiempo, plataformas, comportamiento' },
      { id: 'edad1215_metas_futuro', type: 'textarea', label: 'Metas a futuro: ¿qué planes / sueños tiene?' },
    ],
  },

  // ─── VII. Expectativas y Observaciones ─────────────────────────────────
  {
    titulo: 'VII. Expectativas y observaciones', icono: '✨',
    preguntas: [
      { id: 'expectativas', type: 'textarea', label: '¿Qué esperan obtener de esta evaluación?', required: true },
      { id: 'cambios_deseados', type: 'textarea', label: '¿Qué cambios desean observar en su hijo/a tras el proceso?' },
      { id: 'observaciones', type: 'textarea', label: 'Observaciones finales: cualquier cosa que quieran compartir y no se haya cubierto antes.' },
    ],
  },
]

// ─── Segunda ficha: ANAMNESIS NEUROPSICOLÓGICA ──────────────────────────
// Estructura oficial — 11 secciones (I a XI).
// Las tablas dinámicas permiten al padre/madre agregar varias filas (familiares, accidentes, etc.).
const SECCIONES_NEURO_ES: Seccion[] = [
  // ─── I. Datos Familiares ───────────────────────────────────────────────
  {
    titulo: 'I. Datos familiares', icono: '👨‍👩‍👧',
    descripcion: 'Familiares que viven con el niño/a. Puedes agregar tantos como necesites.',
    preguntas: [
      { id: 'datos_familiares', type: 'tabla_dinamica', label: 'Familiares que conviven con el niño/a',
        addLabel: '+ Agregar familiar', minRows: 2,
        columns: [
          { id: 'relacion', label: 'Relación', options: ['Madre', 'Padre', 'Hermano/a', 'Abuelo/a', 'Tío/a', 'Otro'] },
          { id: 'nombre', label: 'Nombres y apellidos' },
          { id: 'edad', label: 'Edad', type: 'number', placeholder: 'Años' },
          { id: 'instruccion', label: 'Grado de instrucción', placeholder: 'Ej: Superior, técnica' },
          { id: 'ocupacion', label: 'Ocupación' },
        ],
      },
    ],
  },

  // ─── II. Perfil Actual ─────────────────────────────────────────────────
  {
    titulo: 'II. Perfil actual', icono: '🔍',
    descripcion: 'Las principales preocupaciones que motivan la consulta.',
    preguntas: [
      { id: 'perfil_preocupaciones', type: 'textarea', label: 'Motivo de consulta: ¿Cuáles son las principales preocupaciones relacionadas con conducta, lenguaje, autovalimiento, etc.? Describe cada una lo más detalladamente posible.', required: true },
      { id: 'perfil_desde_cuando', type: 'textarea', label: 'Inicio: ¿Desde cuándo se observan estas conductas?', required: true },
    ],
  },

  // ─── III. Historia Evolutiva ───────────────────────────────────────────
  {
    titulo: 'III. Historia evolutiva — Prenatal', icono: '🤰',
    descripcion: 'Etapa antes del nacimiento.',
    preguntas: [
      { id: 'pren_duracion', type: 'text', label: 'Duración del embarazo', placeholder: 'Ej: 9 meses / 38 semanas' },
      { id: 'pren_programado', type: 'radio', label: '¿Fue un embarazo programado?', options: ['Sí', 'No', 'No estoy seguro/a'] },
      { id: 'pren_salud', type: 'textarea', label: 'Salud materna durante el embarazo (enfermedades, complicaciones)' },
      { id: 'pren_edad_papa', type: 'number', label: 'Edad del papá cuando nació su hijo/a' },
      { id: 'pren_edad_mama', type: 'number', label: 'Edad de la mamá cuando nació' },
      { id: 'pren_medicamentos', type: 'textarea', label: 'Ingesta de medicamentos durante el embarazo. ¿Cuáles?' },
      { id: 'pren_comentarios', type: 'textarea', label: 'Otros comentarios sobre el embarazo' },
    ],
  },
  {
    titulo: 'III. Historia evolutiva — Perinatal', icono: '🍼',
    descripcion: 'El parto.',
    preguntas: [
      { id: 'peri_duracion_gestacion', type: 'radio', label: 'Duración de la gestación:', options: ['Normal (a término)', 'Prematuro', 'Post-término', 'No lo sé'] },
      { id: 'peri_tipo_parto', type: 'radio', label: 'Tipo de parto:', options: ['Natural', 'Cesárea programada', 'Cesárea de emergencia', 'No lo sé'] },
      { id: 'peri_motivo_cesarea', type: 'textarea', label: 'Si fue cesárea, ¿por qué?' },
      { id: 'peri_comentarios', type: 'textarea', label: 'Comentarios adicionales sobre el parto' },
    ],
  },
  {
    titulo: 'III. Historia evolutiva — Post natal', icono: '👶',
    descripcion: 'Los primeros días después del nacimiento.',
    preguntas: [
      { id: 'post_lloro', type: 'radio', label: '¿Lloró inmediatamente al nacer?', options: ['Sí', 'No', 'No lo sé'] },
      { id: 'post_oxigeno', type: 'radio', label: '¿Necesitó oxígeno / reanimación?', options: ['No', 'Sí, brevemente', 'Sí, prolongado', 'No lo sé'] },
      { id: 'post_incubadora', type: 'text', label: '¿Necesitó incubadora? ¿Por cuánto tiempo?', placeholder: 'No / Sí, X días' },
      { id: 'post_color', type: 'text', label: 'Color que presentó al nacer', placeholder: 'Rosado, azulado, amarillo…' },
      { id: 'post_comentarios', type: 'textarea', label: 'Comentarios adicionales' },
    ],
  },

  // ─── IV. Historia Médica ───────────────────────────────────────────────
  {
    titulo: 'IV. Historia médica — Enfermedades', icono: '🏥',
    descripcion: 'Padecimientos específicos.',
    preguntas: [
      { id: 'med_enfermedades', type: 'checkbox', label: 'Marca las enfermedades que haya presentado:', options: ['Meningitis', 'Encefalitis', 'Convulsiones', 'Otitis', 'Ictericia', 'Fiebres altas', 'Amigdalitis', 'Otros', 'Ninguna'] },
      { id: 'med_enfermedades_detalle', type: 'textarea', label: 'Detalla las marcadas: edad y duración aproximadas.', placeholder: 'Ej: convulsiones a los 2 años, una sola vez de 5 min' },
    ],
  },
  {
    titulo: 'IV. Historia médica — Accidentes', icono: '🚨',
    descripcion: 'Registro de accidentes ocurridos.',
    preguntas: [
      { id: 'med_accidentes', type: 'tabla_dinamica', label: 'Accidentes',
        addLabel: '+ Agregar accidente', minRows: 0,
        columns: [
          { id: 'anio', label: 'Año', type: 'number', placeholder: 'Ej: 2022' },
          { id: 'edad', label: 'Edad', type: 'number', placeholder: 'Años' },
          { id: 'tipo', label: 'Tipo de accidente' },
          { id: 'tratamiento', label: 'Tratamiento recibido' },
          { id: 'situacion_final', label: 'Situación final / secuelas' },
          { id: 'medicamentos', label: 'Medicamentos' },
        ],
      },
    ],
  },
  {
    titulo: 'IV. Historia médica — Otros', icono: '🩺',
    preguntas: [
      { id: 'med_cambios_post', type: 'textarea', label: 'Cambios post-evento: ¿hubo cambios en el niño/a tras enfermedades o accidentes? ¿Pasajeros o continuos?' },
      { id: 'med_examen_neuro', type: 'textarea', label: 'Exámenes neurológicos: ¿le han hecho alguno? ¿Cuál fue el resultado?' },
      { id: 'med_diagnostico', type: 'textarea', label: 'Diagnósticos previos: ¿ha sido diagnosticado/a con alguna condición?' },
      { id: 'med_sensorial', type: 'textarea', label: '¿Presenta dificultades visuales o auditivas?' },
      { id: 'med_terapias_previas', type: 'textarea', label: 'Terapias recibidas: ¿cuál? ¿desde cuándo? ¿cuántas veces a la semana/mes?' },
      { id: 'med_otros', type: 'textarea', label: 'Otros comentarios médicos' },
    ],
  },

  // ─── V. Historia del Desarrollo Muscular ───────────────────────────────
  {
    titulo: 'V. Desarrollo muscular', icono: '🏃',
    descripcion: 'Hitos motores, dificultades y temperamento.',
    preguntas: [
      { id: 'mot_sentarse', type: 'text', label: '¿A qué edad se sentó solo/a?', placeholder: 'Meses' },
      { id: 'mot_gatear', type: 'text', label: '¿A qué edad gateó?', placeholder: 'Meses' },
      { id: 'mot_pararse', type: 'text', label: '¿A qué edad se paró solo/a?', placeholder: 'Meses' },
      { id: 'mot_caminar', type: 'text', label: '¿A qué edad caminó?', placeholder: 'Meses' },
      { id: 'mot_dificultades', type: 'textarea', label: 'Dificultades observadas durante estos hitos' },
      { id: 'mot_actividad', type: 'radio', label: 'Temperamento — considera que su hijo/a es:', options: ['Demasiado inquieto/a para su edad', 'Demasiado tranquilo/a para su edad', 'Adecuado/a para su edad'] },
    ],
  },

  // ─── VI. Movimiento y Lenguaje ─────────────────────────────────────────
  {
    titulo: 'VI. Movimiento y lenguaje', icono: '🗣️',
    descripcion: 'Movimientos, lateralidad y comunicación.',
    preguntas: [
      { id: 'mov_balanceo', type: 'textarea', label: 'Movimientos automáticos (balanceo, mecerse): ¿los presenta? ¿cuáles?' },
      { id: 'mov_agitados', type: 'textarea', label: 'Movimientos agitados (sacudir manos, estrujar): ¿cuándo aparecen?' },
      { id: 'mov_mano_preferida', type: 'radio', label: 'Lateralidad — mano preferida:', options: ['Derecha', 'Izquierda', 'Ambas', 'No definida aún'] },
      { id: 'leng_primera_edad', type: 'text', label: 'Edad de sus primeras palabras', placeholder: 'Meses' },
      { id: 'leng_dificultad_pronunciar', type: 'textarea', label: 'Dificultades de pronunciación (cuáles)' },
      { id: 'leng_dificultad_actual', type: 'textarea', label: 'Dificultades actuales al hablar: ¿en qué situaciones aparecen?' },
      { id: 'leng_comprende', type: 'radio', label: 'Nivel de comprensión — ¿entiende lo que se le dice?', options: ['Sí, todo', 'Casi todo', 'Solo cosas simples', 'Le cuesta entender'] },
    ],
  },

  // ─── VII. Formación de Hábitos ─────────────────────────────────────────
  {
    titulo: 'VII. Formación de hábitos — Alimentación', icono: '🍽️',
    preguntas: [
      { id: 'hab_lactancia', type: 'radio', label: 'Tipo de lactancia que recibió:', options: ['Materna exclusiva', 'Artificial', 'Mixta', 'No lo sé'] },
      { id: 'hab_lactancia_duracion', type: 'text', label: 'Duración de la lactancia', placeholder: 'Ej: 6 meses' },
      { id: 'hab_come_solo', type: 'radio', label: '¿Come sin ayuda y usa cubiertos?', options: ['Sí, sin problema', 'Parcialmente', 'No', 'Aún no por edad'] },
      { id: 'hab_apetito', type: 'textarea', label: 'Apetito y rechazo de alimentos: ¿cuáles?' },
    ],
  },
  {
    titulo: 'VII. Formación de hábitos — Higiene y sueño', icono: '🛁',
    preguntas: [
      { id: 'hab_control_orina_edad', type: 'text', label: 'Edad de control de orina (diurno/nocturno)' },
      { id: 'hab_control_heces_edad', type: 'text', label: 'Edad de control de heces' },
      { id: 'hab_control_actual', type: 'radio', label: 'En la actualidad, ¿controla orina y heces?', options: ['Sí, ambas', 'Solo diurno', 'Aún no', 'Variable'] },
      { id: 'hab_orina_cama', type: 'text', label: '¿Hasta qué edad se orinó en la cama? (o si aún ocurre)', placeholder: 'Ej: 5 años / aún ocurre' },
      { id: 'hab_sueno_primeros', type: 'textarea', label: 'Calidad del sueño durante los primeros 2 años' },
      { id: 'hab_medicamento_dormir', type: 'textarea', label: '¿Usó medicamentos para dormir? ¿Cuáles y por cuánto tiempo?' },
      { id: 'hab_horas_sueno', type: 'text', label: 'Horas que duerme actualmente', placeholder: 'Ej: 9 horas' },
      { id: 'hab_calidad_sueno', type: 'checkbox', label: 'Conductas durante el sueño:', options: ['Habla dormido', 'Grita', 'Se mueve mucho', 'Transpira', 'Babea', 'Cruje los dientes', 'Sonambulismo', 'Duerme tranquilo'] },
    ],
  },
  {
    titulo: 'VII. Formación de hábitos — Independencia', icono: '🧦',
    preguntas: [
      { id: 'hab_mandados', type: 'radio', label: '¿Realiza mandados?', options: ['Sí, dentro y fuera de casa', 'Solo dentro de casa', 'No', 'Aún no por edad'] },
      { id: 'hab_ayuda_casa', type: 'textarea', label: 'Ayuda en casa: ¿qué cosas hace?' },
      { id: 'hab_viste_solo', type: 'radio', label: 'Capacidad para vestirse solo/a:', options: ['Sí, completamente', 'Casi todo', 'Con ayuda', 'No, depende del adulto'] },
    ],
  },

  // ─── VIII. Historia Educativa ──────────────────────────────────────────
  {
    titulo: 'VIII. Historia educativa', icono: '🏫',
    descripcion: 'Trayectoria escolar.',
    preguntas: [
      { id: 'edu_edad_inicio', type: 'text', label: 'Edad de ingreso al colegio' },
      { id: 'edu_agrado', type: 'radio', label: '¿Le agrada asistir al colegio?', options: ['Sí, le gusta', 'Al inicio costó pero ahora va bien', 'Le cuesta ir', 'No le gusta'] },
      { id: 'edu_cambios_colegio', type: 'textarea', label: 'Cambios de colegio (¿cuántos y por qué?)' },
      { id: 'edu_relaciones', type: 'textarea', label: 'Relación con maestros y compañeros' },
      { id: 'edu_conducta_aula', type: 'textarea', label: 'Conducta en clase y en el recreo' },
      { id: 'edu_trayectoria', type: 'tabla_dinamica', label: 'Registro escolar por año',
        addLabel: '+ Agregar año escolar', minRows: 1,
        columns: [
          { id: 'anio', label: 'Año', type: 'number', placeholder: 'Ej: 2024' },
          { id: 'edad', label: 'Edad', type: 'number', placeholder: 'Años' },
          { id: 'colegio', label: 'Colegio / institución' },
          { id: 'grado', label: 'Grado' },
          { id: 'conducta', label: 'Conducta / dificultades observadas' },
          { id: 'aprobado', label: '¿Aprobó?', options: ['Sí', 'No', 'En proceso'] },
        ],
      },
    ],
  },

  // ─── IX. Juegos ────────────────────────────────────────────────────────
  {
    titulo: 'IX. Juegos', icono: '🎲',
    descripcion: 'Actividades preferidas y socialización al jugar.',
    preguntas: [
      { id: 'jue_solo', type: 'radio', label: '¿Juega solo/a?', options: ['Sí, frecuentemente', 'A veces', 'No, prefiere con otros', 'Variable'] },
      { id: 'jue_preferidos', type: 'textarea', label: 'Juegos, juguetes o actividades preferidas' },
      { id: 'jue_dirige', type: 'radio', label: 'Cuando juega con otros niños:', options: ['Dirige a los demás', 'Es dirigido por ellos', 'Es flexible / colabora', 'Le cuesta integrarse'] },
      { id: 'jue_tiempo_libre', type: 'textarea', label: 'Uso del tiempo libre' },
    ],
  },

  // ─── X. Dinámica Familiar ──────────────────────────────────────────────
  {
    titulo: 'X. Dinámica familiar', icono: '🏡',
    descripcion: 'Vínculos en el hogar, estilo de crianza y comportamiento.',
    preguntas: [
      { id: 'din_estructura', type: 'textarea', label: 'Estructura: ¿quiénes conforman la familia y con quién vive el menor?' },
      { id: 'din_crianza_otros', type: 'textarea', label: 'Roles de otros familiares cercanos en la crianza' },
      { id: 'din_dinamica', type: 'textarea', label: 'Dinámica: descripción de la comunicación en casa' },
      { id: 'din_cambios', type: 'textarea', label: 'Cambios significativos recientes (duelos, mudanzas, separaciones, etc.)' },
      { id: 'din_estilo_crianza', type: 'radio', label: 'Estilo de crianza predominante:', options: ['Permisivo', 'Autoritario', 'Negociador / democrático', 'Inconsistente', 'Otro'] },
      { id: 'din_conducta_casa', type: 'textarea', label: 'Comportamiento en casa' },
      { id: 'din_conductas_preocupan', type: 'textarea', label: 'Preocupaciones específicas de los padres (agresividad, retraimiento, miedo excesivo, etc.)' },
      { id: 'din_frente_a_limites', type: 'textarea', label: 'Reacciones ante situaciones nuevas, frustraciones o límites' },
      { id: 'din_tiempo_libre', type: 'textarea', label: '¿Qué le gusta hacer en su tiempo libre?' },
    ],
  },

  // ─── XI. Antecedentes Familiares ───────────────────────────────────────
  {
    titulo: 'XI. Antecedentes familiares', icono: '🧬',
    descripcion: 'Historial genético / familiar.',
    preguntas: [
      { id: 'ant_familiares', type: 'checkbox', label: '¿En la familia hay o hubo casos de…?', options: ['Enfermedades psiquiátricas', 'Epilepsia o convulsiones', 'Retardo mental / discapacidad intelectual', 'Dificultades de aprendizaje', 'Problemas de habla / lenguaje', 'TEA / autismo', 'TDAH', 'Depresión / ansiedad', 'Otros', 'Ninguno'] },
      { id: 'ant_familiares_detalle', type: 'textarea', label: 'Si marcaste alguna opción, indica quién y de qué se trata' },
    ],
  },
]

// ─── Íconos por sección (las fichas traen un emoji; aquí se muestra un ícono de línea) ──
const ICONO_SECCION: Record<string, any> = {
  '🧒': Baby, '👶': Baby, '👨‍👩‍👧': Users, '💬': MessageCircle, '🏫': School, '🩺': Stethoscope,
  '📋': ClipboardList, '🏠': House, '🏡': House, '✨': Sparkles, '🤰': HeartPulse, '❤️': Heart,
  '🤝': Handshake, '🌧️': CloudRain, '🧸': Puzzle, '🎒': Backpack, '🎓': GraduationCap, '🔍': Search,
  '🍼': Milk, '🏥': Hospital, '🚨': Siren, '🏃': PersonStanding, '🗣️': MessagesSquare, '🍽️': Utensils,
  '🛁': Bath, '🧦': Shirt, '🎲': Dices, '🧬': Dna,
}
const iconoDe = (s: Seccion) => ICONO_SECCION[s.icono] || ClipboardCheck

const cardClass = 'rounded-v border border-v-border bg-v-elevated shadow-v'
const qInput = 'w-full rounded-v-sm border border-v-border bg-v-bg px-4 py-3 text-sm text-v-text outline-none transition-shadow placeholder:text-v-subtle focus:border-v-accent/50 focus:ring-4 focus:ring-v-accent-soft'
// "7 años 3 meses" a partir de la fecha de nacimiento
function edadTexto(nacimiento: string | null | undefined, en: boolean) {
  if (!nacimiento) return ''
  const n = new Date(nacimiento + 'T00:00:00'), h = new Date()
  let meses = (h.getFullYear() - n.getFullYear()) * 12 + (h.getMonth() - n.getMonth())
  if (h.getDate() < n.getDate()) meses--
  if (isNaN(meses) || meses < 0) return ''
  const a = Math.floor(meses / 12), m = meses % 12
  return en ? `${a} year${a === 1 ? '' : 's'} ${m} month${m === 1 ? '' : 's'}` : `${a} año${a === 1 ? '' : 's'} ${m} mes${m === 1 ? '' : 'es'}`
}
const vacio = (v: any) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)

// Borrador local por paciente: si el padre cierra la pestaña no pierde lo escrito
function useBorrador(clave: string, respuestas: Record<string, any>, setRespuestas: (r: any) => void) {
  const [listo, setListo] = useState(false)
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(clave)
      if (guardado) setRespuestas((r: any) => ({ ...JSON.parse(guardado), ...r }))
    } catch { /* sin storage */ }
    setListo(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])
  useEffect(() => {
    if (!listo) return
    try { localStorage.setItem(clave, JSON.stringify(respuestas)) } catch { /* sin storage */ }
  }, [clave, respuestas, listo])
}
const borrarBorrador = (clave: string) => { try { localStorage.removeItem(clave) } catch { /* */ } }

// ─── Render del razonamiento de la IA (convierte **negritas** y --- a formato) ──
function RazonRecomendacion({ texto }: { texto: string }) {
  return (
    <div>
      {(texto || '').split('\n').map((ln, i) => {
        const t = ln.trim()
        if (t === '') return null
        if (/^[-—*_]{2,}$/.test(t)) return <hr key={i} className="my-3 h-px border-0 bg-v-border" />
        return (
          <p key={i} className="mb-2 text-sm leading-relaxed text-v-muted last:mb-0">
            {ln.split(/(\*\*[^*]+\*\*)/g).map((p, k) => p.startsWith('**') && p.endsWith('**')
              ? <strong key={k} className="font-semibold text-v-text">{p.slice(2, -2)}</strong>
              : <span key={k}>{p}</span>)}
          </p>
        )
      })}
    </div>
  )
}

// Encabezado común de cada fase
export function Hero({ Icon, eyebrow, titulo, children, tone = 'bg-v-accent-soft text-v-accent' }: { Icon: any; eyebrow?: string; titulo: React.ReactNode; children?: React.ReactNode; tone?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 22 }}
      className={`relative overflow-hidden ${cardClass}`}>
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(40rem 14rem at 0% 0%, var(--v-glow-1), transparent 70%)' }} />
      <div aria-hidden className="v-brand absolute inset-x-0 top-0 h-[3px]" />
      <div className="relative flex items-start gap-4 p-5 sm:p-6">
        <span className={`grid size-12 shrink-0 place-items-center rounded-[30%] ${tone}`}><Icon size={22} /></span>
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="text-sm text-v-muted">{eyebrow}</p>}
          <h2 className="v-headline text-[1.45rem] leading-tight text-v-text sm:text-[1.7rem]">{titulo}</h2>
          {children && <div className="mt-2 text-sm leading-relaxed text-v-muted">{children}</div>}
        </div>
      </div>
    </motion.div>
  )
}

function Estado({ Icon, tone, titulo, children, pulso = false }: { Icon: any; tone: string; titulo: string; children?: React.ReactNode; pulso?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`${cardClass} mx-auto max-w-xl p-7 text-center sm:p-8`}>
      <motion.span animate={pulso ? { scale: [1, 1.06, 1] } : undefined} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className={`mx-auto grid size-16 place-items-center rounded-full ${tone}`}><Icon size={30} /></motion.span>
      <h2 className="v-headline mt-4 text-xl text-v-text sm:text-2xl">{titulo}</h2>
      {children}
    </motion.div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
function FlujoEvaluacion({ child, profile }: Props) {
  const CONTACTO = useCentroBranding()
  const { t, locale } = useI18n()
  const toast = useToast()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const [loading, setLoading] = useState(true)
  const [evaluacion, setEvaluacion] = useState<any>(null)
  const [terapias, setTerapias] = useState<any[]>([])

  const [pasoIntake, setPasoIntake] = useState(0)
  const [respIntake, setRespIntake] = useState<Record<string, any>>({})
  const [enviandoIntake, setEnviandoIntake] = useState(false)
  const [analizando, setAnalizando] = useState(false)

  const [pasoAnamnesis, setPasoAnamnesis] = useState(0)
  const [respAnamnesis, setRespAnamnesis] = useState<Record<string, any>>({})
  const [enviandoAnamnesis, setEnviandoAnamnesis] = useState(false)

  const [terapiasElegidas, setTerapiasElegidas] = useState<string[]>([])
  const [mensajeEspecialista, setMensajeEspecialista] = useState('')
  const [enviandoSeleccion, setEnviandoSeleccion] = useState(false)

  const [confirmando, setConfirmando] = useState(false)
  const [showRechazoModal, setShowRechazoModal] = useState(false)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [enviandoRechazo, setEnviandoRechazo] = useState(false)

  const [generandoRec, setGenerandoRec] = useState(false)
  const [recIntentada, setRecIntentada] = useState(false)

  useEffect(() => { if (child?.id) cargar() }, [child?.id])
  // La ficha inicial arranca con lo que el centro ya sabe del niño (se puede corregir)
  useEffect(() => {
    if (!child?.id) return
    setRespIntake(r => ({
      ...r,
      menor_nombre: r.menor_nombre || child.name || '',
      menor_fecha_nacimiento: r.menor_fecha_nacimiento || child.birth_date || '',
      menor_edad: r.menor_edad || edadTexto(child.birth_date, locale === 'en'),
    }))
  }, [child?.id])

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/evaluacion-inicial?child_id=${child.id}`)
      const data = await res.json()
      if (data.ok) {
        setEvaluacion(data.evaluacion)
        try { window.dispatchEvent(new CustomEvent('vanty:eval-inicial')) } catch { /* noop */ }
        if (data.evaluacion?.respuestas_intake) setRespIntake(data.evaluacion.respuestas_intake)
        if (data.evaluacion?.anamnesis_especifica) setRespAnamnesis(data.evaluacion.anamnesis_especifica)
        if (data.evaluacion?.terapias_seleccionadas) setTerapiasElegidas(data.evaluacion.terapias_seleccionadas)
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const cargarTerapias = async () => {
    try {
      const res = await fetch('/api/terapias-catalogo')
      const data = await res.json()
      if (data.ok) setTerapias(data.terapias || [])
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    if (['anamnesis_completa', 'terapia_seleccionada', 'revisado', 'completado'].includes(evaluacion?.estado)) cargarTerapias()
  }, [evaluacion?.estado])

  // Asegura que la recomendación de terapias exista al llegar a la selección
  // (en la anamnesis se dispara en segundo plano y en serverless puede no completarse).
  useEffect(() => {
    const necesitaRec = evaluacion?.estado === 'anamnesis_completa' && (!evaluacion?.terapias_recomendadas || evaluacion.terapias_recomendadas.length === 0)
    if (necesitaRec && !recIntentada && !generandoRec) {
      setRecIntentada(true)
      ;(async () => {
        setGenerandoRec(true)
        try {
          await fetch('/api/evaluacion-inicial/recomendar-terapias', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ evaluacion_id: evaluacion.id }),
          })
          await cargar()
        } catch (e) { console.error(e) }
        finally { setGenerandoRec(false) }
      })()
    }
  }, [evaluacion?.estado, evaluacion?.terapias_recomendadas, recIntentada, generandoRec])

  const wa = CONTACTO.telefono ? `https://wa.me/${CONTACTO.telefonoDigitos}` : null

  if (!child) return <div className="v-scope p-8 text-center text-sm text-v-muted">{t('evalIni.selecHijo')}</div>
  if (loading) return <div className="v-scope grid place-items-center py-24"><Loader2 className="animate-spin text-v-accent" size={32} /></div>

  const estado = evaluacion?.estado || 'pendiente_intake'
  const nombreCorto = (child.name || '').split(' ')[0] || child.name

  // ═══ FASE 1: FICHA INICIAL ═══
  if (estado === 'pendiente_intake' || !evaluacion) {
    const secciones = en ? SECCIONES_INTAKE_EN : SECCIONES_INTAKE_ES
    const clave = `vanty_eval_intake_${child.id}`
    return (
      <Wizard
        clave={clave}
        secciones={secciones} seccionIdx={pasoIntake} setSeccionIdx={setPasoIntake}
        respuestas={respIntake} setRespuestas={setRespIntake}
        enviando={enviandoIntake} textoEnviando={analizando ? L('Analyzing…', 'Analizando…') : L('Sending…', 'Enviando…')}
        hero={
          <Hero Icon={ClipboardCheck} eyebrow={L('Initial evaluation · Step 1', 'Evaluación inicial · Paso 1')} titulo={t('evalIni.fichaInicialPapas')}>
            <p>{t('auto.evaluacionInicialView.docNecesarioPre')}<strong className="text-v-text">{child.name}</strong>.</p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-v-fill px-3 py-1 text-xs font-medium text-v-muted">
              <Lock size={12} /> {L('Private and confidential — used only for clinical purposes', 'Privado y confidencial — solo con fines clínicos')}
            </p>
          </Hero>
        }
        onEnviar={async () => {
          setEnviandoIntake(true)
          try {
            const res = await fetch('/api/evaluacion-inicial', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ child_id: child.id, parent_id: profile?.id, respuestas: respIntake }),
            })
            const d = await res.json()
            if (!d.ok) throw new Error(d.error)
            borrarBorrador(clave)
            setAnalizando(true)
            await fetch('/api/evaluacion-inicial/analizar', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: d.evaluacion.id }),
            })
            await cargar()
          } catch (e: any) { toast.error(L('Could not send: ', 'No se pudo enviar: ') + e.message) }
          finally { setEnviandoIntake(false); setAnalizando(false) }
        }}
      />
    )
  }

  // ═══ FASE 2: ANALIZANDO ═══
  if (estado === 'analizando') {
    return (
      <div className="v-scope py-6">
        <Estado Icon={Brain} tone="bg-v-accent-soft text-v-accent" titulo={t('auto.evaluacionInicialView.estamosRevisandoTuInformacion')} pulso>
          <p className="mt-2 text-sm text-v-muted">{t('auto.evaluacionInicialView.estoTomaUnosSegundosSi')}</p>
          <button onClick={cargar} className="v-brand mx-auto mt-6 inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold">
            <RefreshCw size={16} /> {L('Check again', 'Verificar de nuevo')}
          </button>
        </Estado>
      </div>
    )
  }

  // ═══ FASE 3: RECOMENDACIÓN + CONFIRMACIÓN ═══
  if (estado === 'recomendado') {
    const rec = evaluacion.recomendacion
    const mensaje = evaluacion.mensaje_amigable_padre || evaluacion.recomendacion_resumen || t('auto.evaluacionInicialView.hemosRevisado')
    const RecIcon = rec === 'neuropsicologica' ? Brain : Heart
    const recTitulo = rec === 'psicologica' ? t('auto.evaluacionInicialView.recTituloPsico')
      : rec === 'neuropsicologica' ? t('auto.evaluacionInicialView.recTituloNeuro')
      : t('auto.evaluacionInicialView.recTituloIntegral')
    const pasos = [t('evalIni.fichaDetallada'), t('auto.evaluacionInicialView.teMostramosTerapias', { v1: child.name }), t('evalIni.eligesEquipo')]

    return (
      <div className="v-scope mx-auto max-w-2xl space-y-4 pb-12">
        <Hero Icon={RecIcon} eyebrow={t('auto.evaluacionInicialView.nuestraSugerenciaPara', { v1: child.name })} titulo={recTitulo}>
          <p className="whitespace-pre-wrap text-v-text">{mensaje}</p>
        </Hero>

        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className={`${cardClass} p-5`}>
          <p className="text-[15px] font-semibold tracking-tight text-v-text">{t('auto.evaluacionInicialView.queSigueSiAceptas')}</p>
          <ol className="mt-4 space-y-3">
            {pasos.map((p, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-v-muted">
                <span className="v-brand grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold" style={{ boxShadow: 'none' }}>{i + 1}</span>
                <span className="pt-0.5">{p}</span>
              </li>
            ))}
          </ol>
        </motion.section>

        <div className="flex flex-col gap-2 sm:flex-row">
          <motion.button whileTap={{ scale: 0.98 }} disabled={confirmando}
            onClick={async () => {
              setConfirmando(true)
              try {
                const r = await fetch('/api/evaluacion-inicial/confirmar', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ evaluacion_id: evaluacion.id, acepta: true }),
                })
                const d = await r.json()
                if (!d.ok) throw new Error(d.error)
                await cargar()
              } catch (e: any) { toast.error('Error: ' + e.message) }
              finally { setConfirmando(false) }
            }}
            className="v-brand inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold disabled:opacity-60">
            {confirmando ? <Loader2 className="animate-spin" size={18} /> : <ThumbsUp size={18} />} {t('auto.evaluacionInicialView.estoyDeAcuerdoContinuar')}
          </motion.button>
          <button onClick={() => setShowRechazoModal(true)} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-v-fill px-6 text-sm font-semibold text-v-text transition-colors hover:bg-v-accent-soft hover:text-v-accent">
            <HelpCircle size={17} /> {L('I have questions', 'Tengo dudas')}
          </button>
        </div>

        <AnimatePresence>
          {showRechazoModal && (
            <motion.div className="fixed inset-0 z-[200] flex items-end justify-center bg-[#081426]/50 p-4 backdrop-blur-sm sm:items-center"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRechazoModal(false)}>
              <motion.div onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
                transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                className="w-full max-w-md rounded-v-lg border border-v-border bg-v-elevated p-6 shadow-v-lg">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><HelpCircle size={19} /></span>
                  <div>
                    <p className="text-[15px] font-semibold text-v-text">{t('evalIni.cuentanosDudas')}</p>
                    <p className="mt-1 text-sm text-v-muted">{t('auto.evaluacionInicialView.nuestroEquipoTeContactaraPor')}</p>
                  </div>
                </div>
                <textarea value={motivoRechazo} onChange={e => setMotivoRechazo(e.target.value)} rows={4} placeholder={t('evalIni.phDudas')} className={`${qInput} mt-4 resize-none`} />
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={() => setShowRechazoModal(false)} className="h-10 rounded-full px-4 text-sm font-semibold text-v-muted hover:bg-v-fill">{t('common.cancelar')}</button>
                  <button disabled={enviandoRechazo}
                    onClick={async () => {
                      setEnviandoRechazo(true)
                      try {
                        await fetch('/api/evaluacion-inicial/confirmar', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ evaluacion_id: evaluacion.id, acepta: false, motivo_rechazo: motivoRechazo }),
                        })
                        setShowRechazoModal(false)
                        await cargar()
                      } finally { setEnviandoRechazo(false) }
                    }}
                    className="v-brand inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-60">
                    {enviandoRechazo ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {t('common.enviar')}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // ═══ FASE 4: 2ª ANAMNESIS ═══
  if (estado === 'confirmado') {
    const neuro = evaluacion.recomendacion === 'neuropsicologica'
    const secciones = neuro ? (en ? SECCIONES_NEURO_EN : SECCIONES_NEURO_ES) : (en ? SECCIONES_PSICO_EN : SECCIONES_PSICO_ES)
    const clave = `vanty_eval_anamnesis_${child.id}`
    return (
      <Wizard
        clave={clave}
        secciones={secciones} seccionIdx={pasoAnamnesis} setSeccionIdx={setPasoAnamnesis}
        respuestas={respAnamnesis} setRespuestas={setRespAnamnesis}
        enviando={enviandoAnamnesis} textoEnviando={L('Saving…', 'Guardando…')}
        hero={
          <Hero Icon={neuro ? Brain : Heart} eyebrow={L('Initial evaluation · Step 2', 'Evaluación inicial · Paso 2')}
            titulo={neuro ? t('auto.evaluacionInicialView.fichaNeuro') : t('auto.evaluacionInicialView.fichaPsico')}>
            <p>{t('auto.evaluacionInicialView.algunasPreguntasPre')}<strong className="text-v-text">{child.name}</strong>.</p>
          </Hero>
        }
        onEnviar={async () => {
          setEnviandoAnamnesis(true)
          try {
            const res = await fetch('/api/evaluacion-inicial/anamnesis', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ evaluacion_id: evaluacion.id, respuestas: respAnamnesis }),
            })
            const d = await res.json()
            if (!d.ok) throw new Error(d.error)
            borrarBorrador(clave)
            await cargar()
          } catch (e: any) { toast.error(L('Could not save: ', 'No se pudo guardar: ') + e.message) }
          finally { setEnviandoAnamnesis(false) }
        }}
      />
    )
  }

  // ═══ FASE 5: SELECCIÓN DE TERAPIAS ═══
  if (estado === 'anamnesis_completa') {
    const recomendadasIds: string[] = evaluacion.terapias_recomendadas || []
    const recSet = new Set(recomendadasIds)
    const recomendadas = recomendadasIds.map(id => terapias.find(x => x.id === id)).filter(Boolean) as any[]
    const resto = terapias.filter(x => !recSet.has(x.id))

    const tarjeta = (ter: any, i: number) => {
      const checked = terapiasElegidas.includes(ter.id)
      const esRec = recSet.has(ter.id)
      const color = TERAPIA_COLORES[ter.color_tema || 'indigo'] || TERAPIA_COLORES.indigo
      return (
        <motion.button key={ter.id} type="button"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i, type: 'spring', stiffness: 220, damping: 24 }}
          whileHover={{ y: -3 }} whileTap={{ scale: 0.99 }}
          onClick={() => setTerapiasElegidas(arr => arr.includes(ter.id) ? arr.filter(x => x !== ter.id) : [...arr, ter.id])}
          className={`relative flex flex-col overflow-hidden rounded-v border bg-v-elevated text-left shadow-v transition-colors ${checked ? 'border-v-accent ring-4 ring-v-accent-soft' : 'border-v-border hover:border-v-accent/40'}`}>
          <div className="relative h-36 w-full shrink-0 overflow-hidden bg-v-fill">
            {ter.imagen_url
              ? <img src={ter.imagen_url} alt={ter.nombre} className="absolute inset-0 size-full object-cover" style={{ height: '100%' }} />
              : <span className="absolute inset-0 grid place-items-center" style={{ color: color.accent }}><ImageIcon size={34} className="opacity-40" /></span>}
            <span className="absolute inset-x-0 top-0 h-1" style={{ background: color.accent }} />
            {esRec && (
              <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-v-elevated/95 px-2.5 py-1 text-[11px] font-semibold text-v-accent shadow-v">
                <Sparkles size={11} /> {t('auto.evaluacionInicialView.recomendada')}
              </span>
            )}
            <span className={`absolute left-3 top-3 grid size-7 place-items-center rounded-full border-2 transition-colors ${checked ? 'border-transparent bg-v-accent text-white' : 'border-white/80 bg-black/15'}`}>
              {checked && <Check size={15} strokeWidth={3} />}
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-2.5 p-5">
            {ter.categoria && <span className="self-start rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: `${color.accent}1a`, color: color.accent }}>{ter.categoria}</span>}
            <p className="text-base font-semibold leading-tight tracking-tight text-v-text">{ter.nombre}</p>
            {ter.descripcion && <p className="text-sm leading-relaxed text-v-muted">{ter.descripcion}</p>}
            {ter.por_que && (
              <div className="rounded-v-sm bg-v-accent-soft/60 p-3 text-sm leading-relaxed text-v-muted">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-v-accent"><Sparkles size={12} /> {t('auto.evaluacionInicialView.porQueLlevarla')}</p>
                {ter.por_que}
              </div>
            )}
            {(ter.duracion || ter.precio != null) && (
              <div className="mt-auto flex items-end justify-between border-t border-v-border pt-3">
                {ter.duracion ? <div><p className="text-[11px] text-v-subtle">{t('ui.duracion')}</p><p className="text-sm font-semibold text-v-text">{ter.duracion}</p></div> : <span />}
                {ter.precio != null && <div className="text-right"><p className="text-[11px] text-v-subtle">{t('evalIni.inversion')}</p><p className="text-lg font-bold tabular-nums text-v-accent">S/ {Number(ter.precio).toFixed(0)}</p></div>}
              </div>
            )}
          </div>
        </motion.button>
      )
    }

    return (
      <div className="v-scope mx-auto max-w-4xl space-y-5 pb-28">
        <Hero Icon={Sparkles} eyebrow={L('Initial evaluation · Step 3', 'Evaluación inicial · Paso 3')} titulo={t('auto.evaluacionInicialView.casiTerminamos')}>
          <p>{recomendadas.length > 0
            ? L(`We reviewed ${nombreCorto}'s information carefully. Below is our personalized recommendation and the full catalog. Select the ones you want to know more about.`,
                `Revisamos con cuidado la información de ${nombreCorto}. Abajo verás nuestra recomendación personalizada y todo nuestro catálogo. Marca las que te interese conocer.`)
            : t('evalIni.terapiasOfrecemos')}</p>
        </Hero>

        {terapias.length === 0 || generandoRec ? (
          <div className={`${cardClass} py-14 text-center`}>
            <Loader2 className="mx-auto animate-spin text-v-accent" size={28} />
            <p className="mt-3 text-sm font-semibold text-v-text">{generandoRec ? t('auto.evaluacionInicialView.preparandoRecomendacion', { v1: nombreCorto }) : t('auto.evaluacionInicialView.cargandoTerapias')}</p>
            {generandoRec && <p className="mt-1 text-xs text-v-muted">{t('evalIni.tomaSegundos')}</p>}
          </div>
        ) : (
          <>
            {recomendadas.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><Sparkles size={15} /></span>
                  <div>
                    <p className="text-[15px] font-semibold tracking-tight text-v-text">{t('auto.evaluacionInicialView.loQueTeRecomendamosPara', { v1: String(nombreCorto) })}</p>
                    <p className="text-xs text-v-muted">{t('auto.evaluacionInicialView.basadoEnLaInformacionQue')}</p>
                  </div>
                </div>
                {evaluacion.terapias_recomendadas_razon && <div className={`${cardClass} p-5`}><RazonRecomendacion texto={evaluacion.terapias_recomendadas_razon} /></div>}
                <div className="grid gap-4 sm:grid-cols-2">{recomendadas.map(tarjeta)}</div>
              </section>
            )}
            {resto.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-[30%] bg-v-fill text-v-muted"><ClipboardList size={15} /></span>
                  <div>
                    <p className="text-[15px] font-semibold tracking-tight text-v-text">{recomendadas.length > 0 ? t('auto.evaluacionInicialView.todoCatalogo') : t('auto.evaluacionInicialView.nuestrasTerapias')}</p>
                    <p className="text-xs text-v-muted">{recomendadas.length > 0 ? t('auto.evaluacionInicialView.otrasOpciones') : t('auto.evaluacionInicialView.marcaLasQueInterese')}</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">{resto.map(tarjeta)}</div>
              </section>
            )}
          </>
        )}

        <section className={`${cardClass} p-5`}>
          <label className="block text-sm font-semibold text-v-text">{t('auto.evaluacionInicialView.mensajeAlEspecialistaOpcional')}</label>
          <textarea value={mensajeEspecialista} onChange={e => setMensajeEspecialista(e.target.value)} rows={3} placeholder={t('evalIni.phHorarios')} className={`${qInput} mt-2 resize-none`} />
        </section>

        {/* Barra fija con la selección */}
        <div className="sticky bottom-20 z-10 lg:bottom-4">
          <div className={`${cardClass} flex items-center gap-3 px-4 py-3 backdrop-blur-xl`}>
            <p className="min-w-0 flex-1 text-sm text-v-muted">
              <strong className="tabular-nums text-v-text">{terapiasElegidas.length}</strong> {L(terapiasElegidas.length === 1 ? 'therapy selected' : 'therapies selected', terapiasElegidas.length === 1 ? 'terapia elegida' : 'terapias elegidas')}
            </p>
            <motion.button whileTap={{ scale: 0.97 }} disabled={terapiasElegidas.length === 0 || enviandoSeleccion}
              onClick={async () => {
                setEnviandoSeleccion(true)
                try {
                  const r = await fetch('/api/evaluacion-inicial/seleccionar', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ evaluacion_id: evaluacion.id, terapia_ids: terapiasElegidas, mensaje_al_especialista: mensajeEspecialista }),
                  })
                  const d = await r.json()
                  if (!d.ok) throw new Error(d.error)
                  await cargar()
                } catch (e: any) { toast.error('Error: ' + e.message) }
                finally { setEnviandoSeleccion(false) }
              }}
              className="v-brand inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-40">
              {enviandoSeleccion ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} {L('Send to the specialist', 'Enviar al especialista')}
            </motion.button>
          </div>
        </div>
      </div>
    )
  }

  // ═══ FASE 6: ESPERANDO AL ESPECIALISTA ═══
  if (estado === 'terapia_seleccionada') {
    const elegidas = terapias.filter(x => (evaluacion.terapias_seleccionadas || []).includes(x.id))
    return (
      <div className="v-scope py-6">
        <Estado Icon={Clock} tone="bg-v-warning/15 text-v-warning" titulo={t('auto.evaluacionInicialView.tuSolicitudEstaEnRevision')} pulso>
          <p className="mt-2 text-sm leading-relaxed text-v-muted">
            {t('auto.evaluacionInicialView.enRevisionPre')}<strong className="text-v-text">{t('auto.evaluacionInicialView.enRevisionStrong')}</strong>{t('auto.evaluacionInicialView.enRevisionMid')}{child.name}{t('auto.evaluacionInicialView.enRevisionPost')}
          </p>
          {elegidas.length > 0 && (
            <div className="mt-5 rounded-v-sm bg-v-fill p-4 text-left">
              <p className="text-xs font-semibold text-v-muted">{t('evalIni.terapiasPediste')}</p>
              <ul className="mt-2 space-y-1.5">
                {elegidas.map(ter => <li key={ter.id} className="flex items-center gap-2 text-sm text-v-text"><CheckCircle2 size={14} className="shrink-0 text-v-success" /> {ter.nombre}</li>)}
              </ul>
            </div>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="mx-auto mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-v-fill px-5 text-sm font-semibold text-v-text transition-colors hover:bg-v-accent-soft hover:text-v-accent">
              <MessageCircle size={16} /> {t('auto.evaluacionInicialView.contactarMientrasTanto')}
            </a>
          )}
        </Estado>
      </div>
    )
  }

  // ═══ FASE 7: RESPUESTA DEL ESPECIALISTA ═══
  if (estado === 'revisado' || estado === 'completado') {
    const elegidas = terapias.filter(x => (evaluacion.terapias_seleccionadas || []).includes(x.id))
    return (
      <div className="v-scope mx-auto max-w-2xl space-y-4 pb-12">
        <Hero Icon={CheckCircle2} tone="bg-v-success/15 text-v-success" eyebrow={t('evalIni.respuestaEspecialista')} titulo={t('auto.evaluacionInicialView.mensajePara', { v1: child.name })} />
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className={`${cardClass} space-y-4 p-5`}>
          {evaluacion.respuesta_especialista
            ? <p className="whitespace-pre-wrap text-sm leading-relaxed text-v-text">{evaluacion.respuesta_especialista}</p>
            : <p className="text-sm text-v-muted">{t('evalIni.especialistaEnviaraPronto')}</p>}
          {elegidas.length > 0 && (
            <div className="rounded-v-sm bg-v-fill p-4">
              <p className="text-xs font-semibold text-v-muted">{t('evalIni.terapiasSolicitadas')}</p>
              <ul className="mt-2 space-y-1.5">
                {elegidas.map(ter => <li key={ter.id} className="flex items-center gap-2 text-sm text-v-text"><CheckCircle2 size={14} className="shrink-0 text-v-success" /> {ter.nombre}</li>)}
              </ul>
            </div>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="v-brand inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold">
              <MessageCircle size={16} /> {L('Book the first appointment', 'Coordinar la primera cita')}
            </a>
          )}
        </motion.section>
      </div>
    )
  }

  // ═══ FASE: DUDAS ENVIADAS ═══
  if (estado === 'rechazado') {
    return (
      <div className="v-scope py-6">
        <Estado Icon={HelpCircle} tone="bg-v-accent-soft text-v-accent" titulo={t('evalIni.recibimosDudas')}>
          <p className="mt-2 text-sm leading-relaxed text-v-muted">{t('auto.evaluacionInicialView.nuestroEquipoSeVaA')}</p>
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="v-brand mx-auto mt-5 inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold">
              <MessageCircle size={16} /> {L('Contact now', 'Contactar ahora')}
            </a>
          )}
        </Estado>
      </div>
    )
  }

  return null
}

// ═════════════════════════════════════════════════════════════════════════
// Asistente por secciones (ficha inicial y anamnesis)
// ═════════════════════════════════════════════════════════════════════════
export function Wizard({ clave, secciones, seccionIdx, setSeccionIdx, respuestas, setRespuestas, enviando, textoEnviando, hero, onEnviar }: {
  clave: string; secciones: Seccion[]; seccionIdx: number; setSeccionIdx: (n: number) => void
  respuestas: Record<string, any>; setRespuestas: (r: any) => void
  enviando: boolean; textoEnviando: string; hero: React.ReactNode; onEnviar: () => void
}) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const [faltantes, setFaltantes] = useState<string[]>([])
  useBorrador(clave, respuestas, setRespuestas)

  const seccion = secciones[seccionIdx]
  const total = secciones.length
  const ultimo = seccionIdx === total - 1
  const estadoSeccion = (s: Seccion) => {
    const req = s.preguntas.filter((p: any) => p.required)
    const hechas = s.preguntas.filter(p => !vacio(respuestas[p.id])).length
    return { hechas, total: s.preguntas.length, completa: req.every(p => !vacio(respuestas[p.id])) && hechas > 0 }
  }
  const progreso = Math.round(secciones.reduce((a, s) => a + (estadoSeccion(s).completa ? 1 : 0), 0) / total * 100)

  const irA = (i: number) => {
    setFaltantes([])
    setSeccionIdx(i)
    document.getElementById('eval-wizard-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const validar = () => {
    const f = seccion.preguntas.filter((p: any) => p.required && vacio(respuestas[p.id])).map(p => p.id)
    setFaltantes(f)
    if (f.length) document.getElementById(`preg-${f[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return f.length === 0
  }
  const cambiar = (upd: any) => { setRespuestas(upd); if (faltantes.length) setFaltantes([]) }

  return (
    <div id="eval-wizard-top" className="v-scope mx-auto max-w-5xl space-y-5 pb-12">
      {hero}

      <div className="grid gap-5 lg:grid-cols-[250px_1fr]">
        {/* Índice de secciones */}
        <aside className="hidden lg:block">
          <div className={`${cardClass} sticky top-4 p-2`}>
            <div className="flex items-center justify-between px-3 pb-2 pt-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-v-subtle">{L('Sections', 'Secciones')}</p>
              <p className="text-[11px] font-semibold tabular-nums text-v-accent">{progreso}%</p>
            </div>
            <div className="mx-3 mb-2 h-1.5 overflow-hidden rounded-full bg-v-fill">
              <motion.div className="v-brand h-full rounded-full" animate={{ width: `${progreso}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
            </div>
            <div className="max-h-[60vh] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {secciones.map((s, i) => {
                const on = i === seccionIdx
                const { completa } = estadoSeccion(s)
                const Icon = iconoDe(s)
                return (
                  <button key={i} onClick={() => irA(i)}
                    className={`relative flex w-full items-center gap-2.5 rounded-v-sm px-3 py-2 text-left text-[13px] transition-colors ${on ? 'text-v-accent' : 'text-v-muted hover:bg-v-fill hover:text-v-text'}`}>
                    {on && <motion.span layoutId="eval-seccion" transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-v-sm bg-v-accent-soft" />}
                    <span className={`relative grid size-6 shrink-0 place-items-center rounded-full ${completa ? 'bg-v-success text-white' : on ? 'bg-v-accent text-white' : 'bg-v-fill text-v-subtle'}`}>
                      {completa ? <Check size={12} strokeWidth={3} /> : <Icon size={12} />}
                    </span>
                    <span className={`relative line-clamp-2 flex-1 ${on ? 'font-semibold' : ''}`}>{s.titulo}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          {/* Progreso (celular) */}
          <div className="lg:hidden">
            <div className="mb-1.5 flex justify-between text-xs font-semibold text-v-muted">
              <span>{L(`Step ${seccionIdx + 1} of ${total}`, `Paso ${seccionIdx + 1} de ${total}`)}</span>
              <span className="tabular-nums text-v-accent">{progreso}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-v-fill">
              <motion.div className="v-brand h-full rounded-full" animate={{ width: `${Math.max(progreso, ((seccionIdx + 1) / total) * 100 * 0.15)}%` }} />
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.section key={seccionIdx} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
              className={`${cardClass} overflow-hidden`}>
              <SeccionRender seccion={seccion} indice={seccionIdx} total={total} respuestas={respuestas} setRespuestas={cambiar} faltantes={faltantes} />
            </motion.section>
          </AnimatePresence>

          {faltantes.length > 0 && (
            <p className="flex items-center gap-2 rounded-v-sm bg-v-danger/10 px-4 py-2.5 text-sm font-medium text-v-danger">
              <AlertCircle size={15} /> {L('Please answer the required questions marked in red.', 'Responde las preguntas obligatorias marcadas en rojo.')}
            </p>
          )}

          <div className={`${cardClass} flex items-center justify-between gap-2 px-4 py-3`}>
            <button onClick={() => irA(Math.max(0, seccionIdx - 1))} disabled={seccionIdx === 0}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-v-border px-4 text-sm font-semibold text-v-muted transition-colors hover:bg-v-fill hover:text-v-text disabled:opacity-40">
              <ChevronLeft size={16} /> {L('Back', 'Anterior')}
            </button>
            <span className="hidden text-xs text-v-subtle sm:block">{L('Your answers are saved on this device', 'Tus respuestas se guardan en este equipo')}</span>
            {!ultimo ? (
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => { if (validar()) irA(seccionIdx + 1) }}
                className="v-brand inline-flex h-10 items-center gap-1.5 rounded-full px-5 text-sm font-semibold">
                {L('Next', 'Siguiente')} <ChevronRight size={16} />
              </motion.button>
            ) : (
              <motion.button whileTap={{ scale: 0.97 }} disabled={enviando} onClick={() => { if (validar()) onEnviar() }}
                className="v-brand inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-60">
                {enviando ? <><Loader2 className="animate-spin" size={16} /> {textoEnviando}</> : <><Send size={16} /> {L('Send', 'Enviar')}</>}
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function OpcionPill({ on, onClick, children, check = false }: { on: boolean; onClick: () => void; children: React.ReactNode; check?: boolean }) {
  return (
    <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={onClick}
      className={`flex items-center gap-2.5 rounded-v-sm border px-4 py-3 text-left text-sm font-medium transition-all ${on ? 'border-transparent bg-v-accent-soft text-v-accent ring-4 ring-v-accent-soft' : 'border-v-border bg-v-bg text-v-text hover:border-v-accent/40'}`}>
      <span className={`grid size-5 shrink-0 place-items-center border-2 transition-colors ${check ? 'rounded-md' : 'rounded-full'} ${on ? 'border-v-accent bg-v-accent text-white' : 'border-v-border'}`}>
        {on && (check ? <Check size={12} strokeWidth={3} /> : <span className="size-2 rounded-full bg-white" />)}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </motion.button>
  )
}

function SeccionRender({ seccion, indice, total, respuestas, setRespuestas, faltantes }: any) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const setCampo = (id: string, v: any) => setRespuestas((r: any) => ({ ...r, [id]: v }))
  const toggleCheck = (id: string, o: string) => setRespuestas((r: any) => {
    const arr = Array.isArray(r[id]) ? r[id] : []
    return { ...r, [id]: arr.includes(o) ? arr.filter((x: string) => x !== o) : [...arr, o] }
  })
  const Icon = iconoDe(seccion)

  return (
    <>
      <div className="flex items-start gap-3 border-b border-v-border px-5 py-5 sm:px-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><Icon size={19} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tabular-nums text-v-subtle">{L(`Section ${indice + 1} of ${total}`, `Sección ${indice + 1} de ${total}`)}</p>
          <h3 className="text-lg font-semibold leading-tight tracking-tight text-v-text">{seccion.titulo}</h3>
          {seccion.descripcion && <p className="mt-1 text-sm text-v-muted">{seccion.descripcion}</p>}
        </div>
      </div>
      <div className="divide-y divide-v-border">
        {seccion.preguntas.map((p: Pregunta) => {
          const falta = faltantes.includes(p.id)
          const valor = respuestas[p.id]
          return (
            <div key={p.id} id={`preg-${p.id}`} className={`px-5 py-5 transition-colors sm:px-6 ${falta ? 'bg-v-danger/5' : ''}`}>
              <label className="mb-2.5 flex items-start gap-2 text-sm font-semibold text-v-text">
                <span className="flex-1">{p.label}{(p as any).required && <span className="ml-1 text-v-danger">*</span>}</span>
                {!vacio(valor) && <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-v-success" />}
              </label>

              {(p.type === 'text' || p.type === 'number' || p.type === 'date') && (
                <input type={p.type} value={valor || ''} placeholder={(p as any).placeholder} onChange={e => setCampo(p.id, e.target.value)}
                  className={`${qInput} ${p.type === 'date' ? 'max-w-xs' : ''} ${falta ? 'border-v-danger/60' : ''}`} />
              )}
              {p.type === 'textarea' && (
                <textarea value={valor || ''} placeholder={(p as any).placeholder} onChange={e => setCampo(p.id, e.target.value)} rows={3}
                  className={`${qInput} resize-y leading-relaxed ${falta ? 'border-v-danger/60' : ''}`} />
              )}
              {(p.type === 'radio' || p.type === 'select') && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(p as any).options.map((o: string) => <OpcionPill key={o} on={valor === o} onClick={() => setCampo(p.id, valor === o && p.type === 'select' ? '' : o)}>{o}</OpcionPill>)}
                </div>
              )}
              {p.type === 'checkbox' && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(p as any).options.map((o: string) => (
                    <OpcionPill key={o} check on={Array.isArray(valor) && valor.includes(o)} onClick={() => toggleCheck(p.id, o)}>{o}</OpcionPill>
                  ))}
                </div>
              )}
              {p.type === 'tabla_dinamica' && (() => {
                const cols = (p as any).columns as ColumnaTabla[]
                const minRows = (p as any).minRows ?? 1
                const filas: any[] = Array.isArray(valor) ? valor : []
                const filasMostrar = filas.length >= minRows ? filas : [...filas, ...Array(minRows - filas.length).fill({})]
                const setFila = (idx: number, colId: string, v: any) => {
                  const next = [...filasMostrar]
                  next[idx] = { ...(next[idx] || {}), [colId]: v }
                  setCampo(p.id, next)
                }
                const base = ((p as any).addLabel || '').replace(/^\+\s*/, '').replace(/^(Agregar|Añadir|Add)\s+/i, '')
                const etiqueta = base ? base.charAt(0).toUpperCase() + base.slice(1) : L('Row', 'Fila')
                return (
                  <div className="space-y-3">
                    {filasMostrar.map((fila, idx) => (
                      <div key={idx} className="rounded-v-sm border border-v-border bg-v-bg p-3.5">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold text-v-muted">{etiqueta} {idx + 1}</span>
                          {filasMostrar.length > minRows && (
                            <button type="button" onClick={() => { const next = filasMostrar.filter((_, i) => i !== idx); setCampo(p.id, next.length ? next : [{}]) }}
                              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-v-danger hover:bg-v-danger/10">
                              <Trash2 size={12} /> {L('Remove', 'Quitar')}
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          {cols.map(col => (
                            <div key={col.id}>
                              <label className="mb-1 block text-[11px] font-semibold text-v-muted">{col.label}</label>
                              {col.options ? (
                                <select value={fila[col.id] || ''} onChange={e => setFila(idx, col.id, e.target.value)} className={`${qInput} bg-v-elevated py-2.5`}>
                                  <option value="">—</option>
                                  {col.options.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                              ) : (
                                <input type={col.type || 'text'} value={fila[col.id] || ''} placeholder={col.placeholder} onChange={e => setFila(idx, col.id, e.target.value)} className={`${qInput} bg-v-elevated py-2.5`} />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => setCampo(p.id, [...filasMostrar, {}])}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-dashed border-v-border text-sm font-semibold text-v-muted transition-colors hover:border-v-accent/50 hover:text-v-accent">
                      <Plus size={15} /> {(p as any).addLabel?.replace(/^\+\s*/, '') || L('Add row', 'Agregar fila')}
                    </button>
                  </div>
                )
              })()}
              {falta && <p className="mt-2 text-xs font-medium text-v-danger">{L('This question is required.', 'Esta pregunta es obligatoria.')}</p>}
            </div>
          )
        })}
      </div>
    </>
  )
}


// ═════════════════════════════════════════════════════════════════════════
// Evaluación compartida familia ↔ equipo: secciones, visor de respuestas y constancia
// ═════════════════════════════════════════════════════════════════════════

/** Secciones de cada ficha: la inicial (intake) o la 2ª, según la recomendación. */
export function seccionesEvaluacion(tipo: 'intake' | 'anamnesis', recomendacion: string | null | undefined, en: boolean): Seccion[] {
  if (tipo === 'intake') return en ? SECCIONES_INTAKE_EN : SECCIONES_INTAKE_ES
  return recomendacion === 'neuropsicologica' ? (en ? SECCIONES_NEURO_EN : SECCIONES_NEURO_ES) : (en ? SECCIONES_PSICO_EN : SECCIONES_PSICO_ES)
}

function valorTexto(p: Pregunta, v: any, en: boolean): React.ReactNode {
  if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) return null
  if (p.type === 'date' && typeof v === 'string') {
    const d = new Date(v + 'T12:00:00')
    return isNaN(d.getTime()) ? v : d.toLocaleDateString(en ? 'en-US' : 'es-PE', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  if (p.type === 'tabla_dinamica' && Array.isArray(v)) {
    const cols = (p as any).columns as ColumnaTabla[]
    const filas = v.filter(f => f && Object.values(f).some(x => x != null && String(x).trim() !== ''))
    if (!filas.length) return null
    return (
      <div className="space-y-1.5">
        {filas.map((f, i) => (
          <p key={i} className="rounded-v-sm bg-v-fill/60 px-3 py-2 text-sm">
            {cols.map(c => f[c.id] ? <span key={c.id} className="mr-3 inline-block"><span className="text-v-subtle">{c.label}:</span> {String(f[c.id])}</span> : null)}
          </p>
        ))}
      </div>
    )
  }
  if (Array.isArray(v)) return (
    <div className="flex flex-wrap gap-1.5">{v.map((x: any) => <span key={String(x)} className="rounded-full bg-v-accent-soft px-2.5 py-0.5 text-xs font-medium text-v-accent">{String(x)}</span>)}</div>
  )
  if (typeof v === 'object') return JSON.stringify(v)
  return <span className="whitespace-pre-wrap">{String(v)}</span>
}

/** Respuestas de una ficha en solo lectura, agrupadas por sección (con las preguntas originales). */
export function RespuestasEvaluacion({ secciones, respuestas, abiertaInicial = false }: { secciones: Seccion[]; respuestas: Record<string, any>; abiertaInicial?: boolean }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const [abiertas, setAbiertas] = useState<Set<number>>(() => new Set(abiertaInicial ? [0] : []))
  const conDatos = secciones.map((sec, i) => ({ sec, i, filas: sec.preguntas.map(p => ({ p, v: valorTexto(p, respuestas?.[p.id], en) })).filter(x => x.v != null) }))
  const visibles = conDatos.filter(x => x.filas.length > 0)
  if (!visibles.length) return <p className="text-sm text-v-muted">{en ? 'No answers recorded yet.' : 'Aún no hay respuestas registradas.'}</p>
  return (
    <div className="space-y-2">
      {visibles.map(({ sec, i, filas }) => {
        const Icono = ICONO_SECCION[sec.icono] || ClipboardList
        const abierta = abiertas.has(i)
        return (
          <div key={i} className="overflow-hidden rounded-v-sm border border-v-border bg-v-bg">
            <button type="button" onClick={() => setAbiertas(a => { const n = new Set(a); n.has(i) ? n.delete(i) : n.add(i); return n })}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-v-fill/50">
              <span className="grid size-8 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><Icono size={15} /></span>
              <span className="min-w-0 flex-1 text-sm font-semibold text-v-text">{sec.titulo}</span>
              <span className="shrink-0 text-[11px] tabular-nums text-v-subtle">{filas.length}/{sec.preguntas.length}</span>
              <ChevronRight size={16} className={`shrink-0 text-v-subtle transition-transform ${abierta ? 'rotate-90' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {abierta && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <dl className="space-y-3 border-t border-v-border px-4 py-3">
                    {filas.map(({ p, v }) => (
                      <div key={p.id}>
                        <dt className="text-xs font-semibold text-v-muted">{p.label}</dt>
                        <dd className="mt-0.5 text-sm text-v-text">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

/** "Llenado por…": la familia o el equipo, con fecha. */
export function autoriaFicha(rol: string | null | undefined, fecha: string | null | undefined, en: boolean, vistaFamilia: boolean) {
  const quien = !rol ? null
    : rol === 'padre' ? (vistaFamilia ? (en ? 'you' : 'ti') : (en ? 'the family' : 'la familia'))
    : (en ? "the center's team" : 'el equipo del centro')
  const cuando = fecha ? new Date(fecha).toLocaleDateString(en ? 'en-US' : 'es-PE', { day: 'numeric', month: 'short', year: 'numeric' }) : null
  if (!quien && !cuando) return null
  return en ? `Filled in${quien ? ` by ${quien}` : ''}${cuando ? ` · ${cuando}` : ''}` : `Llenada${quien ? ` por ${quien}` : ''}${cuando ? ` · ${cuando}` : ''}`
}

/** Constancia para la familia: lo que se llenó (por ella o por el equipo) siempre queda visible. */
function ConstanciaEvaluacion({ child }: { child: any }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const [ev, setEv] = useState<any>(null)
  useEffect(() => {
    if (!child?.id) return
    const cargar = () => fetch(`/api/evaluacion-inicial?child_id=${child.id}`).then(r => r.json()).then(d => setEv(d?.evaluacion ?? null)).catch(() => {})
    cargar()
    window.addEventListener('vanty:eval-inicial', cargar)
    return () => window.removeEventListener('vanty:eval-inicial', cargar)
  }, [child?.id])

  if (!ev?.respuestas_intake || ev.estado === 'pendiente_intake') return null
  const fichas = [
    { titulo: L('Initial form for parents', 'Ficha inicial para papás'), secciones: seccionesEvaluacion('intake', null, en), resp: ev.respuestas_intake, autor: autoriaFicha(ev.intake_llenado_rol, ev.intake_completado_en, en, true) },
    ...(ev.anamnesis_especifica ? [{
      titulo: ev.recomendacion === 'neuropsicologica' ? L('Neuropsychological form', 'Ficha neuropsicológica') : L('Psychological-emotional form', 'Ficha psicológica emocional'),
      secciones: seccionesEvaluacion('anamnesis', ev.recomendacion, en), resp: ev.anamnesis_especifica,
      autor: autoriaFicha(ev.anamnesis_llenado_rol, ev.anamnesis_completada_en, en, true),
    }] : []),
  ]
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`${cardClass} mx-auto mt-5 max-w-4xl p-4 sm:p-5`}>
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><ClipboardCheck size={18} /></span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-v-text">{L('Record of the evaluation', 'Constancia de la evaluación')}</p>
          <p className="text-xs text-v-muted">{L(`Everything recorded about ${child.name}. It stays here for you to review anytime.`, `Todo lo registrado sobre ${child.name}. Queda aquí para que lo revises cuando quieras.`)}</p>
        </div>
      </div>
      <div className="space-y-5">
        {fichas.map(f => (
          <div key={f.titulo}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-v-text">{f.titulo}</p>
              {f.autor && <span className="rounded-full bg-v-fill px-2.5 py-0.5 text-[11px] text-v-muted">{f.autor}</span>}
            </div>
            <RespuestasEvaluacion secciones={f.secciones} respuestas={f.resp} />
          </div>
        ))}
        {ev.editado_en && <p className="text-[11px] text-v-subtle">{L('Last updated by the center’s team on ', 'Actualizada por el equipo del centro el ')}{new Date(ev.editado_en).toLocaleDateString(en ? 'en-US' : 'es-PE', { day: 'numeric', month: 'long' })}</p>}
      </div>
    </motion.section>
  )
}

export default function EvaluacionInicialView(props: Props) {
  return (
    <>
      <FlujoEvaluacion {...props} />
      <div className="v-scope pb-10"><ConstanciaEvaluacion child={props.child} /></div>
    </>
  )
}
