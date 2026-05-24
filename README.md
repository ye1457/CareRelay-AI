# CareRelay AI 家庭照护交接助手

CareRelay AI 是一个面向家庭照护交接场景的第一版黑客松 Demo。系统把文字、语音和图片中的照护信息整理成清晰的今日交接卡，并输出情感分析、待办清单、风险雷达、可视化信息图、语音播报和按监护对象隔离的个性化知识库。

## 功能概览

- 三模态输入：文字记录、电脑麦克风/音频上传、图片上传。
- 今日交接卡：健康指数、今日摘要、家人群消息、情感状态、待确认事项、下一步待办、照护时间线。
- 图片理解：支持药盒、处方、复诊单、聊天截图、护理记录等图片信息抽取。
- 语音输入：录音后自动转写并写入文本框，再进入结构化解析。
- 可视化信息图：交接卡先返回，信息图异步生成，避免等待过久。
- 个人知识库：按监护对象保存偏好、常规事项、复诊准备等记忆。
- 侧边栏模块：今日监护、监护人、历史信息、知识库、视频观察与通话。

## 技术架构

```text
frontend/
  index.html        单页产品界面
  styles.css        响应式布局、独立滚动、信息图放大等交互样式
  app.js            三模态输入、即时解析、接口调用、语音播报、视频观察

backend/
  main.py           FastAPI 路由与静态资源服务
  api_client.py     大模型、ASR、Vision、Embedding、Image API 客户端
  pipeline.py       CareRelay Agent Pipeline
  memory.py         SQLite 个人知识库与向量检索
  fallback.py       离线样例与备用可视化
  schemas.py        结构化交接卡数据模型

scripts/
  start_demo.sh     启动服务
  smoke_models.py   模型连通性测试
```

核心 Agent Pipeline：

1. `AudioAgent`：语音转写，提取用户口述照护信息。
2. `VisionAgent`：解析图片中的处方、复诊、护理记录、聊天截图等信息。
3. `MemoryAgent`：检索当前监护对象的个性化知识库。
4. `FusionAgent`：融合文本、语音转写、图片解析和记忆命中。
5. `AnalysisAgent`：调用高质量模型生成结构化交接卡。
6. `SafetyAgent`：对药物、剂量、症状、复诊等内容加安全边界。
7. `VisualAgent`：异步生成交接信息图，失败时显示本地备用图。
8. `InteractionAgent`：生成家人群消息、追问项、语音播报内容。

## 快速启动

```bash
cd /home/dataset-assist-0/usr/lh/zzy/inter_demo_zgc
pip install -r requirements.txt
bash scripts/start_demo.sh
```

默认服务地址：

```text
http://127.0.0.1:7860
```

如果通过 Cursor SSH 连接远程服务器，请在 Cursor 的 Ports/端口转发面板中转发 `7860`，然后在本地浏览器打开转发后的地址。

## API 配置

后端按以下优先级读取 API 配置：

1. 环境变量 `CARE_RELAY_API_KEY`、`CARE_RELAY_BASE_URL`
2. 上级目录 `/home/dataset-assist-0/usr/lh/zzy/test_api.py` 中的 `API_KEY`、`BASE_URL`

示例：

```bash
export CARE_RELAY_API_KEY="your-api-key"
export CARE_RELAY_BASE_URL="https://your-gateway.example.com/v1"
bash scripts/start_demo.sh
```

注意：不要把 API key 写入前端文件或提交到 GitHub。

## 模型连通性测试

```bash
cd /home/dataset-assist-0/usr/lh/zzy/inter_demo_zgc
python scripts/smoke_models.py
```

建议验收前至少测试：

- 文本结构化分析模型
- 图片理解模型
- `whisper-1` 语音转写
- `gpt-image-2` 信息图生成
- `text-embedding-3-large` 记忆向量

## 使用流程

1. 在“监护对象”中选择或输入对象，例如 `爷爷`、`宝宝`、`小猫`。
2. 在“照护记录”输入自然语言，例如“今天已经做了...后续还要确认...下一步待做...”。
3. 可点击麦克风录音，语音会自动转写到文本框。
4. 可上传处方、药盒、复诊单或聊天截图，图片解析结果会自动加入文本框。
5. 点击“生成今日交接卡”。
6. 查看今日摘要、必须确认、下一步、时间线、家人群消息和风险雷达。
7. 信息图会在后台异步生成，完成后自动替换备用图；点击图片可放大。
8. 点击“语音播报”可播放关键提醒。
9. 在“知识库”页为当前监护对象保存个性化记忆。

## 复现说明

本仓库不提交运行期产生的本地数据库、上传音频、缓存图片和 API 密钥。首次启动时系统会自动创建 `data/care_relay.sqlite3`、`data/cache/`、`data/uploads/`。

为了保证 Demo 稳定，后端对每个模型调用设置超时和 fallback；如果外部模型不可用，系统会显示离线样例或本地结构化结果，保证界面可演示。

## 医疗安全边界

CareRelay AI 只做家庭照护信息整理、交接提醒和沟通辅助，不做医疗诊断，不提供自行调整药物剂量建议。涉及药物、剂量、症状和复诊安排时，系统会使用“按医嘱执行/联系医生确认”的保守表达。

## 后续技术路线

- 模型后训练：后续会基于家庭照护交接数据、处方说明、护理记录和多角色沟通样例，训练垂直领域专项化模型，提高交接信息抽取、风险识别、任务拆解和安全表达能力。
- 知识图谱：后续会构建监护对象、药物、症状、复诊、家庭成员、照护事件之间的知识图谱，为模型推理拓充辅助语义信息，提升个性化检索和多跳风险解释能力。
- 多端协同：后续可接入微信/日历/IoT/摄像头设备，实现真实家庭协作闭环。
- 评测体系：后续会建立照护交接质量评测集，覆盖准确率、完整性、安全边界、任务可执行性和家属可读性。

