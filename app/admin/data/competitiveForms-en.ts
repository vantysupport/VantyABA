// Versión EN de competitiveForms.ts (traducción propia). Mismos id/type/estructura.
import { FormDefinition } from './neurodivergentForms'

const FREQ = ['Never', 'Rarely (1-2/month)', 'Sometimes (1-2/week)', 'Often (3-4/week)', 'Almost always (daily)', 'Always (several times/day)']
const INTENSITY = ['Not applicable', 'Mild', 'Moderate', 'Intense', 'Very intense / incapacitating']
const CONCERN = ['No concern', 'Mild', 'Moderate', 'Significant', 'Severe']
const NIVEL_INDEPENDENCIA = ['Does not perform / Total dependence', 'With full physical assistance', 'With partial physical assistance', 'With modeling', 'With verbal help', 'With a cue or gesture', 'Independent with errors', 'Independent']

export const EVALUACION_FUNCIONAL_CONDUCTA_EN: FormDefinition = {
  id: 'fba',
  title: 'Functional Behavior Assessment (FBA)',
  subtitle: 'Analysis of the function of problem behaviors',
  category: 'conductual',
  icon: '🔍',
  color: 'from-red-600 to-rose-700',
  targetRole: 'admin',
  estimatedMinutes: 35,
  description: 'Identifies the function of challenging behaviors to design evidence-based interventions (Malott, Ch. 18-22)',
  tags: ['FBA', 'Function', 'Behavior', 'ABA', 'Intervention'],
  sections: [
    {
      title: '🎯 Target Behavior Identification',
      description: 'Define the behavior operationally (observable and measurable)',
      questions: [
        { id: 'conducta_objetivo', label: 'Operational description of the behavior', type: 'textarea', required: true, placeholder: 'Describe exactly what the child does: specific movements, vocalizations, approximate duration. E.g.: "Throws themselves on the floor, kicks with both legs and screams loudly for 2-10 minutes"', helpText: 'A good operational definition describes TOPOGRAPHY (how it looks), not intentions' },
        { id: 'frecuencia_conducta', label: 'How often does the behavior occur?', type: 'select', options: FREQ, required: true },
        { id: 'duracion_episodio', label: 'Typical duration of each episode', type: 'select', options: ['Seconds (less than 1 min)', '1-5 minutes', '5-15 minutes', '15-30 minutes', 'More than 30 minutes', 'Variable'] },
        { id: 'intensidad_conducta', label: 'Typical intensity of the behavior', type: 'select', options: INTENSITY },
        { id: 'conductas_asociadas', label: 'Are there other behaviors that occur together with this one?', type: 'textarea', placeholder: 'E.g.: Before throwing objects, they clench their fists and grind their teeth...' },
        { id: 'riesgo_dano', label: 'Does it pose a risk of physical harm?', type: 'select', options: ['No', 'Risk to themselves (self-injury)', 'Risk to others', 'Risk to objects / environment', 'Multiple risks'] },
      ]
    },
    {
      title: '🌡️ Antecedents (A of the ABC)',
      description: 'What happens BEFORE the behavior? Context, triggers, conditions',
      questions: [
        { id: 'contextos_ocurrencia', label: 'In what contexts/environments does it occur most?', type: 'multiselect', options: ['Therapy room', 'Home', 'School/classroom', 'Public places', 'Transitions', 'Mealtime', 'Bedtime', 'All contexts'] },
        { id: 'contextos_no_ocurrencia', label: 'In what contexts does it almost NEVER occur?', type: 'multiselect', options: ['Playing freely', 'With a preferred activity', 'With a specific person', 'In silence', 'In 1:1 activities', 'After exercise', 'In the morning', 'In the afternoon'] },
        { id: 'triggers_inmediatos', label: 'What are the most common triggers?', type: 'multiselect', options: ['Instruction or demand', 'Transition between activities', 'Something they like ends', 'Another person receives attention', 'Change in routine', 'Sensory stimulation', 'Waiting or delay', 'Unwanted social interaction', 'Difficult task', 'Frustration over an error'] },
        { id: 'condiciones_motivacionales', label: 'Motivating operations: what conditions increase the likelihood?', type: 'multiselect', options: ['Fatigue or lack of sleep', 'Hunger', 'Pain or physical discomfort', 'Medication (change or absence)', 'Environmental stress (noise, light)', 'Deprivation of a preferred reinforcer', 'Change in schedule or routine', 'Previous negative interaction'] },
        { id: 'sd_conducta', label: 'Is there a specific Sd (discriminative stimulus) that almost always precedes the behavior?', type: 'textarea', placeholder: 'E.g.: When the therapist takes out the workbook, when they say "it is time to..."' },
        { id: 'tiempo_antes', label: 'How much time passes between the trigger and the behavior?', type: 'select', options: ['Immediate (seconds)', '1-5 minutes', '5-15 minutes', 'More than 15 minutes', 'Variable / no clear pattern'] },
      ]
    },
    {
      title: '⚡ Consequences (C of the ABC)',
      description: 'What happens AFTER the behavior? What maintains it?',
      questions: [
        { id: 'consecuencias_tipicas', label: 'What happens after the behavior?', type: 'multiselect', options: ['The task/activity ends (escape/avoidance)', 'Receives attention (positive or negative)', 'Obtains a desired object or activity', 'Is completely ignored', 'Is given a time out', 'Is redirected to another activity', 'Receives a verbal correction', 'Nothing changes / no consistent consequence'] },
        { id: 'quien_responde', label: 'Who usually responds to the behavior?', type: 'multiselect', options: ['ABA therapist', 'Mother/Father', 'Teacher', 'Siblings', 'Several / inconsistent'] },
        { id: 'consistencia_consecuencias', label: 'Are the consequences consistent across caregivers?', type: 'select', options: ['Yes - everyone responds the same', 'Partially - some do, others do not', 'No - each person responds differently', 'Unknown'] },
        { id: 'efecto_conducta', label: 'Does the behavior achieve what it seems to seek?', type: 'select', options: ['Yes - generally achieves the goal', 'Sometimes - inconsistent results', 'Rarely - almost never works', 'No - never achieves anything apparent'] },
      ]
    },
    {
      title: '🧪 Functional Hypothesis',
      description: 'Based on A-B-C, what is the maintaining function of the behavior?',
      questions: [
        { id: 'hipotesis_funcion_primaria', label: 'Primary function hypothesis', type: 'select', required: true, options: ['Positive reinforcement - Social attention (gain attention)', 'Positive reinforcement - Tangible (obtain object/activity)', 'Negative reinforcement - Escape from demand/task', 'Negative reinforcement - Sensory escape / avoidance', 'Automatic reinforcement - Sensory stimulation (self-stimulation)', 'Automatic reinforcement - Reduction of internal discomfort', 'Mixed function (combination of the above)', 'Unknown function - further assessment required'] },
        { id: 'hipotesis_funcion_secundaria', label: 'Is there a secondary function?', type: 'select', options: ['No', 'Positive reinforcement - Attention', 'Positive reinforcement - Tangible', 'Negative reinforcement - Escape', 'Automatic reinforcement'] },
        { id: 'evidencia_hipotesis', label: 'Evidence supporting this hypothesis', type: 'textarea', placeholder: 'Describe the observed patterns that lead to this functional conclusion...', required: true },
        { id: 'confirmacion_metodo', label: 'Hypothesis confirmation method', type: 'select', options: ['Descriptive analysis (naturalistic ABC)', 'Analog functional analysis (experimental)', 'Functional interview (FAST/MAS)', 'Combination of methods', 'Pending verification'] },
        { id: 'declaracion_funcion', label: 'Complete functional statement', type: 'textarea', required: true, placeholder: 'In the presence of [Antecedent], [Name] exhibits [Behavior], and as a result obtains/escapes [Consequence], which increases the future likelihood of the behavior.' },
      ]
    },
    {
      title: '💪 Alternative Behaviors and Prerequisite Skills',
      questions: [
        { id: 'conducta_alternativa_funcion', label: 'Is there an alternative behavior that fulfills the same function appropriately?', type: 'textarea', placeholder: 'E.g.: Can ask for help verbally, can use a "break" card, can point to what they want...' },
        { id: 'habilidades_prerrequisito', label: 'What skills do they need to develop to use the alternative behavior?', type: 'multiselect', options: ['Functional communication (request, refuse, comment)', 'Tolerance for delay', 'Emotional self-regulation', 'Following instructions', 'Transitioning between activities', 'Frustration tolerance', 'Specific cognitive skills'] },
        { id: 'nivel_comunicacion_actual', label: "Child's current functional communication level", type: 'select', options: ['Pre-verbal / no intentional communication', 'Gestural communication / pointing', 'Communication with pictograms / PECS', 'Isolated words (1-2 words)', 'Simple phrases (2-3 words)', 'Complete sentences', 'Complex functional verbal communication'] },
        { id: 'observaciones_fba', label: "Evaluator's additional observations", type: 'textarea', placeholder: 'Additional patterns, important contextual factors, overall clinical impression...' },
      ]
    }
  ]
}

