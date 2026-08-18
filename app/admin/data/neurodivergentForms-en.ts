// Versión EN de neurodivergentForms.ts (traducción propia). Mismos id/type/estructura.
// Agrega también los formularios competitivos EN para exponer ALL_FORMS_EN.
import { FormDefinition } from './neurodivergentForms'
import { COMPETITIVE_FORMS_EN } from './competitiveForms-en'

const FREQ_OPTIONS = ['Never', 'Rarely (1-2 times/month)', 'Sometimes (1-2 times/week)', 'Often (3-4 times/week)', 'Almost always (daily)', 'Always (several times a day)']
const INTENSITY_OPTIONS = ['Not applicable', 'Mild - barely affects', 'Moderate - partially affects', 'Intense - affects a lot', 'Very intense - incapacitating']
const CONCERN_OPTIONS = ['No concern', 'Mild concern', 'Moderate concern', 'Significant concern', 'Severe concern']

export const FORM_CATEGORIES_EN = {
  tdah:        { label: 'ADHD',        fullLabel: 'Attention-Deficit/Hyperactivity Disorder', color: 'from-orange-500 to-amber-500', bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-700',  icon: '⚡' },
  tea:         { label: 'ASD',         fullLabel: 'Autism Spectrum Disorder',                  color: 'from-blue-500 to-indigo-500', bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    icon: '🧩' },
  conductual:  { label: 'Behavioral',  fullLabel: 'Behavior Analysis and Modification',        color: 'from-red-500 to-rose-500',    bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     icon: '📊' },
  sensorial:   { label: 'Sensory',     fullLabel: 'Sensory Processing and Integration',        color: 'from-violet-500 to-purple-500', bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', icon: '🌀' },
  habilidades: { label: 'Skills',      fullLabel: 'Social Skills, Communication and Language',  color: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: '🤝' },
  familia:     { label: 'Family',      fullLabel: 'Forms for Parents and Family',              color: 'from-pink-500 to-rose-400',   bg: 'bg-pink-50',    border: 'border-pink-200',    text: 'text-pink-700',    icon: '🏠' },
  seguimiento: { label: 'Follow-up',   fullLabel: 'Clinical Follow-up and Progress',           color: 'from-cyan-500 to-sky-500',    bg: 'bg-cyan-50',    border: 'border-cyan-200',    text: 'text-cyan-700',    icon: '📈' },
}

const SCREENING_TDAH_EN: FormDefinition = {
  id: 'screening_tdah',
  title: 'ADHD Screening (Adapted Conners)',
  subtitle: 'Assessment of inattention and hyperactivity symptoms',
  category: 'tdah', icon: '⚡', color: 'from-orange-500 to-amber-500', targetRole: 'admin', estimatedMinutes: 20,
  description: 'Assessment based on DSM-5 criteria and the Conners scale to identify and quantify ADHD symptoms.',
  tags: ['ADHD', 'Inattention', 'Hyperactivity', 'Impulsivity', 'DSM-5'],
  sections: [
    {
      title: '1. Inattention Symptoms',
      description: 'Rate the frequency of each behavior over the last 6 months',
      questions: [
        { id: 'inat_detalles', label: 'Does not pay attention to details or makes careless mistakes', type: 'frequency', options: FREQ_OPTIONS, required: true },
        { id: 'inat_atencion', label: 'Has difficulty sustaining attention on tasks or play', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'inat_escucha', label: 'Seems not to listen when spoken to directly', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'inat_instrucciones', label: 'Does not follow instructions and does not finish schoolwork or chores', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'inat_organizar', label: 'Has difficulty organizing tasks and activities', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'inat_esfuerzo', label: 'Avoids tasks requiring sustained mental effort', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'inat_objetos', label: 'Loses needed objects (toys, pencils, books)', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'inat_distraido', label: 'Is easily distracted by external stimuli', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'inat_olvidadizo', label: 'Forgetful in daily activities', type: 'frequency', options: FREQ_OPTIONS },
      ]
    },
    {
      title: '2. Hyperactivity-Impulsivity Symptoms',
      questions: [
        { id: 'hiper_manos', label: 'Fidgets with hands or feet, or squirms in the seat', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'hiper_asiento', label: 'Leaves their seat when they should stay seated', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'hiper_corretea', label: 'Runs around or climbs in inappropriate situations', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'hiper_juego', label: 'Has difficulty playing or doing quiet activities', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'hiper_motor', label: 'Acts as if driven by a motor, always on the go', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'hiper_habla', label: 'Talks excessively', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'hiper_responde', label: 'Answers before questions are finished', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'hiper_turno', label: 'Has difficulty waiting their turn', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'hiper_interrumpe', label: 'Interrupts or intrudes on conversations or games', type: 'frequency', options: FREQ_OPTIONS },
      ]
    },
    {
      title: '3. Functional Impact',
      questions: [
        { id: 'impacto_escuela', label: 'Impact on school performance', type: 'select', options: CONCERN_OPTIONS },
        { id: 'impacto_social', label: 'Impact on relationships with peers', type: 'select', options: CONCERN_OPTIONS },
        { id: 'impacto_familia', label: 'Impact on family dynamics', type: 'select', options: CONCERN_OPTIONS },
        { id: 'inicio_sintomas', label: 'Age of symptom onset (approximate)', type: 'number', placeholder: 'E.g.: 4', helpText: 'DSM-5 requires symptoms before age 12' },
        { id: 'duracion_sintomas', label: 'Duration of symptoms', type: 'select', options: ['Less than 6 months', '6-12 months', '1-2 years', 'More than 2 years'] },
        { id: 'contextos', label: 'In what contexts do they occur?', type: 'multiselect', options: ['Home', 'School', 'With other children', 'In public places', 'In all contexts'] },
        { id: 'evaluacion_previa', label: 'Have they had a previous evaluation or diagnosis?', type: 'select', options: ['No', 'Yes - no formal diagnosis', 'Yes - Inattentive ADHD diagnosis', 'Yes - Hyperactive-Impulsive ADHD diagnosis', 'Yes - Combined ADHD diagnosis'] },
        { id: 'medicacion', label: 'Are they currently on medication?', type: 'select', options: ['No', 'Yes - Methylphenidate', 'Yes - Atomoxetine', 'Yes - another stimulant', 'Unknown'] },
        { id: 'observaciones_tdah', label: "Evaluator's Additional Observations", type: 'textarea', placeholder: 'Clinical notes on behavior during the evaluation...' },
      ]
    }
  ]
}

const CONDUCTA_CASA_TDAH_EN: FormDefinition = {
  id: 'conducta_casa_tdah',
  title: 'Behavior at Home - ADHD',
  subtitle: "Parents' report on behaviors at home",
  category: 'tdah', icon: '🏠', color: 'from-amber-500 to-yellow-500', targetRole: 'parent', estimatedMinutes: 15,
  description: "Form for parents to report their child's behavior at home.",
  tags: ['ADHD', 'Home', 'Parents', 'Routines'],
  sections: [
    {
      title: '1. Daily Routines',
      description: "Tell us about your child's routines at home",
      questions: [
        { id: 'rutina_manana', label: 'What is the morning routine like (waking up, breakfast, getting ready)?', type: 'select', options: ['No difficulties', 'Mild difficulties (needs reminders)', 'Moderate difficulties (requires constant help)', 'Very difficult (causes daily conflict)'] },
        { id: 'tarea_escolar', label: 'How do they do schoolwork at home?', type: 'select', options: ['Does it alone without problems', 'Needs supervision', 'Requires constant support', 'It is a daily battle', 'Does not do it'] },
        { id: 'tiempo_tarea', label: 'How long does homework usually take?', type: 'select', options: ['Less than 30 minutes', '30-60 minutes', '1-2 hours', 'More than 2 hours', 'Does not finish'] },
        { id: 'hora_dormir', label: 'What is bedtime like?', type: 'select', options: ['No problems', 'Takes a while to fall asleep', 'Gets up repeatedly', 'Very difficult - great resistance', 'Very little sleep'] },
      ]
    },
    {
      title: '2. Behavior at Home',
      questions: [
        { id: 'obedece_instrucciones', label: 'Do they obey instructions the first time?', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'rabietas', label: 'Do they have tantrums or emotional outbursts?', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'hermanos', label: 'How do they get along with siblings or other children at home?', type: 'select', options: ['Very well', 'Well with some normal conflicts', 'Many conflicts', 'Very frequent and intense conflicts', 'Has no siblings'] },
        { id: 'actividades_preferidas', label: 'In what activities do they concentrate well?', type: 'textarea', placeholder: 'E.g.: video games, drawing, LEGO, watching videos...' },
        { id: 'estres_familiar', label: 'How much stress does their behavior cause in the family?', type: 'select', options: INTENSITY_OPTIONS },
      ]
    },
    {
      title: '3. Strategies Parents Use',
      questions: [
        { id: 'estrategias_funcionan', label: 'What strategies work for you?', type: 'textarea', placeholder: 'Describe what things help manage their behavior...' },
        { id: 'estrategias_no_funcionan', label: 'What strategies do NOT work for you?', type: 'textarea', placeholder: 'Describe what things do not help or worsen the situation...' },
        { id: 'ayuda_necesaria', label: 'In what aspect do you need more help as a family?', type: 'textarea', placeholder: 'Tell us how we can support you better...' },
      ]
    }
  ]
}

const SCREENING_TEA_EN: FormDefinition = {
  id: 'screening_tea',
  title: 'ASD Screening (Adapted M-CHAT-R/F)',
  subtitle: 'Early detection of the autism spectrum',
  category: 'tea', icon: '🧩', color: 'from-blue-500 to-indigo-500', targetRole: 'admin', estimatedMinutes: 25,
  description: 'Based on the M-CHAT-R/F and DSM-5 criteria for ASD. Assesses social communication, repetitive patterns and sensory processing.',
  tags: ['ASD', 'Autism', 'Social Communication', 'Screening'],
  sections: [
    {
      title: '1. Social Communication and Language',
      description: 'Assesses communication and social interaction skills',
      questions: [
        { id: 'tea_contacto_visual', label: 'Eye contact with familiar people', type: 'select', options: ['Normal/consistent', 'Reduced but present', 'Scarce', 'Absent'] },
        { id: 'tea_sonrisa_social', label: "Social smile (responds to others' smiles)", type: 'select', options: ['Present and consistent', 'Present sometimes', 'Rarely', 'Absent'] },
        { id: 'tea_señalar', label: 'Pointing to share interest (proto-declarative)', type: 'select', options: ['Present', 'Sometimes', 'Rarely', 'Absent'] },
        { id: 'tea_nombre', label: 'Responds when called by their name', type: 'select', options: ['Always/almost always', 'Sometimes', 'Rarely', 'Never'] },
        { id: 'tea_atencion_conjunta', label: 'Joint attention (looking where the adult looks)', type: 'select', options: ['Present', 'Sometimes', 'Rarely', 'Absent'] },
        { id: 'tea_mostrar_objetos', label: 'Shows objects to display them to others', type: 'select', options: ['Yes, habitually', 'Sometimes', 'Rarely', 'No'] },
        { id: 'tea_juego_imitativo', label: "Imitates other people's actions", type: 'select', options: ['Yes, spontaneously', 'When asked', 'Rarely', 'Does not imitate'] },
        { id: 'tea_juego_simbolico', label: 'Symbolic play (pretends)', type: 'select', options: ['Present and varied', 'Simple functional play', 'Very limited', 'Absent'] },
        { id: 'tea_interes_ninos', label: 'Interest in playing with other children', type: 'select', options: ['Actively seeks it', 'Accepts it when offered', 'Prefers to play alone', 'Actively avoids it'] },
        { id: 'tea_lenguaje_edad', label: 'Language level for their age', type: 'select', options: ['Within normal range', 'Mild delay', 'Moderate delay', 'Significant delay', 'No spoken language'] },
      ]
    },
    {
      title: '2. Repetitive and Restricted Patterns',
      questions: [
        { id: 'tea_estereotipias', label: 'Repetitive movements (flapping, rocking, spinning)', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'tea_rituales', label: 'Inflexible rituals or routines', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'tea_alineacion', label: 'Lines up or arranges objects repetitively', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'tea_intereses_restringidos', label: 'Very intense and restricted interests', type: 'select', options: ['No', 'Mild', 'Moderate (interferes sometimes)', 'Intense (interferes frequently)'] },
        { id: 'tea_cambios', label: 'Resistance to changes in routines or environment', type: 'select', options: INTENSITY_OPTIONS },
        { id: 'tea_uso_objetos', label: 'Unusual or non-functional use of objects', type: 'frequency', options: FREQ_OPTIONS },
      ]
    },
    {
      title: '3. Sensory Processing',
      questions: [
        { id: 'tea_hipersensibilidad_auditiva', label: 'Hypersensitivity to sounds (covers ears, gets distressed)', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'tea_hipersensibilidad_tactil', label: 'Tactile hypersensitivity (does not tolerate certain textures/clothing)', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'tea_busqueda_sensorial', label: 'Sensory seeking (smells objects, scratches, licks)', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'tea_selectividad_comida', label: 'Extreme food selectivity', type: 'select', options: ['No / Normal', 'Mild (few restrictions)', 'Moderate (affects nutrition)', 'Severe (very few foods)'] },
      ]
    },
    {
      title: '4. History and Context',
      questions: [
        { id: 'tea_edad_primeras_preocupaciones', label: 'Age when the first concerns were noticed', type: 'text', placeholder: 'E.g.: 18 months, 2 years...' },
        { id: 'tea_regresion', label: 'Was there a loss of previously acquired skills?', type: 'select', options: ['No', 'Yes - language', 'Yes - social skills', 'Yes - both', 'Not clear'] },
        { id: 'tea_diagnostico_previo', label: 'Do they have a previous diagnosis?', type: 'select', options: ['No', 'ASD level 1 (formerly Asperger)', 'ASD level 2', 'ASD level 3', 'ASD unspecified', 'Other PDD'] },
        { id: 'tea_nivel_funcionamiento', label: 'Estimated overall functioning level', type: 'select', options: ['High - independent living possible', 'Medium - requires some support', 'Low - requires significant support', 'Very low - requires total support'] },
        { id: 'tea_antecedentes_familiares', label: 'Family history of ASD, ADHD or other?', type: 'textarea', placeholder: 'Describe if there are relatives with a similar diagnosis...' },
        { id: 'tea_observaciones', label: "Evaluator's Clinical Observations", type: 'textarea', placeholder: 'Notes on behavior during the session, diagnostic impression...' },
      ]
    }
  ]
}

const CONDUCTA_CASA_TEA_EN: FormDefinition = {
  id: 'conducta_casa_tea',
  title: 'My child at home - ASD',
  subtitle: 'Form for parents about daily life',
  category: 'tea', icon: '🏡', color: 'from-blue-400 to-cyan-500', targetRole: 'parent', estimatedMinutes: 20,
  description: 'Tell us what your child is like at home. This information helps us better personalize the therapy.',
  tags: ['ASD', 'Home', 'Parents', 'Communication'],
  sections: [
    {
      title: '1. Communication at Home',
      description: "Tell us about your child's communication",
      questions: [
        { id: 'como_comunica', label: 'How does your child mainly communicate?', type: 'multiselect', options: ['Single words', 'Short phrases', 'Complete sentences', 'Gestures and signs', 'Pictograms/PECS', 'Tablet/communicator', 'Pointing to objects', 'Leading the adult', 'Crying or vocalizations'] },
        { id: 'palabras_funcionales', label: 'About how many functional words do they use?', type: 'select', options: ['Does not use words', '1-10 words', '11-50 words', '51-100 words', 'More than 100 words'] },
        { id: 'pide_cosas', label: 'Do they ask for things they want?', type: 'select', options: ['Yes, clearly with words', 'Yes, with gestures/pointing', 'They try but with difficulty', 'Rarely try', 'Do not ask - take things directly'] },
        { id: 'comprende', label: 'Do they understand what you say?', type: 'select', options: ['Understands complex instructions well', 'Understands simple instructions (1-2 steps)', 'Understands only single words', 'Understands very little'] },
      ]
    },
    {
      title: '2. Routines and Daily Living',
      questions: [
        { id: 'rutinas_importancia', label: 'How important are routines for your child?', type: 'select', options: ['Changes do not affect them', 'Prefers routines but tolerates changes', 'Needs routines, gets upset with changes', 'Routines are essential, any change causes a crisis'] },
        { id: 'higiene', label: 'What is personal hygiene like (bathing, teeth, etc.)?', type: 'select', options: ['No difficulties', 'Needs reminders', 'Requires physical support', 'Very difficult / intense resistance'] },
        { id: 'alimentacion', label: 'What is feeding like?', type: 'textarea', placeholder: 'Describe what foods they accept, textures they reject, schedules, etc.' },
        { id: 'sueño', label: 'What is sleep like?', type: 'select', options: ['Sleeps well', 'Difficulty falling asleep', 'Wakes up frequently', 'Very little total sleep', 'Very disrupted sleep patterns'] },
      ]
    },
    {
      title: '3. What Makes Us Happy and What Worries Us',
      description: 'Share freely - all information is valuable',
      questions: [
        { id: 'fortalezas_hijo', label: "What are your child's strengths and talents?", type: 'textarea', placeholder: 'What they do well, what they love, their special skills...' },
        { id: 'mayor_preocupacion', label: 'What is your greatest concern right now?', type: 'textarea', placeholder: 'Tell us what worries you most as a parent...' },
        { id: 'sueños_familia', label: "What do you dream of for your child's future?", type: 'textarea', placeholder: 'Your expectations and hopes for the future...' },
        { id: 'apoyo_familia', label: 'What support do you receive as a family?', type: 'multiselect', options: ['Partner support', 'Grandparent support', 'Support from other parents with similar children', 'Support group', 'Psychologist/therapist for the family', 'None currently'] },
      ]
    }
  ]
}

const PERFIL_SENSORIAL_EN: FormDefinition = {
  id: 'perfil_sensorial',
  title: 'Sensory Processing Profile',
  subtitle: 'Sensory integration assessment (adapted Dunn)',
  category: 'sensorial', icon: '🌀', color: 'from-violet-500 to-purple-500', targetRole: 'admin', estimatedMinutes: 20,
  description: 'Assesses how each sensory system processes: hyper/hyposensitivity, sensory seeking and avoidance.',
  tags: ['Sensory', 'Sensory Integration', 'Processing', 'Occupational'],
  sections: [
    {
      title: '1. Auditory System',
      questions: [
        { id: 'aud_tapas', label: 'Covers their ears at everyday sounds', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'aud_ruido_fondo', label: 'Is distracted by background noises others ignore', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'aud_volumen', label: 'Speaks too loud or too soft without realizing', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'aud_busqueda', label: 'Seeks sounds or makes noises repetitively', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'aud_multisensorial', label: 'Difficulty processing speech with background noise', type: 'frequency', options: FREQ_OPTIONS },
      ]
    },
    {
      title: '2. Tactile System',
      questions: [
        { id: 'tac_rechazo', label: 'Rejects being touched (hugs, caresses)', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'tac_ropa', label: 'Sensitivity to clothing textures (labels, seams)', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'tac_manos', label: 'Avoids having dirty or wet hands', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'tac_busqueda', label: 'Touches everything they find, seeks physical pressure', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'tac_temperatura', label: 'Indifferent to cold, heat or pain', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'tac_temperatura2', label: 'Hyper-reactive to pain or temperature', type: 'frequency', options: FREQ_OPTIONS },
      ]
    },
    {
      title: '3. Visual and Olfactory System',
      questions: [
        { id: 'vis_luces', label: 'Hypersensitive to bright lights (closes eyes, cries)', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'vis_lineas', label: 'Looks at objects sideways or up close', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'olf_olores', label: 'Hypersensitive to smells (moves away, disgusted gesture)', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'olf_huele', label: 'Smells objects or people unusually', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'gust_selectivo', label: 'Selectivity for food textures/flavors', type: 'frequency', options: FREQ_OPTIONS },
      ]
    },
    {
      title: '4. Proprioceptive and Vestibular System',
      questions: [
        { id: 'vest_mareo', label: 'Gets dizzy easily (swings, cars)', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'vest_busca', label: 'Seeks to spin, swing, move excessively', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'prop_torpeza', label: 'Clumsiness, frequently bumps into objects/people', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'prop_fuerza', label: 'Uses too much force (breaks things by accident)', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'prop_presion', label: 'Seeks deep pressure (weights, squeezes, vests)', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'prop_postura', label: 'Poor posture, leans on everything', type: 'frequency', options: FREQ_OPTIONS },
      ]
    },
    {
      title: '5. Impact on Functioning',
      questions: [
        { id: 'sens_participa_actividades', label: 'Do they avoid activities for sensory reasons?', type: 'multiselect', options: ['Contact sports', 'Art/crafts', 'Music/concerts', 'Eating at restaurants', 'Crowded public places', 'Shopping malls', 'Public transport', 'None'] },
        { id: 'sens_melts', label: 'Do they have "meltdowns" or sensory overload?', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'sens_duracion_colapso', label: 'Typical duration of a sensory overload', type: 'select', options: ['No meltdowns', 'Less than 5 minutes', '5-15 minutes', '15-30 minutes', 'More than 30 minutes'] },
        { id: 'sens_regulacion', label: 'What helps them self-regulate?', type: 'textarea', placeholder: 'Describe what strategies regulate the overload episodes...' },
      ]
    }
  ]
}

const HABILIDADES_SOCIALES_EN: FormDefinition = {
  id: 'habilidades_sociales',
  title: 'Social Skills Assessment',
  subtitle: 'Inventory of social and communicative competencies',
  category: 'habilidades', icon: '🤝', color: 'from-emerald-500 to-teal-500', targetRole: 'admin', estimatedMinutes: 20,
  description: 'Assesses pragmatic skills, conflict resolution, emotional recognition and social competencies.',
  tags: ['Social Skills', 'Pragmatics', 'Emotions', 'Communication'],
  sections: [
    {
      title: '1. Initiating and Maintaining Interactions',
      questions: [
        { id: 'hs_inicia', label: 'Initiates conversations or play with peers', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'hs_saluda', label: 'Greets and says goodbye appropriately', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'hs_mantiene', label: 'Maintains the conversation topic', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'hs_turno', label: 'Respects turn-taking in speech', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'hs_contexto', label: 'Adapts language to the context and listener', type: 'select', options: ['Yes, appropriately', 'Sometimes', 'Rarely', 'Does not do it'] },
        { id: 'hs_espacio_personal', label: "Respects others' personal space", type: 'frequency', options: FREQ_OPTIONS },
      ]
    },
    {
      title: '2. Emotional Recognition and Expression',
      questions: [
        { id: 'em_reconoce_caras', label: "Recognizes emotions in others' faces", type: 'select', options: ['Correctly most of the time', 'Only basic emotions (happy/sad)', 'With great difficulty', 'Does not recognize them'] },
        { id: 'em_expresa', label: 'Expresses their own emotions appropriately', type: 'select', options: ['Yes, appropriately', 'Expresses them but intensely', 'Difficulty expressing them', 'Barely expresses them'] },
        { id: 'em_empatia', label: 'Shows empathy when others are sad or hurt', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'em_regula', label: 'Regulates their emotions without escalating behavior', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'em_estrategias', label: 'What emotional regulation strategies do they use?', type: 'textarea', placeholder: 'Breathes, asks for help, moves away, has a calming object...' },
      ]
    },
    {
      title: '3. Conflict Resolution and Play',
      questions: [
        { id: 'conf_comparte', label: 'Shares toys and materials', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'conf_resuelve', label: 'Resolves conflicts without aggression', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'conf_pide_disculpas', label: 'Apologizes when they do something wrong', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'juego_tipo', label: 'Predominant type of play', type: 'select', options: ['Solitary', 'Parallel (alongside others but without interacting)', 'Associative (interacts briefly)', 'Cooperative (team play with rules)'] },
        { id: 'juego_reglas', label: 'Accepts and follows game rules', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'juego_perder', label: 'Tolerates losing or things not going their way', type: 'select', options: INTENSITY_OPTIONS },
      ]
    }
  ]
}

const INFORME_PADRES_GENERAL_EN: FormDefinition = {
  id: 'informe_padres_general',
  title: 'How is my child this week?',
  subtitle: "Parents' weekly report",
  category: 'familia', icon: '💌', color: 'from-pink-500 to-rose-400', targetRole: 'parent', estimatedMinutes: 10,
  description: 'Share with the therapeutic team how your child was during the week.',
  tags: ['Parents', 'Follow-up', 'Weekly', 'Home'],
  sections: [
    {
      title: 'How was the week?',
      description: 'All information is valuable to us 💙',
      questions: [
        { id: 'semana_general', label: 'How would you rate the week overall?', type: 'select', options: ['⭐ Very difficult', '⭐⭐ Difficult', '⭐⭐⭐ Normal', '⭐⭐⭐⭐ Good', '⭐⭐⭐⭐⭐ Excellent'] },
        { id: 'logro_semana', label: 'Was there any achievement or positive thing this week?', type: 'textarea', placeholder: 'Tell us something good that happened, even if small 😊' },
        { id: 'dificultad_semana', label: 'Was there any difficulty or hard situation?', type: 'textarea', placeholder: 'Describe what was difficult this week...' },
        { id: 'practica_casa', label: 'Did you practice the recommended strategies?', type: 'select', options: ['Yes, every day', 'Most days', 'Some days', 'We barely could', 'We could not / did not remember'] },
        { id: 'dudas', label: 'Do you have any doubts or questions for the therapist?', type: 'textarea', placeholder: 'Write your questions here and we will answer them in the next session...' },
        { id: 'estado_animo_hijo', label: "How was your child's mood?", type: 'select', options: ['Very cheerful and calm', 'Good overall', 'Variable', 'More irritable than usual', 'Very difficult'] },
        { id: 'sueño_semana', label: 'How was sleep this week?', type: 'select', options: ['Very good', 'Good', 'Fair', 'Bad', 'Very bad'] },
        { id: 'mensaje_terapeuta', label: 'Anything else you want to tell the therapist?', type: 'textarea', placeholder: 'Anything you consider important...' },
      ]
    }
  ]
}

const HISTORIA_FAMILIAR_EN: FormDefinition = {
  id: 'historia_familiar',
  title: 'Family and Developmental History',
  subtitle: 'Initial form to get to know your family',
  category: 'familia', icon: '👨‍👩‍👧', color: 'from-rose-500 to-pink-500', targetRole: 'parent', estimatedMinutes: 30,
  description: "Initial form to understand the family context and your child's developmental history.",
  tags: ['Clinical History', 'Development', 'Family', 'Initial'],
  sections: [
    {
      title: '1. Family and Environment',
      questions: [
        { id: 'fam_composicion', label: 'Who does the child live with?', type: 'multiselect', options: ['Father', 'Mother', 'Siblings', 'Grandparents', 'Other relatives', 'Only with one parent'] },
        { id: 'fam_hermanos_cuantos', label: 'How many siblings do they have?', type: 'select', options: ['None (only child)', '1 sibling', '2 siblings', '3 or more siblings'] },
        { id: 'fam_idioma', label: 'What language(s) are spoken at home?', type: 'text', placeholder: 'E.g.: Spanish, they also speak Quechua...' },
        { id: 'fam_situacion', label: 'What is the family situation like right now?', type: 'select', options: ['Stable with no significant events', 'Recent change (moving, work)', 'Recent separation or divorce', 'Recent family loss', 'Difficult financial situation', 'Another important change'] },
      ]
    },
    {
      title: '2. Pregnancy and Birth',
      questions: [
        { id: 'emb_complicaciones', label: 'Were there complications during the pregnancy?', type: 'textarea', placeholder: 'Infections, medications, stress, others...' },
        { id: 'emb_semanas', label: 'At how many weeks were they born?', type: 'select', options: ['Extremely premature (<28 wk)', 'Very premature (28-32 wk)', 'Late premature (33-36 wk)', 'Full term (37-42 wk)', 'Post-term (>42 wk)'] },
        { id: 'nac_peso', label: 'What was their birth weight?', type: 'text', placeholder: 'E.g.: 3.200 kg' },
        { id: 'nac_complicaciones', label: 'Were there complications at birth?', type: 'textarea', placeholder: 'NICU, oxygen, jaundice, others...' },
      ]
    },
    {
      title: '3. Developmental Milestones',
      questions: [
        { id: 'hito_sonrisa', label: 'At what age was the first social smile?', type: 'text', placeholder: 'E.g.: 2 months' },
        { id: 'hito_sento', label: 'At what age did they sit up alone?', type: 'text', placeholder: 'E.g.: 6 months' },
        { id: 'hito_camino', label: 'At what age did they walk alone?', type: 'text', placeholder: 'E.g.: 12-14 months' },
        { id: 'hito_palabras', label: 'At what age did they say their first words?', type: 'text', placeholder: 'E.g.: 12 months' },
        { id: 'hito_frases', label: 'At what age did they combine two words?', type: 'text', placeholder: 'E.g.: 24 months' },
        { id: 'hito_control', label: 'At what age did they achieve toilet control?', type: 'select', options: ['Before age 2', '2-3 years', '3-4 years', 'After age 4', 'Not yet'] },
        { id: 'hito_preocupaciones', label: 'When did you start to worry?', type: 'textarea', placeholder: 'Describe when and what you noticed...' },
      ]
    },
    {
      title: '4. Health and Medical History',
      questions: [
        { id: 'med_enfermedades', label: 'Have they had significant illnesses?', type: 'textarea', placeholder: 'Hospitalizations, surgeries, chronic illnesses...' },
        { id: 'med_medicacion', label: 'Are they currently taking any medication?', type: 'textarea', placeholder: 'Name, dosage, for what...' },
        { id: 'med_alergias', label: 'Do they have allergies?', type: 'text', placeholder: 'Foods, medications, others...' },
        { id: 'med_audiologia', label: 'Has their hearing been evaluated?', type: 'select', options: ['Yes - normal hearing', 'Yes - mild hearing loss', 'Yes - moderate/severe hearing loss', 'Not evaluated'] },
        { id: 'med_oftalmologia', label: 'Has their vision been evaluated?', type: 'select', options: ['Yes - normal vision', 'Yes - wears glasses', 'Not evaluated'] },
        { id: 'med_antecedentes_familia', label: 'Relevant family history?', type: 'textarea', placeholder: 'ASD, ADHD, intellectual disability, language problems in the family...' },
      ]
    }
  ]
}

export const ALL_FORMS_EN: FormDefinition[] = [
  SCREENING_TDAH_EN,
  CONDUCTA_CASA_TDAH_EN,
  SCREENING_TEA_EN,
  CONDUCTA_CASA_TEA_EN,
  PERFIL_SENSORIAL_EN,
  HABILIDADES_SOCIALES_EN,
  INFORME_PADRES_GENERAL_EN,
  HISTORIA_FAMILIAR_EN,
  ...COMPETITIVE_FORMS_EN,
]

export const FORMS_BY_CATEGORY_EN = {
  tdah: ALL_FORMS_EN.filter(f => f.category === 'tdah'),
  tea: ALL_FORMS_EN.filter(f => f.category === 'tea'),
  conductual: ALL_FORMS_EN.filter(f => f.category === 'conductual'),
  sensorial: ALL_FORMS_EN.filter(f => f.category === 'sensorial'),
  habilidades: ALL_FORMS_EN.filter(f => f.category === 'habilidades'),
  familia: ALL_FORMS_EN.filter(f => f.category === 'familia'),
  seguimiento: ALL_FORMS_EN.filter(f => f.category === 'seguimiento'),
}

export const PARENT_FORMS_EN = ALL_FORMS_EN.filter(f => f.targetRole === 'parent' || f.targetRole === 'both')
export const ADMIN_FORMS_EN = ALL_FORMS_EN.filter(f => f.targetRole === 'admin' || f.targetRole === 'both')
