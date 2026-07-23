// src/VisualDesignEditor.jsx
// Standalone Visual Design editor page (opened from Step 4 in its own tab via
// ?view=vd&session=<id>). Left: guided form fields. Right: the live diagram.
// Both sides edit the same data; changes auto-save to the session.
import React, { useState, useRef, useEffect, useCallback } from "react";
import html2canvas from "html2canvas";
import { API } from "./api";
import VDTemplateHoneycomb from "./VDTemplateHoneycomb";
import VDTemplatePentagonFlower from "./VDTemplatePentagonFlower";
import VDTemplateMixed from "./VDTemplateMixed";
import ChatBox from "./ChatBox";

/* Form definitions per design. Field keys are shared with the backend
   (VD_FIELD_KEYS) and with the PPTX export placeholders. */
const VD_FORMS = {
  narrative: {
    designName: "Narrative Study",
    intro: "Answer the questions below to build the one-page visual design of your narrative study. Everything you write appears in the diagram on the right - and you can click any text in the diagram to edit it directly.",
    fields: [
      {
        key: "central_item",
        label: "Narrative Portraits",
        hint: "The phenomenon studied through your informants' stories",
        help: "The purpose of narrative research is providing a voice for seldom heard individuals and exploring educational research problems by understanding the experiences of an individual or a few individuals. The stories of the informants constitute the data (usually gathered by interviews and informational conversations). They are called field texts. Include here the phenomenon that will be studied through the narrative portraits of your informants.",
      },
      {
        key: "context",
        label: "Context",
        hint: "Where will your study be conducted?",
        help: "Which is the context in which your study will be conducted? i.e. The study will be conducted at my school which has the following characteristics: (description of the setting).",
      },
      {
        key: "question",
        label: "Narrative Question",
        hint: "The question driving your study",
        help: "The research question in narrative studies should focus on the analysis and deep understanding of the lived experiences of our informants in relation to the research topic that interests us. An example of a research question that could drive a narrative study is: What dilemmas, tensions and problems do novice teachers find in their classrooms?",
      },
      {
        key: "topics",
        label: "Topics",
        hint: "Areas of interest that narrow down your question",
        help: "Which are the particular areas of interest in which you will narrow down the complexity of the narrative question driving the study? For the issue proposed in the previous question (Does the policy to base school placement on residency and past attendance perpetuate inequity?) we could define the following topics: Roots of the policy; advantages for the families; commodity vs. inequity; etc.",
        placeholder: "One topic per line",
      },
      {
        key: "informants",
        label: "Stories of the Informants",
        hint: "Who will you learn from?",
        help: "Which are the informants from which you will get a better understanding of the phenomenon under analysis?",
      },
      {
        key: "data_gathering",
        label: "Data Gathering Methods",
        hint: "How will you collect the stories?",
        help: "The main data gathering methods in narrative studies are: journals, text analysis, analysis of memorabilia, etc. Which Data Gathering methods are you going to use?",
      },
      {
        key: "other_documents",
        label: "Other Documents to be analyzed",
        hint: "Photos, videos, journals, artifacts…",
        help: "In addition to the data gathering methods you will implement, which other documents could help you to better understand the social group under study? i.e. Photos, videos, journals, artifacts created by the informants, etc.",
      },
      {
        key: "strategies",
        label: "Narrative Research Strategies",
        hint: "Restorying, liminality, transgression, evocation, complexity",
        help: "In narrative research the researcher uses to restore the “story” of the informants in accordance with a number of topics or themes. The new story may be structured around a chronology of events describing the individual’s past, present, and future experiences, and situated within a specific setting or context. This process is called “restorying,” which constitutes the main research strategy in this particular form of research. When conducting narrative studies it is also relevant to have in mind some of the strategies we can implement in order to generate good written stories. Some of them are: a) Liminality; b) Transgression; c) Evocation, and; d) Complexity. Will you use any of the previous? Which ones?",
      },
      {
        key: "process_support",
        label: "Process Support",
        hint: "People, tools or resources helping your study",
        help: "Are you using any individual, tool, or resource to help you conduct your study? i.e. Data analysis software.",
      },
    ],
    layout: {
      designName: "Narrative Study",
      contextTitle: "Context of your Narrative Study",
      centerColor: "#93C47D",
      centerLabelColor: "#1C4A12",
      labels: {
        informants: "Stories of the Informants",
        other_documents: "Other Documents",
        data_gathering: "Data Gathering Methods",
        central_item: "Narrative Portraits",
        strategies: "Narrative Research Strategies",
        process_support: "Process Support",
        question: "Narrative Question",
      },
    },
  },

  phenomenology: {
    designName: "Phenomenological Study",
    intro: "Answer the questions below to build the one-page visual design of your phenomenological study. Everything you write appears in the diagram on the right - and you can click any text in the diagram to edit it directly.",
    fields: [
      {
        key: "central_item",
        label: "Phenomenon Under Study",
        hint: "The finite, definable experience your study analyzes",
        help: "Phenomenology is a collection and analysis of people's perceptions related to a specific, definable phenomenon. The central aspect of a Phenomenological study is the phenomenon that will be analyzed. A phenomenon is an event, an experience, or something that happens to someone. A phenomenon is something that is finite and definable rather than nebulous or unclear (i.e. failing or passing a test, giving birth, isolation, losing a friend, etc).",
      },
      {
        key: "context",
        label: "Context",
        hint: "The roots and setting of the phenomenon",
        help: "Which is the context of your phenomenological study? We researchers need to deepen in the roots of the phenomenon driving our study, since it is the only way to be able to understand its origins.",
      },
      {
        key: "question",
        label: "Phenomenological Questions",
        hint: "What does this experience mean to those who live it?",
        help: "Phenomenological questions focus on the meaning of the lived experience: what the phenomenon is like for the people who go through it, and what it means to them. An example of a question that could drive a phenomenological study is: What does the experience of failing a gateway course mean to first-generation college students?",
      },
      {
        key: "topics",
        label: "Topics",
        hint: "Areas of interest that narrow down your question",
        help: "Which are the particular areas of interest in which you will narrow down the complexity of the phenomenological question driving the study? For example, for the experience of failing a gateway course we could define: first reactions; impact on identity; support received; decisions about staying or leaving; etc.",
        placeholder: "One topic per line",
      },
      {
        key: "informants",
        label: "Informants",
        hint: "People who have lived the phenomenon",
        help: "Which are the informants from which you will get a better understanding of the phenomenon under analysis? In phenomenology, informants must be people who have directly experienced the phenomenon under study.",
      },
      {
        key: "data_gathering",
        label: "Data Gathering Methods",
        hint: "How will you collect their perceptions?",
        help: "The main data gathering method in phenomenological studies is the in-depth interview, often repeated with each informant, complemented by written reflections or focus groups. Which Data Gathering methods are you going to use?",
      },
      {
        key: "other_documents",
        label: "Other Documents to be analyzed",
        hint: "Photos, videos, journals, artifacts…",
        help: "In addition to the data gathering methods you will implement, which other documents could help you to better understand the phenomenon under study? i.e. Photos, videos, journals, artifacts created by the informants, etc.",
      },
      {
        key: "strategies",
        label: "Phenomenological Strategies",
        hint: "Bracketing, horizontalization, textural and structural description",
        help: "In phenomenological research the researcher sets aside their own preconceptions about the phenomenon (bracketing or epoche), identifies significant statements from the informants (horizontalization), groups them into clusters of meaning, and writes descriptions of what was experienced (textural) and how it was experienced (structural), arriving at the essence of the phenomenon. Which of these strategies will you use?",
      },
      {
        key: "process_support",
        label: "Process Support",
        hint: "People, tools or resources helping your study",
        help: "Are you using any individual, tool, or resource to help you conduct your study? i.e. Data analysis software.",
      },
    ],
    layout: {
      designName: "Phenomenology",
      contextTitle: "Context of your Phenomenological Study",
      centerColor: "#6FA8DC",
      centerLabelColor: "#0B3050",
      labels: {
        informants: "Informants",
        other_documents: "Other Documents",
        data_gathering: "Data Gathering Methods",
        central_item: "Phenomenon",
        strategies: "Strategies",
        process_support: "Process Support",
        question: "Questions",
      },
    },
  },

  grounded_theory: {
    designName: "Grounded Theory Study",
    intro: "Answer the questions below to build the one-page visual design of your grounded theory study. Everything you write appears in the diagram on the right - and you can click any text in the diagram to edit it directly.",
    fields: [
      {
        key: "central_item",
        label: "Phenomenon under study that has not been covered in the literature",
        hint: "Your substantive area of interest",
        help: "The aim of a grounded theory study is to generate, or discover, a theory regarding a phenomenon that has not been properly covered in the existing body of literature in a given field. A grounded theory is one that is inductively derived from the study of phenomena. The theory is discovered, developed and provisionally verified through systematic data collection and analysis of data pertaining to that phenomena. The important thing to remember is that you do not begin with a theory and then attempt to prove it, but rather you begin with an area of study and then what is relevant is allowed to emerge from your research.",
      },
      {
        key: "context",
        label: "Context",
        hint: "The setting, and how you became interested",
        help: "Which is the context of your grounded theory study? How have you become interested in the topic under research?",
      },
      {
        key: "question",
        label: "Grounded Theory Questions",
        hint: "Open questions about the process behind the phenomenon",
        help: "Grounded theory questions are open-ended and focus on understanding the process behind the phenomenon: how people act, interact, and respond to it. An example of a question that could drive a grounded theory study is: What is the process by which new teachers develop their own classroom management approach?",
      },
      {
        key: "topics",
        label: "Topics",
        hint: "Areas of interest that narrow down your question",
        help: "Which are the particular areas of interest in which you will narrow down the complexity of the grounded theory question driving the study? For the process by which new teachers develop a classroom management approach we could define: early influences; trial and error; advice received; turning points; etc.",
        placeholder: "One topic per line",
      },
      {
        key: "informants",
        label: "Informants",
        hint: "Who experiences the process you want to theorize?",
        help: "Which are the informants from which you will get a better understanding of the phenomenon under analysis? In grounded theory, informants are selected through theoretical sampling: you keep adding informants whose experiences help develop your emerging theory, until new interviews stop adding new insights (saturation).",
      },
      {
        key: "data_gathering",
        label: "Data Gathering Methods",
        hint: "Interviews, observations, collected iteratively",
        help: "The main data gathering method in grounded theory studies is the interview, usually with a larger number of informants than other qualitative designs, complemented by observations. Data collection and analysis happen in cycles: what you learn from early informants shapes who you interview next and what you ask. Which Data Gathering methods are you going to use?",
      },
      {
        key: "other_documents",
        label: "Other Documents to be analyzed",
        hint: "Photos, videos, journals, artifacts…",
        help: "In addition to the data gathering methods you will implement, which other documents could help you to better understand the phenomenon under study? i.e. Photos, videos, journals, artifacts created by the informants, etc.",
      },
      {
        key: "strategies",
        label: "Grounded Theory Strategies",
        hint: "Constant comparison, coding, memoing, saturation",
        help: "In grounded theory research the researcher analyzes the data using the constant comparative method: every new piece of data is compared with what was gathered before. The analysis moves through open coding (identifying categories), axial coding (relating categories to each other), and selective coding (building the story around a core category), supported by memoing (writing notes about the emerging theory) and theoretical sampling until saturation is reached. Which of these strategies will you use?",
      },
      {
        key: "process_support",
        label: "Process Support",
        hint: "People, tools or resources helping your study",
        help: "Are you using any individual, tool, or resource to help you conduct your study? i.e. Data analysis software.",
      },
    ],
    layout: {
      designName: "Grounded Theory",
      contextTitle: "Context of your Grounded Theory Study",
      centerColor: "#A2C4C9",
      centerLabelColor: "#1F3A3D",
      labels: {
        informants: "Informants",
        other_documents: "Other Documents",
        data_gathering: "Data Gathering Methods",
        central_item: "Phenomenon not covered in the literature",
        strategies: "Strategies",
        process_support: "Process Support",
        question: "Questions",
      },
    },
  },

  ethnography: {
    designName: "Ethnographic Study",
    intro: "Answer the questions below to build the one-page visual design of your ethnographic study. Everything you write appears in the diagram on the right - and you can click any text in the diagram to edit it directly.",
    fields: [
      {
        key: "central_item",
        label: "Culture to be studied",
        hint: "The cultural group at the center of your study",
        help: "In ethnographical studies researchers study the shared patterns of behaviors, language, and actions of a cultural group in a natural setting. It involves a field-based study lengthy enough to surface people's everyday norms, rituals, and routines in detail. Which is the culture (group) in which you will focus your study?",
      },
      {
        key: "context",
        label: "Context",
        hint: "Where will your study be conducted?",
        help: "Which is the context in which your study will be conducted? i.e. The study will be conducted at my school which has the following characteristics: (description of the setting).",
      },
      {
        key: "question",
        label: "Ethnographic Question",
        hint: "About the functioning of the social group",
        help: "Ethnographic questions always refer to the functioning of a particular social group (i.e. norms, rules, traditions, etc). Which is the research question driving your study?",
      },
      {
        key: "topics",
        label: "Topics",
        hint: "Areas of interest that narrow down your question",
        help: "Which are the particular areas of interest in which you will narrow down the complexity of the ethnographical question driving the study? For the issue proposed in the previous question (Does the policy to base school placement on residency and past attendance perpetuate inequity?) we could define the following topics: Roots of the policy; advantages for the families; commodity vs. inequity; etc.",
        placeholder: "One topic per line",
      },
      {
        key: "informants",
        label: "Informants",
        hint: "Who will help you understand the group?",
        help: "Which are the informants from which you will get a better understanding of the social group under analysis?",
      },
      {
        key: "data_gathering",
        label: "Data Gathering Methods",
        hint: "Journals, observations, interviews",
        help: "The main data gathering methods in ethnographic studies are: journals, observations, and interviews. Which Data Gathering methods are you going to use?",
      },
      {
        key: "other_documents",
        label: "Other Documents to be analyzed",
        hint: "Photos, videos, journals, artifacts…",
        help: "In addition to the data gathering methods you will implement, which other documents could help you to better understand the social group under study? i.e. Photos, videos, journals, artifacts created by the informants, etc.",
      },
      {
        key: "strategies",
        label: "Ethnographic Research Strategies",
        hint: "Prolonged engagement, vignettes, thick descriptions",
        help: "Some ethnographic strategies are: prolonged engagement, use of vignettes, thick descriptions. Which are the strategies you will follow to illuminate the norms, beliefs and rituals of the culture under study?",
      },
      {
        key: "process_support",
        label: "Process Support",
        hint: "People, tools or resources helping your study",
        help: "Are you using any individual, tool, or resource to help you conduct your study? i.e. Data analysis software.",
      },
    ],
    layout: {
      designName: "Ethnography",
      contextTitle: "Context of your Ethnography",
      centerColor: "#E06666",
      centerLabelColor: "#4A0F0F",
      labels: {
        informants: "Informants",
        other_documents: "Other Documents",
        data_gathering: "Data Gathering Methods",
        central_item: "Culture/group under study",
        strategies: "Ethnographic Research Strategies",
        process_support: "Process Support",
        question: "Ethnographic Question",
      },
    },
  },
  case_study: {
    designName: "Case Study",
    intro: "Answer the questions below to build the one-page visual design of your case study. Everything you write appears in the diagram on the right - and you can click any text in the diagram to edit it directly.",
    fields: [
      {
        key: "central_item",
        label: "Name of your case",
        hint: "Your bounded system in action",
        help: "It is of great importance to define the name of your case since it will give you a sense of its boundaries. Remember that a case study constitutes the study of a bounded system in action. For instance, if you are studying a school choice program policy based on residency, that has been implemented in a school district (your bounded system) the name of your case might be: Residency based policy at Marietta School District.",
      },
      {
        key: "context",
        label: "Context",
        hint: "The contexts affecting your bounded system",
        help: "Which are the contexts affecting the functioning of the bounded system (your case)? We researchers need to deepen in the roots of the case, since it is the only way to be able to analyze it in the context in which it arises and it is developed. Examples of contexts are: Historical Context; Educational Context; Socio-political context; Previous Research conducted in the field; etc.",
      },
      {
        key: "question",
        label: "Issue",
        hint: "The tension under scrutiny driving your study",
        help: "An issue is a matter of contention which is of special concern or importance. It has to do with the functioning of the case, particularly reflecting one or more of its purposes. An issue can be understood as the particular tension under scrutiny, that is going to drive the whole study. i.e. Imagine a case study focused in a school choice program where parents can place their children in any school, if it is in their residency area or if there are openings. An issue driving the study might be: Does the policy to base school placement on residency and past attendance perpetuate inequity?",
      },
      {
        key: "topics",
        label: "Topics",
        hint: "Areas of interest that narrow down your issue",
        help: "Which are the particular areas of interest in which you will narrow down the complexity of the issue driving the study? For the issue proposed in the previous question (Does the policy to base school placement on residency and past attendance perpetuate inequity?) we could define the following topics: Roots of the policy; advantages for the families; commodity vs. inequity; etc.",
        placeholder: "One topic per line",
      },
      {
        key: "informants",
        label: "Informants",
        hint: "Who will help you understand your case?",
        help: "Which are the informants from which you will get a better understanding of the particularity of your case? For instance, in order to illuminate the case we are using as an example in this form, you could gather information from: School district administrators; teachers working for the district; parents; etc.",
      },
      {
        key: "data_gathering",
        label: "Data Gathering Methods",
        hint: "Observations, interviews, focus groups",
        help: "The main data gathering methods in case studies are: Observations; interviews and focus groups. Which Data Gathering methods are you going to use?",
      },
      {
        key: "other_documents",
        label: "Other Documents to be analyzed",
        hint: "Photos, videos, journals, artifacts…",
        help: "In addition to the data gathering methods you will implement, which other documents could help you to better understand the case under study? i.e. Photos, videos, journals, artifacts created by the informants, etc.",
      },
      {
        key: "strategies",
        label: "Case Study Strategies",
        hint: "Progressive focus, thick descriptions, trustworthiness",
        help: "In case studies we should pay attention to: The progressive-in-focus nature of a case study design; the need to incorporate \"Thick Descriptions\" of the case, participants and particular activities studied, as well as at the strategies we will use to ensure the trustworthiness of our data. In the following article (https://tinyurl.com/tu45usts) you will find a thorough description of the main strategies we can implement to guarantee a trustworthy study.",
      },
      {
        key: "minicases",
        label: "Minicases",
        hint: "Special aspects that illuminate the case",
        help: "Minicases are particular aspects of special importance that help the understanding of the complexity of the case. (i.e. a particular teacher, a special activity, a professional development program, etc). Minicases could become cases if we would focus our entire attention on them. For the case we are using as an example in this form (Residency based policy at Marietta School District), we could pay special attention to one school principal who is against the current policy since she believes that it perpetuates inequities among schools, depending on the economical level of families living close to each school.",
      },
      {
        key: "process_support",
        label: "Process Support",
        hint: "People, tools or resources helping your study",
        help: "Are you using any individual, tool, or resource to help you conduct your study? i.e. Data analysis software.",
      },
    ],
    layout: {
      designName: "Case Study",
      contextTitle: "Context of your Case",
      centerColor: "#FF9900",
      centerLabelColor: "#5C3300",
      contextMarkers: true,
      hasMinicases: true,
      labels: {
        informants: "Informants",
        other_documents: "Other Documents",
        data_gathering: "Data Gathering Methods",
        central_item: "CASE",
        strategies: "Strategies",
        process_support: "Process Support",
        question: "Issues",
      },
    },
  },
  action_research: {
    designName: "Action Research Study",
    intro: "Answer the questions below to build the one-page visual design of your action research study. Everything you write appears in the diagram on the right - and you can click any text in the diagram to edit it directly.",
    fields: [
      {
        key: "central_item",
        label: "Aspect to reflect upon and improve",
        hint: "The part of your own practice you want to improve",
        help: "The main particularity of Action Research is that the researcher conducts a deep study of his/her own practice. This research tradition helps to find answers to practical issues found in daily practices. i.e. a teacher wants to study the implementation of an innovation in one of the classes she is teaching. Which is the aspect from your practice that you want to improve?",
      },
      {
        key: "context",
        label: "Context",
        hint: "Where will your study be conducted?",
        help: "Which is the context in which your study will be conducted? i.e. The study will be conducted in my social sciences class when implementing a new strategy to promote collaborative learning.",
      },
      {
        key: "question",
        label: "Practical Question",
        hint: "Focused on improving your daily practice",
        help: "Practical questions should be focused on the aspect you want to analyze and improve with regard to your own daily practice. They could be seen as particular tensions under scrutiny, that will help you drive the whole study. i.e. How do my students' concerns change over the course of their participation throughout the innovation implementation? Which are the practical questions driving your action research study?",
      },
      {
        key: "topics",
        label: "Topics",
        hint: "Areas of interest that narrow down your question",
        help: "Which are the particular areas of interest in which you will narrow down the complexity of the practical question driving the study? For the issue proposed in the previous question (Does the policy to base school placement on residency and past attendance perpetuate inequity?) we could define the following topics: Roots of the policy; advantages for the families; commodity vs. inequity; etc.",
        placeholder: "One topic per line",
      },
      {
        key: "informants",
        label: "Informants",
        hint: "Who will help you understand what to improve?",
        help: "Which are the informants from which you will get a better understanding of the aspect upon reflection or the one you want to improve/change?",
      },
      {
        key: "data_gathering",
        label: "Data Gathering Methods",
        hint: "Self-reflective journal, observations, interviews",
        help: "The main data gathering methods in action research studies are: Self-reflective journal, observations, interviews and focus groups. Which Data Gathering methods are you going to use?",
      },
      {
        key: "other_documents",
        label: "Other Documents to be analyzed",
        hint: "Photos, videos, journals, artifacts…",
        help: "In addition to the data gathering methods you will implement, which other documents could help you to better understand the aspect you are reflecting upon or want to improve? i.e. Photos, videos, journals, artifacts created by the informants, etc.",
      },
      {
        key: "strategies",
        label: "Action Research Strategies (Cycles)",
        hint: "Plan, Act & Observe, Reflect - how many cycles?",
        help: "Action research is cyclical, so it is important to define the different cycles that will conform our study. A commonly known cycle is the one proposed by Kemmis & McTaggart (1988) (see image below). The steps proposed in the action research spiral are: Plan; Act & Observe, and; Reflect. How many cycles are you planning? Do you already know what you would do in each of the steps for each cycle?",
        helpImage: "/kemmis-mctaggart-spiral.png",
        helpImageAlt: "Kemmis & McTaggart action research spiral: Plan, Act & Observe, Reflect, Revised Plan",
      },
      {
        key: "minicases",
        label: "Minicases",
        hint: "Special aspects that illuminate your study",
        help: "Minicases are particular aspects of special importance that help the understanding of the complexity of your study. (i.e. a particular teacher, a special activity, a professional development program, etc).",
      },
      {
        key: "process_support",
        label: "Process Support",
        hint: "People, tools or resources helping your study",
        help: "Are you using any individual, tool, or resource to help you conduct your study? i.e. Data analysis software.",
      },
    ],
    layout: {
      designName: "Action Research",
      contextTitle: "Context of your A-R",
      centerColor: "#FFD966",
      centerLabelColor: "#5C4A00",
      contextMarkers: true,
      hasMinicases: true,
      labels: {
        informants: "Informants",
        other_documents: "Other Documents",
        data_gathering: "Data Gathering Methods",
        central_item: "Aspect to reflect upon and improve",
        strategies: "Cycles",
        process_support: "Process Support",
        question: "Practical Question",
      },
    },
  },
  phenomenography: {
    designName: "Phenomenographic Study",
    intro: "Answer the questions below to build the one-page visual design of your phenomenographic study. Everything you write appears in the diagram on the right - and you can click any text in the diagram to edit it directly.",
    fields: [
      {
        key: "central_item",
        label: "Phenomenon Under Study",
        hint: "The phenomenon whose different understandings you will map",
        help: "Phenomenography denotes a research tradition aiming at describing the different ways a group of people understand a phenomenon (Marton, 1981), whereas phenomenology aims to clarify the structure and meaning of a phenomenon (Giorgi, 1999). This research tradition aims at identifying and interrogating the range of different ways in which people perceive or experience specific phenomena (typically learning, teaching or aspects thereof).",
      },
      {
        key: "context",
        label: "Context",
        hint: "The roots and setting of the phenomenon",
        help: "Which is the context of your phenomenographic study? We researchers need to deepen in the roots of the phenomenon driving our study, since it is the only way to be able to understand its origins.",
      },
      {
        key: "question",
        label: "Phenomenographic Questions",
        hint: "How do people understand the phenomenon differently?",
        help: "Phenomenographic questions are those that ask about the different ways a group of people understand a phenomenon. You should ask questions like: How do in-service teachers perceive the quality of their training?, instead of questions like: What is the best method of training teachers?",
      },
      {
        key: "topics",
        label: "Topics",
        hint: "Areas of interest that narrow down the phenomenon",
        help: "Which are the particular areas of interest in which you will narrow down the complexity of the phenomenon driving the study?",
        placeholder: "One topic per line",
      },
      {
        key: "informants",
        label: "Informants",
        hint: "10-12 people who experienced the phenomenon",
        help: "Which are the informants from which you will get a better understanding of the phenomenon under study? In Phenomenography we use to conduct in-depth interviews of no more than 10-12 individuals who have experienced the phenomenon under study. A phenomenographic study describes the multiple meanings several individuals have of their lived experiences of a concept of a phenomenon.",
      },
      {
        key: "data_gathering",
        label: "Data Gathering Methods",
        hint: "In-depth interviews are the main method",
        help: "Which Data Gathering methods are you going to use? The main data gathering method in phenomenography is interviewing. In the following link you will find an interesting article on how to design and conduct interviews in phenomenography: goo.gl/nWPsRR",
      },
      {
        key: "other_documents",
        label: "Other Documents to be analyzed",
        hint: "Photos, videos, journals, artifacts…",
        help: "In addition to the data gathering methods you will implement, which other documents could help you to better understand the case under study? i.e. Photos, videos, journals, artifacts created by the informants, etc.",
      },
      {
        key: "strategies",
        label: "Phenomenographic Strategies",
        hint: "The six analysis steps, ending in the outcome space",
        help: "One key aspect of phenomenography has to do with the process of analyzing the data gathered. The main steps are: Step 1. Familiarisation step: the transcripts will be read several times in order to become familiar with their contents. This step will correct any mistakes within the transcript. Step 2. Compilation step: The second step will require a more focused reading in order to deduce similarities and differences from the transcripts. The primary aim of this step is to compile the answers to the certain questions that have been asked during interviews. Through this process, the researcher will identify the most valued elements in answers. Step 3. Condensation step: This process will select extracts that seem to be relevant and meaningful for this study. The main aim of this step is to sift through and omit the irrelevant, redundant or unnecessary components within the transcript and consequently decipher the central elements of the participants' answers. Step 4. Preliminary grouping step: the fourth step will focus on locating and classifying similar answers into the preliminary groups. This preliminary group will be reviewed again to check whether any other groups show the same meaning under different headings. Thus, the analysis will present an initial list of categories of descriptions. Step 5. Preliminary comparison of categories: this step will involve the revisions of the initial list of categories to bring forth a comparison among the preliminary listed categories. The main aim of this step is to set up boundaries among the categories. Before going through to the next step, the transcripts will be read again to check whether the preliminary established categories represent the accurate experience of the participants. Step 6. Final outcome space: in the last step, the researcher hopes to discover the final outcome space based on their internal relationships and qualitatively different ways of understanding the particular phenomena. The phenomenographic outcome space describes the different ways in which a phenomenon is experienced in a cohort. It also describes the different ways in which a researcher has interpreted how a phenomenon is experienced in a cohort. (Gonzalez, 2010).",
      },
      {
        key: "process_support",
        label: "Process Support",
        hint: "People, tools or resources helping your study",
        help: "Are you using any individual, tool, or resource to help you conduct your study? i.e. Data analysis software.",
      },
    ],
    layout: {
      designName: "Phenomenography",
      contextTitle: "Context of your Phenomenographic Study",
      centerColor: "#0B5394",
      centerLabelColor: "#FFFFFF",
      centerDark: true,
      labels: {
        informants: "Informants",
        other_documents: "Other Documents",
        data_gathering: "Data Gathering Methods",
        central_item: "Phenomenon",
        strategies: "Strategies",
        process_support: "Process Support",
        question: "Questions",
      },
    },
  },
  descriptive: {
    designName: "Descriptive Non-experimental Study",
    intro: "Answer the questions below to build the one-page visual design of your descriptive non-experimental study. Everything you write appears in the diagram on the right - and you can click any text in the diagram to edit it directly.",
    fields: [
      {
        key: "central_item",
        label: "Phenomenon under study",
        hint: "What will you describe?",
        help: "Describe briefly the phenomenon you will study. For example: Usage of mobile phones by teenagers.",
      },
      {
        key: "study_type",
        label: "Type of study",
        hint: "Survey design or Observational design",
        help: "Non-experimental designs are those in which there is no manipulation of the independent variable as they study situations or phenomena that have already happened and, therefore, the variables are studied as they have been manifested in reality. There are two fundamental types of non-experimental descriptive designs: a) Survey designs, and; b) Observational designs. a) The main objective of the survey designs is to describe features or characteristics of a group or population through the answers issued by the participants to a questionnaire or interview administered by the researcher. They seek to collect information referring to the entire population and in cases where this is not possible, a sample that represents it is selected. The main instruments in this type of design are the questionnaires and the structured or semi-structured interview. b) In observational studies, systematic observation and measurement of what is observed constitute its main foundation.",
        placeholder: "Survey design / Observational design",
      },
      {
        key: "variables",
        label: "Variables",
        hint: "What characteristics will you analyze?",
        help: "Variables in non-experimental descriptive studies are usually related to: a) sociodemographic characteristics of the participants, such as gender, profession, age, etc., and b) attitudes, opinions, perceptions, behaviors, habits, experiences or other characteristics. Describe below the variables that you will analyze in your study.",
      },
      {
        key: "question",
        label: "Research Question",
        hint: "The question driving your study",
        help: "Please include below the research question driving your study.",
      },
      {
        key: "sample",
        label: "Sample",
        hint: "Who will participate, and how are they selected?",
        help: "The objective of this type of design is to analyze the distribution of a given variable - for example, the opinion of Spanish teenagers about the use of mobile phones. When it is not possible to include the entire population in the study, it is vital to select a significant sample through the probabilistic sampling procedures that allow to represent the population from which it was extracted and thus generalize the results (See: https://tinyurl.com/y9lsc463). Describe below the sample that will be used in the study, as well as the probabilistic sampling method to be used.",
      },
      {
        key: "groups",
        label: "# of Groups",
        hint: "1 group, 2 groups, or cases",
        help: "How many groups will your study involve? In descriptive non-experimental designs this is usually: 1 group; 2 groups, or; Cases.",
        placeholder: "1 group / 2 groups / Cases",
      },
      {
        key: "data_gathering",
        label: "Data Gathering",
        hint: "Questionnaire, observation, Likert scale, interviews…",
        help: "Which data gathering instruments will you use? The main options in descriptive non-experimental studies are: Questionnaire; Observation; Likert scale; Structured Interview; Semi-structured Interview; Control list, or others.",
      },
      {
        key: "data_analysis",
        label: "Data Analysis",
        hint: "Descriptive statistics",
        help: "How will you analyze the data? In descriptive non-experimental designs the analysis relies on Descriptive Statistics (frequencies, percentages, means, standard deviations, etc.).",
      },
      {
        key: "process_support",
        label: "Process Support",
        hint: "Statistical packages, questionnaire tools…",
        help: "Include in this section any strategy, tool or technology that will be of help to support the study. You might include the use of statistical packages such as SPSS, the use of tools for the generation of questionnaires, or the use of tools for the management of observations.",
      },
    ],
    layout: {
      kind: "pentagon",
      designName: "Descriptive Non-experimental",
      titleName: "Descriptive non-experimental",
      sliders: { variance: 0.06, causality: 0.06, ivControl: 0.05 },
      fixed: {
        type: "Exploratory/Descriptive",
        groups: "No control group",
        representativeness: "Desirable",
      },
    },
  },
  correlational: {
    designName: "Correlational Non-experimental Study",
    intro: "Answer the questions below to build the one-page visual design of your correlational study. Everything you write appears in the diagram on the right - and you can click any text in the diagram to edit it directly.",
    fields: [
      {
        key: "central_item",
        label: "Phenomenon under study",
        hint: "The phenomenon whose variables you will relate",
        help: "Describe briefly the phenomenon you will study - the situation in which you will analyze how two or more variables relate to each other.",
      },
      {
        key: "study_type",
        label: "Type of correlational study",
        hint: "Predictive or Explanatory",
        help: "Non-experimental designs are those in which there is no manipulation of the independent variable, as they study situations or phenomena that have already happened and, therefore, the variables are studied as they have been manifested in reality. The non-experimental correlational studies have the purpose of knowing the relation or degree of association that exists between two or more concepts, categories or variables in a particular context. Sometimes only the relationship between two variables is analyzed, but often relationships between three, four or more variables are included in the study. Correlational studies, when evaluating the degree of association between two or more variables, measure each of them (presumably related) and then quantify and analyze the linkage. Such correlations are based on hypotheses. The main utility of correlational studies is to know how a concept or a variable can behave when knowing the behavior of other linked variables. There are two fundamental types of correlational study: Predictive and explanatory. In explanatory designs, we intend to analyze the possible relationships between the variables studied. For its part, a predictive design is based on predicting the future evolution of the phenomenon studied, and thus predicting the possible future behavior of a situation based on the relationships between the study variables.",
        placeholder: "Predictive Correlational Design / Explanatory Correlational Design",
      },
      {
        key: "variables",
        label: "Variables",
        hint: "The variables whose relationship you will analyze",
        help: "Please describe below the variables that will be considered in your study.",
      },
      {
        key: "question",
        label: "Research Question",
        hint: "A question about how variables relate",
        help: "Correlational studies aim to answer research questions such as the following: Does the patient's self-esteem increase as a specific therapy passes? Does a greater variety and autonomy at work correspond to more intrinsic motivation regarding work tasks? Do farmers who adopt an innovation more quickly possess greater cosmopolitanism than the farmers who adopt it later? Does the physical distance between couples have a negative relationship with the satisfaction in the relationship? Include below the research question that will guide your study.",
      },
      {
        key: "sample",
        label: "Sample",
        hint: "Who will participate, and how are they selected?",
        help: "When it is not possible to include the entire population in the study, it is vital to select a significant sample through probabilistic sampling procedures that allow representing the population under study and thus generalize the results (See: https://tinyurl.com/ycjyf6ty). Describe below the sample that will be used in the study, as well as the probabilistic sampling technique to be used.",
      },
      {
        key: "groups",
        label: "# of Groups",
        hint: "1, 2, 3 groups of study, or other",
        help: "How many groups of study will your correlational design involve? Usually: 1 group of study; 2 groups of study; 3 groups of study, or another arrangement.",
        placeholder: "1 group / 2 groups / 3 groups",
      },
      {
        key: "data_gathering",
        label: "Data Gathering",
        hint: "Questionnaire, Likert scale…",
        help: "Which data gathering instruments will you use? The main options in correlational studies are: Questionnaire; Likert Scale, or others.",
      },
      {
        key: "data_analysis",
        label: "Data Analysis",
        hint: "Correlation, regression, path analysis…",
        help: "How will you analyze the data? The main options in correlational studies are: Path Analysis; Pearson correlation coefficient; Bivariate analysis; Multivariate analysis; Linear Regression; Multiple Regression, or others.",
      },
      {
        key: "process_support",
        label: "Process Support",
        hint: "Statistical packages, questionnaire tools…",
        help: "Include in this section any strategy, tool or technology that will be of help to support the study. You might include the use of statistical packages such as SPSS, the use of tools for the generation of questionnaires, or the use of tools for the management of observations.",
      },
    ],
    layout: {
      kind: "pentagon",
      designName: "Correlational Non-experimental",
      titleName: "Correlational non-experimental",
      sliders: { variance: 0.2, causality: 0.28, ivControl: 0.05 },
      fixed: {
        type: "Correlational",
        groups: "No control group",
        representativeness: "Desirable",
      },
    },
  },
  quasi_experimental: {
    designName: "Quasi-experimental Study",
    intro: "Answer the questions below to build the one-page visual design of your quasi-experimental study. Everything you write appears in the diagram on the right - and you can click any text in the diagram to edit it directly.",
    fields: [
      {
        key: "central_item",
        label: "Phenomenon under study",
        hint: "The situation where you will test your intervention",
        help: "Describe briefly the phenomenon you will study. In quasi-experimental designs this is usually a situation in which you introduce an intervention or treatment and want to know its effect. i.e. The effect of a new collaborative learning strategy on students' achievement in two existing science classes.",
      },
      {
        key: "study_type",
        label: "Type of quasi-experimental design",
        hint: "Nonequivalent control group, pretest-posttest, time series…",
        help: "Quasi-experimental designs manipulate the independent variable, but participants are NOT assigned to groups at random: the researcher works with groups that already exist naturally (i.e. two intact classrooms). The most common types are: a) Nonequivalent control group design, where an existing group receives the treatment and a similar existing group serves as control; b) Pretest-posttest designs, where both groups are measured before and after the intervention, and; c) Interrupted time-series designs, where one group is measured repeatedly before and after the intervention. Which type will your study follow?",
        placeholder: "Nonequivalent control group / Pretest-posttest / Interrupted time series",
      },
      {
        key: "variables",
        label: "Hypothesis: Variables (IV → DV)",
        hint: "A causal hypothesis: the IV influences the DV",
        help: "In quasi-experimental studies the hypothesis is causal: you predict that the independent variable (IV - the treatment or intervention you manipulate) will produce an effect on the dependent variable (DV - the outcome you measure). Describe below your independent and dependent variables, and the causal hypothesis linking them. i.e. IV: use of a collaborative learning strategy; DV: science achievement scores.",
      },
      {
        key: "question",
        label: "Research Question",
        hint: "Which is the influence of the IV in the DV?",
        help: "Quasi-experimental questions ask about the influence of an independent variable on a dependent variable. i.e. Which is the influence of a collaborative learning strategy on the science achievement of middle school students? Include below the research question that will guide your study.",
      },
      {
        key: "sample",
        label: "Sample",
        hint: "Natural, intact groups - not assigned at random",
        help: "The defining feature of quasi-experimental designs is that the sample is NOT selected or assigned at random: you work with natural groups that already exist, such as two intact classrooms, two schools, or two work teams. Describe below the groups that will take part in your study, which one will receive the treatment, and which one will serve as control.",
      },
      {
        key: "groups",
        label: "# of Groups",
        hint: "2 or more groups (treatment & control)",
        help: "Quasi-experimental designs involve 2 or more groups: at least one treatment group that receives the intervention and one control group that does not. How many groups will your study involve, and what will each one receive?",
        placeholder: "2 or + groups",
      },
      {
        key: "data_gathering",
        label: "Data Gathering",
        hint: "Surveys, scales, tests",
        help: "Which data gathering instruments will you use? The main options in quasi-experimental studies are: Surveys; Scales (i.e. Likert scales measuring the dependent variable), and achievement or performance tests applied before and/or after the intervention.",
      },
      {
        key: "data_analysis",
        label: "Data Analysis",
        hint: "Depends on the # of IV and DV, and the relation between groups",
        help: "How will you analyze the data? In quasi-experimental studies the analysis depends on the number of independent and dependent variables and the relation between the groups. Common options are: t-tests to compare two groups; ANOVA for more than two groups; ANCOVA to control for pretest differences between the natural groups, and; repeated-measures analyses for pretest-posttest designs.",
      },
      {
        key: "process_support",
        label: "Process Support",
        hint: "SPSS, web-based survey tools, EZAnalyze…",
        help: "Include in this section any strategy, tool or technology that will be of help to support the study. You might include the use of statistical packages such as SPSS or EZAnalyze, and the use of web-based survey tools for the generation and administration of questionnaires.",
      },
    ],
    layout: {
      kind: "pentagon",
      designName: "Quasi-experimental",
      titleName: "Quasi-experimental",
      sliders: { variance: 0.65, causality: 0.65, ivControl: 0.7 },
      fixed: {
        type: "Explanatory",
        groups: "Treatment & control group",
        representativeness: "Natural groups",
      },
    },
  },
  experimental: {
    designName: "Experimental Study",
    intro: "Answer the questions below to build the one-page visual design of your experimental study. Everything you write appears in the diagram on the right - and you can click any text in the diagram to edit it directly.",
    fields: [
      {
        key: "central_item",
        label: "Phenomenon under study",
        hint: "The situation where you will test your intervention",
        help: "Describe briefly the phenomenon you will study. In experimental designs this is a situation in which you introduce an intervention or treatment under controlled conditions and measure its effect. i.e. The effect of a new vocabulary learning app on the retention of foreign language words.",
      },
      {
        key: "study_type",
        label: "Type of experimental design",
        hint: "Pretest-posttest, posttest-only, Solomon, factorial…",
        help: "Experimental designs manipulate the independent variable AND assign participants to groups at random - this random assignment is what makes them true experiments, since it makes the groups equivalent before the treatment. The most common types are: a) Pretest-posttest control group design, where both groups are measured before and after the treatment; b) Posttest-only control group design, where groups are only measured after the treatment; c) Solomon four-group design, which combines the previous two to control for pretest effects, and; d) Factorial designs, which study two or more independent variables at the same time. Which type will your study follow?",
        placeholder: "Pretest-posttest / Posttest-only / Solomon four-group / Factorial",
      },
      {
        key: "variables",
        label: "Hypothesis: Variables (IV → DV)",
        hint: "A causal hypothesis: the IV produces an effect on the DV",
        help: "In experimental studies the hypothesis is causal: you predict that the independent variable (IV - the treatment you manipulate) will produce an effect on the dependent variable (DV - the outcome you measure). Describe below your independent and dependent variables, and the causal hypothesis linking them. i.e. IV: use of the vocabulary app (app vs. traditional flashcards); DV: number of words retained after two weeks.",
      },
      {
        key: "question",
        label: "Research Question",
        hint: "What effect does the IV have in the DV?",
        help: "Experimental questions ask about the effect of the independent variable on the dependent variable. i.e. What effect does the use of a vocabulary learning app have on the retention of foreign language words? Include below the research question that will guide your study.",
      },
      {
        key: "sample",
        label: "Sample",
        hint: "Groups assigned at random",
        help: "The defining feature of experimental designs is that participants are assigned to the treatment and control groups AT RANDOM. Random assignment makes the groups statistically equivalent before the treatment, so any difference measured afterwards can be attributed to the treatment itself. Describe below your participants, how they will be recruited, and how they will be randomly assigned to the groups.",
      },
      {
        key: "groups",
        label: "# of Groups",
        hint: "2 or more groups (treatment & control)",
        help: "Experimental designs involve 2 or more groups: at least one treatment group that receives the intervention and one control group that does not. Factorial and Solomon designs involve more. How many groups will your study involve, and what will each one receive?",
        placeholder: "2 or + groups",
      },
      {
        key: "data_gathering",
        label: "Data Gathering",
        hint: "Surveys, scales, tests",
        help: "Which data gathering instruments will you use? The main options in experimental studies are: Surveys; Scales (i.e. Likert scales measuring the dependent variable), and achievement or performance tests applied before and/or after the treatment.",
      },
      {
        key: "data_analysis",
        label: "Data Analysis",
        hint: "Depends on the # of IVs and DVs, and the relation between groups",
        help: "How will you analyze the data? In experimental studies the analysis depends on the number of independent and dependent variables and the relation between the groups. Common options are: t-tests to compare two groups; ANOVA for more than two groups or factorial designs; MANOVA when there are several dependent variables, and; repeated-measures analyses for pretest-posttest designs.",
      },
      {
        key: "process_support",
        label: "Process Support",
        hint: "SPSS, web-based survey tools, EZAnalyze…",
        help: "Include in this section any strategy, tool or technology that will be of help to support the study. You might include the use of statistical packages such as SPSS or EZAnalyze, and the use of web-based survey tools for the generation and administration of questionnaires.",
      },
    ],
    layout: {
      kind: "pentagon",
      designName: "Experimental",
      titleName: "Experimental",
      sliders: { variance: 0.93, causality: 0.93, ivControl: 0.93 },
      fixed: {
        type: "Explanatory",
        groups: "Treatment & control group",
        representativeness: "Natural groups",
      },
    },
  },
  convergent_parallel: {
    designName: "Convergent Parallel Mixed Methods",
    intro: "In a convergent parallel design you run a qualitative and a quantitative study of the same phenomenon at the same time, and merge the results in interpretation. Fill in both strands below - each appears in its side of the diagram.",
    fields: [
      {
        key: "research_topic",
        section: "Your Study",
        label: "Research topic",
        hint: "The topic of your whole mixed methods study",
        help: "State the topic of your mixed methods study - the shared focus that both the qualitative and quantitative strands will illuminate from their own angles.",
      },
      {
        key: "central_item",
        label: "Phenomenon under study",
        hint: "Shared by both strands",
        help: "Describe briefly the phenomenon you will study. In a convergent parallel design BOTH strands study the same phenomenon at the same time: the quantitative strand measures it, and the qualitative strand explores how people experience it. The results are then compared and combined in interpretation.",
      },
      {
        key: "qual_tradition",
        section: "Qualitative Strand",
        label: "Type of qualitative research tradition",
        hint: "Narrative, case study, phenomenology…",
        help: "Which qualitative tradition will this strand follow? i.e. Narrative, Case Study, Phenomenology, Ethnography, Grounded Theory.",
        placeholder: "Narrative / Case Study / Phenomenology / Ethnography / Grounded Theory",
      },
      {
        key: "context",
        label: "Context of the Study",
        hint: "Where the qualitative strand will be conducted",
        help: "Which is the context in which the qualitative strand of your study will be conducted? i.e. The study will be conducted at my school which has the following characteristics: (description of the setting).",
      },
      {
        key: "qual_question",
        label: "Qualitative Research Question",
        hint: "The question driving the qualitative strand",
        help: "Which is the qualitative research question driving this strand of your study? It should focus on understanding how the people involved experience the phenomenon.",
      },
      {
        key: "question",
        label: "Issues",
        hint: "The particular tensions under scrutiny",
        help: "Which are the issues - the particular matters of contention - that the qualitative strand will pay attention to?",
      },
      {
        key: "topics",
        label: "Topics",
        hint: "Areas that narrow down the qualitative question",
        help: "Which are the particular areas of interest in which you will narrow down the complexity of the issue driving the qualitative strand?",
        placeholder: "One topic per line",
      },
      {
        key: "informants",
        label: "Informants",
        hint: "Who will you learn from?",
        help: "Which are the informants from which you will get a better understanding of the phenomenon under analysis?",
      },
      {
        key: "data_gathering",
        label: "Data Gathering Methods (qualitative)",
        hint: "Interviews, observations, journals…",
        help: "Which qualitative data gathering methods are you going to use? i.e. interviews, observations, journals, focus groups.",
      },
      {
        key: "other_documents",
        label: "Other Documents to be analyzed",
        hint: "Photos, videos, journals, artifacts…",
        help: "In addition to the data gathering methods you will implement, which other documents could help you to better understand the phenomenon under study? i.e. Photos, videos, journals, artifacts created by the informants, etc.",
      },
      {
        key: "strategies",
        label: "Strategies (qualitative)",
        hint: "Strategies of your qualitative tradition",
        help: "Which are the strategies you will follow in the qualitative strand? These depend on the tradition you draw from - i.e. thick descriptions, prolonged engagement, restorying, constant comparison.",
      },
      {
        key: "process_support",
        label: "Process Support (qualitative)",
        hint: "People, tools or resources for this strand",
        help: "Are you using any individual, tool, or resource to help you conduct the qualitative strand? i.e. Qualitative data analysis software.",
      },
      {
        key: "variables",
        section: "Quantitative Strand",
        label: "Variables",
        hint: "The variables the quantitative strand will measure",
        help: "Describe the variables that will be measured in the quantitative strand of your study.",
      },
      {
        key: "hypothesis",
        label: "Hypothesis",
        hint: "What you predict the quantitative strand will find",
        help: "State the hypothesis of the quantitative strand - what you predict the data will show about the relationship between your variables.",
      },
      {
        key: "mm_question",
        label: "Quantitative Research Question",
        hint: "The question driving the quantitative strand",
        help: "Include the research question driving the quantitative strand - usually about the distribution of the variables or the relationships between them.",
      },
      {
        key: "sample",
        label: "Sample",
        hint: "Who participates in the quantitative strand?",
        help: "Describe the sample that will be used in the quantitative strand, as well as the sampling method to be used. A representative sample lets you generalize the quantitative results.",
      },
      {
        key: "groups",
        label: "# of Groups",
        hint: "How many groups?",
        help: "How many groups will the quantitative strand involve?",
        placeholder: "1 group / 2 groups",
      },
      {
        key: "mm_data_gathering",
        label: "Data Gathering (quantitative)",
        hint: "Questionnaires, scales, tests…",
        help: "Which quantitative data gathering instruments will you use? i.e. Questionnaires, Likert scales, structured observation, tests.",
      },
      {
        key: "data_analysis",
        label: "Data Analysis",
        hint: "Statistics for the quantitative strand",
        help: "How will you analyze the quantitative data? i.e. Descriptive statistics, correlations, group comparisons.",
      },
      {
        key: "mm_process_support",
        label: "Process Support (quantitative)",
        hint: "SPSS, survey tools…",
        help: "Are you using any strategy, tool or technology to support the quantitative strand? i.e. Statistical packages such as SPSS, or tools for the generation of questionnaires.",
      },
    ],
    layout: {
      kind: "mixed",
      designName: "Convergent Parallel Mixed Methods",
      titleText: "Convergent / Parallel Mixed Methods Research Design on:",
    },
  },
  explanatory_sequential: {
    designName: "Explanatory Sequential Mixed Methods",
    intro: "In an explanatory sequential design you run the quantitative study FIRST (Phase I) - the numbers show what is happening - and then a qualitative study (Phase II) explains why. The quantitative results inform who you talk to and what you ask about in the qualitative phase.",
    fields: [
      {
        key: "research_topic",
        section: "Your Study",
        label: "Research topic",
        hint: "The topic of your whole mixed methods study",
        help: "State the topic of your mixed methods study - the shared focus that Phase I will measure and Phase II will explain.",
      },
      {
        key: "central_item",
        label: "Phenomenon under study",
        hint: "Shared by both phases",
        help: "Describe briefly the phenomenon you will study. In an explanatory sequential design the quantitative phase measures the phenomenon first, and the qualitative phase then explains the results in depth.",
      },
      {
        key: "study_type",
        section: "Phase I - Quantitative Strand",
        label: "Type of quantitative research design",
        hint: "Descriptive, correlational, quasi-experimental…",
        help: "Which quantitative design will Phase I follow? i.e. Descriptive non-experimental, correlational, quasi-experimental or experimental.",
        placeholder: "Descriptive / Correlational / Quasi-experimental / Experimental",
      },
      {
        key: "variables",
        label: "Hypothesis: Variables",
        hint: "The variables Phase I will measure",
        help: "Describe the variables that will be measured in the quantitative phase, and the hypothesis relating them if you have one.",
      },
      {
        key: "hypothesis",
        label: "Hypothesis",
        hint: "What you predict Phase I will find",
        help: "State the hypothesis of the quantitative phase - what you predict the data will show about the relationship between your variables.",
      },
      {
        key: "mm_question",
        label: "Quantitative Research Question",
        hint: "The question driving Phase I",
        help: "Include the research question driving the quantitative phase - usually about the distribution of the variables or the relationships between them.",
      },
      {
        key: "sample",
        label: "Sample",
        hint: "Who participates in Phase I?",
        help: "Describe the sample that will be used in the quantitative phase, as well as the sampling method to be used.",
      },
      {
        key: "groups",
        label: "# of Groups",
        hint: "How many groups?",
        help: "How many groups will the quantitative phase involve?",
        placeholder: "1 group / 2 groups",
      },
      {
        key: "mm_data_gathering",
        label: "Data Gathering (quantitative)",
        hint: "Questionnaires, scales, tests…",
        help: "Which quantitative data gathering instruments will you use in Phase I? i.e. Questionnaires, Likert scales, structured observation, tests.",
      },
      {
        key: "data_analysis",
        label: "Data Analysis",
        hint: "Statistics for Phase I",
        help: "How will you analyze the quantitative data? i.e. Descriptive statistics, correlations, group comparisons. The results of this analysis decide what Phase II needs to explain.",
      },
      {
        key: "mm_process_support",
        label: "Process Support (quantitative)",
        hint: "SPSS, survey tools…",
        help: "Are you using any strategy, tool or technology to support the quantitative phase? i.e. Statistical packages such as SPSS, or tools for the generation of questionnaires.",
      },
      {
        key: "qual_tradition",
        section: "Phase II - Qualitative Strand",
        label: "Type of qualitative research tradition",
        hint: "Narrative, case study, phenomenology…",
        help: "Which qualitative tradition will Phase II follow? i.e. Narrative, Case Study, Phenomenology, Ethnography, Grounded Theory.",
        placeholder: "Narrative / Case Study / Phenomenology / Ethnography / Grounded Theory",
      },
      {
        key: "context",
        label: "Context of the Study",
        hint: "Where the qualitative phase will be conducted",
        help: "Which is the context in which the qualitative phase of your study will be conducted?",
      },
      {
        key: "qual_question",
        label: "Qualitative Research Question",
        hint: "What do the quantitative results need explained?",
        help: "Which is the qualitative research question driving Phase II? In an explanatory sequential design it should focus on EXPLAINING the quantitative results - i.e. why did the groups differ? What is behind the pattern the numbers showed?",
      },
      {
        key: "question",
        label: "Issues",
        hint: "The particular tensions under scrutiny",
        help: "Which are the issues - the particular matters of contention - that the qualitative phase will pay attention to while explaining the quantitative results?",
      },
      {
        key: "topics",
        label: "Topics",
        hint: "Areas that narrow down the qualitative question",
        help: "Which are the particular areas of interest in which you will narrow down the complexity of the issue driving the qualitative phase? These often come directly from the most surprising or important quantitative results.",
        placeholder: "One topic per line",
      },
      {
        key: "informants",
        label: "Informants",
        hint: "Often selected FROM the Phase I participants",
        help: "Which are the informants from which you will get a better understanding of the quantitative results? In explanatory sequential designs informants are usually selected from the Phase I participants - i.e. people whose answers were typical, extreme, or surprising.",
      },
      {
        key: "data_gathering",
        label: "Data Gathering Methods (qualitative)",
        hint: "Interviews, focus groups…",
        help: "Which qualitative data gathering methods are you going to use in Phase II? i.e. interviews, focus groups, observations.",
      },
      {
        key: "other_documents",
        label: "Other Documents to be analyzed",
        hint: "Photos, videos, journals, artifacts…",
        help: "In addition to the data gathering methods you will implement, which other documents could help you to better understand the phenomenon under study?",
      },
      {
        key: "strategies",
        label: "Strategies (qualitative)",
        hint: "Strategies of your qualitative tradition",
        help: "Which are the strategies you will follow in the qualitative phase? i.e. thick descriptions, member checking, constant comparison.",
      },
      {
        key: "process_support",
        label: "Process Support (qualitative)",
        hint: "People, tools or resources for this phase",
        help: "Are you using any individual, tool, or resource to help you conduct the qualitative phase? i.e. Qualitative data analysis software.",
      },
    ],
    layout: {
      kind: "mixed",
      variant: "explanatory",
      designName: "Explanatory Sequential Mixed Methods",
      titleText: "Explanatory Sequential Mixed Methods Research Design on:",
    },
  },
  exploratory_sequential: {
    designName: "Exploratory Sequential Mixed Methods",
    intro: "In an exploratory sequential design you run the qualitative study FIRST (Phase I) to explore the phenomenon, and then a quantitative study (Phase II) tests what you found at scale. The qualitative findings inform the variables and instruments of the quantitative phase.",
    fields: [
      {
        key: "research_topic",
        section: "Your Study",
        label: "Research topic",
        hint: "The topic of your whole mixed methods study",
        help: "State the topic of your mixed methods study - the shared focus that Phase I will explore and Phase II will measure.",
      },
      {
        key: "central_item",
        label: "Phenomenon under study",
        hint: "Shared by both phases",
        help: "Describe briefly the phenomenon you will study. In an exploratory sequential design the qualitative phase explores the phenomenon first, and the quantitative phase then tests the findings with a larger sample.",
      },
      {
        key: "qual_tradition",
        section: "Phase I - Qualitative Strand",
        label: "Type of qualitative research tradition",
        hint: "Narrative, case study, phenomenology…",
        help: "Which qualitative tradition will Phase I follow? i.e. Narrative, Case Study, Phenomenology, Ethnography, Grounded Theory.",
        placeholder: "Narrative / Case Study / Phenomenology / Ethnography / Grounded Theory",
      },
      {
        key: "context",
        label: "Context of the Study",
        hint: "Where the qualitative phase will be conducted",
        help: "Which is the context in which the qualitative phase of your study will be conducted?",
      },
      {
        key: "qual_question",
        label: "Qualitative Research Question",
        hint: "The open question that starts the exploration",
        help: "Which is the qualitative research question driving Phase I? It should be open enough to let the important themes emerge - these themes will become the variables of Phase II.",
      },
      {
        key: "question",
        label: "Issues",
        hint: "The particular tensions under scrutiny",
        help: "Which are the issues - the particular matters of contention - that the qualitative exploration will pay attention to?",
      },
      {
        key: "topics",
        label: "Topics",
        hint: "Areas that narrow down the qualitative question",
        help: "Which are the particular areas of interest in which you will narrow down the complexity of the issue driving the qualitative phase?",
        placeholder: "One topic per line",
      },
      {
        key: "informants",
        label: "Informants",
        hint: "Who will you learn from first?",
        help: "Which are the informants from which you will get a better understanding of the phenomenon under analysis in Phase I?",
      },
      {
        key: "data_gathering",
        label: "Data Gathering Methods (qualitative)",
        hint: "Interviews, observations, focus groups…",
        help: "Which qualitative data gathering methods are you going to use in Phase I? i.e. interviews, observations, focus groups.",
      },
      {
        key: "other_documents",
        label: "Other Documents to be analyzed",
        hint: "Photos, videos, journals, artifacts…",
        help: "In addition to the data gathering methods you will implement, which other documents could help you to better understand the phenomenon under study?",
      },
      {
        key: "strategies",
        label: "Strategies (qualitative)",
        hint: "Strategies of your qualitative tradition",
        help: "Which are the strategies you will follow in the qualitative phase? i.e. thick descriptions, constant comparison, member checking.",
      },
      {
        key: "process_support",
        label: "Process Support (qualitative)",
        hint: "People, tools or resources for this phase",
        help: "Are you using any individual, tool, or resource to help you conduct the qualitative phase? i.e. Qualitative data analysis software.",
      },
      {
        key: "study_type",
        section: "Phase II - Quantitative Strand",
        label: "Type of quantitative research design",
        hint: "Descriptive, correlational, quasi-experimental…",
        help: "Which quantitative design will Phase II follow? i.e. Descriptive non-experimental, correlational, quasi-experimental or experimental.",
        placeholder: "Descriptive / Correlational / Quasi-experimental / Experimental",
      },
      {
        key: "variables",
        label: "Hypothesis: Variables",
        hint: "Variables that emerged from Phase I",
        help: "Describe the variables that will be measured in the quantitative phase. In an exploratory sequential design these usually come from the themes discovered in Phase I - the qualitative findings become measurable variables.",
      },
      {
        key: "hypothesis",
        label: "Hypothesis",
        hint: "What you predict, based on the Phase I findings",
        help: "State the hypothesis of the quantitative phase - what you predict the data will show, usually derived from the themes discovered in Phase I.",
      },
      {
        key: "mm_question",
        label: "Quantitative Research Question",
        hint: "Testing the Phase I findings at scale",
        help: "Include the research question driving the quantitative phase - usually testing whether the patterns found in Phase I hold for a larger population.",
      },
      {
        key: "sample",
        label: "Sample",
        hint: "A larger sample to generalize the findings",
        help: "Describe the sample that will be used in the quantitative phase, as well as the sampling method to be used. A representative sample lets you generalize what Phase I discovered.",
      },
      {
        key: "groups",
        label: "# of Groups",
        hint: "How many groups?",
        help: "How many groups will the quantitative phase involve?",
        placeholder: "1 group / 2 groups",
      },
      {
        key: "mm_data_gathering",
        label: "Data Gathering (quantitative)",
        hint: "Often an instrument built from the Phase I findings",
        help: "Which quantitative data gathering instruments will you use in Phase II? In exploratory sequential designs the questionnaire or scale is often BUILT from the qualitative findings of Phase I.",
      },
      {
        key: "data_analysis",
        label: "Data Analysis",
        hint: "Statistics for Phase II",
        help: "How will you analyze the quantitative data? i.e. Descriptive statistics, correlations, group comparisons.",
      },
      {
        key: "mm_process_support",
        label: "Process Support (quantitative)",
        hint: "SPSS, survey tools…",
        help: "Are you using any strategy, tool or technology to support the quantitative phase? i.e. Statistical packages such as SPSS, or tools for the generation of questionnaires.",
      },
    ],
    layout: {
      kind: "mixed",
      variant: "exploratory",
      designName: "Exploratory Sequential Mixed Methods",
      titleText: "Exploratory Sequential Mixed Methods Research Design on:",
    },
  },

  embedded: {
    designName: "Embedded Mixed Methods",
    intro: "In an embedded design one strand is your main study, and a smaller strand of the other type is embedded inside it to answer a secondary question. Your primary methodology (chosen above the design dropdown) decides which strand hosts the study.",
    fields: [
      {
        key: "research_topic",
        section: "Your Study",
        label: "Research topic",
        hint: "The topic of your whole mixed methods study",
        help: "State the topic of your mixed methods study.",
      },
      {
        key: "central_item",
        label: "Phenomenon under study",
        hint: "The focus of your main study",
        help: "Describe briefly the phenomenon you will study in your main strand.",
      },
      {
        key: "context",
        section: "Primary Qualitative Study",
        label: "Context of the Study",
        hint: "Where your main study will be conducted",
        help: "Which is the context in which your main qualitative study will be conducted?",
      },
      {
        key: "question",
        label: "Qualitative Research Question",
        hint: "The question driving your main study",
        help: "Which is the qualitative research question driving your main study?",
      },
      {
        key: "topics",
        label: "Topics",
        hint: "Areas that narrow down your question",
        help: "Which are the particular areas of interest in which you will narrow down the complexity of the question driving the study?",
        placeholder: "One topic per line",
      },
      {
        key: "informants",
        label: "Informants",
        hint: "Who will you learn from?",
        help: "Which are the informants from which you will get a better understanding of the phenomenon under analysis?",
      },
      {
        key: "data_gathering",
        label: "Data Gathering Methods (qualitative)",
        hint: "Interviews, observations, journals…",
        help: "Which qualitative data gathering methods are you going to use in your main study?",
      },
      {
        key: "other_documents",
        label: "Other Documents to be analyzed",
        hint: "Photos, videos, journals, artifacts…",
        help: "In addition to the data gathering methods you will implement, which other documents could help you to better understand the phenomenon under study?",
      },
      {
        key: "strategies",
        label: "Strategies (qualitative)",
        hint: "Strategies of your qualitative tradition",
        help: "Which are the strategies you will follow in your main qualitative study?",
      },
      {
        key: "process_support",
        label: "Process Support",
        hint: "People, tools or resources for your study",
        help: "Are you using any individual, tool, or resource to help you conduct your study?",
      },
      {
        key: "mm_question",
        section: "Embedded Quantitative Study",
        label: "Research Question (embedded)",
        hint: "The secondary question the embedded study answers",
        help: "Which research question will the embedded quantitative study answer? It is usually a secondary question that numbers answer better than words - i.e. how often something happens, or how attitudes are distributed.",
      },
      {
        key: "mm_data_gathering",
        label: "Data Gathering (embedded)",
        hint: "Questionnaires, scales…",
        help: "Which quantitative instruments will the embedded study use? i.e. a short questionnaire or scale administered to the participants of your main study.",
      },
      {
        key: "data_analysis",
        label: "Data Analysis (embedded)",
        hint: "Descriptive statistics…",
        help: "How will you analyze the embedded quantitative data? i.e. Descriptive statistics, frequencies, simple comparisons.",
      },
    ],
    layout: {
      kind: "mixed",
      variant: "embedded",
      designName: "Embedded Mixed Methods",
      titleText: "Embedded Mixed Methods Research Design on:",
    },
  },

  embedded_quant: {
    designName: "Embedded Mixed Methods",
    intro: "In an embedded design one strand is your main study, and a smaller strand of the other type is embedded inside it to answer a secondary question. Your primary methodology (chosen above the design dropdown) decides which strand hosts the study.",
    fields: [
      {
        key: "research_topic",
        section: "Your Study",
        label: "Research topic",
        hint: "The topic of your whole mixed methods study",
        help: "State the topic of your mixed methods study.",
      },
      {
        key: "central_item",
        label: "Phenomenon under study",
        hint: "The focus of your main study",
        help: "Describe briefly the phenomenon you will study in your main strand.",
      },
      {
        key: "study_type",
        section: "Primary Quantitative Study",
        label: "Type of quantitative research design",
        hint: "Descriptive, correlational, quasi-experimental…",
        help: "Which quantitative design will your main study follow? i.e. Descriptive non-experimental, correlational, quasi-experimental or experimental.",
        placeholder: "Descriptive / Correlational / Quasi-experimental / Experimental",
      },
      {
        key: "variables",
        label: "Hypothesis: Variables",
        hint: "The variables your main study will measure",
        help: "Describe the variables that will be measured in your main quantitative study, and the hypothesis relating them if you have one.",
      },
      {
        key: "mm_question",
        label: "Quantitative Research Question",
        hint: "The question driving your main study",
        help: "Include the research question driving your main quantitative study.",
      },
      {
        key: "sample",
        label: "Sample",
        hint: "Who participates in your main study?",
        help: "Describe the sample that will be used in your main study, as well as the sampling method to be used.",
      },
      {
        key: "groups",
        label: "# of Groups",
        hint: "How many groups?",
        help: "How many groups will your main study involve?",
        placeholder: "1 group / 2 groups",
      },
      {
        key: "mm_data_gathering",
        label: "Data Gathering (quantitative)",
        hint: "Questionnaires, scales, tests…",
        help: "Which quantitative data gathering instruments will your main study use?",
      },
      {
        key: "data_analysis",
        label: "Data Analysis",
        hint: "Statistics for your main study",
        help: "How will you analyze the quantitative data of your main study?",
      },
      {
        key: "mm_process_support",
        label: "Process Support",
        hint: "SPSS, survey tools…",
        help: "Are you using any strategy, tool or technology to support your main study?",
      },
      {
        key: "question",
        section: "Embedded Qualitative Study",
        label: "Qualitative Research Question (embedded)",
        hint: "The secondary question the embedded study answers",
        help: "Which qualitative research question will the embedded study answer? It is usually a secondary question that words answer better than numbers - i.e. how participants experienced the intervention, or why they responded the way they did.",
      },
      {
        key: "data_gathering",
        label: "Data Gathering Methods (embedded)",
        hint: "A few interviews, open questions…",
        help: "Which qualitative methods will the embedded study use? i.e. a small number of interviews, focus groups, or open-ended questions inside your instrument.",
      },
      {
        key: "strategies",
        label: "Strategies (embedded)",
        hint: "How will you analyze the words?",
        help: "Which qualitative strategies will you use for the embedded study? i.e. thematic analysis of the interview transcripts or open answers.",
      },
    ],
    layout: {
      kind: "mixed",
      variant: "embedded",
      designName: "Embedded Mixed Methods",
      titleText: "Embedded Mixed Methods Research Design on:",
    },
  },
};

