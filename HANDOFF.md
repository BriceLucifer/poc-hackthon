# Handoff — Research Contract Adviser POC

写给接手的人（你自己）。三件事：怎么跑、做了什么、还缺什么。

---

## 1. 启动流程

### 一次性准备

```bash
cd poc

# 后端：装依赖 + 配 Azure key
cd backend
uv sync --extra azure-openai
cp .env.example .env
# 编辑 .env 填以下 5 个值（都从 Azure Portal 取）：
#   AZURE_OPENAI_ENDPOINT     https://<resource>.openai.azure.com
#   AZURE_OPENAI_API_KEY      <key>
#   AZURE_OPENAI_API_VERSION  2024-10-21
#   AZURE_OPENAI_CHAT_DEPLOYMENT    gpt-4o
#   AZURE_OPENAI_EMBED_DEPLOYMENT   text-embedding-3-large
cd ..

# 前端：装依赖
cd frontend
npm install
cd ..
```

注意：**hackathon 用过的 key 已经 commit 进 `backend/.env`**（见首次会话）—— 黑客松结束后必须 regenerate。

### 日常启动（两个终端）

```bash
# 终端 1：后端
cd backend
uv run serve
# 监听 http://localhost:8000
# OpenAPI docs:  http://localhost:8000/docs

# 终端 2：前端
cd frontend
npm run dev
# 浏览器打开 http://localhost:5173
```

### 跑评估

```bash
cd backend
uv run python ../eval/run_eval.py --save
# 终端打印 P/R/F1，写入 eval/reports/<timestamp>.json，
# 同时覆盖 eval/reports/latest.json（前端 EvalScorecard 读这个）
```

### 杀进程（如果端口被占）

```bash
pkill -f 'uvicorn main:app'
pkill -f 'vite'
```

---

## 2. 已经做了什么

### 后端架构（`backend/`）

```
main.py              FastAPI 入口，9 个路由
agent.py             4 步流水线编排（ingest → classify → compare → review）
api_clients.py       Azure OpenAI 客户端 + usage tracking + vision OCR
models.py            Pydantic schemas（13 种合同类型 + 4 旗等级 + ReviewMetrics）
data/uoa_positions.json   21 条 UoA 立场，3-tier 结构（Preferred/Acceptable/Escalation）

services/
├── parser.py        PDF/DOCX/TXT 解析 + 多模式 clause 切分（数字 / ALL-CAPS / 段落）
├── vision_ocr.py    GPT-4o vision 兜底，仅 OCR 没文字层的页（min 50 chars 阈值）
├── classifier.py    关键词加权 + LLM 精修（13 类合同）
├── comparator.py    确定性比对：keyword → 主题 → 三层 cue（red/amber/green/blue）
├── templates.py     按合同类型加载对应 UoA 模板 DOCX，喂给 LLM 作 reference
└── reporter.py      flag 排序 + counts 聚合
```

### 关键决策（按时间）

1. **Azure AI Foundry 优先**（不是 OpenAI 公网）—— `LLM_BACKEND=auto` 优先 Azure OpenAI，可切到 Foundry MaaS（Llama/Mistral）
2. **UoA Positions 编进 JSON 而不是 RAG 检索** —— 21 条总共 3K tokens，完整注入更准
3. **加 UoA 模板作 reference**（key 改进） —— F1 从 0.554 → 0.733
4. **`temperature=0`** —— eval 可复现
5. **Vision OCR 兜底而非全替代** —— 全替代会让 OCR 改写法律措辞导致 F1 退化（实测 0.733 → 0.510）

### 前端架构（`frontend/`）

```
src/
├── App.tsx              状态机：idle → uploading → classifying → reviewing → done
├── lib/
│   ├── api.ts           thin fetch 封装，9 个 endpoint
│   ├── flags.ts         4 旗的 meta（颜色、label）
│   └── exportReport.ts  Markdown 导出
└── components/
    ├── Header           顶部 Foundry 状态指示
    ├── Hero             落地标题
    ├── UploadCard       拖放区
    ├── SamplePicker     "Try MTA Example" 一键
    ├── ContractTypeBadge  类型识别 + 置信度条
    ├── SummaryCard      Executive Summary + Metrics chip + 下载报告 + Compared against
    ├── FlagSection x4   Red/Amber/Blue/Green 折叠卡，clause-level rationale
    ├── EvalScorecard    P/R/F1/cost/mismatches，吃 /api/eval/latest
    ├── ChatDock         右下角浮动 chat
    └── Footer
```

