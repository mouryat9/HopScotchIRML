// src/vdEs.jsx
// Spanish overlay for the Visual Design editor forms + diagram layout labels.
// Merged over VD_FORMS at render time when the user works in Spanish. Field
// "help" paragraphs intentionally fall back to English until translated.
const N = {
  narrative: "Estudio narrativo", phenomenology: "Estudio fenomenológico",
  grounded_theory: "Estudio de teoría fundamentada", ethnography: "Estudio etnográfico",
  case_study: "Estudio de caso", action_research: "Estudio de investigación-acción",
  phenomenography: "Estudio fenomenográfico", descriptive: "Estudio descriptivo no experimental",
  correlational: "Estudio correlacional no experimental", quasi_experimental: "Estudio cuasiexperimental",
  experimental: "Estudio experimental", convergent_parallel: "Métodos mixtos convergente paralelo",
  explanatory_sequential: "Métodos mixtos explicativo secuencial",
  exploratory_sequential: "Métodos mixtos exploratorio secuencial",
  embedded: "Métodos mixtos incrustado", embedded_quant: "Métodos mixtos incrustado",
  design_based_research: "Estudio de investigación basada en diseño",
  cross_sectional_survey: "Estudio de encuesta transversal", pre_experimental: "Estudio preexperimental",
};

const intro = (name) =>
  `Responde las preguntas a continuación para construir el diseño visual de una página de tu ${name.toLowerCase()}. Todo lo que escribas aparece en el diagrama de la derecha - y puedes hacer clic en cualquier texto del diagrama para editarlo directamente.`;

// Shared field translations (label/hint/placeholder) by field key
const F = {
  context: { label: "Contexto", hint: "¿Dónde se realizará tu estudio?" },
  topics: { label: "Temas", hint: "Áreas de interés que delimitan tu pregunta", placeholder: "Un tema por línea" },
  informants: { label: "Informantes", hint: "¿Quiénes te ayudarán a comprender el fenómeno?" },
  data_gathering: { label: "Métodos de recolección de datos", hint: "¿Cómo recolectarás los datos?" },
  other_documents: { label: "Otros documentos a analizar", hint: "Fotos, videos, diarios, artefactos…" },
  process_support: { label: "Apoyo al proceso", hint: "Personas, herramientas o recursos que apoyan tu estudio" },
  minicases: { label: "Minicasos", hint: "Aspectos especiales que iluminan el estudio" },
  study_type: { label: "Tipo de estudio", hint: "" },
  variables: { label: "Variables", hint: "¿Qué características analizarás?" },
  question: { label: "Pregunta de investigación", hint: "La pregunta que guía tu estudio" },
  sample: { label: "Muestra", hint: "¿Quiénes participarán y cómo se seleccionan?" },
  groups: { label: "N.º de grupos", hint: "¿Cuántos grupos?", placeholder: "1 grupo / 2 grupos" },
  data_analysis: { label: "Análisis de datos", hint: "¿Cómo analizarás los datos?" },
  strategies: { label: "Estrategias", hint: "" },
  central_item: { label: "Fenómeno en estudio", hint: "" },
  research_topic: { label: "Tema de investigación", hint: "El tema de todo tu estudio de métodos mixtos" },
  qual_tradition: { label: "Tipo de tradición cualitativa", hint: "Narrativa, estudio de caso, fenomenología…", placeholder: "Narrativa / Estudio de caso / Fenomenología / Etnografía / Teoría fundamentada" },
  qual_question: { label: "Pregunta de investigación cualitativa", hint: "La pregunta que guía la vertiente cualitativa" },
  hypothesis: { label: "Hipótesis", hint: "Lo que predices que encontrará la vertiente cuantitativa" },
  mm_question: { label: "Pregunta de investigación cuantitativa", hint: "La pregunta que guía la vertiente cuantitativa" },
  mm_data_gathering: { label: "Recolección de datos (cuantitativa)", hint: "Cuestionarios, escalas, pruebas…" },
  mm_process_support: { label: "Apoyo al proceso (cuantitativa)", hint: "SPSS, herramientas de encuestas…" },
};

// Per-design field label overrides (only where the design uses its own wording)
const D = {
  narrative: {
    central_item: { label: "Retratos narrativos", hint: "El fenómeno estudiado a través de las historias de tus informantes" },
    question: { label: "Pregunta narrativa", hint: "La pregunta que guía tu estudio" },
    informants: { label: "Historias de los informantes", hint: "¿De quiénes aprenderás?" },
    strategies: { label: "Estrategias de investigación narrativa", hint: "Re-historiar, liminalidad, transgresión, evocación, complejidad" },
  },
  phenomenology: {
    central_item: { label: "Fenómeno en estudio", hint: "La experiencia finita y definible que analiza tu estudio" },
    question: { label: "Preguntas fenomenológicas", hint: "¿Qué significa esta experiencia para quienes la viven?" },
    strategies: { label: "Estrategias fenomenológicas", hint: "Epojé, horizontalización, descripción textural y estructural" },
  },
  grounded_theory: {
    central_item: { label: "Fenómeno no cubierto en la literatura", hint: "Tu área sustantiva de interés" },
    question: { label: "Preguntas de teoría fundamentada", hint: "Preguntas abiertas sobre el proceso detrás del fenómeno" },
    strategies: { label: "Estrategias de teoría fundamentada", hint: "Comparación constante, codificación, memos, saturación" },
  },
  ethnography: {
    central_item: { label: "Cultura a estudiar", hint: "El grupo cultural al centro de tu estudio" },
    question: { label: "Pregunta etnográfica", hint: "Sobre el funcionamiento del grupo social" },
    strategies: { label: "Estrategias de investigación etnográfica", hint: "Permanencia prolongada, viñetas, descripciones densas" },
  },
  case_study: {
    central_item: { label: "Nombre de tu caso", hint: "Tu sistema delimitado en acción" },
    question: { label: "Asunto (issue)", hint: "La tensión bajo escrutinio que guía tu estudio" },
    strategies: { label: "Estrategias del estudio de caso", hint: "Enfoque progresivo, descripciones densas, confiabilidad" },
    topics: { label: "Temas", hint: "Áreas de interés que delimitan tu asunto", placeholder: "Un tema por línea" },
  },
  action_research: {
    central_item: { label: "Aspecto a reflexionar y mejorar", hint: "La parte de tu propia práctica que quieres mejorar" },
    question: { label: "Pregunta práctica", hint: "Enfocada en mejorar tu práctica diaria" },
    strategies: { label: "Estrategias de investigación-acción (ciclos)", hint: "Planear, actuar y observar, reflexionar - ¿cuántos ciclos?" },
  },
  phenomenography: {
    central_item: { label: "Fenómeno en estudio", hint: "El fenómeno cuyas distintas comprensiones vas a mapear" },
    question: { label: "Preguntas fenomenográficas", hint: "¿Cómo comprenden el fenómeno de maneras diferentes?" },
    informants: { label: "Informantes", hint: "10-12 personas que vivieron el fenómeno" },
    strategies: { label: "Estrategias fenomenográficas", hint: "Los seis pasos de análisis, hasta el espacio de resultados" },
  },
  descriptive: {
    central_item: { label: "Fenómeno en estudio", hint: "¿Qué describirás?" },
    study_type: { label: "Tipo de estudio", hint: "Diseño de encuesta o diseño observacional", placeholder: "Diseño de encuesta / Diseño observacional" },
    groups: { label: "N.º de grupos", hint: "1 grupo, 2 grupos o casos", placeholder: "1 grupo / 2 grupos / Casos" },
    data_gathering: { label: "Recolección de datos", hint: "Cuestionario, observación, escala Likert, entrevistas…" },
    data_analysis: { label: "Análisis de datos", hint: "Estadística descriptiva" },
    process_support: { label: "Apoyo al proceso", hint: "Paquetes estadísticos, herramientas de cuestionarios…" },
  },
  correlational: {
    central_item: { label: "Fenómeno en estudio", hint: "El fenómeno cuyas variables relacionarás" },
    study_type: { label: "Tipo de estudio correlacional", hint: "Predictivo o explicativo", placeholder: "Diseño correlacional predictivo / Diseño correlacional explicativo" },
    variables: { label: "Variables", hint: "Las variables cuya relación analizarás" },
    question: { label: "Pregunta de investigación", hint: "Una pregunta sobre cómo se relacionan las variables" },
    groups: { label: "N.º de grupos", hint: "1, 2, 3 grupos de estudio u otro", placeholder: "1 grupo / 2 grupos / 3 grupos" },
    data_gathering: { label: "Recolección de datos", hint: "Cuestionario, escala Likert…" },
    data_analysis: { label: "Análisis de datos", hint: "Correlación, regresión, análisis de rutas…" },
  },
  quasi_experimental: {
    central_item: { label: "Fenómeno en estudio", hint: "La situación donde probarás tu intervención" },
    study_type: { label: "Tipo de diseño cuasiexperimental", hint: "Grupo control no equivalente, pretest-postest, series temporales…", placeholder: "Grupo control no equivalente / Pretest-postest / Series temporales interrumpidas" },
    variables: { label: "Hipótesis: variables (VI → VD)", hint: "Una hipótesis causal: la VI influye en la VD" },
    question: { label: "Pregunta de investigación", hint: "¿Cuál es la influencia de la VI en la VD?" },
    sample: { label: "Muestra", hint: "Grupos naturales intactos - no asignados al azar" },
    groups: { label: "N.º de grupos", hint: "2 o más grupos (tratamiento y control)", placeholder: "2 o más grupos" },
    data_gathering: { label: "Recolección de datos", hint: "Encuestas, escalas, pruebas" },
    data_analysis: { label: "Análisis de datos", hint: "Depende del número de VI y VD y la relación entre grupos" },
  },
  experimental: {
    central_item: { label: "Fenómeno en estudio", hint: "La situación donde probarás tu intervención" },
    study_type: { label: "Tipo de diseño experimental", hint: "Pretest-postest, solo postest, Solomon, factorial…", placeholder: "Pretest-postest / Solo postest / Solomon de cuatro grupos / Factorial" },
    variables: { label: "Hipótesis: variables (VI → VD)", hint: "Una hipótesis causal: la VI produce un efecto en la VD" },
    question: { label: "Pregunta de investigación", hint: "¿Qué efecto tiene la VI en la VD?" },
    sample: { label: "Muestra", hint: "Grupos asignados al azar" },
    groups: { label: "N.º de grupos", hint: "2 o más grupos (tratamiento y control)", placeholder: "2 o más grupos" },
    data_gathering: { label: "Recolección de datos", hint: "Encuestas, escalas, pruebas" },
    data_analysis: { label: "Análisis de datos", hint: "Depende del número de VI y VD y la relación entre grupos" },
  },
  cross_sectional_survey: {
    central_item: { label: "Fenómeno en estudio", hint: "¿Qué medirás en un solo momento?" },
    study_type: { label: "Tipo de encuesta", hint: "Descriptiva o analítica", placeholder: "Encuesta descriptiva / Encuesta analítica" },
    question: { label: "Pregunta de investigación", hint: "Sobre el estado de una población en un momento dado" },
    groups: { label: "Organización del estudio", hint: "Una población; subgrupos si es analítica", placeholder: "1 población / comparación de subgrupos" },
  },
  pre_experimental: {
    central_item: { label: "Fenómeno en estudio", hint: "La situación donde explorarás tu intervención" },
    study_type: { label: "Tipo de diseño preexperimental", hint: "Un solo grupo con controles limitados", placeholder: "One-shot / Pretest-postest de un grupo / Comparación con grupo estático" },
    variables: { label: "Hipótesis: variables (VI → VD)", hint: "Una VI explorada con controles limitados" },
    question: { label: "Pregunta de investigación", hint: "¿Cuál es el efecto aparente de la VI?" },
    groups: { label: "N.º de grupos", hint: "1 grupo (sin control)", placeholder: "1 grupo" },
  },
  design_based_research: {
    research_topic: { label: "Nombre de tu estudio DBR", hint: "Un título de trabajo conciso que delimita el estudio" },
    context: { label: "Contexto y límites", hint: "El entorno naturalista y sus condiciones" },
    central_item: { label: "Problema de práctica", hint: "El problema persistente y de consecuencias reales" },
    question: { label: "Propósito y preguntas de investigación", hint: "Mejorar la práctica Y producir conocimiento de diseño" },
    topics: { label: "Temas", hint: "Áreas de interés que enfocan la indagación", placeholder: "Un tema por línea" },
    informants: { label: "Socios, interesados e informantes", hint: "¿Quiénes diseñan, implementan e interpretan contigo?" },
    hypothesis: { label: "Conjetura inicial de diseño", hint: "Si [características del diseño]... entonces [resultados]..." },
    variables: { label: "Intervención y requisitos de diseño", hint: "¿Qué se diseñará o rediseñará?" },
    strategies: { label: "Iteraciones y puntos de decisión", hint: "Los ciclos DBR y sus criterios" },
    data_gathering: { label: "Métodos de recolección de datos", hint: "Resultados, implementación, mecanismos, experiencias" },
    other_documents: { label: "Otros documentos y artefactos a analizar", hint: "Políticas, prototipos, trabajos, registros…" },
    process_support: { label: "Apoyo al proceso y viabilidad", hint: "Personas, herramientas, permisos, contingencias" },
    minicases: { label: "Principios de diseño y contribución", hint: "El conocimiento transferible que produce el estudio" },
  },
};

