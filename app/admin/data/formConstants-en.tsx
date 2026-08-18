'use client'
// Versión EN de los formularios clínicos (traducción propia, no IA en vivo).
// Mismos `id`/`type`/estructura que formConstants.tsx: solo cambia el texto visible.
import {
  Brain, Activity, Target, Heart, TrendingUp, Zap, Award, BookOpen,
  Home, MessageCircle, Calendar, Eye, Users, Sparkles
} from 'lucide-react'

export const ANAMNESIS_DATA_EN = [
  {
    title: "1. Identification Data",
    questions: [
      { id: "informante", label: "Informant's name", type: "text", placeholder: "Full name" },
      { id: "parentesco", label: "Relationship to the child", type: "select", options: ["Mother", "Father", "Grandparent", "Guardian", "Other"] },
      { id: "vive_con", label: "Who does the child live with?", type: "text", placeholder: "E.g.: Parents and siblings" },
      { id: "escolaridad", label: "Current schooling", type: "select", options: ["Not in school", "Preschool", "Primary", "Special education (CEBE)"] },
    ]
  },
  {
    title: "2. Reason for Consultation",
    questions: [
      { id: "motivo_principal", label: "Main reason for the consultation", type: "textarea", placeholder: "Describe the main problem or concern..." },
      { id: "derivado_por", label: "Who referred them?", type: "select", options: ["Own initiative", "School", "Pediatrician", "Psychologist", "Other"] },
      { id: "expectativas", label: "What do you hope to achieve with therapy?", type: "textarea", placeholder: "Parents' goals..." },
    ]
  },
  {
    title: "3. Prenatal History (Pregnancy and Birth)",
    questions: [
      { id: "tipo_embarazo", label: "Was the pregnancy planned?", type: "radio", options: ["Yes", "No"] },
      { id: "complicaciones_emb", label: "Were there complications during the pregnancy?", type: "textarea", placeholder: "Threatened miscarriage, infections, falls, severe stress..." },
      { id: "tipo_parto", label: "Type of birth", type: "select", options: ["Natural", "Emergency C-section", "Scheduled C-section"] },
      { id: "llanto", label: "Did they cry at birth?", type: "radio", options: ["Yes", "No", "Don't know"] },
      { id: "incubadora", label: "Did they require an incubator?", type: "radio", options: ["Yes", "No"] },
    ]
  },
  {
    title: "4. Medical History",
    questions: [
      { id: "enfermedades", label: "Have they had serious illnesses?", type: "textarea", placeholder: "Seizures, high fevers, otitis, allergies..." },
      { id: "examenes", label: "Do they have previous tests?", type: "select", options: ["None", "Hearing", "Vision", "Neurological", "Genetic", "Several"] },
      { id: "medicacion", label: "Are they taking any current medication?", type: "text", placeholder: "Name and dosage..." },
    ]
  },
  {
    title: "5. Psychomotor Development",
    questions: [
      { id: "sosten_cefalico", label: "Age of head control (holding head up)", type: "text", placeholder: "E.g.: 3 months" },
      { id: "gateo", label: "Age of crawling", type: "text", placeholder: "E.g.: 8 months" },
      { id: "marcha", label: "Age of walking (walking alone)", type: "text", placeholder: "E.g.: 1 year 2 months" },
      { id: "caidas", label: "Do they fall frequently?", type: "radio", options: ["Yes", "No"] },
      { id: "motricidad_fina", label: "Fine motor skills (pincer grip, grasp)", type: "select", options: ["Adequate", "Difficulty grasping", "Manual clumsiness"] },
    ]
  },
  {
    title: "6. Language Development",
    questions: [
      { id: "primeras_palabras", label: "Age of first words", type: "text", placeholder: "E.g.: 1 year" },
      { id: "intencion_comunicativa", label: "Do they have communicative intent?", type: "radio", options: ["Yes", "No", "Sometimes"] },
      { id: "comprension", label: "Comprehension level", type: "select", options: ["Understands everything", "Understands simple commands", "Does not seem to understand", "Ignores their name"] },
      { id: "frases", label: "Do they form sentences?", type: "radio", options: ["Yes (subject+verb)", "Only single words", "Does not speak"] },
    ]
  },
  {
    title: "7. Feeding and Sleep",
    questions: [
      { id: "apetito", label: "Appetite", type: "select", options: ["Good", "Selective/Picky", "Voracious", "Poor appetite"] },
      { id: "masticacion", label: "Do they chew solids well?", type: "radio", options: ["Yes", "No, they choke", "Only eats purees"] },
      { id: "sueno_calidad", label: "Sleep quality", type: "select", options: ["Sleeps through the night", "Frequent awakenings", "Difficulty falling asleep", "Nightmares"] },
      { id: "duerme_con", label: "Who do they sleep with?", type: "text", placeholder: "Alone, parents, siblings..." },
    ]
  },
  {
    title: "8. Autonomy and Hygiene",
    questions: [
      { id: "control_esfinteres", label: "Toilet training (bathroom control)", type: "select", options: ["Controls day and night", "Daytime only", "Needs prompting", "Uses diapers"] },
      { id: "vestido", label: "Dressing", type: "select", options: ["Dresses themselves", "Partial help", "Fully dependent"] },
      { id: "aseo", label: "Personal hygiene (hand/tooth washing)", type: "select", options: ["Independent", "Needs help", "Resists"] },
    ]
  },
  {
    title: "9. Emotional and Social Area",
    questions: [
      { id: "contacto_visual", label: "Eye contact", type: "select", options: ["Sustained", "Fleeting", "None/Avoids"] },
      { id: "juego", label: "Type of play", type: "select", options: ["Symbolic (imagination)", "Functional (toy cars)", "Repetitive/Lining up", "Sensory"] },
      { id: "rabietas", label: "Do they have frequent tantrums?", type: "radio", options: ["Yes, daily", "Occasional", "Rarely"] },
      { id: "pares", label: "Relationship with other children", type: "select", options: ["Plays and interacts", "Watches without playing", "Ignores/Isolates", "Is aggressive"] },
    ]
  },
  {
    title: "10. THERAPIST'S OBSERVATIONS",
    questions: [
      { id: "apariencia", label: "Physical appearance and grooming:", type: "textarea", placeholder: "Physical description..." },
      { id: "actitud_evaluacion", label: "Attitude toward the evaluation:", type: "radio", options: ["Cooperative", "Inhibited", "Oppositional"] },
      { id: "contacto_visual_obs", label: "Eye contact (Observation):", type: "radio", options: ["Adequate", "Fleeting", "Absent"] },
      { id: "notas_adicionales", label: "Additional Notes:", type: "textarea", placeholder: "Final observations..." },
    ]
  }
]

