// src/vdZh.jsx
// Simplified Chinese (zh-CN) overlay for the Visual Design editor forms + diagram
// layout labels. Data-only module: the merge logic lives in vdEs.jsx's
// localizeVdForm, which consumes these tables as a per-language overlay.
// Field "help" paragraphs intentionally fall back to English until translated.
const N = {
  narrative: "叙事研究", phenomenology: "现象学研究",
  grounded_theory: "扎根理论研究", ethnography: "民族志研究",
  case_study: "个案研究", action_research: "行动研究",
  phenomenography: "现象图析学研究", descriptive: "描述性非实验研究",
  correlational: "相关性非实验研究", quasi_experimental: "准实验研究",
  experimental: "实验研究", convergent_parallel: "聚敛式平行混合研究方法",
  explanatory_sequential: "解释性序列混合研究方法",
  exploratory_sequential: "探索性序列混合研究方法",
  embedded: "嵌入式混合研究方法", embedded_quant: "嵌入式混合研究方法",
  design_based_research: "基于设计的研究",
  cross_sectional_survey: "横断面调查研究", pre_experimental: "前实验研究",
};

const intro = (name) =>
  `请回答以下问题，为你的${name}构建单页可视化研究设计。你输入的所有内容都会显示在右侧的图示中——你还可以点击图示中的任意文字直接进行编辑。`;

// Shared field translations (label/hint/placeholder) by field key
const F = {
  context: { label: "研究背景", hint: "你的研究将在哪里进行？" },
  topics: { label: "主题", hint: "界定你研究问题的关注领域", placeholder: "每行一个主题" },
  informants: { label: "受访者", hint: "谁将帮助你理解该现象？" },
  data_gathering: { label: "数据收集方法", hint: "你将如何收集数据？" },
  other_documents: { label: "其他待分析文档", hint: "照片、视频、日记、实物资料……" },
  process_support: { label: "过程支持", hint: "支持你研究的人员、工具或资源" },
  minicases: { label: "小案例", hint: "有助于阐明研究的特殊方面" },
  study_type: { label: "研究类型", hint: "" },
  variables: { label: "变量", hint: "你将分析哪些特征？" },
  question: { label: "研究问题", hint: "引导你研究的问题" },
  sample: { label: "样本", hint: "谁将参与？如何选取？" },
  groups: { label: "组数", hint: "" , placeholder: "1 组 / 2 组"},
  data_analysis: { label: "数据分析", hint: "你将如何分析数据？" },
  strategies: { label: "策略", hint: "" },
  central_item: { label: "研究现象", hint: "" },
  research_topic: { label: "研究主题", hint: "你整个混合研究方法研究的主题" },
  qual_tradition: { label: "定性研究传统类型", hint: "叙事研究、个案研究、现象学……", placeholder: "叙事研究 / 个案研究 / 现象学 / 民族志 / 扎根理论" },
  qual_question: { label: "定性研究问题", hint: "引导定性研究部分的问题" },
  hypothesis: { label: "假设", hint: "你预测定量研究部分将发现的结果" },
  mm_question: { label: "定量研究问题", hint: "引导定量研究部分的问题" },
  mm_data_gathering: { label: "数据收集（定量）", hint: "问卷、量表、测验……" },
  mm_process_support: { label: "过程支持（定量）", hint: "SPSS、问卷调查工具……" },
};

