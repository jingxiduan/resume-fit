// 岗位技能词库：中英别名统一映射到同一技能，用于跨语言关键词匹配。
// cat: lang 编程语言 | ml 机器学习 | algo 搜广推/应用算法 | llm 大模型 | mm 多模态/CV | data 数据工程 | infra 训练推理与MLOps | cloud 云与容器

export const SKILLS = [
  // ---------- 编程语言 ----------
  { label: 'Python', cat: 'lang', aliases: ['python'] },
  { label: 'C++', cat: 'lang', aliases: ['c++', 'cpp'] },
  { label: 'Java', cat: 'lang', aliases: ['java'] },
  { label: 'Scala', cat: 'lang', aliases: ['scala'] },
  { label: 'Go', cat: 'lang', aliases: ['golang'] },
  { label: 'Rust', cat: 'lang', aliases: ['rust'] },
  { label: 'SQL', cat: 'lang', aliases: ['sql', 'hiveql', 'spark sql', 'sparksql'] },
  { label: 'CUDA', cat: 'infra', aliases: ['cuda', 'cuda kernel', 'gpu kernel'] },
  { label: 'Triton (OpenAI)', cat: 'infra', aliases: ['openai triton', 'triton kernel', 'triton language'] },

  // ---------- 机器学习基础 ----------
  { label: 'Machine Learning', cat: 'ml', aliases: ['machine learning', '机器学习'] },
  { label: 'Deep Learning', cat: 'ml', aliases: ['deep learning', '深度学习', 'neural network', '神经网络'] },
  { label: 'PyTorch', cat: 'ml', aliases: ['pytorch', 'torch'] },
  { label: 'TensorFlow', cat: 'ml', aliases: ['tensorflow', 'keras'] },
  { label: 'JAX', cat: 'ml', aliases: ['jax', 'flax'] },
  { label: 'scikit-learn', cat: 'ml', aliases: ['scikit-learn', 'sklearn'] },
  { label: 'XGBoost / LightGBM', cat: 'ml', aliases: ['xgboost', 'lightgbm', 'catboost', 'gbdt', 'gradient boosting', '梯度提升'] },
  { label: 'Feature Engineering', cat: 'ml', aliases: ['feature engineering', '特征工程', '特征构建'] },
  { label: 'A/B Testing', cat: 'ml', aliases: ['a/b test', 'ab test', 'a/b experiment', 'online experiment', 'ab实验', 'a/b实验', '在线实验', 'ab测试'] },
  { label: 'Causal Inference', cat: 'ml', aliases: ['causal inference', 'causal', 'uplift', '因果推断', '增益模型'] },
  { label: 'Statistics', cat: 'ml', aliases: ['statistics', 'statistical', 'hypothesis test', '统计学', '假设检验'] },
  { label: 'Reinforcement Learning', cat: 'ml', aliases: ['reinforcement learning', '强化学习', 'multi-armed bandit', 'bandit'] },
  { label: 'Time Series', cat: 'ml', aliases: ['time series', 'forecasting', '时间序列', '时序预测'] },
  { label: 'Graph Neural Network', cat: 'ml', aliases: ['graph neural network', 'gnn', 'gcn', 'graphsage', '图神经网络', '图学习'] },
  { label: 'Representation Learning', cat: 'ml', aliases: ['representation learning', 'embedding', 'embeddings', '表征学习', '向量表示'] },
  { label: 'Contrastive Learning', cat: 'ml', aliases: ['contrastive learning', 'self-supervised', 'self supervised', '对比学习', '自监督'] },
  { label: 'NLP', cat: 'ml', aliases: ['nlp', 'natural language processing', '自然语言处理'] },
  { label: 'Knowledge Distillation', cat: 'infra', aliases: ['knowledge distillation', 'distillation', '知识蒸馏', '模型蒸馏'] },
  { label: 'Model Compression / Quantization', cat: 'infra', aliases: ['quantization', 'int8', 'int4', 'fp8', 'pruning', 'model compression', '量化', '剪枝', '模型压缩'] },

  // ---------- 搜广推 / 应用算法 ----------
  { label: 'Recommender Systems', cat: 'algo', aliases: ['recommender system', 'recommendation system', 'recommendation', 'recsys', '推荐系统', '推荐算法'] },
  { label: 'Search & Ranking', cat: 'algo', aliases: ['search ranking', 'learning to rank', 'ranking model', 'ranking', 're-ranking', 'reranking', '搜索排序', '排序模型', '精排', '粗排', '重排'] },
  { label: 'Retrieval / Recall', cat: 'algo', aliases: ['candidate generation', 'retrieval model', 'two-tower', 'two tower', 'dssm', 'ann search', '召回', '双塔'] },
  { label: 'CTR / CVR Prediction', cat: 'algo', aliases: ['ctr prediction', 'cvr prediction', 'ctr', 'cvr', 'pctr', 'pcvr', '点击率预估', '转化率预估'] },
  { label: 'Computational Advertising', cat: 'algo', aliases: ['computational advertising', 'ads ranking', 'ad ranking', 'advertising', 'ad tech', 'adtech', 'programmatic', 'rtb', '计算广告', '广告算法', '广告系统'] },
  { label: 'Bidding / Auction', cat: 'algo', aliases: ['bidding', 'auto-bidding', 'bid optimization', 'auction', 'ocpx', 'ocpm', 'roas', '出价', '竞价', '智能出价'] },
  { label: 'Multi-task Learning', cat: 'algo', aliases: ['multi-task learning', 'multi task learning', 'mmoe', '多任务学习'] },
  { label: 'LTV Prediction', cat: 'algo', aliases: ['ltv', 'lifetime value', 'pltv', '用户价值预估', '生命周期价值'] },

  // ---------- 大模型 LLM ----------
  { label: 'Large Language Models (LLM)', cat: 'llm', aliases: ['llm', 'llms', 'large language model', '大语言模型', '大模型', 'foundation model', '基座模型', 'gpt'] },
  { label: 'Transformer', cat: 'llm', aliases: ['transformer', 'transformers', 'self-attention', 'attention mechanism', '注意力机制'] },
  { label: 'Pre-training', cat: 'llm', aliases: ['pre-training', 'pretraining', 'continual pretraining', 'continued pretraining', '预训练', '增量预训练'] },
  { label: 'SFT / Instruction Tuning', cat: 'llm', aliases: ['sft', 'supervised fine-tuning', 'instruction tuning', 'fine-tuning', 'finetuning', '监督微调', '指令微调', '微调'] },
  { label: 'RLHF', cat: 'llm', aliases: ['rlhf', 'rlaif', 'reinforcement learning from human feedback', '人类反馈强化学习'] },
  { label: 'DPO / PPO / GRPO', cat: 'llm', aliases: ['dpo', 'ppo', 'grpo', 'kto', 'preference optimization', '偏好优化'] },
  { label: 'Reward Modeling', cat: 'llm', aliases: ['reward model', 'reward modeling', 'rm training', '奖励模型'] },
  { label: 'Alignment', cat: 'llm', aliases: ['alignment', 'ai safety', 'red teaming', '对齐', '安全对齐'] },
  { label: 'LoRA / PEFT', cat: 'llm', aliases: ['lora', 'qlora', 'peft', 'parameter-efficient', 'adapter tuning', 'prefix tuning', '参数高效微调'] },
  { label: 'RAG', cat: 'llm', aliases: ['rag', 'retrieval-augmented generation', 'retrieval augmented generation', '检索增强生成', '检索增强'] },
  { label: 'Vector Database', cat: 'llm', aliases: ['vector database', 'vector db', 'vector store', 'milvus', 'faiss', 'pinecone', 'weaviate', 'chroma', 'qdrant', '向量数据库', '向量检索'] },
  { label: 'LLM Agents / Tool Use', cat: 'llm', aliases: ['agent', 'agents', 'agentic', 'tool use', 'function calling', 'multi-agent', 'react prompting', '智能体', '工具调用', '多智能体'] },
  { label: 'LangChain / LlamaIndex', cat: 'llm', aliases: ['langchain', 'llamaindex', 'llama index', 'langgraph', 'autogen', 'dify'] },
  { label: 'Prompt Engineering', cat: 'llm', aliases: ['prompt engineering', 'prompting', 'in-context learning', 'chain-of-thought', 'chain of thought', '提示工程', '提示词', '思维链'] },
  { label: 'LLM Evaluation', cat: 'llm', aliases: ['llm evaluation', 'model evaluation', 'benchmark', 'benchmarks', 'eval', 'evals', 'hallucination', '模型评测', '评测体系', '幻觉'] },
  { label: 'Mixture of Experts (MoE)', cat: 'llm', aliases: ['moe', 'mixture of experts', 'mixture-of-experts', '混合专家'] },
  { label: 'Long Context', cat: 'llm', aliases: ['long context', 'long-context', 'context window', 'rope scaling', 'position interpolation', '长上下文', '长文本'] },
  { label: 'Hugging Face', cat: 'llm', aliases: ['hugging face', 'huggingface', 'hf transformers'] },
  { label: 'Tokenizer', cat: 'llm', aliases: ['tokenizer', 'tokenization', 'bpe', 'sentencepiece', '分词'] },

  // ---------- 训练 / 推理基础设施 ----------
  { label: 'Distributed Training', cat: 'infra', aliases: ['distributed training', 'data parallel', 'model parallel', 'tensor parallel', 'pipeline parallel', 'zero-3', 'zero3', 'fsdp', 'ddp', 'nccl', '分布式训练', '数据并行', '模型并行'] },
  { label: 'DeepSpeed / Megatron', cat: 'infra', aliases: ['deepspeed', 'megatron', 'megatron-lm', 'colossalai'] },
  { label: 'LLM Inference Optimization', cat: 'infra', aliases: ['inference optimization', 'kv cache', 'paged attention', 'speculative decoding', 'continuous batching', 'flashattention', 'flash attention', '推理优化', '推理加速'] },
  { label: 'vLLM / SGLang / TensorRT-LLM', cat: 'infra', aliases: ['vllm', 'sglang', 'tensorrt-llm', 'tensorrt llm', 'lmdeploy', 'tgi', 'text generation inference', 'llama.cpp'] },
  { label: 'TensorRT / ONNX', cat: 'infra', aliases: ['tensorrt', 'onnx', 'onnx runtime', 'openvino', 'tvm'] },
  { label: 'Model Serving', cat: 'infra', aliases: ['model serving', 'triton inference server', 'torchserve', 'tf serving', 'online inference', '模型部署', '在线推理', '模型服务'] },
  { label: 'MLOps', cat: 'infra', aliases: ['mlops', 'mlflow', 'kubeflow', 'weights & biases', 'wandb', 'model registry', 'feature store', '特征平台'] },
  { label: 'Ray', cat: 'infra', aliases: ['ray tune', 'ray serve', 'ray train', 'ray cluster', 'ray data', 'ray rllib'] },
  { label: 'GPU Cluster', cat: 'infra', aliases: ['gpu cluster', 'a100', 'h100', 'h800', 'multi-gpu', 'multi-node', 'gpu集群', '多机多卡'] },

  // ---------- 多模态 / CV ----------
  { label: 'Multimodal', cat: 'mm', aliases: ['multimodal', 'multi-modal', 'cross-modal', 'vision-language', '多模态', '跨模态', '图文'] },
  { label: 'Vision-Language Models (VLM)', cat: 'mm', aliases: ['vlm', 'vlms', 'mllm', 'lmm', 'llava', 'qwen-vl', 'blip', 'blip-2', 'flamingo', 'internvl', '视觉语言模型', '多模态大模型'] },
  { label: 'CLIP', cat: 'mm', aliases: ['clip', 'siglip', 'open_clip', 'openclip'] },
  { label: 'Vision Transformer (ViT)', cat: 'mm', aliases: ['vit', 'vision transformer', 'swin', 'dino', 'dinov2'] },
  { label: 'Diffusion Models', cat: 'mm', aliases: ['diffusion', 'diffusion model', 'stable diffusion', 'sdxl', 'dit', 'latent diffusion', 'controlnet', 'flow matching', '扩散模型'] },
  { label: 'Text-to-Image / Video Generation', cat: 'mm', aliases: ['text-to-image', 'text to image', 'text-to-video', 'video generation', 'image generation', 'aigc', '文生图', '文生视频', '视频生成', '图像生成'] },
  { label: 'Computer Vision', cat: 'mm', aliases: ['computer vision', 'image recognition', 'image classification', '计算机视觉', '图像识别', '图像分类'] },
  { label: 'Object Detection / Segmentation', cat: 'mm', aliases: ['object detection', 'image segmentation', 'semantic segmentation', 'instance segmentation', 'yolo', 'detr', 'mask r-cnn', 'segment anything', '目标检测', '图像分割', '语义分割', '实例分割'] },
  { label: 'OCR / Document AI', cat: 'mm', aliases: ['ocr', 'document understanding', 'document ai', 'layout analysis', '文字识别', '文档理解'] },
  { label: 'Speech / Audio', cat: 'mm', aliases: ['asr', 'tts', 'speech recognition', 'speech synthesis', 'audio', 'whisper', '语音识别', '语音合成', '音频'] },
  { label: '3D Vision', cat: 'mm', aliases: ['3d vision', 'nerf', 'gaussian splatting', 'point cloud', '3d重建', '点云', '三维重建'] },
  { label: 'GAN / VAE', cat: 'mm', aliases: ['gan', 'gans', 'vae', 'vq-vae', 'generative adversarial', '生成对抗网络', '变分自编码器'] },

  // ---------- 数据工程 ----------
  { label: 'Apache Spark', cat: 'data', aliases: ['spark', 'pyspark', 'spark streaming', 'structured streaming'] },
  { label: 'Apache Flink', cat: 'data', aliases: ['flink', 'flink sql', 'pyflink'] },
  { label: 'Apache Kafka', cat: 'data', aliases: ['kafka', 'pulsar', 'kinesis', 'message queue', '消息队列'] },
  { label: 'Hadoop / Hive', cat: 'data', aliases: ['hadoop', 'hive', 'hdfs', 'mapreduce', 'yarn'] },
  { label: 'Lakehouse (Iceberg / Delta / Hudi)', cat: 'data', aliases: ['iceberg', 'apache iceberg', 'delta lake', 'hudi', 'lakehouse', 'data lake', '湖仓一体', '数据湖'] },
  { label: 'Airflow / Orchestration', cat: 'data', aliases: ['airflow', 'dagster', 'prefect', 'oozie', 'dolphinscheduler', 'workflow orchestration', '任务调度'] },
  { label: 'dbt', cat: 'data', aliases: ['dbt'] },
  { label: 'Presto / Trino', cat: 'data', aliases: ['presto', 'trino', 'impala'] },
  { label: 'OLAP (ClickHouse / Doris / StarRocks)', cat: 'data', aliases: ['clickhouse', 'doris', 'starrocks', 'druid', 'kylin', 'olap'] },
  { label: 'Cloud Data Warehouse', cat: 'data', aliases: ['snowflake', 'bigquery', 'redshift', 'databricks', 'synapse'] },
  { label: 'Data Warehouse', cat: 'data', aliases: ['data warehouse', 'data warehousing', 'dwh', '数据仓库', '数仓'] },
  { label: 'ETL / ELT Pipelines', cat: 'data', aliases: ['etl', 'elt', 'data pipeline', 'data pipelines', '数据管道', '数据链路'] },
  { label: 'Data Modeling', cat: 'data', aliases: ['data modeling', 'dimensional modeling', 'star schema', 'kimball', '数据建模', '维度建模'] },
  { label: 'Real-time Streaming', cat: 'data', aliases: ['real-time', 'realtime', 'stream processing', 'streaming', '实时计算', '流式计算', '实时数仓'] },
  { label: 'Data Quality & Governance', cat: 'data', aliases: ['data quality', 'data governance', 'data lineage', 'great expectations', 'metadata', '数据质量', '数据治理', '数据血缘'] },
  { label: 'Databases (MySQL / PostgreSQL)', cat: 'data', aliases: ['mysql', 'postgresql', 'postgres', 'oracle', 'sql server'] },
  { label: 'NoSQL / Redis', cat: 'data', aliases: ['redis', 'mongodb', 'cassandra', 'hbase', 'dynamodb', 'nosql'] },
  { label: 'Elasticsearch', cat: 'data', aliases: ['elasticsearch', 'opensearch', 'lucene', 'solr'] },

  // ---------- 云与工程 ----------
  { label: 'Docker', cat: 'cloud', aliases: ['docker', 'container', 'containerization', '容器化'] },
  { label: 'Kubernetes', cat: 'cloud', aliases: ['kubernetes', 'k8s', 'helm'] },
  { label: 'AWS', cat: 'cloud', aliases: ['aws', 'amazon web services', 'sagemaker', 's3', 'emr', 'ec2'] },
  { label: 'GCP', cat: 'cloud', aliases: ['gcp', 'google cloud', 'vertex ai', 'dataflow', 'dataproc'] },
  { label: 'Azure', cat: 'cloud', aliases: ['azure', 'azure ml'] },
  { label: 'CI/CD', cat: 'cloud', aliases: ['ci/cd', 'cicd', 'jenkins', 'github actions', 'gitlab ci', '持续集成'] },
  { label: 'Linux', cat: 'cloud', aliases: ['linux', 'shell', 'bash'] },
  { label: 'Microservices', cat: 'cloud', aliases: ['microservice', 'microservices', 'grpc', 'rest api', 'restful', '微服务'] }
];