// School Ethnography uses the same form and diagram as Ethnography
VD_FORMS.school_ethnography = VD_FORMS.ethnography;

export function vdEditorSupports(designId) {
  return Boolean(VD_FORMS[designId]);
}

export default function VisualDesignEditor({ sessionId, data, onClose, aiEnabled = true }) {
  const formKey = data.design === "embedded" && data.primary === "quantitative" ? "embedded_quant" : data.design;
  const form = VD_FORMS[formKey];
  const [fields, setFields] = useState(() => ({ ...data.fields }));
  const [saveState, setSaveState] = useState("saved"); // saved | dirty | saving | error
  const [printing, setPrinting] = useState(false);
  const [activeKey, setActiveKey] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [showIdentity, setShowIdentity] = useState(true);
  const saveTimer = useRef(null);
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  const upd = useCallback((key, val) => {
    setFields((prev) => (prev[key] === val ? prev : { ...prev, [key]: val }));
    setSaveState("dirty");
  }, []);

  const doSave = useCallback(async () => {
    setSaveState("saving");
    try {
      await API.saveVisualDesignData(sessionId, fieldsRef.current);
      setSaveState("saved");
    } catch (e) {
      console.error("Visual design save failed:", e);
      setSaveState("error");
    }
  }, [sessionId]);

  // Debounced auto-save whenever fields change
  useEffect(() => {
    if (saveState !== "dirty") return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, 1200);
    return () => clearTimeout(saveTimer.current);
  }, [fields, saveState, doSave]);

  // Flush a pending save when the tab is closed
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        doSave();
      }
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [doSave]);

  // Clicking a title in the diagram scrolls to (and focuses) its form field
  const jumpToField = useCallback((key) => {
    const el = document.getElementById(`vd-${key}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus({ preventScroll: true });
    }
  }, []);

  async function handlePrint() {
    const diagram = document.querySelector(".vd-diagram");
    if (!diagram) return;
    setPrinting(true);
    // Freeze the animated hopscotch squares at full color for the capture
    diagram.classList.add("vd-diagram--print-freeze");
    try {
      await new Promise((r) => setTimeout(r, 60));
      const canvas = await html2canvas(diagram, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const printWin = window.open("", "_blank");
      if (!printWin) {
        alert("Please allow pop-ups to print the Visual Design.");
        return;
      }
      printWin.document.write(`
        <html>
        <head><title>Visual Design</title>
        <style>
          @page { size: landscape; margin: 0.25in; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { display: flex; justify-content: center; align-items: center; height: 100vh; background: #fff; }
          img { max-width: 100%; max-height: 100vh; object-fit: contain; }
        </style>
        </head>
        <body>
          <img src="${imgData}" onload="setTimeout(function(){window.print();},200);" />
        </body>
        </html>
      `);
      printWin.document.close();
    } catch (e) {
      console.error("Print capture failed:", e);
      window.print();
    } finally {
      diagram.classList.remove("vd-diagram--print-freeze");
      setPrinting(false);
    }
  }

  /* Editable region used inside the diagram (same pattern as the CF editor) */
  const E = ({ value, onChange, className = "", placeholder = "" }) => {
    const hasValue = value && value.trim();
    const display = hasValue
      ? value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")
      : placeholder;
    return (
      <div
        className={`vd-editable ${className}${!hasValue ? " vd-editable--placeholder" : ""}`}
        contentEditable
        suppressContentEditableWarning
        onFocus={(e) => {
          // The placeholder is literal text - clear it so typing starts clean
          if (!hasValue) {
            e.target.innerText = "";
            e.target.classList.remove("vd-editable--placeholder");
          }
        }}
        onBlur={(e) => {
          const text = e.target.innerText.trim();
          onChange(text === placeholder ? "" : text);
          // Left empty: restore the placeholder ourselves, since the state may
          // not have changed and React won't re-render this node
          if (!text) {
            e.target.innerText = placeholder;
            e.target.classList.add("vd-editable--placeholder");
          }
        }}
        dangerouslySetInnerHTML={{ __html: display }}
      />
    );
  };

  const TemplateComp =
    form.layout.kind === "pentagon" ? VDTemplatePentagonFlower :
    form.layout.kind === "mixed" ? VDTemplateMixed :
    VDTemplateHoneycomb;
  const filledCount = form.fields.filter((f) => (fields[f.key] || "").trim()).length;
  const progressPct = Math.round((filledCount / form.fields.length) * 100);

  const saveLabel =
    saveState === "saving" ? "Saving…" :
    saveState === "dirty" ? "Unsaved" :
    saveState === "error" ? "Save failed" :
    "Saved";

  return (
    <div className={`vd-overlay${showIdentity ? "" : " vd-overlay--anon"}`}>
      {/* Toolbar */}
      <div className="vd-toolbar no-print">
        <div className="vd-toolbar__left">
          <button className="vd-btn vd-btn--ghost" onClick={onClose} title="Close this tab and return to your research design">
            &larr; Back
          </button>
          <div className="vd-toolbar__titles">
            <span className="vd-toolbar__title">Visual Design</span>
            <span className="vd-toolbar__badge">{form.designName}</span>
          </div>
        </div>
        <div className="vd-toolbar__right">
          <span className={`vd-save-state vd-save-state--${saveState}`} title="Changes save automatically">
            <span className="vd-save-state__dot" />{saveLabel}
          </span>
          <label className="vd-identity-toggle" title="Turn off to print an anonymized version, e.g. for papers or posters">
            <input
              type="checkbox"
              checked={showIdentity}
              onChange={(e) => setShowIdentity(e.target.checked)}
            />
            Show name &amp; email
          </label>
          <button className="vd-btn vd-btn--primary" onClick={handlePrint} disabled={printing}>
            {printing ? "Capturing…" : "🖨 Print / Save PDF"}
          </button>
        </div>
      </div>

      {/* Body: form (left) + diagram (right) */}
      <div className="vd-body">
        <div className="vd-form no-print">
          <div className="vd-form__header">
            <p className="vd-form__intro">{form.intro}</p>
            <div className="vd-form__progress">
              <div className="vd-form__progress-bar">
                <div className="vd-form__progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="vd-form__progress-text">{filledCount} of {form.fields.length} completed</span>
            </div>
          </div>

          {form.fields.map((f, i) => {
            const filled = (fields[f.key] || "").trim();
            return (
              <React.Fragment key={f.key}>
              {f.section && <h3 className="vd-form__section">{f.section}</h3>}
              <div
                className={`vd-field${activeKey === f.key ? " vd-field--active" : ""}${filled ? " vd-field--filled" : ""}`}
              >
                <div className="vd-field__head">
                  <span className="vd-field__num">{filled ? "✓" : i + 1}</span>
                  <div className="vd-field__titles">
                    <label className="vd-field__label" htmlFor={`vd-${f.key}`}>{f.label}</label>
                    <span className="vd-field__hint">{f.hint}</span>
                  </div>
                </div>
                <details className="vd-field__guide">
                  <summary>Guidance &amp; examples</summary>
                  <p>{f.help}</p>
                  {f.helpImage && (
                    <img className="vd-field__guide-img" src={f.helpImage} alt={f.helpImageAlt || ""} loading="lazy" />
                  )}
                </details>
                <textarea
                  id={`vd-${f.key}`}
                  className="vd-field__input"
                  rows={3}
                  placeholder={f.placeholder || "Write your answer here…"}
                  value={fields[f.key] || ""}
                  onChange={(e) => upd(f.key, e.target.value)}
                  onFocus={() => setActiveKey(f.key)}
                  onBlur={() => setActiveKey(null)}
                />
              </div>
              </React.Fragment>
            );
          })}
        </div>

        <div className="vd-stage">
          <div className="vd-stage__inner">
            <TemplateComp
              layout={form.layout}
              primary={data.primary}
              name={data.name}
              email={data.email}
              fields={fields}
              upd={upd}
              E={E}
              activeKey={activeKey}
              onJumpToField={jumpToField}
            />
            <p className="vd-stage__hint no-print">
              This is your study at a glance - click any text in the diagram to edit it, or use the form on the left.
            </p>
          </div>
        </div>
      </div>

      {/* Floating AI assistant toggle + slide-in chat drawer */}
      {!chatOpen && (
        <button className="vd-chat-toggle no-print" onClick={() => setChatOpen(true)} title="Ask the AI assistant for help with your visual design">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          AI Assistant
        </button>
      )}
      <div className={`vd-chat-drawer no-print${chatOpen ? " vd-chat-drawer--open" : ""}`}>
        <div className="vd-chat-drawer__head">
          <span className="vd-chat-drawer__title">AI Assistant</span>
          <span className="vd-chat-drawer__hint">Ask for help with your {form.designName.toLowerCase()}</span>
          <button className="vd-chat-drawer__close" onClick={() => setChatOpen(false)} title="Close the assistant" aria-label="Close the assistant">&times;</button>
        </div>
        <div className="vd-chat-drawer__body">
          {chatOpen && (
            <ChatBox
              sessionId={sessionId}
              activeStep={4}
              refreshKey={0}
              aiEnabled={aiEnabled}
            />
          )}
        </div>
      </div>
    </div>
  );
}