export const PLAN_INTERVENCION_CONDUCTUAL_EN: FormDefinition = {
  id: 'bip',
  title: 'Behavior Intervention Plan (BIP)',
  subtitle: 'Intervention design based on the FBA',
  category: 'conductual',
  icon: '📋',
  color: 'from-blue-600 to-indigo-700',
  targetRole: 'admin',
  estimatedMinutes: 40,
  description: 'Structured intervention plan for challenging behaviors, based on the function identified in the FBA',
  tags: ['BIP', 'Intervention', 'Plan', 'ABA', 'Reduction'],
  sections: [
    {
      title: '📌 Target Behavior and Function',
      questions: [
        { id: 'conducta_bip', label: 'Target behavior (operational definition)', type: 'textarea', required: true, placeholder: 'Copy or summarize the operational definition from the FBA' },
        { id: 'funcion_bip', label: 'Identified function (from the FBA)', type: 'select', required: true, options: ['Social attention', 'Tangible (object/activity)', 'Escape from demand', 'Sensory escape', 'Automatic stimulation', 'Discomfort reduction', 'Mixed'] },
        { id: 'meta_reduccion', label: 'Reduction goal', type: 'textarea', required: true, placeholder: 'E.g.: Reduce tantrum behavior from a frequency of 5/day to 1/day over an 8-week period, with a 1-month maintenance criterion' },
      ]
    },
    {
      title: '🛡️ Antecedent Strategies (Prevention)',
      description: 'Modifications to the environment BEFORE the behavior occurs',
      questions: [
        { id: 'modificaciones_ambiente', label: 'What changes to the physical environment will be implemented?', type: 'multiselect', options: ['Reduce distracting stimuli', 'Structured work area', 'Visual cues (schedule, timer)', 'Early access to the reinforcer', 'Preferential seating', 'Available rest space', 'Visually organized materials'] },
        { id: 'first_then', label: 'Will First-Then be used?', type: 'select', options: ['Yes - pictograms', 'Yes - verbal', 'Yes - board', 'Not applicable'] },
        { id: 'aviso_previo', label: 'Will advance notice be given before transitions?', type: 'select', options: ['Yes - 5 minutes in advance', 'Yes - verbal + timer', 'Yes - visual cue', 'Depends on the context', 'Not applicable'] },
        { id: 'demandas_graduadas', label: 'Will the difficulty of demands be adjusted?', type: 'textarea', placeholder: 'E.g.: Start with high-probability tasks before difficult tasks (high-p sequence)' },
        { id: 'om_estrategias', label: 'Strategies for motivating operations', type: 'textarea', placeholder: 'E.g.: Ensure prior rest, offer a snack before demanding sessions, allow free access to the reinforcer before work...' },
      ]
    },
    {
      title: '🗣️ Replacement Strategies (Teaching)',
      description: 'Teach an alternative behavior that fulfills the same function',
      questions: [
        { id: 'conducta_reemplazo', label: 'Replacement behavior to teach', type: 'textarea', required: true, placeholder: 'E.g.: Teach them to ask for a "break" with a PECS card or word, so it has the same escape function as the tantrum' },
        { id: 'metodo_ensenanza', label: 'Method for teaching the replacement behavior', type: 'multiselect', options: ['Discrete trial (DTT)', 'Natural environment teaching (NET)', 'PECS (Picture Exchange Communication System)', 'MAND training', 'Modeling + imitation', 'Video modeling', 'Role-play'] },
        { id: 'prompt_strategy', label: 'Prompting strategy', type: 'select', options: ['Most-to-least (from more to less help)', 'Least-to-most (from less to more help)', 'Position prompt', 'Modeling', 'Simultaneous verbal + physical prompt'] },
        { id: 'reforzamiento_reemplazo', label: 'What reinforcer will be used for the replacement behavior?', type: 'textarea', required: true, placeholder: 'The SAME reinforcer that maintains the problem behavior must be accessible via the appropriate behavior' },
      ]
    },
    {
      title: '📉 Consequence Strategies for the Problem Behavior',
      description: 'What to do AFTER the behavior occurs (based on extinction + DRA/DRO)',
      questions: [
        { id: 'procedimiento_extincion', label: 'Extinction procedure', type: 'textarea', required: true, placeholder: 'Based on the function: if escape → do not remove the demand, if attention → withdraw attention, if tangible → do not give the object...' },
        { id: 'dra_dro', label: 'Will DRA, DRO or DRI be used?', type: 'select', options: ['DRA - Differential reinforcement of alternative behavior', 'DRO - Reinforcement of the absence of behavior', 'DRI - Reinforcement of incompatible behavior', 'Combination of DRA + DRO', 'Not applicable in this phase'] },
        { id: 'safety_response', label: 'If there is a risk of harm, how is it handled?', type: 'textarea', placeholder: 'Safety protocol: who intervenes, how, when the session is stopped...' },
        { id: 'crisis_plan', label: 'Is there a documented crisis plan?', type: 'select', options: ['Yes - attached in the file', 'Yes - in progress', 'Not required', 'Pending'] },
      ]
    },
    {
      title: '📊 Monitoring and Success Criteria',
      questions: [
        { id: 'metodo_medicion', label: 'Method for measuring the behavior', type: 'select', required: true, options: ['Frequency (count of occurrences)', 'Duration (total time)', 'Latency (time to onset)', 'Rate (occurrences per time)', 'Partial interval', 'Whole interval', 'Momentary time sampling'] },
        { id: 'criterio_exito_bip', label: 'BIP success criterion', type: 'textarea', required: true, placeholder: 'E.g.: Reduce from 5 tantrums/day to 1 or fewer/day over 3 consecutive weeks, with 4 weeks of maintenance' },
        { id: 'revision_bip', label: 'How often will the plan be reviewed?', type: 'select', options: ['Every week', 'Every 2 weeks', 'Every month', 'Every 6 weeks', 'Upon reaching a partial criterion'] },
        { id: 'responsables_bip', label: 'Who will implement the plan?', type: 'multiselect', options: ['Lead ABA therapist', 'Support therapist', 'Parents at home', 'Teacher at school', 'All significant adults'] },
        { id: 'capacitacion_requerida', label: 'Is training for parents/teachers required?', type: 'select', options: ['Yes - formal training scheduled', 'Yes - model follow-up', 'Partial - reinforcement of strategies', 'No - they already know the plan', 'Pending evaluation'] },
      ]
    }
  ]
}

