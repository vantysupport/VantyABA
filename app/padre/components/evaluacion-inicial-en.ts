// Versión EN de los formularios de Evaluación Inicial (traducción propia, no IA en vivo).
// Los `id` se mantienen idénticos a la versión ES: solo cambia el texto visible.
import type { Seccion } from './EvaluacionInicialView'

export const SECCIONES_INTAKE_EN: Seccion[] = [
  {
    titulo: 'General information about the child', icono: '🧒',
    descripcion: 'Basic information about the child to be evaluated.',
    preguntas: [
      { id: 'menor_nombre', type: 'text', label: "Child's full name", required: true },
      { id: 'menor_edad', type: 'text', label: 'Age (years and months)', placeholder: 'E.g.: 7 years 3 months', required: true },
      { id: 'menor_fecha_nacimiento', type: 'date', label: 'Date of birth', required: true },
      { id: 'menor_grado', type: 'text', label: 'School grade', placeholder: 'E.g.: 2nd grade' },
      { id: 'menor_institucion', type: 'text', label: 'School' },
      { id: 'menor_residencia', type: 'text', label: 'Place of residence (district / city)' },
      { id: 'menor_contacto', type: 'text', label: 'Contact number', placeholder: "Indicate whether it's mom's or dad's", required: true },
    ],
  },
  {
    titulo: "Parents' general information", icono: '👨‍👩‍👧',
    preguntas: [
      { id: 'padre_nombre', type: 'text', label: "Father's full name" },
      { id: 'madre_nombre', type: 'text', label: "Mother's full name" },
    ],
  },
  {
    titulo: 'Reason for consultation', icono: '💬',
    descripcion: 'Tell us in your own words what brings you to the center.',
    preguntas: [
      { id: 'motivo_principal', type: 'textarea', label: 'What is your main concern? Mention one or several.', required: true },
      { id: 'desde_cuando', type: 'radio', label: 'How long have you noticed this concern?', options: ['Less than 1 month', '1-3 months', '3-6 months', 'More than 6 months'], required: true },
      { id: 'como_manejo', type: 'textarea', label: 'How have you handled it? How have you tried to solve it?' },
    ],
  },
  {
    titulo: 'School history', icono: '🏫',
    preguntas: [
      { id: 'experiencia_escolar', type: 'textarea', label: "How has your child's school experience been so far?" },
      { id: 'rendimiento_academico', type: 'textarea', label: 'How do you think they are doing academically?' },
      { id: 'bullying', type: 'textarea', label: 'Have they ever suffered bullying? Any important school detail you want to mention?' },
    ],
  },
  {
    titulo: 'Diagnosis and/or comorbidities', icono: '🩺',
    preguntas: [
      { id: 'diagnostico_previo', type: 'textarea', label: 'Do they have any previous diagnosis? Which one?' },
      { id: 'alergias_medicacion', type: 'textarea', label: 'Do they have allergies or are they taking any medication?' },
      { id: 'antecedentes_medicos', type: 'textarea', label: 'Any medical history of the child or a relative that you consider important?' },
    ],
  },
  {
    titulo: 'Previous evaluations and therapies', icono: '📋',
    preguntas: [
      { id: 'evaluaciones_previas', type: 'textarea', label: 'Were previous evaluations carried out? If so, what were the results?' },
      { id: 'terapias_previas', type: 'textarea', label: 'Have they received any type of therapy before (psychology, occupational therapy, speech, physiotherapy, etc.)? How did it go?' },
    ],
  },
  {
    titulo: 'Family dynamics', icono: '🏠',
    preguntas: [
      { id: 'conflictos_recientes', type: 'textarea', label: 'Were there family conflicts or any major change in the last 6 months (separation, moving, loss of a loved one)?' },
      { id: 'manejo_conflictos', type: 'textarea', label: 'How do you handle conflicts at home?' },
      { id: 'notas_adicionales', type: 'textarea', label: 'Additional notes: anything you want to mention that was not covered in the previous questions.' },
    ],
  },
  {
    titulo: 'Final information', icono: '✨',
    descripcion: 'To get to know you better.',
    preguntas: [
      { id: 'medio_conocimiento', type: 'select', label: 'How did you hear about us?', options: ['Instagram', 'Tiktok', 'Recommendation', 'School', 'Others'] },
      { id: 'medio_otros', type: 'text', label: 'If you chose "Others", tell us which:', placeholder: 'E.g.: Facebook, Google search, etc.' },
      { id: 'recibir_contenido', type: 'radio', label: 'Would you like to receive information, parenting/family tips and content about our services in your email?', options: ['Yes', 'No'], required: true },
    ],
  },
]