// Mixed designs share most field wording
const MIXED_SHARED = {
  research_topic: F.research_topic, central_item: { label: "Fenómeno en estudio", hint: "Compartido por ambas vertientes" },
  qual_tradition: F.qual_tradition, context: { label: "Contexto del estudio", hint: "Dónde se realizará la vertiente cualitativa" },
  qual_question: F.qual_question, question: { label: "Asuntos (issues)", hint: "Las tensiones particulares bajo escrutinio" },
  topics: F.topics, informants: F.informants,
  data_gathering: { label: "Métodos de recolección de datos (cualitativa)", hint: "Entrevistas, observaciones, diarios…" },
  other_documents: F.other_documents,
  strategies: { label: "Estrategias (cualitativa)", hint: "Estrategias de tu tradición cualitativa" },
  process_support: { label: "Apoyo al proceso (cualitativa)", hint: "Personas, herramientas o recursos para esta vertiente" },
  variables: { label: "Variables", hint: "Las variables que medirá la vertiente cuantitativa" },
  hypothesis: F.hypothesis, mm_question: F.mm_question, sample: { label: "Muestra", hint: "¿Quiénes participan en la vertiente cuantitativa?" },
  groups: F.groups, mm_data_gathering: F.mm_data_gathering, data_analysis: { label: "Análisis de datos", hint: "Estadística para la vertiente cuantitativa" },
  mm_process_support: F.mm_process_support, study_type: { label: "Tipo de diseño cuantitativo", hint: "Descriptivo, correlacional, cuasiexperimental…", placeholder: "Descriptivo / Correlacional / Cuasiexperimental / Experimental" },
};
["convergent_parallel", "explanatory_sequential", "exploratory_sequential", "embedded", "embedded_quant"].forEach((k) => { D[k] = MIXED_SHARED; });

// Diagram layout labels per design (what prints on the one-pager)
const L = {
  common: {
    informants: "Informantes", other_documents: "Otros documentos", data_gathering: "Métodos de recolección de datos",
    strategies: "Estrategias", process_support: "Apoyo al proceso", question: "Preguntas", central_item: "Fenómeno",
  },
  narrative: { central_item: "Retratos narrativos", strategies: "Estrategias de investigación narrativa", question: "Pregunta narrativa", informants: "Historias de los informantes" },
  ethnography: { central_item: "Cultura/grupo en estudio", strategies: "Estrategias de investigación etnográfica", question: "Pregunta etnográfica" },
  grounded_theory: { central_item: "Fenómeno no cubierto en la literatura" },
  case_study: { central_item: "CASO", question: "Asuntos" },
  action_research: { central_item: "Aspecto a reflexionar y mejorar", strategies: "Ciclos", question: "Pregunta práctica" },
  design_based_research: { central_item: "Problema de práctica", informants: "Socios, interesados e informantes", other_documents: "Otros documentos y artefactos", strategies: "Iteraciones y puntos de decisión", process_support: "Apoyo al proceso y viabilidad", question: "Propósito y preguntas de investigación" },
};

// Mixed-methods diagram main titles ("... Research Design on:")
const TITLE_TEXTS = {
  convergent_parallel: "Diseño de investigación de métodos mixtos convergente paralelo sobre:",
  explanatory_sequential: "Diseño de investigación de métodos mixtos explicativo secuencial sobre:",
  exploratory_sequential: "Diseño de investigación de métodos mixtos exploratorio secuencial sobre:",
  embedded: "Diseño de investigación de métodos mixtos incrustado sobre:",
  embedded_quant: "Diseño de investigación de métodos mixtos incrustado sobre:",
};

// Quantitative pentagon: short title above the diagram, per design
const TITLE_NAMES = {
  descriptive: "Descriptivo no experimental", correlational: "Correlacional no experimental",
  quasi_experimental: "Cuasiexperimental", experimental: "Experimental",
  cross_sectional_survey: "Encuesta transversal", pre_experimental: "Preexperimental",
};

// Fixed characteristic chips on the pentagon diagram, mapped by English value
const FIXED_VALUES = {
  "Exploratory/Descriptive": "Exploratorio/Descriptivo",
  "No control group": "Sin grupo control",
  "Desirable": "Deseable",
  "Correlational": "Correlacional",
  "Explanatory": "Explicativo",
  "Treatment & control group": "Grupo de tratamiento y control",
  "Natural groups": "Grupos naturales",
  "Descriptive / Survey": "Descriptivo / Encuesta",
  "Essential": "Esencial",
  "Exploratory": "Exploratorio",
  "1 group (no control)": "1 grupo (sin control)",
  "Limited": "Limitada",
};

// DBR-only diagram areas that carry their own titles in the layout
const DBR_RAIL_TITLES = {
  context: "Contexto y límites",
  hypothesis: "Conjetura inicial de diseño",
  variables: "Intervención y requisitos de diseño",
};
const DBR_CENTER_EXTRA_LABEL = "Nombre de tu estudio DBR";
const DBR_SPLIT_STRATEGIES_LABEL = "Principios de diseño y contribución";

const CONTEXT_TITLES = {
  narrative: "Contexto de tu estudio narrativo", phenomenology: "Contexto de tu estudio fenomenológico",
  grounded_theory: "Contexto de tu estudio de teoría fundamentada", ethnography: "Contexto de tu etnografía",
  case_study: "Contexto de tu caso", action_research: "Contexto de tu I-A",
  phenomenography: "Contexto de tu estudio fenomenográfico", design_based_research: "Contexto y límites",
};

// Spanish translations of the VD form "help" (Guide) paragraphs, per design.
// Shared paragraphs reused across designs are hoisted into consts.
const H_PROCESS_SUPPORT = "¿Usarás alguna persona, herramienta o recurso que te ayude a realizar tu estudio? P. ej.: software de análisis de datos.";
const H_OTHER_DOCS_PHEN = "Además de los métodos de recolección de datos que implementarás, ¿qué otros documentos podrían ayudarte a comprender mejor el fenómeno en estudio? P. ej.: fotos, videos, diarios, artefactos creados por los informantes, etc.";
const H_INFORMANTS_BASE = "¿Cuáles son los informantes a partir de los cuales obtendrás una mejor comprensión del fenómeno bajo análisis?";

