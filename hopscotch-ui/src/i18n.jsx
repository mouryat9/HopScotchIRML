// src/i18n.jsx
// Lightweight internationalization for Hopscotch (Phase 1: Spanish vertical
// slice covering Step 1 + chat). Deliberately dependency-free: a context, a
// t(key, vars) lookup with {var} interpolation, and English fallback for any
// untranslated key - so partial translations never blank the UI.
import React, { createContext, useContext, useState, useEffect } from "react";
import { API } from "./api";
import { useAuth } from "./AuthContext";

export const LANGS = [
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
];

const LOCALES = {
  en: {
    "profile.language": "Language",
    "chat.worldviewSelected": "Worldview selected: {label}",
    "chat.send": "Send",
    "chat.sending": "Sending…",
    "chat.step": "Step {n}",
    "app.myResearchDesign": "My Research Design",
    "stepQ.1": "Who am I as a researcher?",
    "stepQ.2": "What am I wondering about?",
    "stepQ.3": "What do I already know?",
    "stepQ.4": "How will I study it?",
    "stepQ.5": "What is my research question?",
    "stepQ.6": "What is the data to collect?",
    "stepQ.7": "How will I make sense of the data?",
    "stepQ.8": "How will I ensure my evidence is trustworthy?",
    "stepQ.9": "How will I be ethical and safe in my study?",
    "stepQ.general": "General",
    "step1.title": "Step 1: Who am I as a researcher?",
    "common.directions": "Directions",
    "step1.directions":
      "Step One will help you reflect on your worldview (paradigmatic positioning) as a researcher. The video and interactive resources on the left will help you learn about the different worldviews you can bring as a researcher to your studies.",
    "step1.selectPrompt":
      "After checking the interactive resources on the left side, please select the worldview that best represents who you are a researcher.",
    "step1.dropdownPlaceholder": "Choose the worldview that best aligns with who you are",
    "worldview.positivist": "Positivist",
    "worldview.post_positivist": "Post-positivist",
    "worldview.constructivist": "Constructivist",
    "worldview.transformative": "Transformative",
    "worldview.pragmatist": "Pragmatist",
    "worldview.unsure": "I'm not sure yet",
    "step1.explainPrompt":
      "Explain your selection based on how you understand the nature of reality (ontology) and how you believe knowledge is generated, discovered, or constructed (epistemology). Then use the AI Assistant to clarify your worldview.",
    "step1.textareaPlaceholder": "Explain your selection...",
    "step1.askAI": "Ask AI to Clarify My Worldview",
    "common.saving": "Saving…",
    "chat.placeholder": "Type your message and press Enter…",
    "chat.aiOff": "The AI assistant is turned off by your teacher.",
    "step1.autoMsgWithJustification":
      'I just selected {label} as my worldview. Here is my explanation based on my understanding of ontology and epistemology: "{justification}". Can you give me a personalised welcome, help me clarify my worldview based on my reasoning, and explain what this means for my research approach and methodology pathway?',
    "step1.autoMsgNoJustification":
      "I just selected {label} as my worldview. Can you give me a personalised welcome explaining what this means for my research approach and methodology pathway?",
  },
  es: {
    "profile.language": "Idioma",
    "chat.worldviewSelected": "Cosmovisión seleccionada: {label}",
    "chat.send": "Enviar",
    "chat.sending": "Enviando…",
    "chat.step": "Paso {n}",
    "app.myResearchDesign": "Mi Diseño de Investigación",
    "stepQ.1": "¿Quién soy como investigador/a?",
    "stepQ.2": "¿Sobre qué me pregunto?",
    "stepQ.3": "¿Qué sé ya sobre el tema?",
    "stepQ.4": "¿Cómo lo estudiaré?",
    "stepQ.5": "¿Cuál es mi pregunta de investigación?",
    "stepQ.6": "¿Qué datos voy a recolectar?",
    "stepQ.7": "¿Cómo daré sentido a los datos?",
    "stepQ.8": "¿Cómo aseguraré que mi evidencia sea confiable?",
    "stepQ.9": "¿Cómo seré ético/a y cuidadoso/a en mi estudio?",
    "stepQ.general": "General",
    "step1.title": "Paso 1: ¿Quién soy como investigador/a?",
    "common.directions": "Instrucciones",
    "step1.directions":
      "El Paso Uno te ayudará a reflexionar sobre tu cosmovisión (posicionamiento paradigmático) como investigador/a. El video y los recursos interactivos de la izquierda te ayudarán a conocer las diferentes cosmovisiones que puedes aportar como investigador/a a tus estudios.",
    "step1.selectPrompt":
      "Después de revisar los recursos interactivos del lado izquierdo, selecciona la cosmovisión que mejor representa quién eres como investigador/a.",
    "step1.dropdownPlaceholder": "Elige la cosmovisión que mejor se alinea contigo",
    "worldview.positivist": "Positivista",
    "worldview.post_positivist": "Pospositivista",
    "worldview.constructivist": "Constructivista",
    "worldview.transformative": "Transformativa",
    "worldview.pragmatist": "Pragmatista",
    "worldview.unsure": "Aún no estoy seguro/a",
    "step1.explainPrompt":
      "Explica tu selección según cómo entiendes la naturaleza de la realidad (ontología) y cómo crees que el conocimiento se genera, se descubre o se construye (epistemología). Luego usa el Asistente de IA para aclarar tu cosmovisión.",
    "step1.textareaPlaceholder": "Explica tu selección...",
    "step1.askAI": "Pedir a la IA que aclare mi cosmovisión",
    "common.saving": "Guardando…",
    "chat.placeholder": "Escribe tu mensaje y presiona Enter…",
    "chat.aiOff": "Tu docente ha desactivado el asistente de IA.",
    "step1.autoMsgWithJustification":
      'Acabo de seleccionar {label} como mi cosmovisión. Esta es mi explicación basada en mi comprensión de la ontología y la epistemología: "{justification}". ¿Puedes darme una bienvenida personalizada, ayudarme a aclarar mi cosmovisión a partir de mi razonamiento y explicarme qué implica para mi enfoque de investigación y mi ruta metodológica?',
    "step1.autoMsgNoJustification":
      "Acabo de seleccionar {label} como mi cosmovisión. ¿Puedes darme una bienvenida personalizada y explicarme qué implica para mi enfoque de investigación y mi ruta metodológica?",
  },
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const { user } = useAuth();
  const [lang, setLangState] = useState(() => localStorage.getItem("hop_lang") || "en");

  // First load on a new device: adopt the language saved on the account
  useEffect(() => {
    if (!localStorage.getItem("hop_lang") && user?.language && user.language !== lang) {
      setLangState(user.language);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.language]);

  const setLang = (l) => {
    setLangState(l);
    localStorage.setItem("hop_lang", l);
    API.setLanguage(l).catch(() => {}); // persist to the account; best-effort
  };

  const t = (key, vars) => {
    let s = LOCALES[lang]?.[key] ?? LOCALES.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v);
    return s;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  // Components rendered outside the provider (tests) fall back to English
  if (!ctx) {
    return { lang: "en", setLang: () => {}, t: (k, vars) => {
      let s = LOCALES.en[k] ?? k;
      if (vars) for (const [kk, v] of Object.entries(vars)) s = s.split(`{${kk}}`).join(v);
      return s;
    } };
  }
  return ctx;
}