技术栈：React 18 + Vite + TS + Tailwind + framer-motion + lucide-react。Apple 风：SF font stack、glass 卡片、柔阴影、4 色系统。

### Eval 框架（`eval/`）

```
eval/
├── golden/mta_example_1.json     17 条手标 gold（我标的 v0，建议你 review）
├── lib/metrics.py                P/R/F1/confusion + 终端渲染
├── run_eval.py                   CLI：--case 选择 / --save 持久化
└── reports/                      历次 eval JSON + latest.json（前端读）
```

### 当前 baseline 数字（MTA Example 1）

```
Accuracy:   81.25%
Macro-F1:   0.733
Per-level:  green 0.67  amber 0.67  red 0.67  blue 0.93
Mismatches: 4 / 17
Cost:       $0.087 per review (含 OCR)
Latency:    ~120 秒
LLM calls:  5 (2 vision OCR + 3 review)
```

### 数据资产（`data/`）

| 文件 | 用途 |
|---|---|
| `Contracting Positions...PDF` | UoA 政策原文（已抽进 `uoa_positions.json`） |
| `UoA-Material_Transfer_Agreement *.docx` (in/out) | MTA 模板，agent 自动加载作 reference |
| `UoA-Student Research Agreement Template *.docx` | SRA 模板 |
| `MTA Example 1.pdf` | 真实匿名 MTA，eval gold 已标 |
| `Student Research Agreement Example 1.pdf` | 真实匿名 SRA，eval gold **未标** |

---

## 3. 还缺什么

按优先级排（你 demo / 接手后再做）：

### P0 — Demo 必须

- **`.env` 里 hackathon key 必须 rotate** —— 那个 key 已经在我们对话历史里
- **检查样本 PDF 不含真实敏感信息** —— 现在 `data/MTA Example 1.pdf` 和 `Student Research Agreement Example 1.pdf` 标榜"redacted"，但快速过一眼公司名/人名是否真的脱敏了

### P1 — 提性能（如果有时间）

- **多栏 PDF 抽取**：SRA 文字层页面是 2 栏，pdfplumber 抽出来左右栏交错，per-clause mapping 受影响。改成按 bounding box 分栏抽取（pdfplumber 有 `extract_words` + 按 x0 排序）。预期 SRA amber 数会降。
- **更多 gold 样本**：现在只有 MTA 1 份。labeling 一份 SRA + 一份 CDA 就能跑跨类型 F1，demo 时数字更有说服力。
- **修剩下 4 个 mismatch**（见 `eval/reports/latest.json` 的 `rows`）：
  - POS-10 warranty (clause 4) 漏检 —— 加 "fitness for a particular purpose" 关键字
  - POS-07 mutual exclusion (clause 9) 应是 green —— 拓宽 GREEN 模式包含 "will not extend to"
  - POS-IP "retains ownership of materials" (clause 12) —— 加 "retains ownership"、"custodian rights" 到 IP keywords

### P2 — 工程化

- **下载 11 份 UoA 模板补全 templates registry**：现在 `services/templates.py` 列了 11 个模板路径，但只有 MTA in/out + SRA 实际下载了。Azure blob 容器里其他 8 份（CDA/DTA/DAA/MSA/PoS/Collaboration）没下载，对应类型走 LLM 时不会有模板 reference。
- **多文件批量上传**：现在前端单文件。RGC team 实际工作流是一批合同一起审。
- **Reviewer 反馈回路**：加一个 `/api/feedback` 端点，让 reviewer 标"这条 flag 不对"，把反馈数据攒起来反哺 prompt 调优 / gold labels。
- **DOCX 导出报告**：现在只能下载 Markdown。RGC team 大概率想要 .docx。
- **持久化层**：现在文档只在内存（重启就没）。production 要 Redis 或 SQLite。

### P3 — 长远