const HELPS = {
  narrative: {
    central_item: "El propósito de la investigación narrativa es dar voz a personas rara vez escuchadas y explorar problemas de investigación educativa comprendiendo las experiencias de un individuo o de unos pocos. Las historias de los informantes constituyen los datos (usualmente recogidos mediante entrevistas y conversaciones informativas); se les llama textos de campo. Incluye aquí el fenómeno que se estudiará a través de los retratos narrativos de tus informantes.",
    context: "¿Cuál es el contexto en el que se realizará tu estudio? P. ej.: El estudio se realizará en mi escuela, que tiene las siguientes características: (descripción del entorno).",
    question: "La pregunta de investigación en los estudios narrativos debe centrarse en el análisis y la comprensión profunda de las experiencias vividas de nuestros informantes en relación con el tema de investigación que nos interesa. Un ejemplo de pregunta que podría guiar un estudio narrativo es: ¿Qué dilemas, tensiones y problemas encuentran los docentes noveles en sus aulas?",
    topics: "¿Cuáles son las áreas particulares de interés en las que acotarás la complejidad de la pregunta narrativa que guía el estudio? Para el asunto propuesto en la pregunta anterior (¿La política de asignar escuela según residencia y asistencia previa perpetúa la inequidad?) podríamos definir los siguientes temas: raíces de la política; ventajas para las familias; comodidad vs. inequidad; etc.",
    informants: H_INFORMANTS_BASE,
    data_gathering: "Los principales métodos de recolección de datos en los estudios narrativos son: diarios, análisis de textos, análisis de objetos con valor de recuerdo, etc. ¿Qué métodos de recolección de datos vas a utilizar?",
    other_documents: "Además de los métodos de recolección de datos que implementarás, ¿qué otros documentos podrían ayudarte a comprender mejor el grupo social en estudio? P. ej.: fotos, videos, diarios, artefactos creados por los informantes, etc.",
    strategies: "En la investigación narrativa, el investigador/a suele re-historiar la “historia” de los informantes de acuerdo con una serie de temas. La nueva historia puede estructurarse en torno a una cronología de eventos que describe las experiencias pasadas, presentes y futuras del individuo, situada en un entorno o contexto específico. Este proceso se llama “re-historiar” (restorying) y constituye la principal estrategia de investigación en esta forma particular de investigación. Al realizar estudios narrativos también es relevante tener en mente algunas estrategias para generar buenas historias escritas. Algunas son: a) liminalidad; b) transgresión; c) evocación; y d) complejidad. ¿Usarás alguna de las anteriores? ¿Cuáles?",
    process_support: H_PROCESS_SUPPORT,
  },
  phenomenology: {
    central_item: "La fenomenología es la recolección y el análisis de las percepciones de las personas en relación con un fenómeno específico y definible. El aspecto central de un estudio fenomenológico es el fenómeno que se analizará. Un fenómeno es un evento, una experiencia o algo que le sucede a alguien; es algo finito y definible, no nebuloso o impreciso (p. ej.: reprobar o aprobar un examen, dar a luz, el aislamiento, perder a un amigo, etc.).",
    context: "¿Cuál es el contexto de tu estudio fenomenológico? Los investigadores necesitamos profundizar en las raíces del fenómeno que guía nuestro estudio, ya que es la única manera de poder comprender sus orígenes.",
    question: "Las preguntas fenomenológicas se centran en el significado de la experiencia vivida: cómo es el fenómeno para las personas que lo atraviesan y qué significa para ellas. Un ejemplo de pregunta que podría guiar un estudio fenomenológico es: ¿Qué significa la experiencia de reprobar un curso clave para estudiantes universitarios de primera generación?",
    topics: "¿Cuáles son las áreas particulares de interés en las que acotarás la complejidad de la pregunta fenomenológica que guía el estudio? Por ejemplo, para la experiencia de reprobar un curso clave podríamos definir: primeras reacciones; impacto en la identidad; apoyo recibido; decisiones sobre continuar o abandonar; etc.",
    informants: H_INFORMANTS_BASE + " En fenomenología, los informantes deben ser personas que hayan experimentado directamente el fenómeno en estudio.",
    data_gathering: "El principal método de recolección de datos en los estudios fenomenológicos es la entrevista en profundidad, a menudo repetida con cada informante, complementada con reflexiones escritas o grupos focales. ¿Qué métodos de recolección de datos vas a utilizar?",
    other_documents: H_OTHER_DOCS_PHEN,
    strategies: "En la investigación fenomenológica, el investigador/a deja de lado sus propias preconcepciones sobre el fenómeno (bracketing o epojé), identifica declaraciones significativas de los informantes (horizontalización), las agrupa en núcleos de significado y escribe descripciones de lo que se experimentó (textural) y de cómo se experimentó (estructural), llegando a la esencia del fenómeno. ¿Cuáles de estas estrategias usarás?",
    process_support: H_PROCESS_SUPPORT,
  },
  grounded_theory: {
    central_item: "El objetivo de un estudio de teoría fundamentada es generar, o descubrir, una teoría sobre un fenómeno que no ha sido cubierto adecuadamente en la literatura existente de un campo. Una teoría fundamentada es aquella que se deriva inductivamente del estudio de los fenómenos: se descubre, se desarrolla y se verifica provisionalmente mediante la recolección y el análisis sistemáticos de datos relativos a esos fenómenos. Lo importante es recordar que no comienzas con una teoría para luego intentar probarla, sino con un área de estudio, dejando que emerja de tu investigación aquello que es relevante.",
    context: "¿Cuál es el contexto de tu estudio de teoría fundamentada? ¿Cómo llegaste a interesarte en el tema investigado?",
    question: "Las preguntas de teoría fundamentada son abiertas y se centran en comprender el proceso detrás del fenómeno: cómo las personas actúan, interactúan y responden ante él. Un ejemplo de pregunta que podría guiar un estudio de teoría fundamentada es: ¿Cuál es el proceso por el que los docentes noveles desarrollan su propio enfoque de gestión del aula?",
    topics: "¿Cuáles son las áreas particulares de interés en las que acotarás la complejidad de la pregunta de teoría fundamentada que guía el estudio? Para el proceso por el que los docentes noveles desarrollan un enfoque de gestión del aula podríamos definir: influencias tempranas; ensayo y error; consejos recibidos; puntos de inflexión; etc.",
    informants: H_INFORMANTS_BASE + " En teoría fundamentada, los informantes se seleccionan mediante muestreo teórico: sigues agregando informantes cuyas experiencias ayudan a desarrollar tu teoría emergente, hasta que las nuevas entrevistas dejan de aportar nuevos hallazgos (saturación).",
    data_gathering: "El principal método de recolección de datos en los estudios de teoría fundamentada es la entrevista, usualmente con un número mayor de informantes que en otros diseños cualitativos, complementada con observaciones. La recolección y el análisis de datos ocurren en ciclos: lo que aprendes de los primeros informantes define a quién entrevistas después y qué preguntas haces. ¿Qué métodos de recolección de datos vas a utilizar?",
    other_documents: H_OTHER_DOCS_PHEN,
    strategies: "En la investigación de teoría fundamentada, el investigador/a analiza los datos mediante el método comparativo constante: cada nuevo dato se compara con lo recogido antes. El análisis avanza por la codificación abierta (identificar categorías), la codificación axial (relacionar categorías entre sí) y la codificación selectiva (construir la historia en torno a una categoría central), apoyado en memos (notas sobre la teoría emergente) y muestreo teórico hasta alcanzar la saturación. ¿Cuáles de estas estrategias usarás?",
    process_support: H_PROCESS_SUPPORT,
  },
  ethnography: {
    central_item: "En los estudios etnográficos, los investigadores estudian los patrones compartidos de comportamiento, lenguaje y acciones de un grupo cultural en un entorno natural. Implica un estudio de campo lo bastante prolongado como para hacer visibles en detalle las normas, rituales y rutinas cotidianas de las personas. ¿Cuál es la cultura (grupo) en la que centrarás tu estudio?",
    context: "¿Cuál es el contexto en el que se realizará tu estudio? P. ej.: El estudio se realizará en mi escuela, que tiene las siguientes características: (descripción del entorno).",
    question: "Las preguntas etnográficas siempre se refieren al funcionamiento de un grupo social particular (p. ej.: normas, reglas, tradiciones, etc.). ¿Cuál es la pregunta de investigación que guía tu estudio?",
    topics: "¿Cuáles son las áreas particulares de interés en las que acotarás la complejidad de la pregunta etnográfica que guía el estudio? Para el asunto propuesto en la pregunta anterior (¿La política de asignar escuela según residencia y asistencia previa perpetúa la inequidad?) podríamos definir los siguientes temas: raíces de la política; ventajas para las familias; comodidad vs. inequidad; etc.",
    informants: "¿Cuáles son los informantes a partir de los cuales obtendrás una mejor comprensión del grupo social bajo análisis?",
    data_gathering: "Los principales métodos de recolección de datos en los estudios etnográficos son: diarios, observaciones y entrevistas. ¿Qué métodos de recolección de datos vas a utilizar?",
    other_documents: "Además de los métodos de recolección de datos que implementarás, ¿qué otros documentos podrían ayudarte a comprender mejor el grupo social en estudio? P. ej.: fotos, videos, diarios, artefactos creados por los informantes, etc.",
    strategies: "Algunas estrategias etnográficas son: permanencia prolongada, uso de viñetas, descripciones densas. ¿Cuáles son las estrategias que seguirás para iluminar las normas, creencias y rituales de la cultura en estudio?",
    process_support: H_PROCESS_SUPPORT,
  },
  case_study: {
    central_item: "Es de gran importancia definir el nombre de tu caso, ya que te dará un sentido de sus límites. Recuerda que un estudio de caso constituye el estudio de un sistema delimitado en acción. Por ejemplo, si estudias una política de elección de escuela basada en la residencia, implementada en un distrito escolar (tu sistema delimitado), el nombre de tu caso podría ser: Política basada en residencia en el Distrito Escolar de Marietta.",
    context: "¿Cuáles son los contextos que afectan el funcionamiento del sistema delimitado (tu caso)? Los investigadores necesitamos profundizar en las raíces del caso, ya que es la única manera de poder analizarlo en el contexto en el que surge y se desarrolla. Ejemplos de contextos son: contexto histórico; contexto educativo; contexto sociopolítico; investigación previa realizada en el campo; etc.",
    question: "Un asunto (issue) es una cuestión en disputa que tiene especial preocupación o importancia. Tiene que ver con el funcionamiento del caso, reflejando en particular uno o más de sus propósitos. Un asunto puede entenderse como la tensión particular bajo escrutinio que guiará todo el estudio. P. ej.: imagina un estudio de caso centrado en un programa de elección de escuela donde los padres pueden inscribir a sus hijos en cualquier escuela, si está en su área de residencia o si hay cupos. Un asunto que guíe el estudio podría ser: ¿La política de asignar escuela según residencia y asistencia previa perpetúa la inequidad?",
    topics: "¿Cuáles son las áreas particulares de interés en las que acotarás la complejidad del asunto que guía el estudio? Para el asunto propuesto en la pregunta anterior (¿La política de asignar escuela según residencia y asistencia previa perpetúa la inequidad?) podríamos definir los siguientes temas: raíces de la política; ventajas para las familias; comodidad vs. inequidad; etc.",
    informants: "¿Cuáles son los informantes a partir de los cuales obtendrás una mejor comprensión de la particularidad de tu caso? Por ejemplo, para iluminar el caso que usamos como ejemplo en este formulario, podrías obtener información de: administradores del distrito escolar; docentes que trabajan para el distrito; padres; etc.",
    data_gathering: "Los principales métodos de recolección de datos en los estudios de caso son: observaciones, entrevistas y grupos focales. ¿Qué métodos de recolección de datos vas a utilizar?",
    other_documents: "Además de los métodos de recolección de datos que implementarás, ¿qué otros documentos podrían ayudarte a comprender mejor el caso en estudio? P. ej.: fotos, videos, diarios, artefactos creados por los informantes, etc.",
    strategies: "En los estudios de caso debemos prestar atención a: la naturaleza de enfoque progresivo del diseño de un estudio de caso; la necesidad de incorporar \"descripciones densas\" del caso, de los participantes y de las actividades particulares estudiadas, así como a las estrategias que usaremos para asegurar la confiabilidad de nuestros datos. En el siguiente artículo (https://tinyurl.com/tu45usts) encontrarás una descripción exhaustiva de las principales estrategias que podemos implementar para garantizar un estudio confiable.",
    minicases: "Los minicasos son aspectos particulares de especial importancia que ayudan a comprender la complejidad del caso (p. ej.: un docente en particular, una actividad especial, un programa de desarrollo profesional, etc.). Los minicasos podrían convertirse en casos si concentráramos toda nuestra atención en ellos. Para el caso que usamos como ejemplo en este formulario (Política basada en residencia en el Distrito Escolar de Marietta), podríamos prestar especial atención a una directora que está en contra de la política actual porque cree que perpetúa inequidades entre escuelas, según el nivel económico de las familias que viven cerca de cada escuela.",
    process_support: H_PROCESS_SUPPORT,
  },
  action_research: {
    central_item: "La principal particularidad de la investigación-acción es que el investigador/a realiza un estudio profundo de su propia práctica. Esta tradición de investigación ayuda a encontrar respuestas a asuntos prácticos de la práctica diaria. P. ej.: una docente quiere estudiar la implementación de una innovación en una de las clases que imparte. ¿Cuál es el aspecto de tu práctica que quieres mejorar?",
    context: "¿Cuál es el contexto en el que se realizará tu estudio? P. ej.: El estudio se realizará en mi clase de ciencias sociales al implementar una nueva estrategia para promover el aprendizaje colaborativo.",
    question: "Las preguntas prácticas deben centrarse en el aspecto que quieres analizar y mejorar respecto de tu propia práctica diaria. Pueden verse como tensiones particulares bajo escrutinio que te ayudarán a guiar todo el estudio. P. ej.: ¿Cómo cambian las inquietudes de mis estudiantes a lo largo de su participación en la implementación de la innovación? ¿Cuáles son las preguntas prácticas que guían tu estudio de investigación-acción?",
    topics: "¿Cuáles son las áreas particulares de interés en las que acotarás la complejidad de la pregunta práctica que guía el estudio? Para el asunto propuesto en la pregunta anterior (¿La política de asignar escuela según residencia y asistencia previa perpetúa la inequidad?) podríamos definir los siguientes temas: raíces de la política; ventajas para las familias; comodidad vs. inequidad; etc.",
    informants: "¿Cuáles son los informantes a partir de los cuales obtendrás una mejor comprensión del aspecto sobre el que reflexionas o que quieres mejorar/cambiar?",
    data_gathering: "Los principales métodos de recolección de datos en los estudios de investigación-acción son: diario autorreflexivo, observaciones, entrevistas y grupos focales. ¿Qué métodos de recolección de datos vas a utilizar?",
    other_documents: "Además de los métodos de recolección de datos que implementarás, ¿qué otros documentos podrían ayudarte a comprender mejor el aspecto sobre el que reflexionas o que quieres mejorar? P. ej.: fotos, videos, diarios, artefactos creados por los informantes, etc.",
    strategies: "La investigación-acción es cíclica, por lo que es importante definir los distintos ciclos que conformarán nuestro estudio. Un ciclo comúnmente conocido es el propuesto por Kemmis y McTaggart (1988) (ver imagen abajo). Los pasos propuestos en la espiral de investigación-acción son: planear; actuar y observar; y reflexionar. ¿Cuántos ciclos planeas? ¿Ya sabes qué harías en cada paso de cada ciclo?",
    minicases: "Los minicasos son aspectos particulares de especial importancia que ayudan a comprender la complejidad de tu estudio (p. ej.: un docente en particular, una actividad especial, un programa de desarrollo profesional, etc.).",
    process_support: H_PROCESS_SUPPORT,
  },
  phenomenography: {
    central_item: "La fenomenografía denota una tradición de investigación que busca describir las distintas maneras en que un grupo de personas comprende un fenómeno (Marton, 1981), mientras que la fenomenología busca clarificar la estructura y el significado de un fenómeno (Giorgi, 1999). Esta tradición de investigación busca identificar e interrogar el rango de maneras diferentes en que las personas perciben o experimentan fenómenos específicos (típicamente el aprendizaje, la enseñanza o aspectos de estos).",
    context: "¿Cuál es el contexto de tu estudio fenomenográfico? Los investigadores necesitamos profundizar en las raíces del fenómeno que guía nuestro estudio, ya que es la única manera de poder comprender sus orígenes.",
    question: "Las preguntas fenomenográficas son aquellas que indagan por las distintas maneras en que un grupo de personas comprende un fenómeno. Debes hacer preguntas como: ¿Cómo perciben los docentes en ejercicio la calidad de su formación?, en lugar de preguntas como: ¿Cuál es el mejor método para formar docentes?",
    topics: "¿Cuáles son las áreas particulares de interés en las que acotarás la complejidad del fenómeno que guía el estudio?",
    informants: "¿Cuáles son los informantes a partir de los cuales obtendrás una mejor comprensión del fenómeno en estudio? En fenomenografía solemos realizar entrevistas en profundidad a no más de 10-12 personas que hayan experimentado el fenómeno en estudio. Un estudio fenomenográfico describe los múltiples significados que varias personas dan a sus experiencias vividas de un concepto o un fenómeno.",
    data_gathering: "¿Qué métodos de recolección de datos vas a utilizar? El principal método de recolección de datos en fenomenografía es la entrevista. En el siguiente enlace encontrarás un artículo interesante sobre cómo diseñar y realizar entrevistas en fenomenografía: goo.gl/nWPsRR",
    other_documents: "Además de los métodos de recolección de datos que implementarás, ¿qué otros documentos podrían ayudarte a comprender mejor el caso en estudio? P. ej.: fotos, videos, diarios, artefactos creados por los informantes, etc.",
    strategies: "Un aspecto clave de la fenomenografía tiene que ver con el proceso de análisis de los datos recogidos. Los pasos principales son: Paso 1. Familiarización: las transcripciones se leen varias veces para familiarizarse con su contenido; en este paso se corrige cualquier error de la transcripción. Paso 2. Compilación: el segundo paso requiere una lectura más enfocada para deducir similitudes y diferencias entre las transcripciones; el objetivo principal es compilar las respuestas a las preguntas formuladas en las entrevistas, identificando los elementos más valorados en las respuestas. Paso 3. Condensación: se seleccionan los extractos que parecen relevantes y significativos para el estudio; el objetivo es descartar los componentes irrelevantes, redundantes o innecesarios y así descifrar los elementos centrales de las respuestas de los participantes. Paso 4. Agrupación preliminar: se localizan y clasifican las respuestas similares en grupos preliminares, que se revisan de nuevo para comprobar si otros grupos muestran el mismo significado bajo encabezados distintos; el análisis presenta así una lista inicial de categorías de descripción. Paso 5. Comparación preliminar de categorías: se revisa la lista inicial de categorías para compararlas entre sí y establecer límites entre ellas; antes de pasar al siguiente paso, se releen las transcripciones para comprobar que las categorías preliminares representan con precisión la experiencia de los participantes. Paso 6. Espacio de resultados final: en el último paso, el investigador/a busca descubrir el espacio de resultados final con base en sus relaciones internas y en las maneras cualitativamente distintas de comprender el fenómeno. El espacio de resultados fenomenográfico describe las distintas maneras en que un fenómeno es experimentado en un grupo, y también las distintas maneras en que el investigador/a ha interpretado cómo se experimenta (González, 2010).",
    process_support: H_PROCESS_SUPPORT,
  },
  descriptive: {
    central_item: "Describe brevemente el fenómeno que estudiarás. Por ejemplo: el uso de teléfonos móviles por parte de los adolescentes.",
    study_type: "Los diseños no experimentales son aquellos en los que no hay manipulación de la variable independiente, ya que estudian situaciones o fenómenos que ya han sucedido y, por tanto, las variables se estudian tal como se han manifestado en la realidad. Hay dos tipos fundamentales de diseños descriptivos no experimentales: a) diseños de encuesta y b) diseños observacionales. a) El objetivo principal de los diseños de encuesta es describir rasgos o características de un grupo o población a través de las respuestas de los participantes a un cuestionario o entrevista administrados por el investigador/a. Buscan recoger información de toda la población y, cuando esto no es posible, se selecciona una muestra que la represente. Los instrumentos principales en este tipo de diseño son los cuestionarios y la entrevista estructurada o semiestructurada. b) En los estudios observacionales, la observación sistemática y la medición de lo observado constituyen su fundamento principal.",
    variables: "Las variables en los estudios descriptivos no experimentales suelen relacionarse con: a) características sociodemográficas de los participantes, como género, profesión, edad, etc., y b) actitudes, opiniones, percepciones, conductas, hábitos, experiencias u otras características. Describe a continuación las variables que analizarás en tu estudio.",
    question: "Incluye a continuación la pregunta de investigación que guía tu estudio.",
    sample: "El objetivo de este tipo de diseño es analizar la distribución de una variable determinada; por ejemplo, la opinión de los adolescentes españoles sobre el uso de los teléfonos móviles. Cuando no es posible incluir a toda la población en el estudio, es vital seleccionar una muestra significativa mediante procedimientos de muestreo probabilístico que permitan representar a la población de la que se extrajo y así generalizar los resultados (ver: https://tinyurl.com/y9lsc463). Describe a continuación la muestra que se usará en el estudio, así como el método de muestreo probabilístico a utilizar.",
    groups: "¿Cuántos grupos involucrará tu estudio? En los diseños descriptivos no experimentales suele ser: 1 grupo; 2 grupos; o casos.",
    data_gathering: "¿Qué instrumentos de recolección de datos usarás? Las opciones principales en los estudios descriptivos no experimentales son: cuestionario; observación; escala Likert; entrevista estructurada; entrevista semiestructurada; lista de control; u otros.",
    data_analysis: "¿Cómo analizarás los datos? En los diseños descriptivos no experimentales el análisis se apoya en la estadística descriptiva (frecuencias, porcentajes, medias, desviaciones estándar, etc.).",
    process_support: "Incluye en esta sección cualquier estrategia, herramienta o tecnología que sirva de apoyo al estudio. Podrías incluir el uso de paquetes estadísticos como SPSS, herramientas para la generación de cuestionarios o herramientas para la gestión de observaciones.",
  },
  correlational: {
    central_item: "Describe brevemente el fenómeno que estudiarás: la situación en la que analizarás cómo se relacionan dos o más variables.",
    study_type: "Los diseños no experimentales son aquellos en los que no hay manipulación de la variable independiente, ya que estudian situaciones o fenómenos que ya han sucedido y, por tanto, las variables se estudian tal como se han manifestado en la realidad. Los estudios correlacionales no experimentales tienen el propósito de conocer la relación o el grado de asociación que existe entre dos o más conceptos, categorías o variables en un contexto particular. A veces solo se analiza la relación entre dos variables, pero a menudo se incluyen relaciones entre tres, cuatro o más variables. Los estudios correlacionales, al evaluar el grado de asociación entre dos o más variables, miden cada una de ellas (presuntamente relacionadas) y luego cuantifican y analizan el vínculo. Tales correlaciones se sustentan en hipótesis. La utilidad principal de los estudios correlacionales es saber cómo puede comportarse un concepto o variable al conocer el comportamiento de otras variables vinculadas. Hay dos tipos fundamentales de estudio correlacional: predictivo y explicativo. En los diseños explicativos pretendemos analizar las posibles relaciones entre las variables estudiadas. Por su parte, un diseño predictivo se basa en predecir la evolución futura del fenómeno estudiado, y así anticipar el posible comportamiento futuro de una situación a partir de las relaciones entre las variables del estudio.",
    variables: "Describe a continuación las variables que se considerarán en tu estudio.",
    question: "Los estudios correlacionales buscan responder preguntas de investigación como las siguientes: ¿Aumenta la autoestima del paciente a medida que avanza una terapia específica? ¿A mayor variedad y autonomía en el trabajo corresponde mayor motivación intrínseca respecto de las tareas laborales? ¿Los agricultores que adoptan una innovación más rápidamente poseen mayor cosmopolitismo que los que la adoptan después? ¿La distancia física entre las parejas tiene una relación negativa con la satisfacción en la relación? Incluye a continuación la pregunta de investigación que guiará tu estudio.",
    sample: "Cuando no es posible incluir a toda la población en el estudio, es vital seleccionar una muestra significativa mediante procedimientos de muestreo probabilístico que permitan representar a la población en estudio y así generalizar los resultados (ver: https://tinyurl.com/ycjyf6ty). Describe a continuación la muestra que se usará en el estudio, así como la técnica de muestreo probabilístico a utilizar.",
    groups: "¿Cuántos grupos de estudio involucrará tu diseño correlacional? Usualmente: 1 grupo de estudio; 2 grupos de estudio; 3 grupos de estudio; u otro arreglo.",
    data_gathering: "¿Qué instrumentos de recolección de datos usarás? Las opciones principales en los estudios correlacionales son: cuestionario; escala Likert; u otros.",
    data_analysis: "¿Cómo analizarás los datos? Las opciones principales en los estudios correlacionales son: análisis de rutas; coeficiente de correlación de Pearson; análisis bivariado; análisis multivariado; regresión lineal; regresión múltiple; u otros.",
    process_support: "Incluye en esta sección cualquier estrategia, herramienta o tecnología que sirva de apoyo al estudio. Podrías incluir el uso de paquetes estadísticos como SPSS, herramientas para la generación de cuestionarios o herramientas para la gestión de observaciones.",
  },
  quasi_experimental: {
    central_item: "Describe brevemente el fenómeno que estudiarás. En los diseños cuasiexperimentales suele ser una situación en la que introduces una intervención o tratamiento y quieres conocer su efecto. P. ej.: el efecto de una nueva estrategia de aprendizaje colaborativo en el rendimiento de dos clases de ciencias ya existentes.",
    study_type: "Los diseños cuasiexperimentales manipulan la variable independiente, pero los participantes NO se asignan a los grupos al azar: el investigador/a trabaja con grupos que ya existen de forma natural (p. ej.: dos aulas intactas). Los tipos más comunes son: a) diseño de grupo control no equivalente, donde un grupo existente recibe el tratamiento y un grupo existente similar sirve de control; b) diseños pretest-postest, donde ambos grupos se miden antes y después de la intervención; y c) diseños de series temporales interrumpidas, donde un grupo se mide repetidamente antes y después de la intervención. ¿Qué tipo seguirá tu estudio?",
    variables: "En los estudios cuasiexperimentales la hipótesis es causal: predices que la variable independiente (VI, el tratamiento o intervención que manipulas) producirá un efecto en la variable dependiente (VD, el resultado que mides). Describe a continuación tus variables independiente y dependiente, y la hipótesis causal que las vincula. P. ej.: VI: uso de una estrategia de aprendizaje colaborativo; VD: puntuaciones de rendimiento en ciencias.",
    question: "Las preguntas cuasiexperimentales indagan por la influencia de una variable independiente sobre una variable dependiente. P. ej.: ¿Cuál es la influencia de una estrategia de aprendizaje colaborativo en el rendimiento en ciencias de estudiantes de secundaria? Incluye a continuación la pregunta de investigación que guiará tu estudio.",
    sample: "El rasgo definitorio de los diseños cuasiexperimentales es que la muestra NO se selecciona ni se asigna al azar: trabajas con grupos naturales que ya existen, como dos aulas intactas, dos escuelas o dos equipos de trabajo. Describe a continuación los grupos que participarán en tu estudio, cuál recibirá el tratamiento y cuál servirá de control.",
    groups: "Los diseños cuasiexperimentales involucran 2 o más grupos: al menos un grupo de tratamiento que recibe la intervención y un grupo control que no. ¿Cuántos grupos involucrará tu estudio y qué recibirá cada uno?",
    data_gathering: "¿Qué instrumentos de recolección de datos usarás? Las opciones principales en los estudios cuasiexperimentales son: encuestas; escalas (p. ej.: escalas Likert que miden la variable dependiente); y pruebas de rendimiento o desempeño aplicadas antes y/o después de la intervención.",
    data_analysis: "¿Cómo analizarás los datos? En los estudios cuasiexperimentales el análisis depende del número de variables independientes y dependientes y de la relación entre los grupos. Opciones comunes son: pruebas t para comparar dos grupos; ANOVA para más de dos grupos; ANCOVA para controlar diferencias de pretest entre los grupos naturales; y análisis de medidas repetidas para diseños pretest-postest.",
    process_support: "Incluye en esta sección cualquier estrategia, herramienta o tecnología que sirva de apoyo al estudio. Podrías incluir el uso de paquetes estadísticos como SPSS o EZAnalyze, y de herramientas de encuestas en línea para la generación y administración de cuestionarios.",
  },
  experimental: {
    central_item: "Describe brevemente el fenómeno que estudiarás. En los diseños experimentales es una situación en la que introduces una intervención o tratamiento bajo condiciones controladas y mides su efecto. P. ej.: el efecto de una nueva aplicación de aprendizaje de vocabulario en la retención de palabras de un idioma extranjero.",
    study_type: "Los diseños experimentales manipulan la variable independiente Y asignan a los participantes a los grupos al azar; esta asignación aleatoria es lo que los convierte en experimentos verdaderos, ya que hace equivalentes a los grupos antes del tratamiento. Los tipos más comunes son: a) diseño de grupo control con pretest-postest, donde ambos grupos se miden antes y después del tratamiento; b) diseño de grupo control solo con postest, donde los grupos solo se miden después del tratamiento; c) diseño de cuatro grupos de Solomon, que combina los dos anteriores para controlar los efectos del pretest; y d) diseños factoriales, que estudian dos o más variables independientes al mismo tiempo. ¿Qué tipo seguirá tu estudio?",
    variables: "En los estudios experimentales la hipótesis es causal: predices que la variable independiente (VI, el tratamiento que manipulas) producirá un efecto en la variable dependiente (VD, el resultado que mides). Describe a continuación tus variables independiente y dependiente, y la hipótesis causal que las vincula. P. ej.: VI: uso de la aplicación de vocabulario (aplicación vs. tarjetas tradicionales); VD: número de palabras retenidas después de dos semanas.",
    question: "Las preguntas experimentales indagan por el efecto de la variable independiente sobre la variable dependiente. P. ej.: ¿Qué efecto tiene el uso de una aplicación de aprendizaje de vocabulario en la retención de palabras de un idioma extranjero? Incluye a continuación la pregunta de investigación que guiará tu estudio.",
    sample: "El rasgo definitorio de los diseños experimentales es que los participantes se asignan a los grupos de tratamiento y control AL AZAR. La asignación aleatoria hace que los grupos sean estadísticamente equivalentes antes del tratamiento, de modo que cualquier diferencia medida después puede atribuirse al tratamiento mismo. Describe a continuación a tus participantes, cómo serán reclutados y cómo se asignarán aleatoriamente a los grupos.",
    groups: "Los diseños experimentales involucran 2 o más grupos: al menos un grupo de tratamiento que recibe la intervención y un grupo control que no. Los diseños factoriales y de Solomon involucran más. ¿Cuántos grupos involucrará tu estudio y qué recibirá cada uno?",
    data_gathering: "¿Qué instrumentos de recolección de datos usarás? Las opciones principales en los estudios experimentales son: encuestas; escalas (p. ej.: escalas Likert que miden la variable dependiente); y pruebas de rendimiento o desempeño aplicadas antes y/o después del tratamiento.",
    data_analysis: "¿Cómo analizarás los datos? En los estudios experimentales el análisis depende del número de variables independientes y dependientes y de la relación entre los grupos. Opciones comunes son: pruebas t para comparar dos grupos; ANOVA para más de dos grupos o diseños factoriales; MANOVA cuando hay varias variables dependientes; y análisis de medidas repetidas para diseños pretest-postest.",
    process_support: "Incluye en esta sección cualquier estrategia, herramienta o tecnología que sirva de apoyo al estudio. Podrías incluir el uso de paquetes estadísticos como SPSS o EZAnalyze, y de herramientas de encuestas en línea para la generación y administración de cuestionarios.",
  },
  cross_sectional_survey: {
    central_item: "Describe brevemente el fenómeno que estudiarás. Una encuesta transversal toma una instantánea de una población en UN solo momento; p. ej.: qué opinan ahora mismo los estudiantes de un distrito sobre las tareas escolares.",
    study_type: "Las encuestas transversales miden a una población en un único momento, sin manipulación de variables. Pueden ser: a) descriptivas, que buscan describir las características, actitudes o conductas de la población; o b) analíticas, que además comparan subgrupos de la población (p. ej.: por grado, género o escuela) para explorar posibles asociaciones. ¿De qué tipo será tu encuesta?",
    variables: "Describe las variables que medirá tu encuesta. Usualmente son: a) características sociodemográficas de los participantes, como edad, género o grado; y b) actitudes, opiniones, percepciones, conductas o experiencias capturadas en el momento de la encuesta.",
    question: "Las preguntas de las encuestas transversales indagan por el estado de una población en un momento dado. P. ej.: ¿Qué proporción de estudiantes de secundaria reporta usar herramientas de IA para las tareas, y difiere esto según el grado? Incluye a continuación la pregunta de investigación que guiará tu estudio.",
    sample: "Dado que una encuesta transversal busca describir a toda una población a partir de una sola medición, una muestra representativa es ESENCIAL. Describe la población, el método de muestreo probabilístico (p. ej.: aleatorio, estratificado, por conglomerados) y el tamaño de muestra que planeas encuestar.",
    groups: "Las encuestas transversales estudian una población en un momento dado. Las encuestas analíticas comparan además subgrupos naturales dentro de ella (p. ej.: por grado o escuela). ¿Cómo se organizará tu encuesta?",
    data_gathering: "¿Qué instrumentos usarás? Las opciones principales en las encuestas transversales son: cuestionarios (en papel o en línea); escalas Likert; y entrevistas estructuradas, todos administrados una sola vez, en la misma ventana de tiempo, a toda la muestra.",
    data_analysis: "¿Cómo analizarás los datos? Opciones comunes son: estadística descriptiva (frecuencias, porcentajes, medias); tablas cruzadas que comparan subgrupos; y pruebas de chi-cuadrado o similares para asociaciones entre variables categóricas.",
    process_support: "Incluye en esta sección cualquier estrategia, herramienta o tecnología que sirva de apoyo al estudio. P. ej.: plataformas de encuestas en línea para la administración, y paquetes estadísticos como SPSS para el análisis.",
  },
  pre_experimental: {
    central_item: "Describe brevemente el fenómeno que estudiarás. En los diseños preexperimentales introduces una intervención o tratamiento, pero con un solo grupo y sin grupo control: una primera prueba exploratoria de su efecto.",
    study_type: "Los diseños preexperimentales manipulan la variable independiente pero carecen de grupo control y de asignación aleatoria, por lo que sus afirmaciones causales son débiles; se usan mejor como pilotos exploratorios. Los tipos principales son: a) estudio de caso de una sola medición (one-shot), donde un grupo recibe el tratamiento y se mide después; b) diseño de un grupo con pretest-postest, donde el grupo se mide antes y después del tratamiento; y c) comparación con grupo estático, donde el grupo tratado se compara con un grupo existente no tratado, sin pretest. ¿Qué tipo seguirá tu estudio?",
    variables: "Describe tu variable independiente (VI, el tratamiento o intervención) y tu variable dependiente (VD, el resultado que mides), y la hipótesis que las vincula. P. ej.: VI: una unidad de juegos de vocabulario de dos semanas; VD: puntuaciones en pruebas de vocabulario.",
    question: "Las preguntas preexperimentales indagan por el efecto aparente del tratamiento, formulado con cautela porque no se pueden descartar explicaciones rivales. P. ej.: ¿Mejora el desempeño de los estudiantes en las pruebas de vocabulario después de la unidad de juegos de dos semanas? Incluye a continuación la pregunta de investigación que guiará tu estudio.",
    sample: "Los diseños preexperimentales trabajan con un único grupo intacto (p. ej.: una clase existente) que recibe el tratamiento, sin asignación aleatoria ni grupo control. Describe el grupo que participará en tu estudio y cómo se seleccionará.",
    groups: "Los diseños preexperimentales involucran 1 grupo que recibe el tratamiento. En una comparación con grupo estático se agrega un grupo existente no tratado para comparar, pero sin pretest ni asignación aleatoria. ¿Cuántos grupos involucrará tu estudio?",
    data_gathering: "¿Qué instrumentos usarás? Las opciones principales en los estudios preexperimentales son: pruebas de rendimiento o desempeño, y escalas que miden la variable dependiente, aplicadas después del tratamiento (one-shot) o antes y después de él (pretest-postest).",
    data_analysis: "¿Cómo analizarás los datos? Opciones comunes son: estadística descriptiva del resultado; puntuaciones de ganancia entre pretest y postest; y pruebas t pareadas para diseños pretest-postest. Interpreta los resultados con cautela: sin grupo control, las mejoras pueden tener otras explicaciones (maduración, efectos de práctica, eventos externos).",
    process_support: "Incluye en esta sección cualquier estrategia, herramienta o tecnología que sirva de apoyo al estudio. P. ej.: paquetes estadísticos como SPSS, y herramientas para construir y administrar las pruebas o escalas.",
  },
  convergent_parallel: {
    research_topic: "Enuncia el tema de tu estudio de métodos mixtos: el foco compartido que ambas vertientes, cualitativa y cuantitativa, iluminarán desde sus propios ángulos.",
    central_item: "Describe brevemente el fenómeno que estudiarás. En un diseño convergente paralelo AMBAS vertientes estudian el mismo fenómeno al mismo tiempo: la vertiente cuantitativa lo mide y la cualitativa explora cómo lo experimentan las personas. Los resultados luego se comparan y combinan en la interpretación.",
    qual_tradition: "¿Qué tradición cualitativa seguirá esta vertiente? P. ej.: narrativa, estudio de caso, fenomenología, etnografía, teoría fundamentada.",
    context: "¿Cuál es el contexto en el que se realizará la vertiente cualitativa de tu estudio? P. ej.: El estudio se realizará en mi escuela, que tiene las siguientes características: (descripción del entorno).",
    qual_question: "¿Cuál es la pregunta de investigación cualitativa que guía esta vertiente de tu estudio? Debe centrarse en comprender cómo experimentan el fenómeno las personas involucradas.",
    question: "¿Cuáles son los asuntos (issues) —las cuestiones particulares en disputa— a los que la vertiente cualitativa prestará atención?",
    topics: "¿Cuáles son las áreas particulares de interés en las que acotarás la complejidad del asunto que guía la vertiente cualitativa?",
    informants: H_INFORMANTS_BASE,
    data_gathering: "¿Qué métodos cualitativos de recolección de datos vas a utilizar? P. ej.: entrevistas, observaciones, diarios, grupos focales.",
    other_documents: H_OTHER_DOCS_PHEN,
    strategies: "¿Cuáles son las estrategias que seguirás en la vertiente cualitativa? Dependen de la tradición en la que te bases; p. ej.: descripciones densas, permanencia prolongada, re-historiar, comparación constante.",
    process_support: "¿Usarás alguna persona, herramienta o recurso que te ayude a realizar la vertiente cualitativa? P. ej.: software de análisis de datos cualitativos.",
    variables: "Describe las variables que se medirán en la vertiente cuantitativa de tu estudio.",
    hypothesis: "Enuncia la hipótesis de la vertiente cuantitativa: lo que predices que mostrarán los datos sobre la relación entre tus variables.",
    mm_question: "Incluye la pregunta de investigación que guía la vertiente cuantitativa; usualmente sobre la distribución de las variables o las relaciones entre ellas.",
    sample: "Describe la muestra que se usará en la vertiente cuantitativa, así como el método de muestreo a utilizar. Una muestra representativa permite generalizar los resultados cuantitativos.",
    groups: "¿Cuántos grupos involucrará la vertiente cuantitativa?",
    mm_data_gathering: "¿Qué instrumentos cuantitativos de recolección de datos usarás? P. ej.: cuestionarios, escalas Likert, observación estructurada, pruebas.",
    data_analysis: "¿Cómo analizarás los datos cuantitativos? P. ej.: estadística descriptiva, correlaciones, comparaciones entre grupos.",
    mm_process_support: "¿Usarás alguna estrategia, herramienta o tecnología de apoyo para la vertiente cuantitativa? P. ej.: paquetes estadísticos como SPSS, o herramientas para la generación de cuestionarios.",
  },
  explanatory_sequential: {
    research_topic: "Enuncia el tema de tu estudio de métodos mixtos: el foco compartido que la Fase I medirá y la Fase II explicará.",
    central_item: "Describe brevemente el fenómeno que estudiarás. En un diseño explicativo secuencial la fase cuantitativa mide primero el fenómeno, y la fase cualitativa explica luego los resultados en profundidad.",
    study_type: "¿Qué diseño cuantitativo seguirá la Fase I? P. ej.: descriptivo no experimental, correlacional, cuasiexperimental o experimental.",
    variables: "Describe las variables que se medirán en la fase cuantitativa, y la hipótesis que las relaciona si la tienes.",
    hypothesis: "Enuncia la hipótesis de la fase cuantitativa: lo que predices que mostrarán los datos sobre la relación entre tus variables.",
    mm_question: "Incluye la pregunta de investigación que guía la fase cuantitativa; usualmente sobre la distribución de las variables o las relaciones entre ellas.",
    sample: "Describe la muestra que se usará en la fase cuantitativa, así como el método de muestreo a utilizar.",
    groups: "¿Cuántos grupos involucrará la fase cuantitativa?",
    mm_data_gathering: "¿Qué instrumentos cuantitativos de recolección de datos usarás en la Fase I? P. ej.: cuestionarios, escalas Likert, observación estructurada, pruebas.",
    data_analysis: "¿Cómo analizarás los datos cuantitativos? P. ej.: estadística descriptiva, correlaciones, comparaciones entre grupos. Los resultados de este análisis deciden qué necesita explicar la Fase II.",
    mm_process_support: "¿Usarás alguna estrategia, herramienta o tecnología de apoyo para la fase cuantitativa? P. ej.: paquetes estadísticos como SPSS, o herramientas para la generación de cuestionarios.",
    qual_tradition: "¿Qué tradición cualitativa seguirá la Fase II? P. ej.: narrativa, estudio de caso, fenomenología, etnografía, teoría fundamentada.",
    context: "¿Cuál es el contexto en el que se realizará la fase cualitativa de tu estudio?",
    qual_question: "¿Cuál es la pregunta de investigación cualitativa que guía la Fase II? En un diseño explicativo secuencial debe centrarse en EXPLICAR los resultados cuantitativos; p. ej.: ¿por qué difirieron los grupos?, ¿qué hay detrás del patrón que mostraron los números?",
    question: "¿Cuáles son los asuntos (issues) —las cuestiones particulares en disputa— a los que la fase cualitativa prestará atención al explicar los resultados cuantitativos?",
    topics: "¿Cuáles son las áreas particulares de interés en las que acotarás la complejidad del asunto que guía la fase cualitativa? A menudo provienen directamente de los resultados cuantitativos más sorprendentes o importantes.",
    informants: "¿Cuáles son los informantes a partir de los cuales obtendrás una mejor comprensión de los resultados cuantitativos? En los diseños explicativos secuenciales, los informantes suelen seleccionarse entre los participantes de la Fase I; p. ej.: personas cuyas respuestas fueron típicas, extremas o sorprendentes.",
    data_gathering: "¿Qué métodos cualitativos de recolección de datos vas a utilizar en la Fase II? P. ej.: entrevistas, grupos focales, observaciones.",
    other_documents: "Además de los métodos de recolección de datos que implementarás, ¿qué otros documentos podrían ayudarte a comprender mejor el fenómeno en estudio?",
    strategies: "¿Cuáles son las estrategias que seguirás en la fase cualitativa? P. ej.: descripciones densas, verificación con los participantes (member checking), comparación constante.",
    process_support: "¿Usarás alguna persona, herramienta o recurso que te ayude a realizar la fase cualitativa? P. ej.: software de análisis de datos cualitativos.",
  },
  exploratory_sequential: {
    research_topic: "Enuncia el tema de tu estudio de métodos mixtos: el foco compartido que la Fase I explorará y la Fase II medirá.",
    central_item: "Describe brevemente el fenómeno que estudiarás. En un diseño exploratorio secuencial la fase cualitativa explora primero el fenómeno, y la fase cuantitativa pone luego a prueba los hallazgos con una muestra más grande.",
    qual_tradition: "¿Qué tradición cualitativa seguirá la Fase I? P. ej.: narrativa, estudio de caso, fenomenología, etnografía, teoría fundamentada.",
    context: "¿Cuál es el contexto en el que se realizará la fase cualitativa de tu estudio?",
    qual_question: "¿Cuál es la pregunta de investigación cualitativa que guía la Fase I? Debe ser lo bastante abierta para dejar emerger los temas importantes: esos temas se convertirán en las variables de la Fase II.",
    question: "¿Cuáles son los asuntos (issues) —las cuestiones particulares en disputa— a los que la exploración cualitativa prestará atención?",
    topics: "¿Cuáles son las áreas particulares de interés en las que acotarás la complejidad del asunto que guía la fase cualitativa?",
    informants: "¿Cuáles son los informantes a partir de los cuales obtendrás una mejor comprensión del fenómeno bajo análisis en la Fase I?",
    data_gathering: "¿Qué métodos cualitativos de recolección de datos vas a utilizar en la Fase I? P. ej.: entrevistas, observaciones, grupos focales.",
    other_documents: "Además de los métodos de recolección de datos que implementarás, ¿qué otros documentos podrían ayudarte a comprender mejor el fenómeno en estudio?",
    strategies: "¿Cuáles son las estrategias que seguirás en la fase cualitativa? P. ej.: descripciones densas, comparación constante, verificación con los participantes (member checking).",
    process_support: "¿Usarás alguna persona, herramienta o recurso que te ayude a realizar la fase cualitativa? P. ej.: software de análisis de datos cualitativos.",
    study_type: "¿Qué diseño cuantitativo seguirá la Fase II? P. ej.: descriptivo no experimental, correlacional, cuasiexperimental o experimental.",
    variables: "Describe las variables que se medirán en la fase cuantitativa. En un diseño exploratorio secuencial suelen provenir de los temas descubiertos en la Fase I: los hallazgos cualitativos se convierten en variables medibles.",
    hypothesis: "Enuncia la hipótesis de la fase cuantitativa: lo que predices que mostrarán los datos, usualmente derivada de los temas descubiertos en la Fase I.",
    mm_question: "Incluye la pregunta de investigación que guía la fase cuantitativa; usualmente pone a prueba si los patrones encontrados en la Fase I se mantienen en una población más grande.",
    sample: "Describe la muestra que se usará en la fase cuantitativa, así como el método de muestreo a utilizar. Una muestra representativa permite generalizar lo que descubrió la Fase I.",
    groups: "¿Cuántos grupos involucrará la fase cuantitativa?",
    mm_data_gathering: "¿Qué instrumentos cuantitativos de recolección de datos usarás en la Fase II? En los diseños exploratorios secuenciales, el cuestionario o la escala a menudo se CONSTRUYE a partir de los hallazgos cualitativos de la Fase I.",
    data_analysis: "¿Cómo analizarás los datos cuantitativos? P. ej.: estadística descriptiva, correlaciones, comparaciones entre grupos.",
    mm_process_support: "¿Usarás alguna estrategia, herramienta o tecnología de apoyo para la fase cuantitativa? P. ej.: paquetes estadísticos como SPSS, o herramientas para la generación de cuestionarios.",
  },
  embedded: {
    research_topic: "Enuncia el tema de tu estudio de métodos mixtos.",
    central_item: "Describe brevemente el fenómeno que estudiarás en tu vertiente principal.",
    question: "¿Cuál es la pregunta de investigación cualitativa que guía tu estudio principal?",
    topics: "¿Cuáles son las áreas particulares de interés en las que acotarás la complejidad de la pregunta que guía el estudio?",
    informants: H_INFORMANTS_BASE,
    data_gathering: "¿Qué métodos cualitativos de recolección de datos vas a utilizar en tu estudio principal?",
    other_documents: "Además de los métodos de recolección de datos que implementarás, ¿qué otros documentos podrían ayudarte a comprender mejor el fenómeno en estudio?",
    strategies: "¿Cuáles son las estrategias que seguirás en tu estudio cualitativo principal?",
    process_support: "¿Usarás alguna persona, herramienta o recurso que te ayude a realizar tu estudio?",
    mm_question: "¿Qué pregunta de investigación responderá el estudio cuantitativo incrustado? Suele ser una pregunta secundaria que los números responden mejor que las palabras; p. ej.: con qué frecuencia sucede algo, o cómo se distribuyen las actitudes.",
    mm_data_gathering: "¿Qué instrumentos cuantitativos usará el estudio incrustado? P. ej.: un cuestionario corto o una escala administrada a los participantes de tu estudio principal.",
    mm_process_support: "¿Usarás alguna estrategia, herramienta o tecnología de apoyo para el estudio cuantitativo incrustado? P. ej.: un paquete estadístico o una herramienta para generar cuestionarios.",
    data_analysis: "¿Cómo analizarás los datos cuantitativos incrustados? P. ej.: estadística descriptiva, frecuencias, comparaciones simples.",
    sample: "Describe la muestra del estudio cuantitativo incrustado; usualmente los mismos participantes de tu estudio principal, o un subconjunto de ellos.",
  },
  embedded_quant: {
    research_topic: "Enuncia el tema de tu estudio de métodos mixtos.",
    central_item: "Describe brevemente el fenómeno que estudiarás en tu vertiente principal.",
    study_type: "¿Qué diseño cuantitativo seguirá tu estudio principal? P. ej.: descriptivo no experimental, correlacional, cuasiexperimental o experimental.",
    variables: "Describe las variables que se medirán en tu estudio cuantitativo principal, y la hipótesis que las relaciona si la tienes.",
    mm_question: "Incluye la pregunta de investigación que guía tu estudio cuantitativo principal.",
    sample: "Describe la muestra que se usará en tu estudio principal, así como el método de muestreo a utilizar.",
    groups: "¿Cuántos grupos involucrará tu estudio principal?",
    mm_data_gathering: "¿Qué instrumentos cuantitativos de recolección de datos usará tu estudio principal?",
    data_analysis: "¿Cómo analizarás los datos cuantitativos de tu estudio principal?",
    mm_process_support: "¿Usarás alguna estrategia, herramienta o tecnología de apoyo para tu estudio principal?",
    question: "¿Qué pregunta de investigación cualitativa responderá el estudio incrustado? Suele ser una pregunta secundaria que las palabras responden mejor que los números; p. ej.: cómo experimentaron los participantes la intervención, o por qué respondieron como lo hicieron.",
    data_gathering: "¿Qué métodos cualitativos usará el estudio incrustado? P. ej.: un número pequeño de entrevistas, grupos focales o preguntas abiertas dentro de tu instrumento.",
    strategies: "¿Qué estrategias cualitativas usarás para el estudio incrustado? P. ej.: análisis temático de las transcripciones de entrevistas o de las respuestas abiertas.",
    informants: "¿Cuáles son los informantes del estudio cualitativo incrustado? Usualmente un número pequeño de participantes seleccionados de tu estudio principal.",
    context: "¿En qué contexto se realizará el estudio cualitativo incrustado?",
  },
  design_based_research: {
    research_topic: "Da al estudio un título de trabajo conciso que identifique el problema, la intervención, los participantes y el entorno sin presuponer el éxito. Nombrar estos elementos ayuda a establecer los límites de la indagación. Por ejemplo: Co-diseñar y refinar rutinas de discusión para apoyar la participación equitativa en aulas de ciencias de octavo grado.",
    context: "¿En qué entorno naturalista se desarrollará y estudiará el diseño, y qué define los límites de la indagación? Describe las condiciones institucionales, históricas, culturales, sociales, políticas, tecnológicas y materiales que pueden moldear la implementación y los resultados. Identifica los sitios, los grupos de participantes, el periodo de tiempo, las rutinas organizacionales, las políticas, los recursos y la investigación previa relevante. ¿Qué características contextuales pueden habilitar, restringir o interactuar con el diseño?",
    central_item: "¿Qué problema persistente y de consecuencias reales experimentan los practicantes y aprendices en este entorno? ¿Qué evidencia muestra que el problema existe, para quién importa y cómo se aborda actualmente? Distingue los síntomas observables de las causas subyacentes plausibles. Explica por qué el problema es apto para una intervención y por qué los enfoques existentes son insuficientes.",
    question: "Enuncia el doble propósito del estudio: mejorar la práctica mediante una intervención utilizable y producir conocimiento teórico o de diseño. Desarrolla preguntas que evolucionen a lo largo del proceso DBR. Considera: ¿Qué necesidades y mecanismos deben informar el diseño inicial? ¿Cómo se implementa y adapta la intervención? ¿Qué resultados y consecuencias no previstas emergen? ¿Cómo explican el contexto y la implementación la variación? ¿Qué principios de diseño ganan credibilidad a través de las iteraciones?",
    topics: "¿Qué áreas de interés enfocarán la indagación sin simplificar en exceso el problema? Los temas pueden incluir participación, procesos de aprendizaje, identidad, accesibilidad, toma de decisiones docente, condiciones de implementación, usabilidad, rutinas institucionales o equidad. Aclara cómo se relaciona cada tema con el problema, la intervención, las preguntas de investigación y la contribución esperada.",
    informants: "¿Quiénes participarán en formular el problema, diseñar la intervención, implementarla e interpretar la evidencia? Identifica aprendices, practicantes, líderes, familias, miembros de la comunidad, diseñadores e investigadores según corresponda. Para cada grupo, especifica su conocimiento, rol, derechos de decisión, beneficio esperado y carga potencial. ¿Qué informantes pueden iluminar experiencias contrastantes, incluidas las de los más afectados o históricamente subrepresentados?",
    hypothesis: "Articula el razonamiento que vincula la intervención propuesta con los procesos y resultados deseados. Por ejemplo: Si los docentes y estudiantes de ciencias de octavo grado diseñan colaborativamente y refinan iterativamente rutinas de discusión estructuradas que establecen normas explícitas para la participación equitativa; brindan tiempo individual de pensamiento y preparación; y usan múltiples formatos de participación, como hablar, escribir, dibujar y respuestas digitales, entonces los estudiantes que típicamente tienen menos probabilidades de contribuir, incluidos los aprendices multilingües, los estudiantes con discapacidades y aquellos cuyas ideas han sido históricamente marginadas, tendrán oportunidades más frecuentes y significativas de participar en las discusiones de ciencias.",
    variables: "¿Qué se diseñará o rediseñará? Por ejemplo: un currículo, una herramienta, un entorno de aprendizaje, una práctica profesional, una rutina de política o un sistema coordinado. Identifica sus características esenciales, elementos adaptables, usuarios, actividades, materiales, apoyos y secuencia prevista. Traduce el análisis del problema en requisitos y restricciones de diseño. ¿Qué contaría como una versión viable, utilizable, equitativa y sostenible en este contexto?",
    strategies: "Planifica los ciclos DBR: análisis y exploración; diseño y construcción; implementación y evaluación; reflexión y rediseño. Para cada ciclo, especifica su propósito, entorno, participantes, duración, versión del prototipo, evidencia a recolectar y criterios para continuar, adaptar o detenerse. ¿Cómo se registrarán los cambios entre versiones para poder conectar las afirmaciones con características y condiciones de diseño particulares?",
    data_gathering: "Selecciona métodos que capturen resultados, implementación, mecanismos, experiencias y contexto a lo largo del tiempo. Según las preguntas, pueden incluir observaciones, entrevistas, grupos focales, encuestas, evaluaciones, trazas de uso, grabaciones, protocolos de pensamiento en voz alta, reuniones de diseño, notas de campo y registros de implementación. Especifica a quién o qué se muestreará, cuándo y con qué frecuencia se recogerán los datos, y cómo se vincularán las fuentes entre ciclos. Prevé evidencia suficiente para examinar efectos esperados e inesperados.",
    other_documents: "¿Qué materiales existentes o generados iluminarán el problema, el proceso de diseño, la implementación y los resultados? Ejemplos: políticas, currículos, planes de clase, trabajos de los participantes, fotografías, videos, diarios, comunicaciones, actas de reuniones, versiones de prototipos, formularios de retroalimentación, memos analíticos y registros de decisiones. Para cada fuente, aclara su procedencia, relevancia, condiciones de acceso y papel en la triangulación.",
    process_support: "¿Qué personas, herramientas, recursos, permisos y capacidades se requieren? Considera facilitación, experticia en la materia, asistencia de investigación, software de diseño y análisis de datos, capacitación, infraestructura técnica, presupuesto, tiempo y apoyo del liderazgo. Identifica dependencias y riesgos para la fidelidad de la implementación, la participación de los socios y la continuidad entre ciclos. ¿Qué planes de contingencia son realistas si las condiciones cambian?",
    minicases: "¿Qué forma debe tomar el conocimiento transferible del estudio? Redacta principios de diseño provisionales que conecten un propósito, una característica de diseño, un mecanismo y una condición contextual; luego especifica la evidencia necesaria para revisarlos o rechazarlos. Identifica también las contribuciones previstas a la teoría, la medición, los métodos y la práctica local. Evita prescripciones universales: enuncia los límites, las condiciones de frontera y el grado de confianza que respaldan las iteraciones.",
  },
};