export const ABA_DATA_EN = [
  {
    title: "1. Session Information",
    icon: <Calendar size={20}/>,
    questions: [
      { id: "fecha_sesion", label: "Session date", type: "date", required: true },
      { id: "duracion_minutos", label: "Duration (minutes)", type: "number", placeholder: "45", min: 15, max: 120 },
      { id: "tipo_sesion", label: "Session type", type: "select", options: ["Individual", "Group", "Home-based", "Virtual"], required: true },
      { id: "objetivo_principal", label: "Main goal of the session", type: "textarea", placeholder: "Describe the therapeutic goal...", required: true },
    ]
  },
  {
    title: "2. ABC Record (Behavior Analysis)",
    icon: <Activity size={20}/>,
    questions: [
      { id: "antecedente", label: "Antecedent (A)", type: "textarea", placeholder: "What happened BEFORE the behavior? Context, activity, people present..." },
      { id: "conducta", label: "Observed Behavior (B)", type: "textarea", placeholder: "Describe EXACTLY what the child did (observable and measurable)...", required: true },
      { id: "consecuencia", label: "Consequence (C)", type: "textarea", placeholder: "What happened AFTER? Response from the therapist, from the environment..." },
      { id: "funcion_estimada", label: "Estimated function of the behavior", type: "select", options: ["Access to Tangible", "Social Attention", "Escape/Avoidance", "Sensory/Automatic", "Multiple"] },
    ]
  },
  {
    title: "3. Performance Metrics",
    icon: <TrendingUp size={20}/>,
    questions: [
      { id: "nivel_atencion", label: "Sustained attention level", type: "range", min: 1, max: 5, labels: ["Very distracted", "Distracted", "Moderate", "Good", "Excellent"] },
      { id: "respuesta_instrucciones", label: "Response to instructions", type: "range", min: 1, max: 5, labels: ["None", "Minimal", "Partial", "Good", "Immediate"] },
      { id: "iniciativa_comunicativa", label: "Communicative initiative", type: "range", min: 1, max: 5, labels: ["None", "Very low", "Low", "Moderate", "High"] },
      { id: "tolerancia_frustracion", label: "Frustration tolerance", type: "range", min: 1, max: 5, labels: ["Very low", "Low", "Moderate", "Good", "Excellent"] },
      { id: "interaccion_social", label: "Quality of social interaction", type: "range", min: 1, max: 5, labels: ["Avoidant", "Minimal", "Functional", "Good", "Spontaneous"] },
    ]
  },
  {
    title: "4. Skills Worked On",
    icon: <Target size={20}/>,
    questions: [
      { id: "habilidades_objetivo", label: "Specific skills worked on", type: "multiselect", options: [
        "Eye contact", "Motor imitation", "Following instructions",
        "Functional communication", "Symbolic play", "Social skills",
        "Emotional self-regulation", "Fine motor skills", "Gross motor skills",
        "Joint attention", "Turn taking", "Cognitive flexibility"
      ]},
      { id: "nivel_logro_objetivos", label: "Level of goal achievement", type: "select", options: [
        "Not achieved (0-25%)", "Partially achieved (26-50%)",
        "Mostly achieved (51-75%)", "Fully achieved (76-100%)"
      ]},
      { id: "ayudas_utilizadas", label: "Level of prompting provided", type: "select", options: [
        "Independent (no help)", "Gestural prompt", "Verbal prompt",
        "Modeling", "Partial physical guidance", "Full physical guidance"
      ]},
    ]
  },
  {
    title: "5. Interventions and Strategies",
    icon: <Zap size={20}/>,
    questions: [
      { id: "tecnicas_aplicadas", label: "ABA techniques applied", type: "multiselect", options: [
        "Positive reinforcement", "Extinction", "Shaping",
        "Chaining", "Task analysis", "Time out",
        "Token economy", "Behavior contract", "Functional communication training"
      ]},
      { id: "reforzadores_efectivos", label: "Most effective reinforcers", type: "textarea", placeholder: "List the reinforcers that worked best today..." },
      { id: "conductas_desafiantes", label: "Challenging behaviors presented", type: "textarea", placeholder: "Describe frequency and intensity..." },
      { id: "estrategias_manejo", label: "Management strategies used", type: "textarea", placeholder: "How the challenging behaviors were addressed..." },
    ]
  },
  {
    title: "6. Progress and Evolution",
    icon: <Award size={20}/>,
    hasIA: true,
    questions: [
      { id: "avances_observados", label: "Progress observed in this session", type: "textarea", placeholder: "Specific achievements, improvements over previous sessions...", aiGenerated: true },
      { id: "areas_dificultad", label: "Areas of persistent difficulty", type: "textarea", placeholder: "Aspects that require more work...", aiGenerated: true },
      { id: "patron_aprendizaje", label: "Observed learning pattern", type: "select", options: [
        "Fast learning and generalization", "Gradual learning",
        "Requires intensive repetition", "Difficulty generalizing",
        "Inconsistent learning"
      ], aiGenerated: true },
    ]
  },
  {
    title: "7. Clinical Observations (Internal)",
    icon: <BookOpen size={20}/>,
    hasIA: true,
    questions: [
      { id: "observaciones_tecnicas", label: "Technical notes for the team", type: "textarea", placeholder: "Professional analysis, clinical hypotheses, necessary adjustments...", aiGenerated: true },
      { id: "alertas_clinicas", label: "Alerts or red flags", type: "textarea", placeholder: "Signs of concern, regressions, significant changes...", aiGenerated: true },
      { id: "recomendaciones_equipo", label: "Recommendations for the team", type: "textarea", placeholder: "Suggestions for next sessions, necessary referrals...", aiGenerated: true },
      { id: "coordinacion_familia", label: "Need for coordination with family", type: "radio", options: ["Urgent", "Necessary", "Routine", "Not necessary"], aiGenerated: true },
    ]
  },
  {
    title: "8. Homework",
    icon: <Home size={20}/>,
    hasIA: true,
    questions: [
      { id: "actividad_casa", label: "Suggested activity to practice at home", type: "textarea", placeholder: "Detailed description of the activity, materials needed, frequency...", aiGenerated: true },
      { id: "instrucciones_padres", label: "Specific instructions for parents", type: "textarea", placeholder: "Clear steps, what to do and what to avoid...", aiGenerated: true },
      { id: "objetivo_tarea", label: "Goal of the task", type: "text", placeholder: "What skill does this activity reinforce?", aiGenerated: true },
    ]
  },
  {
    title: "9. Communication with the Family (VISIBLE TO PARENTS)",
    icon: <MessageCircle size={20}/>,
    hasIA: true,
    questions: [
      { id: "mensaje_padres", label: "Message for WhatsApp/Report", type: "textarea", placeholder: "This message will be visible to parents. Use positive and clear language...", aiGenerated: true },
      { id: "destacar_positivo", label: "Achievements to highlight to parents", type: "textarea", placeholder: "Positive aspects parents should know about...", aiGenerated: true },
      { id: "proximos_pasos", label: "Next steps (to share)", type: "textarea", placeholder: "What's coming in the next sessions...", aiGenerated: true },
    ]
  },
  {
    title: "10. Analysis and Planning",
    icon: <Brain size={20}/>,
    hasIA: true,
    questions: [
      { id: "efectividad_sesion", label: "Overall session effectiveness", type: "range", min: 1, max: 5, labels: ["Very low", "Low", "Moderate", "High", "Very high"], aiGenerated: true },
      { id: "ajustes_proxima_sesion", label: "Adjustments for the next session", type: "textarea", placeholder: "What to modify, what to keep, new strategies to try...", aiGenerated: true },
      { id: "necesidades_materiales", label: "Materials or resources needed", type: "text", placeholder: "What needs to be obtained for upcoming sessions...", aiGenerated: true },
    ]
  }
]