export const OBJETIVOS_IEP_EN: FormDefinition = {
  id: 'iep',
  title: 'Individual Intervention Plan (IEP/IIP)',
  subtitle: 'Annual functional goals with progress metrics',
  category: 'seguimiento',
  icon: '🗺️',
  color: 'from-indigo-600 to-violet-700',
  targetRole: 'admin',
  estimatedMinutes: 45,
  description: 'Master document of annual therapeutic goals with measurable mastery criteria, per IBAO standards',
  tags: ['IEP', 'Goals', 'Plan', 'Annual', 'Targets'],
  sections: [
    {
      title: '📊 Present Levels of Performance',
      description: 'Baseline: where the child is TODAY in each area',
      questions: [
        { id: 'nivel_comunicacion', label: 'Communication and Language - current level', type: 'textarea', required: true, placeholder: 'E.g.: Uses about 50 approximate words, occasionally combines 2 words, consistently understands 1-step instructions...' },
        { id: 'nivel_social', label: 'Social Skills - current level', type: 'textarea', placeholder: 'E.g.: Parallel play with peers, responds to name 80% in a 1:1 setting, social initiation absent...' },
        { id: 'nivel_autonomia', label: 'Autonomy and Daily Living - current level', type: 'textarea', placeholder: 'E.g.: Eats alone with a spoon with supervision, requires partial assistance with dressing, toilet training in progress...' },
        { id: 'nivel_cognitivo', label: 'Cognitive and Academic Skills - current level', type: 'textarea', placeholder: 'E.g.: Matching basic colors and shapes, sequencing 3 images, counting 1-5 with support...' },
        { id: 'nivel_conductual', label: 'Behavior and Emotional Regulation - current level', type: 'textarea', placeholder: 'E.g.: 3-5 tantrums/week, duration 5-15 min, escape function, self-stimulatory behaviors 40% of the time...' },
        { id: 'fortalezas_principales', label: 'Strengths and areas of motivation', type: 'textarea', required: true, placeholder: 'E.g.: High motivation for vehicles and music, excellent visual memory, good adherence to predictable routines...' },
      ]
    },
    {
      title: '🎯 Area 1: Communication and Language',
      questions: [
        { id: 'obj_com_1_lp', label: 'Annual communication goal', type: 'textarea', placeholder: 'By the end of the year, [Name] will be able to... [behavior] under [conditions] with [mastery criterion]' },
        { id: 'obj_com_1_cp1', label: 'Short-term goal 1 (quarter 1)', type: 'textarea', placeholder: 'Measurable goal for the first 3 months...' },
        { id: 'obj_com_1_cp2', label: 'Short-term goal 2 (quarter 2)', type: 'textarea', placeholder: '' },
        { id: 'obj_com_metodo', label: 'Communication intervention strategies', type: 'multiselect', options: ['MAND training (verbal behavior)', 'PECS (Phase I-VI)', 'AAC / Communication device', 'ABA language therapy', 'Incidental teaching', 'PRT (Pivotal Response Training)'] },
      ]
    },
    {
      title: '🎯 Area 2: Behavior and Regulation',
      questions: [
        { id: 'obj_cond_1_lp', label: 'Annual behavior/regulation goal', type: 'textarea', placeholder: '' },
        { id: 'obj_cond_1_cp1', label: 'Short-term goal 1', type: 'textarea', placeholder: '' },
        { id: 'obj_cond_estrategia', label: 'Main behavioral strategy', type: 'select', options: ['DRA (Differential reinforcement of alternative)', 'DRO (Reinforcement of absence)', 'Token economy', 'Planned extinction', 'Response cost', 'Emotional regulation teaching', 'Social Stories', 'Power Cards'] },
      ]
    },
    {
      title: '🎯 Area 3: Social Skills',
      questions: [
        { id: 'obj_social_lp', label: 'Annual social skills goal', type: 'textarea', placeholder: '' },
        { id: 'obj_social_cp1', label: 'Short-term goal 1', type: 'textarea', placeholder: '' },
        { id: 'obj_social_metodo', label: 'Strategies', type: 'multiselect', options: ['Social Skills Groups', 'Peer-mediated intervention', 'Video modeling', 'Social Stories', 'PEERS curriculum', 'Structured role play'] },
      ]
    },
    {
      title: '🎯 Area 4: Autonomy and Daily Living',
      questions: [
        { id: 'obj_autonomia_lp', label: 'Annual autonomy goal', type: 'textarea', placeholder: '' },
        { id: 'obj_autonomia_cp1', label: 'Short-term goal 1', type: 'textarea', placeholder: '' },
        { id: 'obj_autonomia_metodo', label: 'Strategies', type: 'multiselect', options: ['Task analysis', 'Chaining (forward chaining)', 'Backward chaining', 'Video prompting', 'Visual guides / pictograms', 'Structured schedules'] },
      ]
    },
    {
      title: '📋 Services and Team',
      questions: [
        { id: 'horas_aba_semana', label: 'Weekly hours of ABA therapy', type: 'select', options: ['5-10 hours', '10-15 hours', '15-20 hours', '20-25 hours', '25-30 hours', 'More than 30 hours'] },
        { id: 'servicios_adicionales', label: 'Additional services', type: 'multiselect', options: ['Speech therapy', 'Occupational therapy', 'Physiotherapy', 'School support', 'Social skills groups', 'Psychotherapy', 'Parent support'] },
        { id: 'equipo_intervencion', label: 'Intervention team members', type: 'multiselect', options: ['Behavior analyst (IBA)', 'Behavior therapist (IBT)', 'Speech therapist', 'Occupational therapist', 'Special education teacher', 'Psychologist', 'Parents / caregivers'] },
        { id: 'revision_iep', label: 'Next IEP review', type: 'select', options: ['In 3 months', 'In 6 months', 'In 1 year', 'According to clinical progress'] },
      ]
    }
  ]
}

