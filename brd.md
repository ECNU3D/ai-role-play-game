# 基于LLM的网页RPG：产品需求文档 (BRD)

## 1. 简介

本文档概述了一款基于网页的沙盒角色扮演游戏（RPG）的产品需求。其核心体验由一个大型语言模型（LLM）扮演游戏管理员（Game Master）驱动，创造一个动态且沉浸式的叙事。该游戏将完全在客户端的网页浏览器中运行，并利用浏览器存储进行持久化。为了增强视觉沉浸感，游戏将结合由文本到图像模型根据场景描述生成的图像。

核心游戏循环如下：
1. 玩家设定自己的角色。
2. LLM呈现一个场景，包括描述和图像。
3. 玩家以自然语言输入一个动作。
4. LLM处理该动作，更新游戏状态，并生成一个新的场景和叙事。
5. 游戏状态被保存��用户浏览器的本地存储中。

## 2. 核心功能

### 2.1. 由LLM驱动的游戏管理员
游戏将由一个LLM控制，该LLM遵循项目`prompt.md`中定义的详细逻辑和角色。其职责包括：
- **角色创建：**引导玩家完成角色创建，并生成初始统计数据和属性。
- **场景呈现：**以丰富的叙事风格描述环境、角色和事件。
- **互动式叙事：**响应玩家的动作，推进情节，管理NPC互动，并执行游戏规则。
- **状态管理：**跟踪并报告角色统计数据（HP、MP等）、物品栏和世界状态的变化。
- **结构化响应：**以一致的格式提供响应，客户端可以解析这些响应以更新UI和游戏状态。
请参阅项目的'generate_text.py'以了解如何与Gemini LLM进行交互。

### 2.2. 动态图像生成
- 对于游戏管理员呈现的每个新场景，一个描述性的提示将被发送到文本到图像服务。
- 生成的图像将在UI中显著位置显示，以视觉方式呈现当前的环境、角色和事件，使基于文本的世界更加生动。
请参阅项目的'generate_image.py'以了解如何与Gemini LLM进行文本到图像任务的交互。

### 2.3. 基于网页的客户端
- 整个游戏将通过标准的网页浏览器进行访问和游玩。
- 游戏逻辑不需要后端服务器，因为所有��作都将通过JavaScript在客户端处理。
- 该应用程序将是一个单页应用程序（SPA），以获得无缝、不间断的体验。

### 2.4. 基于浏览器的数据持久化
- 所有游戏数据，包括角色表、世界状态、物品栏和游戏进度，都将存储在用户浏览器的本地。
- 将使用IndexedDB，因为它能够存储结构化数据，确保游戏状态在会话之间得以保存。

### 2.5. 用户界面
UI将简洁、直观，并专注于叙事。
- **叙事日志：**一个主视图，用于显示来自LLM的故事文本。
- **图像显示：**一个专用区域，用于显示当前场景生成的图像。
- **输入命令栏：**一个文本字段，供玩家输入他们的动作。
- **建议的动作：**一个可点击按钮的列表，用于LLM建议的动作，以便快速推进。
- **状态模态框：**用于显示特殊命令（`status`、`chars`、`env`）的详细信息的覆盖层。

## 3. 技术架构

- **前端：**原生HTML5、CSS3和JavaScript（ES6+）。为了保持简单，初始版本不需要框架。
    - `index.html`：应用程序的主要结构。
    - `style.css`：用于UI的样式设计，可能采用深色的奇幻主题美学。
    - `app.js`：主要的应用程序逻辑，处理游戏循环和UI更新。
- **LLM和图像API集成：**
    - 客户端JavaScript将直接对所选的LLM（用于文本生成）和文本到图像服务进行API调用。
    - API密钥将由客户端管理（例如，由用户配置并存储在`localStorage`中）。
- **数据存储：**
    - **IndexedDB：**将作为主数据库使用。
    - **模式：**
        - `characters`：一个对象存储，用于所有角色数据（玩家、NPC、敌人）。
        - `worldState`：一个键值存储，用于全局游戏信息，如时间、地点和天气。
        - `gameLog`：一个对象存储，用于保存交互历史。

## 4. 实施计划

该项目将分阶段开发，以确保结构化和迭代的推出。

### 阶段1：核心机制和UI外壳
*   **目标：**建立基本结构，并使核心游戏循环功能化。
*   **任务：**
    1.  **HTML/CSS：**创建`index.html`文件，包含基本的UI布局（叙事显示、图像占位符、输入栏），并应用初始CSS以获得干净、可读的界面。
    2.  **数据库：**实现一个`db.js`模块，包含用于初始化和管理IndexedDB数据库及其对象存储的辅助函数。
    3.  **LLM服务：**创建一个`llm.js`模块，用于处理对文本生成模型的API调用。
    4.  **角色创建：**构建初始的角色创建表单。提交后，将新角色保存到IndexedDB。同时提供一个按钮可以重制游戏角色，重新开始
    5.  **基本游戏循环：**
        - 连接输入字段以捕获玩家命令。
        - 提交命令后，构建一个基本的提示并将其发送到LLM服务。
        - 在叙事日志中显示原始文本响应。

### 阶段2：高级游戏逻辑和状态管理
*   **目标：**完全实现`prompt.md`中定义的游戏规则和状态跟踪。
*   **任务：**
    1.  **高级提示工程：**增强提示构建逻辑，以包括来自`prompt.md`的完整上下文、来自IndexedDB的角色数据和当前的世界状态。
    2.  **响应解析：**实现一个健壮的解析器，以解构LLM的结构化响应（例如，分离叙事、对话、状态变化和建议的动作）。
    3.  **状态更新：**使用解析的数据更新IndexedDB中的角色和世界状态。
    4.  **UI集成：**
        - 动态地将“建议的动作”呈现为可点击的按钮。
        - 实现`status`、`chars`和`env`命令，以从IndexedDB获取数据并在格式化的模态框中显示。

### 阶段3：图像生成和视觉润色
*   **目标：**集成文本到图像功能并完善用户体验。
*   **任务：**
    1.  **图像生成服务：**创建一个`image.js`模块，用于处理对文本到图像模型的API调用。
    2.  **集成：**从LLM接收到场景描述后，为图像模型提取一个提示，调用该服务，并显示返回的图像��为图像实现一个加载状态。
    3.  **UI/UX改进：**润色CSS，为叙事日志添加平滑滚动，并确保布局对不同屏幕尺寸具有响应性。

### 阶段4：最终确定和部署
*   **目标：**准备游戏以供公众使用。
*   **任务：**
    1.  **配置：**添加一个设置区域，用户可以在其中安全地输入并保存自己的LLM和图像服务的API密钥。
    2.  **测试：**对所有功能进行彻底的端到端测试，重点关注`prompt.md`中的逻辑规则。
    3.  **文档：**创建一个`README.md`文件，其中包含关于如何玩游戏和配置API密钥的清晰说明。
    4.  **部署：**将静态文件（HTML、CSS、JS）托管在像GitHub Pages这样的服务上，以便于公众访问。