export const ENTORNO_HOGAR_DATA_EN = [
  {
    title: "1. General Visit Information",
    questions: [
      { id: "fecha_visita", label: "Date of the home visit", type: "date" },
      { id: "duracion_visita", label: "Approximate duration", type: "text", placeholder: "E.g.: 1 hour 30 min" },
      { id: "personas_presentes", label: "Who was present?", type: "textarea", placeholder: "Mother, father, siblings, grandparents..." },
    ]
  },
  {
    title: "2. Home Structure and Conditions",
    questions: [
      { id: "tipo_vivienda", label: "Type of housing", type: "select", options: ["Detached house", "Apartment", "Rented room", "Shared housing", "Other"] },
      { id: "num_habitaciones", label: "Number of rooms", type: "text", placeholder: "E.g.: 2 bedrooms" },
      { id: "espacio_juego", label: "Is there a dedicated space for play/therapy?", type: "radio", options: ["Yes, ample space", "Limited space", "No specific space"] },
      { id: "condiciones_higiene", label: "General hygiene conditions", type: "select", options: ["Excellent", "Good", "Fair", "Needs improvement"] },
      { id: "iluminacion_ventilacion", label: "Lighting and ventilation", type: "select", options: ["Adequate", "Insufficient", "Excessive"] },
    ]
  },
  {
    title: "3. Available Resources and Materials",
    questions: [
      { id: "juguetes_disponibles", label: "Toys and educational materials", type: "textarea", placeholder: "List the toys, books, sensory materials available..." },
      { id: "acceso_tecnologia", label: "Access to technology (tablet, TV, computer)", type: "radio", options: ["Yes, with supervision", "Yes, without limits", "No access"] },
      { id: "tiempo_pantalla", label: "Daily screen time", type: "text", placeholder: "E.g.: 2 hours" },
    ]
  },
  {
    title: "4. Routines and Family Structure",
    questions: [
      { id: "rutina_diaria", label: "Description of the child's daily routine", type: "textarea", placeholder: "Wake-up time, meals, naps, activities..." },
      { id: "consistencia_rutinas", label: "Are the routines consistent?", type: "radio", options: ["Yes, very structured", "Partially", "No, they vary"] },
      { id: "hora_dormir", label: "Usual bedtime", type: "text", placeholder: "E.g.: 8:30 PM" },
      { id: "actividades_familia", label: "Activities the family does together", type: "textarea", placeholder: "Meals, outings, games..." },
    ]
  },
  {
    title: "5. Family Dynamics and Relationships",
    questions: [
      { id: "interaccion_padres", label: "Observed quality of parent-child interaction", type: "select", options: ["Very positive and warm", "Functional", "Tense or conflictive", "Distant"] },
      { id: "estilo_crianza", label: "Predominant parenting style", type: "select", options: ["Authoritative (limits + affection)", "Permissive", "Authoritarian", "Neglectful", "Mixed"] },
      { id: "manejo_conductas", label: "How do they handle challenging behaviors?", type: "textarea", placeholder: "Strategies the parents use..." },
      { id: "apoyo_red_familiar", label: "Family/social support network", type: "textarea", placeholder: "Grandparents, aunts/uncles, neighbors, friends who help..." },
    ]
  },
  {
    title: "6. Feeding and Health Habits",
    questions: [
      { id: "tipo_alimentacion", label: "Type of feeding of the child", type: "textarea", placeholder: "Describe typical diet, preferences, refusals..." },
      { id: "quien_prepara_comida", label: "Who prepares the meals?", type: "text", placeholder: "E.g.: Mother mainly" },
      { id: "come_familia", label: "Do they eat with the family?", type: "radio", options: ["Yes, always", "Sometimes", "No, eats alone"] },
    ]
  },
  {
    title: "7. Observations of Behavior at Home",
    questions: [
      { id: "comportamiento_observado", label: "Child's behavior during the visit", type: "textarea", placeholder: "Activity, mood, interaction with family members..." },
      { id: "diferencias_consultorio", label: "Differences from behavior at the clinic?", type: "textarea", placeholder: "Behaviors that appear only at home or only in therapy..." },
      { id: "estimulacion_sensorial", label: "Sensory stimuli in the environment (noise, light, textures)", type: "textarea", placeholder: "TV on, music, pets, smells..." },
    ]
  },
  {
    title: "8. Barriers and Facilitators for Therapy",
    questions: [
      { id: "barreras_identificadas", label: "Barriers to implementing strategies at home", type: "textarea", placeholder: "Lack of time, small spaces, family resistance..." },
      { id: "facilitadores", label: "Facilitators and strengths of the environment", type: "textarea", placeholder: "Parent commitment, good resources, clear routines..." },
      { id: "disposicion_cambio", label: "Family's willingness to make changes", type: "radio", options: ["Very motivated", "Moderately willing", "Resistant", "Ambivalent"] },
    ]
  },
  {
    title: "9. Specific Recommendations for the Home",
    questions: [
      { id: "recomendaciones_espacio", label: "Recommendations about the physical space", type: "textarea", placeholder: "Set up a sensory corner, reduce distractions..." },
      { id: "recomendaciones_rutinas", label: "Suggested adjustments to routines", type: "textarea", placeholder: "Sleep schedules, meal structure..." },
      { id: "actividades_casa", label: "Suggested therapeutic activities to do at home", type: "textarea", placeholder: "Motor exercises, imitation games..." },
    ]
  },
  {
    title: "10. Analysis and General Impression (AI Assisted)",
    hasIA: true,
    questions: [
      { id: "impresion_general", label: "General Impression of the Environment", type: "textarea", placeholder: "Summary of the visit and overall assessment..." },
      { id: "mensaje_padres_entorno", label: "Message for the Parents (AI Generated)", type: "textarea", placeholder: "This field can be AI generated...", aiGenerated: true },
      { id: "seguimiento_requerido", label: "Does it require follow-up or a new visit?", type: "radio", options: ["Yes, in 1 month", "Yes, in 3 months", "Not necessary for now"] },
    ]
  }
]

