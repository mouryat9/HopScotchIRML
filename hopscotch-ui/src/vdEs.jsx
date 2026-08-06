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
  groups: { label: "N.º de grupos", hint: "" , placeholder: "1 grupo / 2 grupos"},
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
    question: { label: "Pregunta narrativa" },
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
    topics: { label: "Temas", hint: "Áreas de interés que delimitan tu asunto" },
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
    study_type: { label: "Tipo de encuesta", hint: "Descriptiva o analítica" },
    question: { label: "Pregunta de investigación", hint: "Sobre el estado de una población en un momento dado" },
    groups: { label: "Organización del estudio", hint: "Una población; subgrupos si es analítica" },
  },
  pre_experimental: {
    central_item: { label: "Fenómeno en estudio", hint: "La situación donde explorarás tu intervención" },
    study_type: { label: "Tipo de diseño preexperimental", hint: "Un solo grupo con controles limitados" },
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
  mm_process_support: F.mm_process_support, study_type: { label: "Tipo de diseño cuantitativo", hint: "Descriptivo, correlacional, cuasiexperimental…" },
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

const CONTEXT_TITLES = {
  narrative: "Contexto de tu estudio narrativo", phenomenology: "Contexto de tu estudio fenomenológico",
  grounded_theory: "Contexto de tu estudio de teoría fundamentada", ethnography: "Contexto de tu etnografía",
  case_study: "Contexto de tu caso", action_research: "Contexto de tu I-A",
  phenomenography: "Contexto de tu estudio fenomenográfico", design_based_research: "Contexto y límites",
};

export function localizeVdForm(form, designKey, lang) {
  if (lang !== "es" || !form) return form;
  const name = N[designKey] || form.designName;
  const perDesign = D[designKey] || {};
  const fields = (form.fields || []).map((f) => {
    const ov = perDesign[f.key] || F[f.key] || {};
    return { ...f, label: ov.label || f.label, hint: ov.hint !== undefined && ov.hint !== "" ? ov.hint : f.hint, placeholder: ov.placeholder || f.placeholder };
  });
  const labels = form.layout?.labels
    ? { ...form.layout.labels, ...L.common, ...(L[designKey] || {}) }
    : form.layout?.labels;
  const layout = {
    ...form.layout,
    ...(labels ? { labels } : {}),
    ...(form.layout?.contextTitle ? { contextTitle: CONTEXT_TITLES[designKey] || form.layout.contextTitle } : {}),
    ...(form.layout?.designName ? { designName: N[designKey] || form.layout.designName } : {}),
  };
  return { ...form, designName: name, intro: intro(name), fields, layout };
}

export const VD_DESIGN_NAMES_ES = N;