- **接进 RCRM**：跟 University Research CRM 集成，review 完直接挂到合同记录上
- **Agent loop**：reviewer 可以在 chat 里说 "redo clause 7 considering the cap"，agent 重跑那条 clause
- **Embedding-based 主题检索**：替换 `comparator.py` 的关键词匹配为 `text-embedding-3-large` 余弦相似度，对模板措辞变化更鲁棒
- **数据驻留合规**：现在用 Azure OpenAI（在 NZ/AU region 应该 OK），但 RGC 真上线前要跟 IT/法务确认 data residency

---

## 4. 怎么 demo（5 分钟讲法）

1. **开场 30 秒**：业务问题 —— RGC team 手工审合同，慢、易漏、不可审计
2. **演示 90 秒**：
   - 浏览器开 :5173
   - 点 "Try MTA Example 1" → 等 30s
   - 看 Executive Summary（"uncapped liability + indemnity + IP escalation"）
   - 看 4 旗分布、metrics chip（gpt-4o · 5 calls · $0.087 · 120s）
   - 展开一条 Red flag 看 rationale + standard ref
   - 点 "Download report" 下 Markdown
3. **eval 30 秒**：展开 Pipeline Evaluation 折叠面板 —— Accuracy 81.25%、F1 0.733、4 mismatches 都列出来
4. **架构 60 秒**：解释为什么不用 RAG / 不用 LangGraph —— 21 条立场 + 模板能直接喂，自写 200 行编排换来可审计 + 可复现
5. **责任 AI 30 秒**：每条 flag 有 standard_ref；agent 不批准只标记；human-in-the-loop pill；NZ data residency via Azure
6. **Q&A**：常见问题准备（见下）

### 评委可能问 + 怎么答

- **Q: 为什么不用 LangGraph / Pydantic-AI**：domain logic（21 立场 + 模板 + 4 旗映射）是瓶颈，不是编排。框架抽象省 200 行换来一层学习成本，POC 不值。
- **Q: 为什么不用 RAG**：所有 reference 文档（21 立场 + 1 模板）能塞进 8K tokens，全注入比检索更准、更可解释。
- **Q: 准确率怎么算的**：手标 gold 17 条 clause，pipeline 跑一遍，per-level P/R/F1。代码在 `eval/`。
- **Q: 怎么处理扫描 PDF**：自动用 GPT-4o vision OCR 兜底（pdfplumber 抽不到字时触发），实测 SRA 那份从 17K → 34K 字符内容恢复。
- **Q: 法律风险**：agent 永远不批准合同，每个 red flag 都标具体的升级路径（"Refer to Research Grants and Contracts Delegations"），所有决定仍归 RGC team。

---

## 5. 几个 gotcha

- **Backend 是 `--reload`**：改后端代码自动 reload，但加了新 dataclass 字段时偶尔需要手动重启
- **`uv run` 必须在 `backend/` 目录**：脚本路径硬编码 backend 为 cwd
- **eval 跑一次大约 2 分钟**：因为 vision OCR 走真 API
- **OCR 成本现在算进 metrics**了（早期 bug 已修），所以你看到 cost 比以前高是真实，不是退化
- **Vision OCR 用的 prompt 在 `api_clients.py:call_vision_ocr`**：要求 "transcribe exactly as written"，避免改写法律措辞
- **`backend/uploads/` 是上传缓存目录**，启动时会建好但目前只在内存用 doc

---

## 6. 调试常用命令

```bash
# 查看后端日志
cd backend && uv run uvicorn main:app --port 8000 --log-level debug

# 仅跑 parser 不调 LLM
cd backend && uv run python -c "
from services.parser import extract_text, split_clauses
raw = open('../data/MTA Example 1.pdf','rb').read()
text = extract_text('MTA Example 1.pdf', raw)
clauses = split_clauses(text)
print(f'{len(clauses)} clauses')
"

# 仅跑 ingest（含 vision OCR）
cd backend && uv run python -c "
import asyncio
from dotenv import load_dotenv
load_dotenv('.env')
from agent import ingest
asyncio.run(ingest('foo.pdf', open('../data/foo.pdf','rb').read()))
"

# 看 eval JSON 完整内容
jq . eval/reports/latest.json | less
```

---

接手顺利。出问题随时回来 ping。
