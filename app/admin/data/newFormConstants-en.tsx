// Versión EN de newFormConstants.tsx (traducción propia). Mismos id/type/estructura.

const AVANCE = ['No progress / Regression', 'Minimal progress (<20%)', 'Moderate progress (20-50%)', 'Significant progress (50-80%)', 'Goal achieved (>80%)', 'Not worked on this month']

export const OBJETIVO_IEP_DATA_EN = [
  {
    title: '1. Goal Identification',
    questions: [
      { id: 'dominio', label: 'Intervention Domain', type: 'select', options: ['Communication and Language', 'Social Skills', 'Adaptive Behavior', 'Academic Skills', 'Autonomy and Daily Living', 'Fine Motor Skills', 'Gross Motor Skills', 'Emotional Regulation', 'Play Skills'] },
      { id: 'objetivo_largo_plazo', label: 'Annual Goal (Long Term)', type: 'textarea', placeholder: 'E.g.: The child will increase their functional vocabulary to communicate basic needs...' },
      { id: 'objetivo_corto_plazo', label: 'Short-Term Goal (quarterly)', type: 'textarea', placeholder: 'E.g.: The child will name 10 household objects at 80% of opportunities over 3 consecutive sessions...' },
      { id: 'nivel_actual', label: 'Present Level of Performance (Baseline)', type: 'textarea', placeholder: "Describe the patient's current performance in this skill..." },
    ]
  },
  {
    title: '2. Evaluation Criteria and Strategies',
    questions: [
      { id: 'criterio_dominio', label: 'Mastery Criterion', type: 'text', placeholder: 'E.g.: 80% of correct trials over 3 consecutive sessions' },
      { id: 'metodo_ensenanza', label: 'Main Teaching Method', type: 'select', options: ['DTT (Discrete Trial Training)', 'NET (Natural Environment Training)', 'PECS', 'Modeling', 'Backward chaining', 'Forward chaining', 'Incidental Teaching', 'PRT (Pivotal Response Training)'] },
      { id: 'tipo_ayuda', label: 'Initial Prompt Type', type: 'select', options: ['No help', 'Gestural', 'Partial verbal', 'Full verbal', 'Partial physical', 'Full physical', 'Visual/Pictogram'] },
      { id: 'materiales', label: 'Materials and Resources Needed', type: 'textarea', placeholder: 'List the specific materials to work on this goal...' },
    ]
  },
  {
    title: '3. Generalization and Maintenance',
    questions: [
      { id: 'escenarios_generalizacion', label: 'Generalization Settings', type: 'multiselect', options: ['Home', 'School', 'Park/outdoors', 'Supermarket', 'With other adults', 'With peers', 'Different materials', 'Different times of day'] },
      { id: 'estrategia_generalizacion', label: 'Generalization Plan', type: 'textarea', placeholder: 'Describe how generalization to home and community will be promoted...' },
      { id: 'fecha_inicio_objetivo', label: 'Start Date', type: 'date' },
      { id: 'fecha_revision', label: 'Scheduled Review Date', type: 'date' },
      { id: 'responsable', label: 'Responsible Therapist', type: 'text', placeholder: "Therapist's name" },
    ]
  }
]