export const EVALUACION_LENGUAJE_VERBAL_EN: FormDefinition = {
  id: 'lenguaje_verbal',
  title: 'Verbal Behavior Assessment (adapted VB-MAPP)',
  subtitle: 'Profile of language and communication skills',
  category: 'habilidades',
  icon: '🗣️',
  color: 'from-teal-500 to-cyan-600',
  targetRole: 'admin',
  estimatedMinutes: 30,
  description: 'Assesses verbal operants (mand, tact, echoic, intraverbal) to design ABA communication programs',
  tags: ['Language', 'VB-MAPP', 'Verbal Behavior', 'Communication', 'Mand'],
  sections: [
    {
      title: '🎤 Mand (Requests)',
      description: 'Ability to ask for what they need or want',
      questions: [
        { id: 'mando_nivel', label: 'Current mand level', type: 'select', required: true, options: NIVEL_INDEPENDENCIA },
        { id: 'mando_modalidad', label: 'Main request modality', type: 'select', options: ['No functional requests', 'Crying / undirected vocalizations', 'Pulling the hand / physically guiding', 'Pointing', 'Reaching + eye contact', 'Pictograms / PECS', 'Signs / sign language', 'Isolated words (1 word)', 'Phrases (2+ words)', 'Complete sentences'] },
        { id: 'mando_variedad', label: 'About how many different requests do they make?', type: 'select', options: ['0-5 types of requests', '5-20 types', '20-50 types', '50-100 types', 'More than 100 types / unlimited'] },
        { id: 'mando_contexto', label: 'In what contexts do they make requests?', type: 'multiselect', options: ['Only with very familiar people', 'With any familiar adult', 'In the therapy session', 'At home', 'At school', 'In public', 'In all contexts'] },
        { id: 'mando_espontaneo', label: 'Do they make spontaneous requests (without a prompt)?', type: 'select', options: ['Never spontaneous - requires a prompt', 'Occasionally spontaneous', 'Frequently spontaneous', 'Almost always spontaneous'] },
      ]
    },
    {
      title: '👁️ Tact (Labeling)',
      description: 'Ability to name or label what they see, hear, touch',
      questions: [
        { id: 'tacto_objetos', label: 'Names objects (object tacts)', type: 'select', options: ['0 objects', '1-10 objects', '10-50 objects', '50-100 objects', '100-200 objects', 'More than 200 objects'] },
        { id: 'tacto_acciones', label: 'Names actions (verbs)', type: 'select', options: ['None', '1-10 actions', '10-50 actions', 'More than 50 actions'] },
        { id: 'tacto_atributos', label: 'Names attributes (colors, sizes, shapes)', type: 'multiselect', options: ['Basic colors (3+)', 'Basic shapes', 'Sizes (big/small)', 'Textures', 'Basic emotions in photos', 'Body parts (10+)', 'Animals (10+)', 'Foods (10+)'] },
        { id: 'tacto_funcion', label: 'Names by function or characteristic', type: 'select', options: ['Does not name by function', 'Does it with a prompt', 'Does it spontaneously with some', 'Does it spontaneously with many'] },
      ]
    },
    {
      title: '👂 Listener / Comprehension',
      description: 'What they understand and follow',
      questions: [
        { id: 'comprension_instrucciones', label: 'Level of instructions they follow', type: 'select', required: true, options: ['Does not follow verbal instructions', '1-step instructions with gestures', '1-step verbal-only instructions', '2-step instructions', '3+ step instructions', 'Complex / conditional instructions'] },
        { id: 'comprension_vocabulario', label: 'Discriminates vocabulary (point to..., touch...)', type: 'select', options: ['0-10 words', '10-50 words', '50-100 words', '100-200 words', 'More than 200 words'] },
        { id: 'comprension_grupo', label: 'Follows instructions in a group (not just 1:1)', type: 'select', options: ['Only 1:1 (not in a group)', 'With their name mentioned', 'In a small group (3-5 people)', 'In a large group (class)'] },
      ]
    },
    {
      title: '🔄 Intraverbal and Conversation',
      description: 'Conversation, questions, completing phrases',
      questions: [
        { id: 'intraverbal_nivel', label: 'Level of intraverbal response', type: 'select', options: ['Does not answer verbal questions', 'Answers "What is your name?"', 'Answers what? and who? about objects', 'Completes known phrases ("Sun, moon and...")', 'Answers questions about activities', 'Basic two-way conversation (3-5 turns)', 'Sustained conversation with varied topics'] },
        { id: 'ecoico', label: 'Echoic: Do they repeat words when asked?', type: 'select', options: ['Does not imitate sounds or words', 'Imitates isolated vowels', 'Imitates consonants + vowels (CV)', 'Imitates 1-syllable words', 'Imitates 2-syllable words', 'Imitates 3+ syllable words', 'Imitates short sentences'] },
        { id: 'juego_simbolico', label: 'Symbolic / imaginative play', type: 'select', options: ['No symbolic play', 'Functional play (objects with a real function)', 'Simple symbolic play (pretends)', 'Elaborate symbolic play', 'Sociodramatic play with peers'] },
      ]
    },
    {
      title: '📋 Summary and Recommendations',
      questions: [
        { id: 'nivel_vb_global', label: 'Overall verbal development level (adapted VB-MAPP)', type: 'select', required: true, options: ['Level 1 (0-18 months equiv.) - prerequisites and first words', 'Level 2 (18-30 months equiv.) - vocabulary expansion', 'Level 3 (30-48 months equiv.) - basic conversation', 'Above level 3 - functional language skills'] },
        { id: 'barreras_lenguaje', label: 'Main barriers to language learning', type: 'multiselect', options: ['Motivational deficit / low motivation', 'Interfering behaviors (self-stimulation)', 'Sensory deficit (auditory)', 'Speech motor difficulties (apraxia)', 'Poor motor imitation (prerequisite)', 'Lack of eye contact', 'Rigidity / inflexibility'] },
        { id: 'prioridad_intervencion_lenguaje', label: 'Priority area of language intervention', type: 'select', required: true, options: ['MAND training (teach requesting)', 'Echoic (vocal imitation)', 'Tact (labeling)', 'Listener (comprehension)', 'Intraverbal (conversation)', 'All equally', 'Additional evaluation needed'] },
        { id: 'observaciones_lenguaje', label: "Evaluator's observations", type: 'textarea', placeholder: 'Additional notes about the communication profile, contextual factors, specific recommendations...' },
      ]
    }
  ]
}