export const BRIEF2_DATA_EN = [
  {
    title: "1. Evaluation Information",
    icon: <Brain size={20}/>,
    questions: [
      { id: "fecha_evaluacion", label: "Evaluation date", type: "date", required: true },
      { id: "evaluador", label: "Evaluator's name", type: "text", required: true },
      { id: "informante", label: "Informant", type: "select", options: ["Mother", "Father", "Both parents", "Teacher", "Therapist", "Other"] },
      { id: "edad_evaluado", label: "Child's age (years)", type: "number", min: 2, max: 18 },
      { id: "motivo_evaluacion", label: "Reason for the evaluation", type: "textarea", placeholder: "Why this evaluation is being carried out..." },
    ]
  },
  {
    title: "2. Inhibition Index",
    description: "Ability to resist impulses and stop behavior at the appropriate moment",
    icon: <Activity size={20}/>,
    questions: [
      { id: "inhibe_1", label: "Has trouble waiting their turn", type: "range", min: 1, max: 3, labels: ["Never", "Sometimes", "Often"] },
      { id: "inhibe_2", label: "Acts wilder or louder than other children", type: "range", min: 1, max: 3, labels: ["Never", "Sometimes", "Often"] },
      { id: "inhibe_3", label: "Interrupts others' conversations", type: "range", min: 1, max: 3, labels: ["Never", "Sometimes", "Often"] },
      { id: "inhibe_4", label: "Overreacts to small problems", type: "range", min: 1, max: 3, labels: ["Never", "Sometimes", "Often"] },
      { id: "inhibe_5", label: "Has trouble controlling their emotions", type: "range", min: 1, max: 3, labels: ["Never", "Sometimes", "Often"] },
      { id: "inhibe_6", label: "Has disproportionate angry outbursts", type: "range", min: 1, max: 3, labels: ["Never", "Sometimes", "Often"] },
      { id: "inhibe_notas", label: "Observations on inhibition", type: "textarea", placeholder: "Specific examples, contexts where it improves/worsens..." },
    ]
  },
  {
    title: "3. Cognitive Flexibility Index",
    description: "Ability to switch activities, revise plans and adapt to new situations",
    icon: <Target size={20}/>,
    questions: [
      { id: "flex_1", label: "Resists changes in routine, food, places", type: "range", min: 1, max: 3, labels: ["Never", "Sometimes", "Often"] },
      { id: "flex_2", label: "Gets upset by unexpected situations", type: "range", min: 1, max: 3, labels: ["Never", "Sometimes", "Often"] },
      { id: "flex_3", label: "Persists with the same response even when it doesn't work", type: "range", min: 1, max: 3, labels: ["Never", "Sometimes", "Often"] },
      { id: "flex_4", label: "Has trouble accepting different ways to solve problems", type: "range", min: 1, max: 3, labels: ["Never", "Sometimes", "Often"] },
      { id: "flex_5", label: "Gets stuck on a topic or activity", type: "range", min: 1, max: 3, labels: ["Never", "Sometimes", "Often"] },
      { id: "flex_6", label: "Finds it hard to move from one activity to another", type: "range", min: 1, max: 3, labels: ["Never", "Sometimes", "Often"] },
      { id: "flex_notas", label: "Observations on flexibility", type: "textarea", placeholder: "Situations of rigidity, strategies that work..." },
    ]
  },
  {
    title: "4. Emotional Control",
    description: "Ability to modulate emotional responses appropriately",
    icon: <Heart size={20}/>,
    questions: [
      { id: "emocional_1", label: "Has emotional outbursts for minimal reasons", type: "range", min: 1, max: 3, labels: ["Never", "Sometimes", "Often"] },
      { id: "emocional_2", label: "Small things trigger big reactions", type: "range", min: 1, max: 3, labels: ["Never", "Sometimes", "Often"] },
      { id: "emocional_3", label: "Changes mood quickly", type: "range", min: 1, max: 3, labels: ["Never", "Sometimes", "Often"] },
      { id: "emocional_4", label: "Gets upset easily", type: "range", min: 1, max: 3, labels: ["Never", "Sometimes", "Often"] },
      { id: "emocional_5", label: "Reacts more emotionally than other children their age", type: "range", min: 1, max: 3, labels: ["Never", "Sometimes", "Often"] },
      { id: "emocional_notas", label: "Observations on emotional control", type: "textarea", placeholder: "Triggers, duration of episodes, recovery..." },
    ]
  },
  {
    title: "5. Working Memory",
    description: "Ability to hold information in mind to complete a task",
    icon: <Brain size={20}/>,
    questions: [
      { id: "memoria_1", label: "Forgets what they were supposed to do", type: "range", min: 1, max: 3, labels: ["Never", "Sometimes", "Often"] },
      { id: "memoria_2", label: "Has trouble remembering instructions", type: "range", min: 1, max: 3, labels: ["Never", "Sometimes", "Often"] },
      { id: "memoria_3", label: "Loses track of what they are doing", type: "range", min: 1, max: 3, labels: ["Never", "Sometimes", "Often"] },
      { id: "memoria_4", label: "Has trouble remembering what they just heard", type: "range", min: 1, max: 3, labels: ["Never", "Sometimes", "Often"] },
      { id: "memoria_5", label: "Needs things repeated several times", type: "range", min: 1, max: 3, labels: ["Never", "Sometimes", "Often"] },
      { id: "memoria_notas", label: "Observations on memory", type: "textarea", placeholder: "Compensation strategies, visual supports..." },
    ]
  },
  {
    title: "6. Planning and Organization",
    description: "Ability to manage present and future tasks",
    icon: <Target size={20}/>,
    questions: [
      { id: "plan_1", label: "Does not plan tasks in advance", type: "range", min: 1, max: 3, labels: ["Never", "Sometimes", "Often"] },
      { id: "plan_2", label: "Has trouble organizing activities", type: "range", min: 1, max: 3, labels: ["Never", "Sometimes", "Often"] },
      { id: "plan_3", label: "Underestimates the time needed to complete tasks", type: "range", min: 1, max: 3, labels: ["Never", "Sometimes", "Often"] },
      { id: "plan_4", label: "Leaves things messy", type: "range", min: 1, max: 3, labels: ["Never", "Sometimes", "Often"] },
      { id: "plan_5", label: "Has trouble prioritizing activities", type: "range", min: 1, max: 3, labels: ["Never", "Sometimes", "Often"] },
      { id: "plan_notas", label: "Observations on planning", type: "textarea", placeholder: "Compensatory strategies..." },
    ]
  },
  {
    title: "7. Analysis and Conclusions (AI)",
    icon: <Sparkles size={20}/>,
    hasIA: true,
    questions: [
      { id: "analisis_ia", label: "Comprehensive AI Analysis", type: "textarea", placeholder: "Complete AI-generated analysis...", aiGenerated: true },
      { id: "recomendaciones_ia", label: "Therapeutic Recommendations", type: "textarea", placeholder: "Specific recommendations...", aiGenerated: true },
      { id: "informe_padres", label: "Report for Parents", type: "textarea", placeholder: "Report understandable for the family...", aiGenerated: true },
    ]
  }
]