export const NOTA_SESION_DATA_EN = [
  {
    title: '1. Session Data',
    questions: [
      { id: 'numero_sesion', label: 'Session Number', type: 'number', placeholder: 'E.g.: 42' },
      { id: 'duracion_minutos', label: 'Duration (minutes)', type: 'number', placeholder: '45' },
      { id: 'tipo_sesion', label: 'Modality', type: 'select', options: ['In-person - Center', 'In-person - Home', 'In-person - School', 'Hybrid', 'Remote/Virtual'] },
      { id: 'estado_animo_inicio', label: 'Patient State at the Start', type: 'select', options: ['Calm and cooperative', 'Slightly anxious', 'Irritable', 'Tired/drowsy', 'Very active/overstimulated', 'Crying', 'Resistant', 'Cheerful and motivated'] },
    ]
  },
  {
    title: '2. Goals Worked On and Performance',
    questions: [
      { id: 'objetivos_sesion', label: 'IEP Goals Worked On', type: 'textarea', placeholder: 'List the goals addressed in this session...' },
      { id: 'porcentaje_correcto', label: 'Average % of Correct Responses', type: 'number', placeholder: 'E.g.: 75' },
      { id: 'programas_trabajados', label: 'Programs / Activities Done', type: 'textarea', placeholder: 'Describe the activities, games and programs done during the session...' },
      { id: 'reforzadores_efectivos', label: 'Most Effective Reinforcers Today', type: 'text', placeholder: 'E.g.: Soap bubbles, verbal praise, tablet 2 min' },
    ]
  },
  {
    title: '3. Behaviors and Clinical Observations',
    questions: [
      { id: 'conductas_problema', label: 'Did problem behaviors occur?', type: 'select', options: ['No', 'Yes - mild (did not interfere)', 'Yes - moderate (partially interfered)', 'Yes - severe (interrupted the session)'] },
      { id: 'descripcion_conductas', label: 'Behavior Description (if applicable)', type: 'textarea', placeholder: 'Describe topography, frequency, duration and intensity...' },
      { id: 'estrategia_manejo', label: 'Management Strategy Used', type: 'textarea', placeholder: 'Describe how the behavior was managed...' },
      { id: 'observaciones_generales', label: 'General Clinical Observations', type: 'textarea', placeholder: "Therapist's observations on clinical status, new skills, regressions, etc." },
    ]
  },
  {
    title: '4. Recommendations and Plan',
    questions: [
      { id: 'tarea_casa', label: 'Home Activities', type: 'textarea', placeholder: 'Specific activities parents should practice this week...' },
      { id: 'ajuste_programa', label: 'Are program adjustments needed?', type: 'select', options: ['No, continue the same', 'Increase difficulty', 'Reduce demand', 'Change reinforcer', 'Review teaching method', 'Consult with supervisor'] },
      { id: 'plan_proxima_sesion', label: 'Plan for Next Session', type: 'textarea', placeholder: 'Priority goals and strategies for the next session...' },
      { id: 'comunicar_padres', label: 'Message for the Parents?', type: 'textarea', placeholder: 'Achievements or important information to communicate to the family...' },
    ]
  }
]

export const INFORME_MENSUAL_DATA_EN = [
  {
    title: '1. Period Summary',
    questions: [
      { id: 'mes_evaluado', label: 'Month Evaluated', type: 'select', options: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] },
      { id: 'total_sesiones', label: 'Total Sessions Held', type: 'number', placeholder: 'E.g.: 8' },
      { id: 'sesiones_faltadas', label: 'Sessions Not Held', type: 'number', placeholder: 'E.g.: 1' },
      { id: 'horas_terapia', label: 'Hours of Direct Therapy', type: 'number', placeholder: 'E.g.: 6' },
      { id: 'resumen_periodo', label: 'General Summary of the Month', type: 'textarea', placeholder: "Brief description of the patient's overall performance during the month..." },
    ]
  },
  {
    title: '2. Progress by Domain',
    questions: [
      { id: 'avance_comunicacion', label: 'Communication and Language', type: 'select', options: AVANCE },
      { id: 'avance_social', label: 'Social Skills', type: 'select', options: AVANCE },
      { id: 'avance_conducta', label: 'Adaptive Behavior', type: 'select', options: AVANCE },
      { id: 'avance_autonomia', label: 'Autonomy and Daily Living', type: 'select', options: AVANCE },
      { id: 'avance_academico', label: 'Academic / Pre-academic Skills', type: 'select', options: AVANCE },
    ]
  },
  {
    title: '3. Goals Achieved and New Ones',
    questions: [
      { id: 'objetivos_logrados', label: 'Goals Mastered This Month', type: 'textarea', placeholder: 'List the goals that reached the mastery criterion...' },
      { id: 'objetivos_nuevos', label: 'New Goals Introduced', type: 'textarea', placeholder: 'New goals that started being worked on...' },
      { id: 'conductas_preocupacion', label: 'Behaviors of Concern', type: 'textarea', placeholder: 'Problem behaviors that persist or emerged this month...' },
    ]
  },
  {
    title: '4. Recommendations and Next Month Plan',
    questions: [
      { id: 'recomendaciones_familia', label: 'Recommendations for the Family', type: 'textarea', placeholder: 'Specific strategies to implement at home...' },
      { id: 'plan_proximo_mes', label: 'Priority Goals for Next Month', type: 'textarea', placeholder: "Describe the therapeutic focus for the next period..." },
      { id: 'coordinacion_escuela', label: 'Does it require coordination with the school?', type: 'select', options: ['No', 'Yes - send report', 'Yes - meeting recommended', 'Yes - observation visit', 'Already coordinated'] },
      { id: 'necesita_reevaluacion', label: 'Is a reassessment recommended?', type: 'select', options: ['Not at this time', 'Yes - in 1 month', 'Yes - in 3 months', 'Yes - urgent'] },
    ]
  }
]