export const INFORME_PROGRESO_MENSUAL_EN: FormDefinition = {
  id: 'informe_mensual_prog',
  title: 'Monthly Progress Report',
  subtitle: 'Clinical progress report for parents and supervisor',
  category: 'seguimiento',
  icon: '📈',
  color: 'from-emerald-500 to-teal-600',
  targetRole: 'admin',
  estimatedMinutes: 20,
  description: 'Monthly progress report with objective data, clinical analysis and communication to families',
  tags: ['Monthly', 'Progress', 'Report', 'Family'],
  sections: [
    {
      title: '📊 Progress in ABA Programs',
      questions: [
        { id: 'programas_en_progreso', label: 'Programs worked on this month', type: 'textarea', required: true, placeholder: 'List the programs, the initial and final success % of the month, and the current status...' },
        { id: 'programas_dominados', label: 'Did any program reach the mastery criterion?', type: 'textarea', placeholder: 'Program name and mastery date...' },
        { id: 'programas_nuevos', label: 'Were new programs started?', type: 'textarea', placeholder: 'New program + clinical justification...' },
        { id: 'tendencia_general', label: 'Overall progress trend for the month', type: 'select', required: true, options: ['Consistent progress across all programs', 'Progress in most programs', 'Mixed progress (some advance, others do not)', 'General stagnation', 'Regression in some programs', 'Significant regression'] },
      ]
    },
    {
      title: '🧠 Behavior and Regulation',
      questions: [
        { id: 'conductas_desafiantes_mes', label: 'Challenging behaviors this month', type: 'textarea', placeholder: 'Frequency, intensity, changes from the previous month...' },
        { id: 'estrategias_efectivas', label: 'Strategies that were effective', type: 'textarea', placeholder: 'What worked well to manage behaviors or promote learning...' },
        { id: 'ajustes_realizados', label: 'Adjustments made to the programs or strategies', type: 'textarea', placeholder: 'Reinforcer changes, procedure modifications, phase changes...' },
      ]
    },
    {
      title: '🏠 Generalization and Family Collaboration',
      questions: [
        { id: 'generalizacion', label: 'Have they generalized skills outside the session?', type: 'textarea', placeholder: 'At home, school, community... what skills did they apply spontaneously...' },
        { id: 'participacion_familia', label: 'Family participation and adherence', type: 'select', options: ['Excellent - they implement strategies consistently', 'Good - most of the time', 'Fair - needs more support and follow-up', 'Difficult - significant barriers', 'No data available'] },
        { id: 'necesidades_familia', label: 'What does the family need this month?', type: 'multiselect', options: ['Training in new strategies', 'Emotional support and psychoeducation', 'Coordination with the school', 'Adjustment of activities at home', 'Follow-up meeting', 'No urgent needs'] },
      ]
    },
    {
      title: '🗺️ Plan for Next Month',
      questions: [
        { id: 'objetivos_proximo_mes', label: 'Goals for next month', type: 'textarea', required: true, placeholder: 'What is expected to be achieved, which programs will be prioritized...' },
        { id: 'ajustes_plan', label: 'Will the intervention plan be modified?', type: 'select', options: ['No - continue per the IEP', 'Yes - minor strategy adjustment', 'Yes - new program(s) to add', 'Yes - major IEP revision required', 'Consultation with supervisor/team needed'] },
        { id: 'recomendaciones_padres', label: 'Specific recommendations for parents this month', type: 'textarea', required: true, placeholder: 'Concrete activities, strategies to practice, what to observe and record...' },
      ]
    }
  ]
}