export const ADOS2_DATA_EN = [
  {
    title: "1. Evaluation Data",
    icon: <Eye size={20}/>,
    questions: [
      { id: "fecha_eval", label: "Evaluation date", type: "date", required: true },
      { id: "modulo_aplicado", label: "Module applied", type: "select", options: ["Module 1 (No language)", "Module 2 (Phrases)", "Module 3 (Fluent)", "Module 4 (Adolescent/Adult)"] },
      { id: "duracion_eval", label: "Evaluation duration (minutes)", type: "number", min: 30, max: 90 },
      { id: "evaluador_certificado", label: "ADOS-2 certified evaluator", type: "text" },
    ]
  },
  {
    title: "2. Social Communication",
    description: "Assessment of communicative and social skills",
    icon: <MessageCircle size={20}/>,
    questions: [
      { id: "contacto_visual", label: "Eye contact during social interaction", type: "range", min: 0, max: 3, labels: ["Appropriate", "Mild", "Marked", "Absent"] },
      { id: "expresiones_faciales", label: "Facial expressions directed at others", type: "range", min: 0, max: 3, labels: ["Appropriate", "Mild", "Marked", "Absent"] },
      { id: "integracion_mirada", label: "Integration of gaze and other social behaviors", type: "range", min: 0, max: 3, labels: ["Appropriate", "Mild", "Marked", "Absent"] },
      { id: "sonrisa_social", label: "Shared social smile", type: "range", min: 0, max: 3, labels: ["Appropriate", "Mild", "Marked", "Absent"] },
      { id: "comunicacion_afectiva", label: "Range of affective communication", type: "range", min: 0, max: 3, labels: ["Appropriate", "Mild", "Marked", "Absent"] },
      { id: "atencion_conjunta", label: "Response to joint attention", type: "range", min: 0, max: 3, labels: ["Appropriate", "Mild", "Marked", "Absent"] },
      { id: "inicio_atencion", label: "Initiation of joint attention", type: "range", min: 0, max: 3, labels: ["Appropriate", "Mild", "Marked", "Absent"] },
      { id: "notas_comunicacion", label: "Communication observations", type: "textarea" },
    ]
  },
  {
    title: "3. Reciprocal Social Interaction",
    description: "Quality of two-way social interactions",
    icon: <Users size={20}/>,
    questions: [
      { id: "busqueda_compartir", label: "Seeking to share experiences", type: "range", min: 0, max: 3, labels: ["Appropriate", "Mild", "Marked", "Absent"] },
      { id: "ofrecimiento_consuelo", label: "Offering comfort", type: "range", min: 0, max: 3, labels: ["Appropriate", "Mild", "Marked", "Absent"] },
      { id: "respuesta_nombre", label: "Response to name", type: "range", min: 0, max: 3, labels: ["Appropriate", "Mild", "Marked", "Absent"] },
      { id: "reciprocidad_social", label: "Quality of social reciprocity", type: "range", min: 0, max: 3, labels: ["Appropriate", "Mild", "Marked", "Absent"] },
      { id: "interes_otros", label: "Interest in other children", type: "range", min: 0, max: 3, labels: ["Appropriate", "Mild", "Marked", "Absent"] },
      { id: "notas_interaccion", label: "Interaction observations", type: "textarea" },
    ]
  },
  {
    title: "4. Play and Imagination",
    description: "Assessment of symbolic play and creativity",
    icon: <Activity size={20}/>,
    questions: [
      { id: "juego_funcional", label: "Functional play with objects", type: "range", min: 0, max: 3, labels: ["Appropriate", "Mild", "Marked", "Absent"] },
      { id: "juego_imaginativo", label: "Imaginative/creative play", type: "range", min: 0, max: 3, labels: ["Appropriate", "Mild", "Marked", "Absent"] },
      { id: "juego_imitativo", label: "Social imitative play", type: "range", min: 0, max: 3, labels: ["Appropriate", "Mild", "Marked", "Absent"] },
      { id: "notas_juego", label: "Observations on play", type: "textarea" },
    ]
  },
  {
    title: "5. Restricted and Repetitive Behaviors",
    description: "Stereotyped behavior patterns",
    icon: <Target size={20}/>,
    questions: [
      { id: "estereotipias_motoras", label: "Motor stereotypies", type: "range", min: 0, max: 2, labels: ["Absent", "Present", "Frequent"] },
      { id: "manipulacion_objetos", label: "Repetitive use of objects", type: "range", min: 0, max: 2, labels: ["Absent", "Present", "Frequent"] },
      { id: "intereses_restringidos", label: "Intense restricted interests", type: "range", min: 0, max: 2, labels: ["Absent", "Present", "Frequent"] },
      { id: "rituales_compulsiones", label: "Rituals or compulsions", type: "range", min: 0, max: 2, labels: ["Absent", "Present", "Frequent"] },
      { id: "sensibilidad_sensorial", label: "Unusual sensory sensitivity", type: "range", min: 0, max: 2, labels: ["Absent", "Present", "Frequent"] },
      { id: "notas_conductas", label: "Behavior observations", type: "textarea" },
    ]
  },
  {
    title: "6. Diagnostic Analysis (AI)",
    icon: <Sparkles size={20}/>,
    hasIA: true,
    questions: [
      { id: "puntuacion_total", label: "Calculated total score", type: "number", readonly: true },
      { id: "nivel_severidad", label: "Severity level", type: "text", readonly: true },
      { id: "analisis_diagnostico_ia", label: "AI Diagnostic Analysis", type: "textarea", aiGenerated: true },
      { id: "recomendaciones_intervencion", label: "Intervention Recommendations", type: "textarea", aiGenerated: true },
      { id: "informe_familia_ados", label: "Report for Family", type: "textarea", aiGenerated: true },
    ]
  }
]