export const SECCIONES_PSICO_EN: Seccion[] = [
  {
    titulo: 'I. General information', icono: '🧒',
    descripcion: 'Basic information about the child.',
    preguntas: [
      { id: 'menor_nombre', type: 'text', label: 'Full name', required: true },
      { id: 'menor_sexo', type: 'radio', label: 'Sex', options: ['Female', 'Male', 'Other / prefer not to say'] },
      { id: 'menor_edad', type: 'text', label: 'Age (years and months)', placeholder: 'E.g.: 7 years 3 months' },
      { id: 'menor_fecha_nacimiento', type: 'date', label: 'Date of birth' },
      { id: 'menor_escolaridad', type: 'text', label: 'Schooling / grade', placeholder: 'E.g.: 2nd grade' },
      { id: 'menor_institucion', type: 'text', label: 'School' },
      { id: 'menor_direccion', type: 'text', label: 'Address' },
      { id: 'menor_residencia', type: 'text', label: 'Place of residence', placeholder: 'District / city' },
      { id: 'menor_tiempo_lima', type: 'text', label: 'Time living in Lima', placeholder: 'E.g.: 5 years / always' },
      { id: 'menor_celular', type: 'text', label: 'Contact phone number(s)' },
      { id: 'menor_correo', type: 'text', label: 'Contact email(s)' },
    ],
  },
  {
    titulo: 'I. Family information', icono: '👨‍👩‍👧',
    descripcion: 'People who live with the child. You can add as many family members as you need.',
    preguntas: [
      { id: 'datos_familiares', type: 'tabla_dinamica', label: 'Family members who live with the child',
        addLabel: '+ Add family member', minRows: 2,
        columns: [
          { id: 'relacion', label: 'Relationship', options: ['Mother', 'Father', 'Sibling', 'Grandparent', 'Uncle/Aunt', 'Other'] },
          { id: 'nombre', label: 'Full name' },
          { id: 'edad', label: 'Age', type: 'number', placeholder: 'Years' },
          { id: 'instruccion', label: 'Education level', placeholder: 'E.g.: Higher, technical' },
          { id: 'ocupacion', label: 'Occupation' },
        ],
      },
    ],
  },
  {
    titulo: 'II. Reason for consultation', icono: '💬',
    descripcion: 'The main concerns and their context.',
    preguntas: [
      { id: 'preocupaciones', type: 'textarea', label: 'What are the main concerns (behavior, language, self-care, emotional, etc.)? Describe each one as thoroughly as possible.', required: true },
      { id: 'desde_cuando', type: 'textarea', label: 'How long have these behaviors been observed?', required: true },
      { id: 'situaciones_frecuentes', type: 'textarea', label: 'In what situations do they appear most frequently?' },
      { id: 'entornos_afectados', type: 'checkbox', label: 'Settings where they appear:', options: ['Home', 'School', 'Peer relationships', 'Extended family', 'Public spaces', 'Others'] },
      { id: 'intentos_previos', type: 'textarea', label: 'What have you tried to manage it? How effective was it?' },
      { id: 'opinion_profesores', type: 'textarea', label: 'Opinion of the teachers / school team' },
    ],
  },
  {
    titulo: 'III. Developmental history', icono: '🤰',
    descripcion: 'Pregnancy, birth and early milestones.',
    preguntas: [
      { id: 'complicaciones_embarazo_parto', type: 'textarea', label: 'Complications during pregnancy and/or birth' },
      { id: 'hito_sostener_cabeza', type: 'text', label: 'Age they held their head up', placeholder: 'Months' },
      { id: 'hito_sentarse', type: 'text', label: 'Age they sat up on their own', placeholder: 'Months' },
      { id: 'hito_gatear', type: 'text', label: 'Age they crawled', placeholder: 'Months' },
      { id: 'hito_caminar', type: 'text', label: 'Age they walked', placeholder: 'Months' },
      { id: 'hito_hablar', type: 'text', label: 'Age they started talking', placeholder: 'Months' },
    ],
  },
  {
    titulo: 'III. Medical and family history', icono: '🩺',
    preguntas: [
      { id: 'alergias', type: 'textarea', label: 'Do they have allergies? Which ones?' },
      { id: 'hospitalizaciones', type: 'textarea', label: 'Hospitalizations (reason, age, duration)' },
      { id: 'medicacion', type: 'textarea', label: 'Are they taking medication? Which one and since when?' },
      { id: 'diagnostico_previo', type: 'textarea', label: 'Previous diagnoses' },
      { id: 'antecedentes_familiares', type: 'checkbox', label: 'Family history of:', options: ['Mental health (depression, anxiety, etc.)', 'ASD / autism', 'ADHD', 'Learning difficulties', 'Speech / language difficulties', 'Epilepsy / seizures', 'Intellectual disability', 'Others', 'None'] },
      { id: 'antecedentes_detalle', type: 'textarea', label: 'If you marked any, indicate who and what it is about' },
    ],
  },
  {
    titulo: 'IV. School history', icono: '🏫',
    descripcion: 'Trajectory and performance at school.',
    preguntas: [
      { id: 'edu_edad_inicio', type: 'text', label: 'Age they started school', placeholder: 'Years' },
      { id: 'edu_adaptacion', type: 'textarea', label: 'Adaptation at the different educational levels (preschool, primary, secondary)' },
      { id: 'edu_gustos', type: 'textarea', label: 'Subjects they like most' },
      { id: 'edu_dificultades', type: 'textarea', label: 'Subjects in which they have difficulties' },
      { id: 'edu_comentarios_colegio', type: 'textarea', label: 'Recurring comments from the school about your child' },
      { id: 'edu_conducta_bullying', type: 'textarea', label: 'Behavior problems or bullying (received or done)' },
      { id: 'edu_apoyos_previos', type: 'textarea', label: 'Previous support received (tutoring, psychopedagogical therapy, etc.)' },
    ],
  },
  {
    titulo: 'V. Socio-emotional area', icono: '❤️',
    preguntas: [
      { id: 'soc_personalidad', type: 'textarea', label: "How would you describe your child's personality?" },
      { id: 'soc_expresion_emociones', type: 'radio', label: 'How do they express their emotions?', options: ['They talk about them with words', 'They show them through behavior', 'They keep them to themselves', 'It depends on the moment'] },
      { id: 'soc_factores_frustracion', type: 'textarea', label: 'What situations cause them frustration?' },
      { id: 'soc_reaccion_limites', type: 'textarea', label: 'How do they react to limits or when told "no"?' },
      { id: 'soc_autorregulacion', type: 'textarea', label: 'What strategies do they use to calm down? Do they manage on their own or need help?' },
    ],
  },
  {
    titulo: 'V. Family relationships', icono: '🏡',
    preguntas: [
      { id: 'fam_convivencia', type: 'textarea', label: 'What is life at home like?' },
      { id: 'fam_vinculos_afectivos', type: 'textarea', label: 'Affective bonds: who are they closest to? Who do they struggle with?' },
      { id: 'fam_estilo_disciplina', type: 'radio', label: 'Predominant discipline style:', options: ['Permissive', 'Authoritarian', 'Negotiating / democratic', 'Inconsistent', 'Other'] },
      { id: 'fam_estrategias_disciplina', type: 'textarea', label: 'What strategies do you use when there is a behavior problem?' },
      { id: 'fam_conflictos', type: 'textarea', label: 'Are there current family conflicts that are important to know about?' },
    ],
  },
  {
    titulo: 'V. Social sphere', icono: '🤝',
    preguntas: [
      { id: 'social_amigos', type: 'radio', label: 'Is it easy for them to make friends?', options: ['Yes, very easy', 'With some effort', 'They struggle', 'They hardly socialize'] },
      { id: 'social_juego_pref', type: 'radio', label: 'When they play, they prefer:', options: ['To be alone', 'To be in a group', "It doesn't matter to them", 'It depends on the moment'] },
      { id: 'social_fuera_colegio', type: 'textarea', label: 'What is their social interaction like outside school? (relatives, neighbors, extracurricular activities)' },
      { id: 'social_manejo_conflictos', type: 'textarea', label: 'How do they handle conflicts with their peers?' },
    ],
  },
  {
    titulo: 'V. Current emotional state', icono: '🌧️',
    descripcion: 'Your honesty helps us take better care of your child.',
    preguntas: [
      { id: 'emo_sintomas', type: 'checkbox', label: 'Mark what you currently observe:', options: ['Persistent sadness', 'Frequent irritability or anger', 'Intense fears', 'Changes in sleep', 'Changes in appetite', 'Negative thoughts about themselves', 'Social isolation', 'Anticipatory fear (of something about to happen)', 'Risk behaviors', 'They are fine most of the time'] },
      { id: 'emo_pensamientos_riesgo', type: 'textarea', label: 'Have they expressed concerning thoughts (not wanting to be here, hurting themselves, etc.)? Your honesty helps us take better care of them.' },
      { id: 'emo_descripcion_general', type: 'textarea', label: "How would you describe your child's general emotional state right now?" },
    ],
  },
  {
    titulo: 'VI. Age-specific area (2–6 years)', icono: '🧸',
    descripcion: 'Complete this section if your child is between 2 and 6 years old. If not, skip it.',
    preguntas: [
      { id: 'edad26_juego_simbolico', type: 'textarea', label: 'Symbolic play: do they play "pretend" (cooking, being a doctor, etc.)? How often?' },
      { id: 'edad26_imitacion', type: 'textarea', label: 'Imitation: do they imitate actions, sounds, gestures of others?' },
      { id: 'edad26_rutinas', type: 'textarea', label: 'Routines: do they adapt to routines or struggle? How do they react to changes?' },
      { id: 'edad26_separacion', type: 'textarea', label: 'Separation from the caregiver: how do they react when saying goodbye to mom/dad?' },
    ],
  },
  {
    titulo: 'VI. Age-specific area (7–11 years)', icono: '🎒',
    descripcion: 'Complete this section if your child is between 7 and 11 years old. If not, skip it.',
    preguntas: [
      { id: 'edad711_autoconcepto', type: 'textarea', label: 'Self-concept: how do they see themselves? What opinion do they have of themselves?' },
      { id: 'edad711_frustracion', type: 'textarea', label: "Frustration management: what do they do when something doesn't work out?" },
      { id: 'edad711_habilidades_sociales', type: 'textarea', label: 'Social skills: how do they relate to their peers?' },
      { id: 'edad711_miedos', type: 'textarea', label: 'Frequent fears: what causes them fear or anxiety?' },
    ],
  },
  {
    titulo: 'VI. Age-specific area (12–15 years)', icono: '🎓',
    descripcion: 'Complete this section if your child is between 12 and 15 years old. If not, skip it.',
    preguntas: [
      { id: 'edad1215_autoestima', type: 'textarea', label: 'Self-esteem / identity: how do they value themselves?' },
      { id: 'edad1215_cambios_etapa', type: 'textarea', label: 'Managing the changes of adolescence (bodily, emotional, social)' },
      { id: 'edad1215_pares', type: 'textarea', label: 'Peer influence: how influenced are they by their friends?' },
      { id: 'edad1215_tecnologia', type: 'textarea', label: 'Use of technology and social media: amount of time, platforms, behavior' },
      { id: 'edad1215_metas_futuro', type: 'textarea', label: 'Future goals: what plans / dreams do they have?' },
    ],
  },
  {
    titulo: 'VII. Expectations and observations', icono: '✨',
    preguntas: [
      { id: 'expectativas', type: 'textarea', label: 'What do you expect to get from this evaluation?', required: true },
      { id: 'cambios_deseados', type: 'textarea', label: 'What changes do you want to see in your child after the process?' },
      { id: 'observaciones', type: 'textarea', label: 'Final observations: anything you want to share that was not covered before.' },
    ],
  },
]