export const HABILIDADES_ADAPTATIVAS_EN: FormDefinition = {
  id: 'habilidades_adaptativas',
  title: 'Adaptive Skills Assessment',
  subtitle: 'Functioning in daily living and autonomy',
  category: 'habilidades',
  icon: '🌟',
  color: 'from-amber-500 to-yellow-600',
  targetRole: 'admin',
  estimatedMinutes: 25,
  description: 'Assesses daily living skills, self-care and adaptive functioning (complements Vineland-3)',
  tags: ['Adaptive', 'Autonomy', 'Daily living', 'Self-care', 'DSM-5'],
  sections: [
    {
      title: '🍽️ Feeding',
      questions: [
        { id: 'come_solo', label: 'Eats independently', type: 'select', options: NIVEL_INDEPENDENCIA },
        { id: 'uso_utensilios', label: 'Use of utensils (spoon, fork)', type: 'select', options: NIVEL_INDEPENDENCIA },
        { id: 'variedad_alimentos', label: 'Variety in the diet', type: 'select', options: ['Very restricted (1-5 foods)', 'Restricted (5-15 foods)', 'Moderate (15-30 foods)', 'Wide (no significant restrictions)'] },
        { id: 'conductas_alimentacion', label: 'Problem behaviors around feeding', type: 'multiselect', options: ['None', 'Texture refusal', 'Color/presentation refusal', 'Spitting behaviors', 'Problematic chewing', 'Gagging / nausea', 'Only eats a specific brand of food'] },
      ]
    },
    {
      title: '🚿 Hygiene and Self-Care',
      questions: [
        { id: 'control_esfinteres', label: 'Toilet control', type: 'select', options: ['No control (diaper)', 'In training - frequent accidents', 'Partial - dry most of the time', 'Controlled with reminders', 'Independent daytime control', 'Independent day and night control'] },
        { id: 'lavado_manos', label: 'Hand washing', type: 'select', options: NIVEL_INDEPENDENCIA },
        { id: 'cepillado_dientes', label: 'Tooth brushing', type: 'select', options: NIVEL_INDEPENDENCIA },
        { id: 'bano', label: 'Bath / shower', type: 'select', options: NIVEL_INDEPENDENCIA },
        { id: 'vestido', label: 'Dressing / undressing', type: 'select', options: NIVEL_INDEPENDENCIA },
        { id: 'calzado', label: 'Putting on and taking off footwear', type: 'select', options: NIVEL_INDEPENDENCIA },
      ]
    },
    {
      title: '🏠 Home and Community',
      questions: [
        { id: 'desplazamiento_casa', label: 'Moves safely within the home', type: 'select', options: ['Requires constant supervision', 'Close supervision', 'Distant supervision', 'Independent at home'] },
        { id: 'seguridad_hogar', label: 'Do they understand basic safety rules?', type: 'multiselect', options: ['Does not open dangerous doors/windows', 'Does not touch outlets/cables', 'Does not climb high surfaces without supervision', 'Understands "hot" and "danger"', 'None of the above'] },
        { id: 'uso_comunidad', label: 'Can they go to community places?', type: 'select', options: ['Does not tolerate community outings', 'Tolerates short outings with support', 'Tolerates community activities with supervision', 'Active participation in the community with an adult', 'Partially autonomous mobility'] },
        { id: 'manejo_dinero', label: 'Basic handling of money/transactions', type: 'select', options: ['Not applicable by age', 'No understanding of money', 'Recognizes coins/bills', 'Simple transactions with support', 'Simple autonomous transactions'] },
      ]
    },
    {
      title: '💤 Sleep and Routines',
      questions: [
        { id: 'patron_sueno', label: 'Sleep pattern', type: 'select', options: ['No sleep problems', 'Difficulty falling asleep', 'Frequent night awakenings', 'Very early (before 5am)', 'Irregular schedule', 'Requires an adult to fall asleep'] },
        { id: 'horas_sueno', label: 'Hours of sleep per night (approx)', type: 'select', options: ['Less than 7 hours', '7-8 hours', '8-9 hours', '9-10 hours', '10-11 hours', 'More than 11 hours'] },
        { id: 'seguimiento_rutinas', label: 'Do they follow structured routines?', type: 'select', options: ['Does not follow routines / very disruptive with changes', 'Follows routines with very rigid structure', 'Follows routines with some visual supports', 'Follows routines with verbal reminders', 'Follows routines independently'] },
      ]
    }
  ]
}