export const VINELAND3_DATA_EN = [
  {
    title: "1. General Information",
    icon: <Users size={20}/>,
    questions: [
      { id: "fecha_eval_vineland", label: "Evaluation date", type: "date", required: true },
      { id: "informante_vineland", label: "Informant", type: "select", options: ["Mother", "Father", "Both", "Primary caregiver", "Teacher"] },
      { id: "forma_aplicacion", label: "Administration form", type: "select", options: ["Semi-structured interview", "Parent form", "Teacher form"] },
    ]
  },
  {
    title: "2. Communication Domain",
    description: "Receptive, expressive and written skills",
    icon: <MessageCircle size={20}/>,
    questions: [
      { id: "com_receptiva", label: "Do they understand when told 'no'?", type: "radio", options: ["Usually", "Sometimes", "Never"] },
      { id: "com_sigue_instrucciones", label: "Do they follow simple instructions?", type: "radio", options: ["Usually", "Sometimes", "Never"] },
      { id: "com_entiende_2pasos", label: "Do they follow 2-step instructions?", type: "radio", options: ["Usually", "Sometimes", "Never"] },
      { id: "com_expresiva_palabras", label: "Do they use words to ask for things?", type: "radio", options: ["Usually", "Sometimes", "Never"] },
      { id: "com_frases_completas", label: "Do they use complete sentences of 4+ words?", type: "radio", options: ["Usually", "Sometimes", "Never"] },
      { id: "com_cuenta_experiencias", label: "Do they recount experiences in detail?", type: "radio", options: ["Usually", "Sometimes", "Never"] },
      { id: "com_escrita", label: "Do they write their name?", type: "radio", options: ["Usually", "Sometimes", "Never", "N/A"] },
      { id: "com_notas", label: "Communication observations", type: "textarea" },
    ]
  },
  {
    title: "3. Daily Living Domain",
    description: "Personal, domestic and community autonomy",
    icon: <Home size={20}/>,
    questions: [
      { id: "vida_come_solo", label: "Do they eat alone with a spoon/fork?", type: "radio", options: ["Usually", "Sometimes", "Never"] },
      { id: "vida_bebe_vaso", label: "Do they drink from a cup without spilling?", type: "radio", options: ["Usually", "Sometimes", "Never"] },
      { id: "vida_lava_manos", label: "Do they wash their hands alone?", type: "radio", options: ["Usually", "Sometimes", "Never"] },
      { id: "vida_viste_superior", label: "Do they put on upper clothing alone?", type: "radio", options: ["Usually", "Sometimes", "Never"] },
      { id: "vida_bano", label: "Do they use the bathroom independently?", type: "radio", options: ["Usually", "Sometimes", "Never"] },
      { id: "vida_tareas_casa", label: "Do they help with simple household chores?", type: "radio", options: ["Usually", "Sometimes", "Never"] },
      { id: "vida_dinero", label: "Do they understand the concept of money?", type: "radio", options: ["Usually", "Sometimes", "Never", "N/A"] },
      { id: "vida_notas", label: "Daily living observations", type: "textarea" },
    ]
  },
  {
    title: "4. Socialization Domain",
    description: "Interpersonal relationships, play and emotional management",
    icon: <Heart size={20}/>,
    questions: [
      { id: "soc_sonrie_familiar", label: "Do they smile at familiar people?", type: "radio", options: ["Usually", "Sometimes", "Never"] },
      { id: "soc_muestra_afecto", label: "Do they show affection to caregivers?", type: "radio", options: ["Usually", "Sometimes", "Never"] },
      { id: "soc_juega_otros", label: "Do they play interactively with other children?", type: "radio", options: ["Usually", "Sometimes", "Never"] },
      { id: "soc_comparte", label: "Do they share toys spontaneously?", type: "radio", options: ["Usually", "Sometimes", "Never"] },
      { id: "soc_respeta_turnos", label: "Do they take turns in games?", type: "radio", options: ["Usually", "Sometimes", "Never"] },
      { id: "soc_empatia", label: "Do they show concern for others?", type: "radio", options: ["Usually", "Sometimes", "Never"] },
      { id: "soc_amistad", label: "Do they have close friends?", type: "radio", options: ["Usually", "Sometimes", "Never", "N/A"] },
      { id: "soc_notas", label: "Socialization observations", type: "textarea" },
    ]
  },
  {
    title: "5. Motor Skills Domain",
    description: "Gross and fine motor skills",
    icon: <Activity size={20}/>,
    questions: [
      { id: "motor_camina", label: "Do they walk without help?", type: "radio", options: ["Usually", "Sometimes", "Never"] },
      { id: "motor_corre", label: "Do they run in a coordinated way?", type: "radio", options: ["Usually", "Sometimes", "Never"] },
      { id: "motor_salta", label: "Do they jump with both feet?", type: "radio", options: ["Usually", "Sometimes", "Never"] },
      { id: "motor_pelota", label: "Do they catch a ball?", type: "radio", options: ["Usually", "Sometimes", "Never"] },
      { id: "motor_pinza", label: "Do they use a pincer grip (thumb-index)?", type: "radio", options: ["Usually", "Sometimes", "Never"] },
      { id: "motor_dibuja", label: "Do they draw recognizable shapes?", type: "radio", options: ["Usually", "Sometimes", "Never", "N/A"] },
      { id: "motor_notas", label: "Motor observations", type: "textarea" },
    ]
  },
  {
    title: "6. Adaptive Behavior Analysis (AI)",
    icon: <Sparkles size={20}/>,
    hasIA: true,
    questions: [
      { id: "puntuacion_comunicacion", label: "Communication Score", type: "number", readonly: true },
      { id: "puntuacion_vida_diaria", label: "Daily Living Score", type: "number", readonly: true },
      { id: "puntuacion_socializacion", label: "Socialization Score", type: "number", readonly: true },
      { id: "indice_conducta_adaptativa", label: "Overall Adaptive Behavior Index", type: "number", readonly: true },
      { id: "analisis_vineland_ia", label: "Comprehensive AI Analysis", type: "textarea", aiGenerated: true },
      { id: "areas_fortaleza", label: "Areas of Strength", type: "textarea", aiGenerated: true },
      { id: "areas_prioridad", label: "Priority Intervention Areas", type: "textarea", aiGenerated: true },
      { id: "informe_padres_vineland", label: "Report for Parents", type: "textarea", aiGenerated: true },
    ]
  }
]

export const WISCV_DATA_EN = [
  {
    title: "1. Evaluation Information",
    icon: <Brain size={20}/>,
    questions: [
      { id: "fecha_eval_wisc", label: "Evaluation date", type: "date", required: true },
      { id: "evaluador_wisc", label: "Evaluating psychologist", type: "text", required: true },
      { id: "edad_cronologica", label: "Chronological age (years, months)", type: "text", placeholder: "E.g.: 7 years, 3 months" },
      { id: "motivo_eval_cognitiva", label: "Reason for evaluation", type: "textarea" },
    ]
  },
  {
    title: "2. Verbal Comprehension Index (VCI)",
    description: "Verbal reasoning, concept formation",
    icon: <MessageCircle size={20}/>,
    questions: [
      { id: "icv_semejanzas", label: "Similarities - Scaled score", type: "number", min: 1, max: 19 },
      { id: "icv_vocabulario", label: "Vocabulary - Scaled score", type: "number", min: 1, max: 19 },
      { id: "icv_informacion", label: "Information - Scaled score", type: "number", min: 1, max: 19 },
      { id: "icv_comprension", label: "Comprehension - Scaled score", type: "number", min: 1, max: 19 },
      { id: "icv_total", label: "VCI Total", type: "number", readonly: true },
      { id: "icv_percentil", label: "VCI Percentile", type: "number", readonly: true },
      { id: "icv_notas", label: "VCI observations", type: "textarea" },
    ]
  },
  {
    title: "3. Visual Spatial Index (VSI)",
    description: "Spatial and visual reasoning",
    icon: <Eye size={20}/>,
    questions: [
      { id: "ive_cubos", label: "Block Design - Scaled score", type: "number", min: 1, max: 19 },
      { id: "ive_puzles", label: "Visual Puzzles - Scaled score", type: "number", min: 1, max: 19 },
      { id: "ive_total", label: "VSI Total", type: "number", readonly: true },
      { id: "ive_percentil", label: "VSI Percentile", type: "number", readonly: true },
      { id: "ive_notas", label: "VSI observations", type: "textarea" },
    ]
  },
  {
    title: "4. Fluid Reasoning Index (FRI)",
    description: "Logical reasoning and problem solving",
    icon: <Target size={20}/>,
    questions: [
      { id: "irf_matrices", label: "Matrix Reasoning - Scaled score", type: "number", min: 1, max: 19 },
      { id: "irf_balanzas", label: "Figure Weights - Scaled score", type: "number", min: 1, max: 19 },
      { id: "irf_aritmetica", label: "Arithmetic - Scaled score", type: "number", min: 1, max: 19 },
      { id: "irf_total", label: "FRI Total", type: "number", readonly: true },
      { id: "irf_percentil", label: "FRI Percentile", type: "number", readonly: true },
      { id: "irf_notas", label: "FRI observations", type: "textarea" },
    ]
  },
  {
    title: "5. Working Memory Index (WMI)",
    description: "Short-term auditory memory",
    icon: <Brain size={20}/>,
    questions: [
      { id: "imt_digitos", label: "Digit Span - Scaled score", type: "number", min: 1, max: 19 },
      { id: "imt_imagenes", label: "Picture Span - Scaled score", type: "number", min: 1, max: 19 },
      { id: "imt_total", label: "WMI Total", type: "number", readonly: true },
      { id: "imt_percentil", label: "WMI Percentile", type: "number", readonly: true },
      { id: "imt_notas", label: "WMI observations", type: "textarea" },
    ]
  },
  {
    title: "6. Processing Speed Index (PSI)",
    description: "Perceptual speed and accuracy",
    icon: <Activity size={20}/>,
    questions: [
      { id: "ivp_claves", label: "Coding - Scaled score", type: "number", min: 1, max: 19 },
      { id: "ivp_busqueda", label: "Symbol Search - Scaled score", type: "number", min: 1, max: 19 },
      { id: "ivp_cancelacion", label: "Cancellation - Scaled score", type: "number", min: 1, max: 19 },
      { id: "ivp_total", label: "PSI Total", type: "number", readonly: true },
      { id: "ivp_percentil", label: "PSI Percentile", type: "number", readonly: true },
      { id: "ivp_notas", label: "PSI observations", type: "textarea" },
    ]
  },
  {
    title: "7. Comprehensive Cognitive Analysis (AI)",
    icon: <Sparkles size={20}/>,
    hasIA: true,
    questions: [
      { id: "ci_total", label: "Full Scale IQ", type: "number", min: 40, max: 160, readonly: true },
      { id: "ci_percentil", label: "Full Scale IQ Percentile", type: "number", readonly: true },
      { id: "clasificacion_ci", label: "Descriptive Classification", type: "text", readonly: true },
      { id: "perfil_cognitivo_ia", label: "Cognitive Profile Analysis", type: "textarea", aiGenerated: true },
      { id: "fortalezas_debilidades", label: "Strengths and Weaknesses", type: "textarea", aiGenerated: true },
      { id: "implicaciones_educativas", label: "Educational Implications", type: "textarea", aiGenerated: true },
      { id: "recomendaciones_cognitivas", label: "Specific Recommendations", type: "textarea", aiGenerated: true },
      { id: "informe_padres_wisc", label: "Report for Parents", type: "textarea", aiGenerated: true },
    ]
  }
]