// Per-design field label overrides (only where the design uses its own wording)
const D = {
  narrative: {
    central_item: { label: "叙事画像", hint: "通过受访者的故事所研究的现象" },
    question: { label: "叙事问题" },
    informants: { label: "受访者的故事", hint: "你将向谁学习？" },
    strategies: { label: "叙事研究策略", hint: "重述故事、阈限性、越界、唤起、复杂性" },
  },
  phenomenology: {
    central_item: { label: "研究现象", hint: "你的研究所分析的有限且可界定的经验" },
    question: { label: "现象学问题", hint: "这一经验对亲历者意味着什么？" },
    strategies: { label: "现象学策略", hint: "悬置（epoché）、水平化、文本性与结构性描述" },
  },
  grounded_theory: {
    central_item: { label: "文献尚未涵盖的现象", hint: "你的实质性关注领域" },
    question: { label: "扎根理论问题", hint: "关于现象背后过程的开放式问题" },
    strategies: { label: "扎根理论策略", hint: "持续比较、编码、备忘录、理论饱和" },
  },
  ethnography: {
    central_item: { label: "待研究的文化", hint: "处于你研究核心的文化群体" },
    question: { label: "民族志问题", hint: "关于该社会群体如何运作" },
    strategies: { label: "民族志研究策略", hint: "长期驻留、情景片段、深描" },
  },
  case_study: {
    central_item: { label: "你的案例名称", hint: "你所界定的运行中的系统" },
    question: { label: "议题（issue）", hint: "引导你研究的、受审视的张力" },
    strategies: { label: "个案研究策略", hint: "渐进聚焦、深描、可信度" },
    topics: { label: "主题", hint: "界定你议题的关注领域" },
  },
  action_research: {
    central_item: { label: "需要反思和改进的方面", hint: "你想改进的自身实践的那一部分" },
    question: { label: "实践问题", hint: "聚焦于改进你的日常实践" },
    strategies: { label: "行动研究策略（循环）", hint: "计划、行动与观察、反思——共几个循环？" },
  },
  phenomenography: {
    central_item: { label: "研究现象", hint: "你将描绘其各种不同理解方式的现象" },
    question: { label: "现象图析学问题", hint: "人们如何以不同方式理解该现象？" },
    informants: { label: "受访者", hint: "经历过该现象的 10-12 人" },
    strategies: { label: "现象图析学策略", hint: "六步分析法，直至形成结果空间" },
  },
  descriptive: {
    central_item: { label: "研究现象", hint: "你将描述什么？" },
    study_type: { label: "研究类型", hint: "调查设计或观察设计", placeholder: "调查设计 / 观察设计" },
    groups: { label: "组数", hint: "1 组、2 组或多个案例", placeholder: "1 组 / 2 组 / 案例" },
    data_gathering: { label: "数据收集", hint: "问卷、观察、李克特量表、访谈……" },
    data_analysis: { label: "数据分析", hint: "描述性统计" },
    process_support: { label: "过程支持", hint: "统计软件包、问卷工具……" },
  },
  correlational: {
    central_item: { label: "研究现象", hint: "你将关联其变量的现象" },
    study_type: { label: "相关研究类型", hint: "预测性或解释性", placeholder: "预测性相关设计 / 解释性相关设计" },
    variables: { label: "变量", hint: "你将分析其关系的变量" },
    question: { label: "研究问题", hint: "关于变量之间如何相关的问题" },
    groups: { label: "组数", hint: "1、2、3 个研究组或其他", placeholder: "1 组 / 2 组 / 3 组" },
    data_gathering: { label: "数据收集", hint: "问卷、李克特量表……" },
    data_analysis: { label: "数据分析", hint: "相关分析、回归分析、路径分析……" },
  },
  quasi_experimental: {
    central_item: { label: "研究现象", hint: "你将检验干预措施的情境" },
    study_type: { label: "准实验设计类型", hint: "非对等控制组、前测-后测、时间序列……", placeholder: "非对等控制组 / 前测-后测 / 间断时间序列" },
    variables: { label: "假设：变量（自变量 → 因变量）", hint: "一个因果假设：自变量影响因变量" },
    question: { label: "研究问题", hint: "自变量对因变量有什么影响？" },
    sample: { label: "样本", hint: "完整的自然组——非随机分配" },
    groups: { label: "组数", hint: "2 个或更多组（处理组与控制组）", placeholder: "2 个或更多组" },
    data_gathering: { label: "数据收集", hint: "调查、量表、测验" },
    data_analysis: { label: "数据分析", hint: "取决于自变量和因变量的数量以及组间关系" },
  },
  experimental: {
    central_item: { label: "研究现象", hint: "你将检验干预措施的情境" },
    study_type: { label: "实验设计类型", hint: "前测-后测、仅后测、所罗门设计、析因设计……", placeholder: "前测-后测 / 仅后测 / 所罗门四组设计 / 析因设计" },
    variables: { label: "假设：变量（自变量 → 因变量）", hint: "一个因果假设：自变量对因变量产生效应" },
    question: { label: "研究问题", hint: "自变量对因变量有什么效应？" },
    sample: { label: "样本", hint: "随机分配的组" },
    groups: { label: "组数", hint: "2 个或更多组（处理组与控制组）", placeholder: "2 个或更多组" },
    data_gathering: { label: "数据收集", hint: "调查、量表、测验" },
    data_analysis: { label: "数据分析", hint: "取决于自变量和因变量的数量以及组间关系" },
  },
  cross_sectional_survey: {
    central_item: { label: "研究现象", hint: "你将在单一时间点测量什么？" },
    study_type: { label: "调查类型", hint: "描述性或分析性" },
    question: { label: "研究问题", hint: "关于某一总体在特定时刻的状况" },
    groups: { label: "研究组织", hint: "一个总体；若为分析性调查则含子群体" },
  },
  pre_experimental: {
    central_item: { label: "研究现象", hint: "你将探索干预措施的情境" },
    study_type: { label: "前实验设计类型", hint: "单组且控制条件有限" },
    variables: { label: "假设：变量（自变量 → 因变量）", hint: "在有限控制下探索的一个自变量" },
    question: { label: "研究问题", hint: "自变量的表面效应是什么？" },
    groups: { label: "组数", hint: "1 组（无控制组）", placeholder: "1 组" },
  },
  design_based_research: {
    research_topic: { label: "你的 DBR 研究名称", hint: "一个界定研究范围的简明工作标题" },
    context: { label: "背景与边界", hint: "自然情境及其条件" },
    central_item: { label: "实践问题", hint: "持续存在且具有实际后果的问题" },
    question: { label: "研究目的与研究问题", hint: "既改进实践，又产出设计知识" },
    topics: { label: "主题", hint: "聚焦探究的关注领域", placeholder: "每行一个主题" },
    informants: { label: "合作伙伴、利益相关者与受访者", hint: "谁与你共同设计、实施和解读？" },
    hypothesis: { label: "初始设计猜想", hint: "如果[设计特征]……那么[结果]……" },
    variables: { label: "干预与设计要求", hint: "将设计或重新设计什么？" },
    strategies: { label: "迭代与决策点", hint: "DBR 循环及其判定标准" },
    data_gathering: { label: "数据收集方法", hint: "结果、实施、机制、体验" },
    other_documents: { label: "其他待分析文档与制品", hint: "政策、原型、学生作业、记录……" },
    process_support: { label: "过程支持与可行性", hint: "人员、工具、许可、应急预案" },
    minicases: { label: "设计原则与贡献", hint: "研究产出的可迁移知识" },
  },
};