export const PERFIL_SENSORIAL_AVANZADO_EN: FormDefinition = {
  id: 'sensorial_avanzado',
  title: 'Advanced Sensory Profile (adapted Dunn)',
  subtitle: 'Detailed assessment of sensory processing',
  category: 'sensorial',
  icon: '🌀',
  color: 'from-violet-600 to-purple-700',
  targetRole: 'admin',
  estimatedMinutes: 25,
  description: 'Complete assessment of the 8 sensory systems with a processing profile per the Dunn model (1997)',
  tags: ['Sensory', 'SPD', 'Dunn', 'ASD', 'Sensory integration'],
  sections: [
    {
      title: '👀 Visual Processing',
      questions: [
        { id: 'vis_sensible', label: 'Are they bothered by bright lights or very well-lit spaces?', type: 'frequency', options: FREQ },
        { id: 'vis_busca', label: 'Do they intensely watch objects that move or spin?', type: 'frequency', options: FREQ },
        { id: 'vis_distracto', label: 'Are they visually distracted by movement in the environment?', type: 'frequency', options: FREQ },
        { id: 'vis_perder', label: 'Do they lose their place when reading or following text?', type: 'frequency', options: FREQ },
      ]
    },
    {
      title: '👂 Auditory Processing',
      questions: [
        { id: 'aud_ruidos', label: 'Do they get distressed or cover their ears at everyday noises (hairdryer, blender)?', type: 'frequency', options: FREQ },
        { id: 'aud_busca', label: 'Do they actively seek loud sounds or produce them?', type: 'frequency', options: FREQ },
        { id: 'aud_no_responde', label: 'Do they seem not to hear when spoken to directly?', type: 'frequency', options: FREQ },
        { id: 'aud_ambiente', label: 'Do they have difficulty in environments with a lot of background noise?', type: 'frequency', options: FREQ },
      ]
    },
    {
      title: '✋ Tactile Processing',
      questions: [
        { id: 'tac_texturas', label: 'Do they avoid specific textures in clothing, food or surfaces?', type: 'frequency', options: FREQ },
        { id: 'tac_contacto', label: 'Do they get distressed by unexpected physical contact?', type: 'frequency', options: FREQ },
        { id: 'tac_busca', label: 'Do they actively seek tactile experiences (touch everything, get dirty)?', type: 'frequency', options: FREQ },
        { id: 'tac_temperatura', label: 'Do they show indifference to cold, heat or pain?', type: 'frequency', options: FREQ },
        { id: 'tac_higiene', label: 'Resistance to nail cutting, combing or hair washing?', type: 'frequency', options: FREQ },
      ]
    },
    {
      title: '🏃 Proprioceptive and Vestibular Processing',
      questions: [
        { id: 'prop_busca', label: 'Do they seek deep pressure (tight hugs, pressing against objects)?', type: 'frequency', options: FREQ },
        { id: 'prop_fuerza', label: 'Do they use excessive force when grabbing objects or people?', type: 'frequency', options: FREQ },
        { id: 'vest_movimiento', label: 'Do they actively seek movement (swings, spinning, bouncing)?', type: 'frequency', options: FREQ },
        { id: 'vest_mareo', label: 'Do they get dizzy easily with normal movements?', type: 'frequency', options: FREQ },
        { id: 'vest_evita', label: 'Do they avoid activities that require lifting their feet off the ground?', type: 'frequency', options: FREQ },
      ]
    },
    {
      title: '👃 Smell and Taste (Interoceptive)',
      questions: [
        { id: 'olfato_sensible', label: 'Do they react strongly to smells others do not notice?', type: 'frequency', options: FREQ },
        { id: 'gusto_restriccion', label: 'Do they have food restrictions based on taste/texture?', type: 'frequency', options: FREQ },
        { id: 'interocepcion', label: 'Do they have difficulty identifying internal sensations (hunger, thirst, need to use the bathroom)?', type: 'frequency', options: FREQ },
      ]
    },
    {
      title: '📊 Functional Impact',
      questions: [
        { id: 'impacto_aprendizaje', label: 'Impact on learning and attention', type: 'select', options: CONCERN },
        { id: 'impacto_social_sens', label: 'Impact on social interactions', type: 'select', options: CONCERN },
        { id: 'impacto_avd', label: 'Impact on daily living activities', type: 'select', options: CONCERN },
        { id: 'patron_sensorial', label: 'Predominant sensory pattern', type: 'select', required: true, options: ['Low registration (general hyposensitivity)', 'Sensory seeker', 'Sensory sensitivity (hypersensitivity)', 'Sensory avoider', 'Mixed profile', 'No clear pattern - varied'] },
        { id: 'recomendaciones_ot', label: 'Recommendations for occupational therapy / sensory strategies', type: 'textarea', placeholder: 'What kind of sensory diet, environmental adaptations, self-regulation strategies...' },
      ]
    }
  ]
}