export const REGISTRO_CONDUCTUAL_ABC_DATA_EN = [
  {
    title: '1. Episode Data',
    questions: [
      { id: 'hora_inicio', label: 'Start Time', type: 'time' },
      { id: 'hora_fin', label: 'End Time', type: 'time' },
      { id: 'duracion_estimada', label: 'Estimated Duration', type: 'select', options: ['Less than 1 minute', '1-5 minutes', '5-10 minutes', '10-30 minutes', 'More than 30 minutes'] },
      { id: 'lugar', label: 'Where It Occurred', type: 'select', options: ['Therapy center', 'Home - living room', 'Home - bedroom', 'Home - kitchen', 'School - classroom', 'School - recess', 'Outdoors/street', 'Supermarket/store', 'Transport', 'Other place'] },
      { id: 'personas_presentes', label: 'People Present', type: 'multiselect', options: ['Therapist', 'Mother', 'Father', 'Siblings', 'Grandparents', 'Teacher', 'Classmates', 'Unknown people'] },
    ]
  },
  {
    title: '2. Antecedent (A) - What happened BEFORE?',
    questions: [
      { id: 'actividad_previa', label: 'Activity being done', type: 'text', placeholder: 'E.g.: Working at the table with colored cards' },
      { id: 'demanda_presentada', label: 'Was any demand presented?', type: 'select', options: ['No', 'Yes - academic task', 'Yes - activity change', 'Yes - verbal instruction', 'Yes - limit/refusal', 'Yes - waiting/turn'] },
      { id: 'cambio_ambiente', label: 'Was there any change in the environment?', type: 'select', options: ['No', 'Yes - noise/sound', 'Yes - new person', 'Yes - change of place', 'Yes - routine change', 'Yes - visual stimulus'] },
      { id: 'estado_previo', label: "Child's State Before the Episode", type: 'select', options: ['Normal/neutral', 'Already irritable', 'Tired', 'Hungry/thirsty', 'Sick/physical discomfort', 'Overstimulated', 'Had just lost a reinforcer'] },
    ]
  },
  {
    title: '3. Behavior (B) - What happened EXACTLY?',
    questions: [
      { id: 'topografia_conducta', label: 'Precise Description of the Behavior', type: 'textarea', placeholder: 'Describe EXACTLY what the child did (without interpreting): movements, vocalizations, actions...' },
      { id: 'tipo_conducta', label: 'Behavior Category', type: 'multiselect', options: ['Aggression toward people', 'Self-injury', 'Destruction of objects', 'Escaping/fleeing', 'Intense crying', 'Screaming/vocalizations', 'Refusal/resistance', 'Stereotypy', 'Tantrum', 'Not following instruction'] },
      { id: 'intensidad', label: 'Episode Intensity', type: 'select', options: ['1 - Very mild', '2 - Mild', '3 - Moderate', '4 - Intense', '5 - Very intense / Crisis'] },
      { id: 'frecuencia', label: 'Frequency in the last 2 weeks', type: 'select', options: ['First time', '2-3 times', '4-7 times', '8-14 times', 'More than 14 times (daily)'] },
    ]
  },
  {
    title: '4. Consequence (C) and Hypothesized Function',
    questions: [
      { id: 'consecuencia_adulto', label: 'How Did the Adults React?', type: 'multiselect', options: ['Redirected the activity', 'Removed the demand', 'Gave verbal attention', 'Gave a preferred object', 'Ignored', 'Physical containment', 'Timeout/isolation', 'Did the task for the child'] },
      { id: 'resultado_conducta', label: 'What Did the Child Get with the Behavior?', type: 'select', options: ['Adult attention', 'Avoid/escape a task', 'Obtain object/food', 'Sensory stimulation', 'Control/power', 'Not clear'] },
      { id: 'funcion_hipotetica', label: 'Hypothesized Function of the Behavior', type: 'select', options: ['Access to tangibles', 'Access to attention', 'Escape/avoidance', 'Sensory/automatic', 'Multiple functions', 'Not determined yet'] },
      { id: 'plan_intervencion', label: 'Suggested Intervention Plan', type: 'textarea', placeholder: 'Based on the functional analysis, describe intervention strategies...' },
    ]
  }
]