// Mixed designs share most field wording
const MIXED_SHARED = {
  research_topic: F.research_topic, central_item: { label: "研究现象", hint: "两个研究部分共享" },
  qual_tradition: F.qual_tradition, context: { label: "研究背景", hint: "定性研究部分将在哪里进行" },
  qual_question: F.qual_question, question: { label: "议题（issues）", hint: "受审视的特定张力" },
  topics: F.topics, informants: F.informants,
  data_gathering: { label: "数据收集方法（定性）", hint: "访谈、观察、日记……" },
  other_documents: F.other_documents,
  strategies: { label: "策略（定性）", hint: "你所选定性研究传统的策略" },
  process_support: { label: "过程支持（定性）", hint: "支持该研究部分的人员、工具或资源" },
  variables: { label: "变量", hint: "定量研究部分将测量的变量" },
  hypothesis: F.hypothesis, mm_question: F.mm_question, sample: { label: "样本", hint: "谁参与定量研究部分？" },
  groups: F.groups, mm_data_gathering: F.mm_data_gathering, data_analysis: { label: "数据分析", hint: "定量研究部分的统计方法" },
  mm_process_support: F.mm_process_support, study_type: { label: "定量设计类型", hint: "描述性、相关性、准实验……" },
};
["convergent_parallel", "explanatory_sequential", "exploratory_sequential", "embedded", "embedded_quant"].forEach((k) => { D[k] = MIXED_SHARED; });