export function localizeVdForm(form, designKey, lang) {
  if (lang !== "es" || !form) return form;
  const name = N[designKey] || form.designName;
  const perDesign = D[designKey] || {};
  const fields = (form.fields || []).map((f) => {
    const ov = perDesign[f.key] || F[f.key] || {};
    return { ...f, label: ov.label || f.label, hint: ov.hint !== undefined && ov.hint !== "" ? ov.hint : f.hint, placeholder: ov.placeholder || f.placeholder, help: (HELPS[designKey] || {})[f.key] || ov.help || f.help };
  });
  const labels = form.layout?.labels
    ? { ...form.layout.labels, ...L.common, ...(L[designKey] || {}) }
    : form.layout?.labels;
  const layout = {
    ...form.layout,
    ...(labels ? { labels } : {}),
    ...(form.layout?.contextTitle ? { contextTitle: CONTEXT_TITLES[designKey] || form.layout.contextTitle } : {}),
    ...(form.layout?.designName ? { designName: N[designKey] || form.layout.designName } : {}),
    ...(form.layout?.titleText ? { titleText: TITLE_TEXTS[designKey] || form.layout.titleText } : {}),
    ...(form.layout?.titleName ? { titleName: TITLE_NAMES[designKey] || form.layout.titleName } : {}),
    ...(form.layout?.fixed
      ? { fixed: Object.fromEntries(Object.entries(form.layout.fixed).map(([k, v]) => [k, FIXED_VALUES[v] || v])) }
      : {}),
    ...(form.layout?.leftRails
      ? { leftRails: form.layout.leftRails.map((r) => ({ ...r, title: DBR_RAIL_TITLES[r.key] || r.title })) }
      : {}),
    ...(form.layout?.centerExtra ? { centerExtra: { ...form.layout.centerExtra, label: DBR_CENTER_EXTRA_LABEL } } : {}),
    ...(form.layout?.splitStrategies ? { splitStrategies: { ...form.layout.splitStrategies, label: DBR_SPLIT_STRATEGIES_LABEL } } : {}),
  };
  return { ...form, designName: name, intro: intro(name), fields, layout };
}

export const VD_DESIGN_NAMES_ES = N;