export const ROLE_PROFILES = {
  ml: { label: '机器学习工程师 / ML Engineer', cats: { ml: 3, algo: 1.5, infra: 1.5, lang: 1, cloud: 0.5 } },
  algo: { label: '搜广推算法工程师 / Ranking & Ads', cats: { algo: 3, ml: 2, lang: 0.5, data: 0.5 } },
  llm: { label: '大模型算法工程师 / LLM Engineer', cats: { llm: 3, infra: 2, ml: 1 } },
  mm: { label: '多模态算法工程师 / Multimodal', cats: { mm: 3, llm: 1.5, ml: 1, infra: 0.8 } },
  de: { label: '数据工程师 / Data Engineer', cats: { data: 3, cloud: 1.5, lang: 1 } }
};

export const TOP_VENUES = [
  'neurips', 'nips', 'icml', 'iclr', 'cvpr', 'iccv', 'eccv', 'acl', 'emnlp', 'naacl', 'coling',
  'kdd', 'sigir', 'wsdm', 'cikm', 'recsys', 'aaai', 'ijcai', 'tpami', 'jmlr', 'tkde', 'icde', 'sigmod', 'vldb', 'interspeech', 'icassp', 'acm mm', 'acm multimedia', 'the web conference'
];

export const STRONG_VERBS_EN = [
  'led', 'owned', 'designed', 'architected', 'built', 'developed', 'engineered', 'implemented', 'launched', 'shipped',
  'delivered', 'deployed', 'optimized', 'improved', 'reduced', 'increased', 'accelerated', 'scaled', 'automated',
  'streamlined', 'spearheaded', 'pioneered', 'proposed', 'established', 'drove', 'trained', 'pretrained', 'fine-tuned',
  'devised', 'formulated', 'created', 'migrated', 'refactored', 'published', 'mentored', 'directed', 'orchestrated',
  'boosted', 'cut', 'achieved', 'introduced', 'redesigned', 'productionized', 'benchmarked', 'evaluated', 'analyzed',
  'modeled', 'invented', 'unified', 'consolidated', 'initiated', 'authored', 'collaborated', 'partnered', 'resolved'
];