// Diagram layout labels per design (what prints on the one-pager)
const L = {
  common: {
    informants: "受访者", other_documents: "其他文档", data_gathering: "数据收集方法",
    strategies: "策略", process_support: "过程支持", question: "问题", central_item: "现象",
  },
  narrative: { central_item: "叙事画像", strategies: "叙事研究策略", question: "叙事问题", informants: "受访者的故事" },
  ethnography: { central_item: "研究中的文化/群体", strategies: "民族志研究策略", question: "民族志问题" },
  grounded_theory: { central_item: "文献尚未涵盖的现象" },
  case_study: { central_item: "案例", question: "议题" },
  action_research: { central_item: "需要反思和改进的方面", strategies: "循环", question: "实践问题" },
  design_based_research: { central_item: "实践问题", informants: "合作伙伴、利益相关者与受访者", other_documents: "其他文档与制品", strategies: "迭代与决策点", process_support: "过程支持与可行性", question: "研究目的与研究问题" },
};

// Mixed-methods diagram main titles ("... Research Design on:")
const TITLE_TEXTS = {
  convergent_parallel: "聚敛式平行混合研究方法研究设计，研究主题：",
  explanatory_sequential: "解释性序列混合研究方法研究设计，研究主题：",
  exploratory_sequential: "探索性序列混合研究方法研究设计，研究主题：",
  embedded: "嵌入式混合研究方法研究设计，研究主题：",
  embedded_quant: "嵌入式混合研究方法研究设计，研究主题：",
};

const CONTEXT_TITLES = {
  narrative: "你的叙事研究背景", phenomenology: "你的现象学研究背景",
  grounded_theory: "你的扎根理论研究背景", ethnography: "你的民族志背景",
  case_study: "你的案例背景", action_research: "你的行动研究背景",
  phenomenography: "你的现象图析学研究背景", design_based_research: "背景与边界",
};

// Quantitative pentagon: short title above the diagram, per design
const TITLE_NAMES = {
  descriptive: "描述性非实验研究", correlational: "相关性非实验研究",
  quasi_experimental: "准实验研究", experimental: "实验研究",
  cross_sectional_survey: "横断面调查研究", pre_experimental: "前实验研究",
};

// Fixed characteristic chips on the pentagon diagram, mapped by English value
const FIXED_VALUES = {
  "Exploratory/Descriptive": "探索性/描述性",
  "No control group": "无对照组",
  "Desirable": "值得追求",
  "Correlational": "相关性",
  "Explanatory": "解释性",
  "Treatment & control group": "实验组与对照组",
  "Natural groups": "自然分组",
  "Descriptive / Survey": "描述性 / 调查",
  "Essential": "必不可少",
  "Exploratory": "探索性",
  "1 group (no control)": "1 组（无对照）",
  "Limited": "有限",
};

// DBR-only diagram areas that carry their own titles in the layout
const DBR_RAIL_TITLES = {
  context: "背景与边界",
  hypothesis: "初始设计猜想",
  variables: "干预与设计要求",
};
const DBR_CENTER_EXTRA_LABEL = "你的基于设计的研究名称";
const DBR_SPLIT_STRATEGIES_LABEL = "设计原则与知识贡献";

// Data-only overlay bundle, mirroring the tables localizeVdForm reads
// (N, F, D, L, CONTEXT_TITLES, TITLE_TEXTS, ... intro). No merge logic here.
export const VD_ZH = {
  N, F, D, L, CONTEXT_TITLES, TITLE_TEXTS, TITLE_NAMES, FIXED_VALUES,
  DBR_RAIL_TITLES, DBR_CENTER_EXTRA_LABEL, DBR_SPLIT_STRATEGIES_LABEL, intro,
};
export { N, F, D, L, CONTEXT_TITLES, TITLE_TEXTS, intro };
export const VD_DESIGN_NAMES_ZH = N;
export default VD_ZH;