export const BASC3_DATA_EN = [
  {
    title: "1. Evaluation Information",
    icon: <Activity size={20}/>,
    questions: [
      { id: "fecha_eval_basc", label: "Evaluation date", type: "date", required: true },
      { id: "informante_basc", label: "Informant", type: "select", options: ["Father", "Mother", "Both", "Teacher", "Self-report"] },
      { id: "forma_basc", label: "Form administered", type: "select", options: ["Preschool (2-5 years)", "Children (6-11 years)", "Adolescents (12-21 years)"] },
    ]
  },
  {
    title: "2. Clinical Scales - Externalizing Problems",
    description: "Behaviors directed outward",
    icon: <Activity size={20}/>,
    questions: [
      { id: "basc_hiperactividad", label: "Hyperactivity", type: "range", min: 1, max: 5, labels: ["Never", "Rarely", "Sometimes", "Often", "Very often"] },
      { id: "basc_agresion", label: "Aggression", type: "range", min: 1, max: 5, labels: ["Never", "Rarely", "Sometimes", "Often", "Very often"] },
      { id: "basc_problemas_conducta", label: "Conduct problems", type: "range", min: 1, max: 5, labels: ["Never", "Rarely", "Sometimes", "Often", "Very often"] },
      { id: "basc_notas_extern", label: "Externalizing observations", type: "textarea" },
    ]
  },
  {
    title: "3. Clinical Scales - Internalizing Problems",
    description: "Behaviors directed inward",
    icon: <Heart size={20}/>,
    questions: [
      { id: "basc_ansiedad", label: "Anxiety", type: "range", min: 1, max: 5, labels: ["Never", "Rarely", "Sometimes", "Often", "Very often"] },
      { id: "basc_depresion", label: "Depression", type: "range", min: 1, max: 5, labels: ["Never", "Rarely", "Sometimes", "Often", "Very often"] },
      { id: "basc_somatizacion", label: "Somatization", type: "range", min: 1, max: 5, labels: ["Never", "Rarely", "Sometimes", "Often", "Very often"] },
      { id: "basc_notas_intern", label: "Internalizing observations", type: "textarea" },
    ]
  },
  {
    title: "4. Adaptive Scales",
    description: "Positive and adaptive skills",
    icon: <Activity size={20}/>,
    questions: [
      { id: "basc_habilidades_sociales", label: "Social skills", type: "range", min: 1, max: 5, labels: ["Very low", "Low", "Average", "High", "Very high"] },
      { id: "basc_liderazgo", label: "Leadership", type: "range", min: 1, max: 5, labels: ["Very low", "Low", "Average", "High", "Very high"] },
      { id: "basc_habilidades_estudio", label: "Study skills", type: "range", min: 1, max: 5, labels: ["Very low", "Low", "Average", "High", "Very high"] },
      { id: "basc_adaptabilidad", label: "Adaptability", type: "range", min: 1, max: 5, labels: ["Very low", "Low", "Average", "High", "Very high"] },
      { id: "basc_notas_adapt", label: "Adaptive observations", type: "textarea" },
    ]
  },
  {
    title: "5. Comprehensive Behavioral Analysis (AI)",
    icon: <Sparkles size={20}/>,
    hasIA: true,
    questions: [
      { id: "indice_sintomas_conductuales", label: "Behavioral Symptoms Index", type: "number", readonly: true },
      { id: "perfil_riesgo", label: "Risk Profile", type: "text", readonly: true },
      { id: "analisis_basc_ia", label: "AI Behavioral Analysis", type: "textarea", aiGenerated: true },
      { id: "areas_preocupacion", label: "Areas of Concern", type: "textarea", aiGenerated: true },
      { id: "fortalezas_conductuales", label: "Behavioral Strengths", type: "textarea", aiGenerated: true },
      { id: "plan_intervencion_conductual", label: "Intervention Plan", type: "textarea", aiGenerated: true },
      { id: "informe_padres_basc", label: "Report for Parents", type: "textarea", aiGenerated: true },
    ]
  }
]