export const SECCIONES_NEURO_EN: Seccion[] = [
  {
    titulo: 'I. Family information', icono: '👨‍👩‍👧',
    descripcion: 'Family members who live with the child. You can add as many as you need.',
    preguntas: [
      { id: 'datos_familiares', type: 'tabla_dinamica', label: 'Family members who live with the child',
        addLabel: '+ Add family member', minRows: 2,
        columns: [
          { id: 'relacion', label: 'Relationship', options: ['Mother', 'Father', 'Sibling', 'Grandparent', 'Uncle/Aunt', 'Other'] },
          { id: 'nombre', label: 'Full name' },
          { id: 'edad', label: 'Age', type: 'number', placeholder: 'Years' },
          { id: 'instruccion', label: 'Education level', placeholder: 'E.g.: Higher, technical' },
          { id: 'ocupacion', label: 'Occupation' },
        ],
      },
    ],
  },
  {
    titulo: 'II. Current profile', icono: '🔍',
    descripcion: 'The main concerns that motivate the consultation.',
    preguntas: [
      { id: 'perfil_preocupaciones', type: 'textarea', label: 'Reason for consultation: What are the main concerns related to behavior, language, self-care, etc.? Describe each one as thoroughly as possible.', required: true },
      { id: 'perfil_desde_cuando', type: 'textarea', label: 'Onset: How long have these behaviors been observed?', required: true },
    ],
  },
  {
    titulo: 'III. Developmental history — Prenatal', icono: '🤰',
    descripcion: 'Stage before birth.',
    preguntas: [
      { id: 'pren_duracion', type: 'text', label: 'Length of pregnancy', placeholder: 'E.g.: 9 months / 38 weeks' },
      { id: 'pren_programado', type: 'radio', label: 'Was it a planned pregnancy?', options: ['Yes', 'No', "I'm not sure"] },
      { id: 'pren_salud', type: 'textarea', label: 'Maternal health during pregnancy (illnesses, complications)' },
      { id: 'pren_edad_papa', type: 'number', label: "Father's age when the child was born" },
      { id: 'pren_edad_mama', type: 'number', label: "Mother's age when they were born" },
      { id: 'pren_medicamentos', type: 'textarea', label: 'Medication taken during pregnancy. Which ones?' },
      { id: 'pren_comentarios', type: 'textarea', label: 'Other comments about the pregnancy' },
    ],
  },
  {
    titulo: 'III. Developmental history — Perinatal', icono: '🍼',
    descripcion: 'The birth.',
    preguntas: [
      { id: 'peri_duracion_gestacion', type: 'radio', label: 'Length of gestation:', options: ['Normal (full term)', 'Premature', 'Post-term', "I don't know"] },
      { id: 'peri_tipo_parto', type: 'radio', label: 'Type of birth:', options: ['Natural', 'Scheduled C-section', 'Emergency C-section', "I don't know"] },
      { id: 'peri_motivo_cesarea', type: 'textarea', label: 'If it was a C-section, why?' },
      { id: 'peri_comentarios', type: 'textarea', label: 'Additional comments about the birth' },
    ],
  },
  {
    titulo: 'III. Developmental history — Postnatal', icono: '👶',
    descripcion: 'The first days after birth.',
    preguntas: [
      { id: 'post_lloro', type: 'radio', label: 'Did they cry immediately at birth?', options: ['Yes', 'No', "I don't know"] },
      { id: 'post_oxigeno', type: 'radio', label: 'Did they need oxygen / resuscitation?', options: ['No', 'Yes, briefly', 'Yes, prolonged', "I don't know"] },
      { id: 'post_incubadora', type: 'text', label: 'Did they need an incubator? For how long?', placeholder: 'No / Yes, X days' },
      { id: 'post_color', type: 'text', label: 'Color they had at birth', placeholder: 'Pink, bluish, yellow…' },
      { id: 'post_comentarios', type: 'textarea', label: 'Additional comments' },
    ],
  },
  {
    titulo: 'IV. Medical history — Illnesses', icono: '🏥',
    descripcion: 'Specific conditions.',
    preguntas: [
      { id: 'med_enfermedades', type: 'checkbox', label: 'Mark the illnesses they have had:', options: ['Meningitis', 'Encephalitis', 'Seizures', 'Otitis', 'Jaundice', 'High fevers', 'Tonsillitis', 'Others', 'None'] },
      { id: 'med_enfermedades_detalle', type: 'textarea', label: 'Detail the ones marked: approximate age and duration.', placeholder: 'E.g.: seizures at age 2, only once for 5 min' },
    ],
  },
  {
    titulo: 'IV. Medical history — Accidents', icono: '🚨',
    descripcion: 'Record of accidents that occurred.',
    preguntas: [
      { id: 'med_accidentes', type: 'tabla_dinamica', label: 'Accidents',
        addLabel: '+ Add accident', minRows: 0,
        columns: [
          { id: 'anio', label: 'Year', type: 'number', placeholder: 'E.g.: 2022' },
          { id: 'edad', label: 'Age', type: 'number', placeholder: 'Years' },
          { id: 'tipo', label: 'Type of accident' },
          { id: 'tratamiento', label: 'Treatment received' },
          { id: 'situacion_final', label: 'Final situation / after-effects' },
          { id: 'medicamentos', label: 'Medications' },
        ],
      },
    ],
  },
  {
    titulo: 'IV. Medical history — Other', icono: '🩺',
    preguntas: [
      { id: 'med_cambios_post', type: 'textarea', label: 'Post-event changes: were there changes in the child after illnesses or accidents? Temporary or ongoing?' },
      { id: 'med_examen_neuro', type: 'textarea', label: 'Neurological exams: have they had any? What was the result?' },
      { id: 'med_diagnostico', type: 'textarea', label: 'Previous diagnoses: have they been diagnosed with any condition?' },
      { id: 'med_sensorial', type: 'textarea', label: 'Do they have visual or hearing difficulties?' },
      { id: 'med_terapias_previas', type: 'textarea', label: 'Therapies received: which? since when? how many times a week/month?' },
      { id: 'med_otros', type: 'textarea', label: 'Other medical comments' },
    ],
  },
  {
    titulo: 'V. Muscular development', icono: '🏃',
    descripcion: 'Motor milestones, difficulties and temperament.',
    preguntas: [
      { id: 'mot_sentarse', type: 'text', label: 'At what age did they sit up on their own?', placeholder: 'Months' },
      { id: 'mot_gatear', type: 'text', label: 'At what age did they crawl?', placeholder: 'Months' },
      { id: 'mot_pararse', type: 'text', label: 'At what age did they stand on their own?', placeholder: 'Months' },
      { id: 'mot_caminar', type: 'text', label: 'At what age did they walk?', placeholder: 'Months' },
      { id: 'mot_dificultades', type: 'textarea', label: 'Difficulties observed during these milestones' },
      { id: 'mot_actividad', type: 'radio', label: 'Temperament — you consider your child to be:', options: ['Too restless for their age', 'Too calm for their age', 'Appropriate for their age'] },
    ],
  },
  {
    titulo: 'VI. Movement and language', icono: '🗣️',
    descripcion: 'Movements, laterality and communication.',
    preguntas: [
      { id: 'mov_balanceo', type: 'textarea', label: 'Automatic movements (rocking, swaying): do they have them? which ones?' },
      { id: 'mov_agitados', type: 'textarea', label: 'Agitated movements (hand-flapping, squeezing): when do they appear?' },
      { id: 'mov_mano_preferida', type: 'radio', label: 'Laterality — preferred hand:', options: ['Right', 'Left', 'Both', 'Not defined yet'] },
      { id: 'leng_primera_edad', type: 'text', label: 'Age of their first words', placeholder: 'Months' },
      { id: 'leng_dificultad_pronunciar', type: 'textarea', label: 'Pronunciation difficulties (which ones)' },
      { id: 'leng_dificultad_actual', type: 'textarea', label: 'Current speaking difficulties: in what situations do they appear?' },
      { id: 'leng_comprende', type: 'radio', label: 'Comprehension level — do they understand what is said to them?', options: ['Yes, everything', 'Almost everything', 'Only simple things', 'They struggle to understand'] },
    ],
  },
  {
    titulo: 'VII. Habit formation — Feeding', icono: '🍽️',
    preguntas: [
      { id: 'hab_lactancia', type: 'radio', label: 'Type of feeding they received:', options: ['Exclusive breastfeeding', 'Formula', 'Mixed', "I don't know"] },
      { id: 'hab_lactancia_duracion', type: 'text', label: 'Duration of breastfeeding', placeholder: 'E.g.: 6 months' },
      { id: 'hab_come_solo', type: 'radio', label: 'Do they eat without help and use utensils?', options: ['Yes, no problem', 'Partially', 'No', 'Not yet due to age'] },
      { id: 'hab_apetito', type: 'textarea', label: 'Appetite and food rejection: which ones?' },
    ],
  },
  {
    titulo: 'VII. Habit formation — Hygiene and sleep', icono: '🛁',
    preguntas: [
      { id: 'hab_control_orina_edad', type: 'text', label: 'Age of bladder control (day/night)' },
      { id: 'hab_control_heces_edad', type: 'text', label: 'Age of bowel control' },
      { id: 'hab_control_actual', type: 'radio', label: 'Currently, do they control urine and stool?', options: ['Yes, both', 'Daytime only', 'Not yet', 'Variable'] },
      { id: 'hab_orina_cama', type: 'text', label: 'Until what age did they wet the bed? (or if it still happens)', placeholder: 'E.g.: 5 years / still happens' },
      { id: 'hab_sueno_primeros', type: 'textarea', label: 'Sleep quality during the first 2 years' },
      { id: 'hab_medicamento_dormir', type: 'textarea', label: 'Did they use medication to sleep? Which ones and for how long?' },
      { id: 'hab_horas_sueno', type: 'text', label: 'Hours they currently sleep', placeholder: 'E.g.: 9 hours' },
      { id: 'hab_calidad_sueno', type: 'checkbox', label: 'Behaviors during sleep:', options: ['Talks in their sleep', 'Screams', 'Moves a lot', 'Sweats', 'Drools', 'Grinds their teeth', 'Sleepwalking', 'Sleeps peacefully'] },
    ],
  },
  {
    titulo: 'VII. Habit formation — Independence', icono: '🧦',
    preguntas: [
      { id: 'hab_mandados', type: 'radio', label: 'Do they run errands?', options: ['Yes, inside and outside the home', 'Only inside the home', 'No', 'Not yet due to age'] },
      { id: 'hab_ayuda_casa', type: 'textarea', label: 'Help at home: what things do they do?' },
      { id: 'hab_viste_solo', type: 'radio', label: 'Ability to dress themselves:', options: ['Yes, completely', 'Almost everything', 'With help', 'No, depends on the adult'] },
    ],
  },
  {
    titulo: 'VIII. Educational history', icono: '🏫',
    descripcion: 'School trajectory.',
    preguntas: [
      { id: 'edu_edad_inicio', type: 'text', label: 'Age they started school' },
      { id: 'edu_agrado', type: 'radio', label: 'Do they like going to school?', options: ['Yes, they like it', 'It was hard at first but now they do well', 'They find it hard to go', "They don't like it"] },
      { id: 'edu_cambios_colegio', type: 'textarea', label: 'School changes (how many and why?)' },
      { id: 'edu_relaciones', type: 'textarea', label: 'Relationship with teachers and classmates' },
      { id: 'edu_conducta_aula', type: 'textarea', label: 'Behavior in class and at recess' },
      { id: 'edu_trayectoria', type: 'tabla_dinamica', label: 'School record by year',
        addLabel: '+ Add school year', minRows: 1,
        columns: [
          { id: 'anio', label: 'Year', type: 'number', placeholder: 'E.g.: 2024' },
          { id: 'edad', label: 'Age', type: 'number', placeholder: 'Years' },
          { id: 'colegio', label: 'School / institution' },
          { id: 'grado', label: 'Grade' },
          { id: 'conducta', label: 'Behavior / difficulties observed' },
          { id: 'aprobado', label: 'Passed?', options: ['Yes', 'No', 'In progress'] },
        ],
      },
    ],
  },
  {
    titulo: 'IX. Play', icono: '🎲',
    descripcion: 'Preferred activities and socialization while playing.',
    preguntas: [
      { id: 'jue_solo', type: 'radio', label: 'Do they play alone?', options: ['Yes, frequently', 'Sometimes', 'No, they prefer with others', 'Variable'] },
      { id: 'jue_preferidos', type: 'textarea', label: 'Favorite games, toys or activities' },
      { id: 'jue_dirige', type: 'radio', label: 'When they play with other children:', options: ['They lead the others', 'They are led by them', 'They are flexible / cooperate', 'They struggle to fit in'] },
      { id: 'jue_tiempo_libre', type: 'textarea', label: 'Use of free time' },
    ],
  },
  {
    titulo: 'X. Family dynamics', icono: '🏡',
    descripcion: 'Bonds at home, parenting style and behavior.',
    preguntas: [
      { id: 'din_estructura', type: 'textarea', label: 'Structure: who makes up the family and who does the child live with?' },
      { id: 'din_crianza_otros', type: 'textarea', label: 'Roles of other close relatives in parenting' },
      { id: 'din_dinamica', type: 'textarea', label: 'Dynamics: description of communication at home' },
      { id: 'din_cambios', type: 'textarea', label: 'Recent significant changes (grief, moving, separations, etc.)' },
      { id: 'din_estilo_crianza', type: 'radio', label: 'Predominant parenting style:', options: ['Permissive', 'Authoritarian', 'Negotiating / democratic', 'Inconsistent', 'Other'] },
      { id: 'din_conducta_casa', type: 'textarea', label: 'Behavior at home' },
      { id: 'din_conductas_preocupan', type: 'textarea', label: 'Specific parental concerns (aggressiveness, withdrawal, excessive fear, etc.)' },
      { id: 'din_frente_a_limites', type: 'textarea', label: 'Reactions to new situations, frustrations or limits' },
      { id: 'din_tiempo_libre', type: 'textarea', label: 'What do they like to do in their free time?' },
    ],
  },
  {
    titulo: 'XI. Family history', icono: '🧬',
    descripcion: 'Genetic / family history.',
    preguntas: [
      { id: 'ant_familiares', type: 'checkbox', label: 'Are there or were there cases in the family of…?', options: ['Psychiatric illnesses', 'Epilepsy or seizures', 'Intellectual disability', 'Learning difficulties', 'Speech / language problems', 'ASD / autism', 'ADHD', 'Depression / anxiety', 'Others', 'None'] },
      { id: 'ant_familiares_detalle', type: 'textarea', label: 'If you marked any option, indicate who and what it is about' },
    ],
  },
]