export const STRONG_VERBS_ZH = [
  '主导', '牵头', '负责并主导', '设计', '搭建', '构建', '研发', '开发', '提出', '实现', '优化', '推动', '落地', '上线',
  '部署', '重构', '升级', '建立', '创建', '攻克', '突破', '完成', '迭代', '训练', '微调', '蒸馏', '发表', '指导', '带领',
  '统筹', '制定', '沉淀', '改进', '提升', '降低', '解决', '探索', '验证', '主持', '独立负责'
];

// 口语化 / 弱表述，附带替换建议
export const WEAK_PHRASES = [
  { re: /\bresponsible for\b/i, phrase: 'responsible for', fix: '改为以强动词开头描述个人产出，如 "Led / Owned / Designed …"' },
  { re: /\bhelped( to)?\b/i, phrase: 'helped', fix: '明确个人贡献："Contributed X by doing Y, resulting in Z"' },
  { re: /\bworked on\b/i, phrase: 'worked on', fix: '改为 "Developed / Implemented …" 并补充结果' },
  { re: /\bassisted( in| with)?\b/i, phrase: 'assisted', fix: '写清楚你独立负责的模块，避免从属表述' },
  { re: /\b(participated|involved) in\b/i, phrase: 'participated / involved in', fix: '改为具体动作 + 可量化结果，突出 ownership' },
  { re: /\bduties included\b/i, phrase: 'duties included', fix: '删除职责式描述，改为成果式描述（STAR 中的 A + R）' },
  { re: /\btried to\b/i, phrase: 'tried to', fix: '只写已完成的动作与结果' },
  { re: /\b(a lot of|lots of|many|various|several)\b/i, phrase: 'a lot of / many / various', fix: '用具体数字替代模糊量词（如 "12 models", "3 teams"）' },
  { re: /\b(pretty|kind of|sort of|basically|really|very)\b/i, phrase: 'pretty / very / basically', fix: '删除口语化修饰词，学术表述不使用程度副词' },
  { re: /\b(stuff|things)\b/i, phrase: 'stuff / things', fix: '替换为准确的技术名词' },
  { re: /\betc\.?/i, phrase: 'etc.', fix: '列出最重要的 2-3 项即可，避免 "etc."' },
  { re: /(^|[\s(])(I|my|me|we|our)\s/, phrase: '第一人称 I / my / we', fix: '英文简历省略主语，直接以过去式动词开头' },
  { re: /参与(了)?/, phrase: '参与', fix: '改为"主导/负责……模块的设计与实现"，并写明个人贡献比例' },
  { re: /协助|帮忙|帮助(团队|同事|组内)/, phrase: '协助 / 帮忙', fix: '明确你独立完成的部分，避免从属表述' },
  { re: /做了|干了|搞(了|定)?|弄(了)?/, phrase: '做了 / 搞 / 弄', fix: '替换为书面动词："设计并实现""构建""完成"' },
  { re: /一些|很多|大量|许多|若干/, phrase: '一些 / 很多 / 大量', fix: '用具体数字量化（如"12 个模型""日均 3 亿条"）' },
  { re: /非常|特别|比较|挺|相当|十分/, phrase: '非常 / 比较 / 特别', fix: '删除程度副词，用数据支撑' },
  { re: /大概|大约|差不多|感觉|觉得/, phrase: '大概 / 感觉', fix: '学术表述需确定性措辞，给出准确数值或区间' },
  { re: /等等|之类/, phrase: '等等 / 之类', fix: '列出核心项即可，避免"等等"' },
  { re: /学习了|了解了|接触过|熟悉了/, phrase: '学习了 / 接触过', fix: '经历中只写产出；技能栏用"熟练掌握 / 具备……工程实践经验"（须属实）' },
  { re: /负责(一些|部分|日常)/, phrase: '负责一些 / 日常', fix: '聚焦有成果的核心工作，删去日常事务' },
  { re: /打杂|跟进|对接/, phrase: '打杂 / 跟进 / 对接', fix: '改为体现技术深度的动作，或删除' }
];

export const SECTION_PATTERNS = {
  summary: /^(summary|professional summary|profile|about me|objective|career objective|个人简介|个人总结|自我评价|个人优势|求职意向)(?:$|[\s/&|(（,，])/i,
  education: /^(education|academic background|educational background|教育背景|教育经历|学历)(?:$|[\s/&|(（,，])/i,
  experience: /^(work experience|professional experience|experience|employment( history)?|industry experience|internships?|internship experience|工作经历|实习经历|工作经验|职业经历|工作及实习经历)(?:$|[\s/&|(（,，])/i,
  projects: /^(projects?|selected projects|research experience|research projects|项目经历|项目经验|科研经历|研究经历|科研项目)(?:$|[\s/&|(（,，])/i,
  skills: /^(skills|technical skills|core competencies|technologies|tech stack|专业技能|技能|技术栈|个人技能|技能清单)(?:$|[\s/&|(（,，])/i,
  publications: /^(publications?|papers|selected publications|patents?|论文|论文发表|发表论文|学术成果|专利)(?:$|[\s/&|(（,，])/i,
  awards: /^(awards|honors|honours|achievements|competitions|荣誉|获奖|奖项|竞赛)(?:$|[\s/&|(（,，])/i
};