export const REGISTRO_ABC_AVANZADO_EN: FormDefinition = {
  id: 'abc_avanzado',
  title: 'Advanced ABC Record + Function',
  subtitle: 'Antecedent → Behavior → Consequence with functional analysis',
  category: 'conductual',
  icon: '📊',
  color: 'from-orange-500 to-amber-600',
  targetRole: 'admin',
  estimatedMinutes: 10,
  description: 'Observational ABC record with integrated functional analysis for systematic behavioral data collection',
  tags: ['ABC', 'Record', 'Function', 'Observation', 'Data'],
  sections: [
    {
      title: '🕐 Episode Context',
      questions: [
        { id: 'fecha_abc', label: 'Approximate date and time', type: 'text', placeholder: 'E.g.: March 15, 10:30am' },
        { id: 'lugar', label: 'Place', type: 'select', options: ['Therapy room', 'Home - living room', 'Home - dining room', 'Home - bedroom', 'School - classroom', 'School - recess', 'Community / external', 'Other'] },
        { id: 'actividad_en_curso', label: 'Activity in progress', type: 'text', placeholder: 'E.g.: table work, free time, lunch, transition...' },
        { id: 'personas_presentes', label: 'People present', type: 'multiselect', options: ['Only with the therapist', 'With mother/father', 'With siblings', 'With peers/classmates', 'In a group', 'Alone'] },
      ]
    },
    {
      title: 'A — Antecedent',
      questions: [
        { id: 'antecedente_especifico', label: 'What happened just before the behavior?', type: 'textarea', required: true, placeholder: 'Describe in detail what happened in the 1-2 minutes before the behavior...' },
        { id: 'tipo_antecedente', label: 'Type of antecedent', type: 'select', options: ['Direct instruction or demand', 'End of a preferred activity', 'Transition', 'Attention directed to another person', 'Waiting or delay', 'Sensory stimulation', 'Social interaction initiated by a peer', 'No clear antecedent / spontaneous behavior'] },
      ]
    },
    {
      title: 'B — Behavior',
      questions: [
        { id: 'conducta_observada', label: 'Operational description of the behavior', type: 'textarea', required: true, placeholder: 'Describe exactly what the child did: topography, approximate duration, intensity...' },
        { id: 'duracion_episodio_abc', label: 'Episode duration', type: 'select', options: ['Seconds', '1-5 minutes', '5-15 minutes', '15-30 minutes', 'More than 30 minutes'] },
        { id: 'intensidad_episodio', label: 'Intensity', type: 'select', options: INTENSITY },
      ]
    },
    {
      title: 'C — Consequence',
      questions: [
        { id: 'consecuencia_inmediata', label: 'What happened immediately after?', type: 'textarea', required: true, placeholder: "Describe exactly the adult's response and the outcome for the child..." },
        { id: 'tipo_consecuencia', label: 'Type of consequence', type: 'select', options: ['The demand was removed / escape granted', 'Attention was given to the child (even if negative)', 'They were given what they asked for (tangible)', 'They were ignored / no social consequence', 'Time out', 'Redirection', 'Verbal correction', 'Physical restraint', 'Inconsistent consequence'] },
        { id: 'funcion_hipotesis_abc', label: 'Function hypothesis (this episode)', type: 'select', required: true, options: ['Social attention', 'Tangible (object/activity)', 'Escape from demand', 'Automatic stimulation', 'Multiple', 'Unknown'] },
        { id: 'notas_abc', label: "Observer's additional notes", type: 'textarea', placeholder: 'Contextual factors, motivating operations observed, variations from previous episodes...' },
      ]
    }
  ]
}

export const COMPETITIVE_FORMS_EN: FormDefinition[] = [
  EVALUACION_FUNCIONAL_CONDUCTA_EN,
  PLAN_INTERVENCION_CONDUCTUAL_EN,
  OBJETIVOS_IEP_EN,
  EVALUACION_LENGUAJE_VERBAL_EN,
  INFORME_PROGRESO_MENSUAL_EN,
  HABILIDADES_ADAPTATIVAS_EN,
  PERFIL_SENSORIAL_AVANZADO_EN,
  REGISTRO_ABC_AVANZADO_EN,
]