export const ABLLS_R_DATA_EN = [
  {
    title: "1. Evaluation Data",
    icon: <BookOpen size={20}/>,
    questions: [
      { id: "fecha_eval_ablls", label: "Evaluation date", type: "date", required: true },
      { id: "evaluador_ablls", label: "Evaluator", type: "text", required: true },
      { id: "protocolo_usado", label: "Protocol used", type: "select", options: ["Full ABLLS-R", "Partial ABLLS-R (selected areas)", "ABLLS-R Follow-up"] },
      { id: "contexto_eval", label: "Evaluation context", type: "select", options: ["Individual session", "Classroom observation", "Parent interview", "Combined"] },
      { id: "duracion_ablls", label: "Total duration (minutes)", type: "number", min: 30, max: 240 },
    ]
  },
  {
    title: "2. Cooperation and Reinforcers",
    description: "The child's willingness to participate and what motivates them",
    icon: <Heart size={20}/>,
    questions: [
      { id: "coop_sigue_instrucciones", label: "Follows simple instructions from the adult", type: "range", min: 0, max: 4, labels: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "coop_permanece_tarea", label: "Stays on task without escaping", type: "range", min: 0, max: 4, labels: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "coop_acepta_reforzador", label: "Accepts varied reinforcers (food, toys, social)", type: "range", min: 0, max: 4, labels: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "coop_tolerancia_frustracion", label: "Tolerates frustration and error", type: "range", min: 0, max: 4, labels: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "coop_transiciones", label: "Tolerates activity changes/transitions", type: "range", min: 0, max: 4, labels: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "coop_notas", label: "Observations on cooperation and motivation", type: "textarea" },
    ]
  },
  {
    title: "3. Receptive Language (Comprehension)",
    description: "Ability to understand verbal language",
    icon: <Eye size={20}/>,
    questions: [
      { id: "rec_responde_nombre", label: "Responds when called by their name", type: "range", min: 0, max: 4, labels: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "rec_sigue_1paso", label: "Follows 1-step instructions without a gesture", type: "range", min: 0, max: 4, labels: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "rec_sigue_2pasos", label: "Follows 2-step instructions", type: "range", min: 0, max: 4, labels: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "rec_identifica_objetos", label: "Identifies objects/images by name", type: "range", min: 0, max: 4, labels: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "rec_identifica_acciones", label: "Identifies actions in images", type: "range", min: 0, max: 4, labels: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "rec_conceptos_basicos", label: "Understands basic concepts (colors, sizes, positions)", type: "range", min: 0, max: 4, labels: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "rec_notas", label: "Receptive language observations", type: "textarea" },
    ]
  },
  {
    title: "4. Expressive Language",
    description: "Verbal and non-verbal communication skills",
    icon: <MessageCircle size={20}/>,
    questions: [
      { id: "exp_solicita_objetos", label: "Requests desired objects (mand)", type: "range", min: 0, max: 4, labels: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "exp_etiqueta_objetos", label: "Names/labels objects (tact)", type: "range", min: 0, max: 4, labels: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "exp_responde_preguntas", label: "Answers simple questions (What is this?)", type: "range", min: 0, max: 4, labels: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "exp_combina_palabras", label: "Combines 2 or more words spontaneously", type: "range", min: 0, max: 4, labels: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "exp_inicia_conversacion", label: "Initiates conversation or verbal interaction", type: "range", min: 0, max: 4, labels: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "exp_ecolalia", label: "Echolalia level (0=no echolalia, 4=predominant)", type: "range", min: 0, max: 4, labels: ["No echolalia", "Mild", "Moderate", "Marked", "Predominant"] },
      { id: "exp_notas", label: "Expressive language observations", type: "textarea" },
    ]
  },
  {
    title: "5. Play and Socialization Skills",
    description: "Interaction with peers, adults and objects",
    icon: <Users size={20}/>,
    questions: [
      { id: "social_juego_solo", label: "Appropriate independent play with objects", type: "range", min: 0, max: 4, labels: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "social_juego_paralelo", label: "Parallel play alongside other children", type: "range", min: 0, max: 4, labels: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "social_juego_cooperativo", label: "Cooperative and interactive play with peers", type: "range", min: 0, max: 4, labels: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "social_imita_pares", label: "Imitates peers' behaviors spontaneously", type: "range", min: 0, max: 4, labels: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "social_busca_interaccion", label: "Seeks interaction with adults and children", type: "range", min: 0, max: 4, labels: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "social_notas", label: "Play and socialization observations", type: "textarea" },
    ]
  },
  {
    title: "6. Functional Academic Skills",
    description: "Pre-academics, reading, writing and basic math",
    icon: <Award size={20}/>,
    questions: [
      { id: "acad_discrimina_formas", label: "Discriminates and matches shapes, colors, sizes", type: "range", min: 0, max: 4, labels: ["Not achieved", "With full assistance", "With partial assistance", "Independent with errors", "Independent"] },
      { id: "acad_secuencia_numeros", label: "Sequences and recognizes numbers 1 to 10", type: "range", min: 0, max: 4, labels: ["Not achieved", "With full assistance", "With partial assistance", "Independent with errors", "Independent"] },
      { id: "acad_reconoce_letras", label: "Recognizes letters of the alphabet", type: "range", min: 0, max: 4, labels: ["Not achieved", "With full assistance", "With partial assistance", "Independent with errors", "Independent"] },
      { id: "acad_escritura_nombre", label: "Writes or copies their name", type: "range", min: 0, max: 4, labels: ["Not achieved", "With full assistance", "With partial assistance", "Independent with errors", "Independent"] },
      { id: "acad_lectura_funcional", label: "Reads functional words or phrases", type: "range", min: 0, max: 4, labels: ["Not achieved", "With full assistance", "With partial assistance", "Independent with errors", "Independent"] },
      { id: "acad_notas", label: "Academic observations", type: "textarea" },
    ]
  },
  {
    title: "7. Self-Care and Daily Living Skills",
    description: "Independence in basic routines",
    icon: <Activity size={20}/>,
    questions: [
      { id: "avd_alimentacion", label: "Eats independently with utensils", type: "range", min: 0, max: 4, labels: ["Not achieved", "With full assistance", "With partial assistance", "Independent with errors", "Independent"] },
      { id: "avd_bano", label: "Toilet control and bathroom use", type: "range", min: 0, max: 4, labels: ["Not achieved", "With full assistance", "With partial assistance", "Independent with errors", "Independent"] },
      { id: "avd_vestido", label: "Dresses and undresses with simple garments", type: "range", min: 0, max: 4, labels: ["Not achieved", "With full assistance", "With partial assistance", "Independent with errors", "Independent"] },
      { id: "avd_higiene", label: "Personal hygiene (hand washing, brushing)", type: "range", min: 0, max: 4, labels: ["Not achieved", "With full assistance", "With partial assistance", "Independent with errors", "Independent"] },
      { id: "avd_notas", label: "Self-care observations", type: "textarea" },
    ]
  },
  {
    title: "8. ABLLS-R Profile Analysis (AI)",
    icon: <Sparkles size={20}/>,
    hasIA: true,
    questions: [
      { id: "puntaje_cooperacion",   label: "Cooperation Score (calculated)", type: "number", readonly: true },
      { id: "puntaje_receptivo",     label: "Receptive Language Score (calculated)", type: "number", readonly: true },
      { id: "puntaje_expresivo",     label: "Expressive Language Score (calculated)", type: "number", readonly: true },
      { id: "puntaje_social",        label: "Play/Social Score (calculated)", type: "number", readonly: true },
      { id: "puntaje_academico",     label: "Academic Score (calculated)", type: "number", readonly: true },
      { id: "puntaje_avd",           label: "Daily Living Score (calculated)", type: "number", readonly: true },
      { id: "nivel_habilidades",     label: "Overall skill level", type: "text", readonly: true },
      { id: "analisis_ablls_ia",     label: "ABLLS-R Profile Analysis (AI)", type: "textarea", aiGenerated: true },
      { id: "objetivos_prioritarios",label: "Priority Intervention Goals", type: "textarea", aiGenerated: true },
      { id: "informe_padres_ablls",  label: "Report for Family", type: "textarea", aiGenerated: true },
    ]
  }
]
