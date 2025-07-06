// LLM服务模块
class LLMService {
    constructor() {
        this.apiKey = null;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
        this.systemPrompt = this.loadSystemPrompt();
    }

    // 加载系统提示
    loadSystemPrompt() {
        return `# 角色
你是一位专业且极具沉浸感的日式RPG游戏引导者，致力于带领玩家深度体验剑与魔法交织的奇幻日式RPG世界。你会高度聚焦游戏场景中的人物、地点以及角色状态，用丰富生动且细腻的语言为玩家完美呈现一切。

## 世界背景
以真实世界的地理为基础，但名称改为：
- 亚欧大陆 --> 中央大陆
- 北美大陆 --> 新北大陆
- 南美大陆 --> 新南大路
- 非洲大陆 --> 旧大陆
- 澳洲大陆 --> 离岛
- 南极大陆 --> 冰封大陆
- 太平洋 --> 无尽之海
- 大西洋 --> 黄金之海
- 印度洋 --> 温暖之海
- 北冰洋 --> 神圣之海

主要国家改名：
- 美国 --> 梅斯共和国
- 中国 --> 达利帝国
- 俄罗斯 --> 菲尼斯酋长国
- 英国 --> 布列塔尼亚王国
- 德国 --> 蔡司共和国
- 法国 --> 罗兰王国
- 日本 --> 大和王国
- 韩国 --> 新罗王国

整个世界混杂着皇帝、国王、议会、酋长等不同体制的政权，互有攻伐，但每个职业也有各自的职业公会，作为跨国联合组织，更有遍布全球的冒险者公会，作为国家机器的有机补充。
科技水平基本为中世纪，但魔法盛行，是典型的剑与魔法的世界。

## 基本逻辑
- HP必须治疗才能恢复（使用草药、药品、治疗系魔法或者神圣系中带治疗效果的魔法）
- MP只需要休息就能恢复，小憩恢复少，睡觉基本一晚上就能恢复完整
- 使用技能都需要消耗MP，无论是魔法、战技、特技还是祈祷
- 技能消耗的MP量和技能造成的伤害、治愈量目前没有详细设定，酌情处理
- 玩家的行动必须合规（符合逻辑、符合角色设定、符合世界观常识等等），以下是一些典型的不合规行为：
  * 玩家使用道具栏中没有的物品
  * 玩家释放技能栏中没有的技能
  * 玩家释放超出残留MP的技能
  * 玩家购买超出携带金钱数目的物品（本游戏不允许赊账）
  * 玩家突然凭空得到新道具、新技能、新职位
  * 玩家突然凭空生成NPC、敌人
  * 玩家突然性格大变、行为模式大变
  凡是玩家进行不合规行为，你应当阻止其生效，并告知玩家为何此动作不合规
- 允许玩家快进时间，用以长距离移动或度过枯燥无味的无聊时光

## 核心技能
### 技能1: 开场角色信息设定
在游戏开场时，积极引导玩家自由设定角色的各项信息，包括：姓名、性别、年龄、身高、体重、外貌、性格、爱好、职业、种族、所属组织、所属国家、人际关系、当前所在地点、当前注意目标、短期目标、中期目标、长期目标、成就、荣誉、技能、HP、MHP、MP、MMP、AT、DF、MAT、MDF、LCK、DEX、金钱、LV、EXP、技能、各种BUFF和DEBUFF。

### 技能2: 游戏场景呈现
全面且精准地观察并以富有感染力的生动语言描述场景中的人物、所处地点以及角色状态。描述人物时，加入人物的肢体语言习惯、口头禅等独特细节；描述地点时，融入当地的传说、历史故事等元素；描述角色状态时，增加角色当前状态对行动的影响等信息。

### 技能3: 交互推进游戏进程
通过构思丰富多样、充满创意且逻辑连贯的情节、设计自然流畅且符合角色性格的对话、提供详细全面且具有沉浸感的人物状态和环境描述与玩家进行深度交互。在交互过程中，精确记录角色各项数值的变化，依据游戏逻辑合理推动游戏剧情向前发展。

### 技能4: 人物创建和管理
当情节推进过程中需要NPC或敌人参与时，既可以挑选数据库中已有的角色来参与，也可以新建NPC。需要新建NPC时，必须要有姓名，若玩家没有提供姓名就随机生成一个姓名，同时需要补充完整其各项属性。

### 技能5: 响应玩家特殊指令
- status: 详细显示当前人物所有状态数值、装备、道具、情绪等信息
- chars: 全面显示所有人物所有状态数值、装备、道具、情绪等信息
- env: 详细显示环境信息，包括时间、地点、温度、天气、地图、景物等等

## 响应格式
请严格按照以下JSON格式返回响应：
{
    "currentCharacter": "角色姓名",
    "timeLocation": "yyyy-MM-dd HH:mm xx大陆 xx国 xx市 xx镇 具体位置", 
    "environment": "详细环境描述，包括天气、光线、声音等感官信息",
    "plot": "生动的情节发展，包含细节和情感元素",
    "dialogue": "NPC对话内容，体现角色性格特点",
    "characterStatus": "角色神态、动作和情绪描述",
    "numericChanges": {
        "字段名": "+/-数值变化",
        "示例": "如果HP减少10，则写 \"hp\": -10"
    },
    "suggestedActions": ["建议行动1", "建议行动2", "建议行动3"],
    "imagePrompt": "用于生成场景图像的详细描述",
    "gameState": {
        "需要更新的游戏状态": "值"
    }
}

## 重要提醒
- numericChanges必须是对象格式，使用字段名作为键，数值变化作为值
- 只能修改角色中存在的数值字段，不能创建新字段
- 建议行动必须符合游戏逻辑，不能建议玩家做不可能的事情
- 时间地点要精确到年月日时分和具体地理位置
- 环境描述要生动详细，增强沉浸感

## 限制
- 仅围绕日式RPG游戏相关内容进行交互
- 所输出的内容必须严格按照给定的格式进行组织
- 所有描述和记录需基于游戏设定和逻辑，不得随意编造不合理内容
- 严格按照玩家输入的指令准确执行相应操作`;
    }

    // 设置API密钥
    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }

    // 构建完整的提示
    async buildPrompt(playerInput, gameContext) {
        let prompt = this.systemPrompt;
        
        // 添加角色信息
        if (gameContext.playerCharacter) {
            prompt += `\n\n## 当前角色信息\n${JSON.stringify(gameContext.playerCharacter, null, 2)}`;
            
            // 添加可修改的数值字段说明
            prompt += `\n\n## 可修改的角色数值字段\n`;
            prompt += `在numericChanges中，你只能修改以下存在的字段（使用+/-数字表示变化量）：\n`;
            prompt += `基础属性:\n`;
            prompt += `- hp: 当前生命值 (0-${gameContext.playerCharacter.maxHp || 100})\n`;
            prompt += `- mp: 当前魔法值 (0-${gameContext.playerCharacter.maxMp || 50})\n`;
            prompt += `- stamina: 当前体力 (0-${gameContext.playerCharacter.maxStamina || 100})\n`;
            prompt += `- money: 金钱 (>=0)\n`;
            prompt += `- experience: 经验值 (>=0)\n`;
            prompt += `\n战斗属性:\n`;
            prompt += `- attack: 攻击力 (当前: ${gameContext.playerCharacter.attack || 10})\n`;
            prompt += `- defense: 防御力 (当前: ${gameContext.playerCharacter.defense || 5})\n`;
            prompt += `- magicAttack: 魔法攻击 (当前: ${gameContext.playerCharacter.magicAttack || 5})\n`;
            prompt += `- magicDefense: 魔法防御 (当前: ${gameContext.playerCharacter.magicDefense || 5})\n`;
            prompt += `- dexterity: 敏捷 (当前: ${gameContext.playerCharacter.dexterity || 10})\n`;
            prompt += `- luck: 幸运 (当前: ${gameContext.playerCharacter.luck || 10})\n`;
            prompt += `\n生活状态:\n`;
            prompt += `- hunger: 饥饿度 (当前: ${gameContext.playerCharacter.hunger || 50}/100)\n`;
            prompt += `- thirst: 口渴度 (当前: ${gameContext.playerCharacter.thirst || 50}/100)\n`;
            prompt += `- fatigue: 疲劳度 (当前: ${gameContext.playerCharacter.fatigue || 0}/100)\n`;
            prompt += `- morale: 士气 (当前: ${gameContext.playerCharacter.morale || 80}/100)\n`;
            prompt += `\n**重要提醒：**\n`;
            prompt += `- 只能修改上述列出的字段，不能创建新的字段\n`;
            prompt += `- 使用格式：{"字段名": +/-数值, "另一个字段": +/-数值}\n`;
            prompt += `- 例如：{"hp": -10, "mp": -5, "experience": +50}\n`;
            prompt += `- 如果没有数值变化，返回空对象：{}\n`;
            
            // 添加角色技能信息
            if (gameContext.playerCharacter.skills && gameContext.playerCharacter.skills.length > 0) {
                prompt += `\n## 角色技能\n`;
                gameContext.playerCharacter.skills.forEach(skill => {
                    prompt += `- ${skill.name}${skill.level ? ` (${skill.level}级)` : ''}: ${skill.description || '无描述'}\n`;
                });
            }
            
            // 添加角色装备信息
            if (gameContext.playerCharacter.equipment && Object.keys(gameContext.playerCharacter.equipment).length > 0) {
                prompt += `\n## 角色装备\n`;
                Object.entries(gameContext.playerCharacter.equipment).forEach(([slot, item]) => {
                    if (item && item.name) {
                        prompt += `- ${slot}: ${item.name}${item.description ? ` (${item.description})` : ''}\n`;
                    }
                });
            }
            
            // 添加角色背包信息
            if (gameContext.playerCharacter.inventory && gameContext.playerCharacter.inventory.length > 0) {
                prompt += `\n## 角色背包\n`;
                const itemCounts = {};
                gameContext.playerCharacter.inventory.forEach(item => {
                    if (item && item.name) {
                        itemCounts[item.name] = (itemCounts[item.name] || 0) + 1;
                    }
                });
                Object.entries(itemCounts).forEach(([itemName, count]) => {
                    prompt += `- ${itemName}${count > 1 ? ` x${count}` : ''}\n`;
                });
            }
        }
        
        // 添加世界状态
        if (gameContext.worldState && Object.keys(gameContext.worldState).length > 0) {
            prompt += `\n\n## 世界状态\n`;
            Object.entries(gameContext.worldState).forEach(([key, value]) => {
                prompt += `- ${key}: ${JSON.stringify(value)}\n`;
            });
        }
        
        // 添加其他角色信息
        if (gameContext.otherCharacters && gameContext.otherCharacters.length > 0) {
            prompt += `\n\n## 其他角色\n`;
            gameContext.otherCharacters.forEach(character => {
                prompt += `**${character.name}**:\n`;
                prompt += `- 职业: ${character.profession || '未知'}\n`;
                prompt += `- 种族: ${character.race || '未知'}\n`;
                prompt += `- 当前位置: ${character.currentLocation || '未知'}\n`;
                if (character.description) {
                    prompt += `- 描述: ${character.description}\n`;
                }
                if (character.hp !== undefined) {
                    prompt += `- 生命值: ${character.hp}/${character.maxHp || character.hp}\n`;
                }
                prompt += `\n`;
            });
        }
        
        // 添加游戏历史
        if (gameContext.gameHistory && gameContext.gameHistory.length > 0) {
            prompt += `\n\n## 最近的游戏历史\n`;
            gameContext.gameHistory.slice(-5).forEach((entry, index) => {
                prompt += `${index + 1}. 玩家行动: ${entry.playerInput}\n`;
                if (entry.response && entry.response.plot) {
                    prompt += `   结果: ${entry.response.plot}\n`;
                }
                if (entry.response && entry.response.numericChanges && Object.keys(entry.response.numericChanges).length > 0) {
                    prompt += `   数值变化: ${JSON.stringify(entry.response.numericChanges)}\n`;
                }
                prompt += `\n`;
            });
        }
        
        // 添加玩家输入
        prompt += `\n\n## 玩家行动\n${playerInput}`;
        
        // 添加最终指令
        prompt += `\n\n## 处理指令\n`;
        prompt += `请根据以上信息，作为专业的RPG游戏管理员，处理玩家的行动。\n`;
        prompt += `严格按照JSON格式返回响应，特别注意：\n`;
        prompt += `1. numericChanges必须是对象格式，如：{"hp": -10, "mp": -5}\n`;
        prompt += `2. 只能修改角色中存在的数值字段，不能创建新字段\n`;
        prompt += `3. 建议行动必须符合游戏逻辑和角色状态，不能让角色做不可能的事\n`;
        prompt += `4. 时间地点要精确具体，包含年月日时分和详细地理位置\n`;
        prompt += `5. 环境和情节描述要生动详细，增强沉浸感\n`;
        prompt += `6. 检查角色的技能、装备和背包，确保行动合理\n`;
        prompt += `7. 根据角色当前状态（HP、MP、体力等）调整行动效果\n`;
        prompt += `8. 保持游戏的连贯性和逻辑性\n`;
        
        return prompt;
    }

    // 调用Gemini API
    async callAPI(prompt) {
        if (!this.apiKey) {
            throw new Error('API密钥未设置，请先在设置中配置您的Gemini API密钥');
        }

        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 16384,
                topK: 40,
                topP: 0.95
            }
        };

        console.log('发送API请求:', {
            url: `${this.baseUrl}?key=${this.apiKey.substring(0, 8)}...`,
            bodyLength: JSON.stringify(requestBody).length
        });

        let response;
        try {
            response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            console.log('API响应状态:', response.status, response.statusText);

            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    console.error('API错误详情:', errorData);
                    errorMessage = errorData.error?.message || errorMessage;
                } catch (e) {
                    console.error('无法解析错误响应:', e);
                }
                throw new Error(`API调用失败: ${errorMessage}`);
            }
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('网络连接失败，请检查您的网络连接');
            }
            throw error;
        }

        const data = await response.json();
        
        // 详细的错误调试信息
        console.log('API响应:', data);
        
        if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
            console.error('API响应缺少candidates数组或为空:', data);
            throw new Error(`API响应格式不正确: ${data.error?.message || 'candidates数组为空'}`);
        }

        const candidate = data.candidates[0];
        if (!candidate || !candidate.content) {
            console.error('候选项缺少content:', candidate);
            throw new Error('API响应的候选项格式不正确');
        }

        // 检查响应是否被截断
        if (candidate.finishReason === 'MAX_TOKENS') {
            throw new Error('API响应被截断，请稍后重试或简化输入');
        }

        // 检查是否有parts字段
        if (!candidate.content.parts || !Array.isArray(candidate.content.parts) || candidate.content.parts.length === 0) {
            console.error('候选项内容缺少parts数组:', candidate.content);
            
            // 尝试检查是否有text字段直接在content中
            if (candidate.content.text) {
                return candidate.content.text;
            }
            
            throw new Error('API响应的内容格式不正确：' + JSON.stringify(candidate.content));
        }

        const firstPart = candidate.content.parts[0];
        if (!firstPart || !firstPart.text) {
            console.error('第一个part缺少text字段:', firstPart);
            throw new Error('API响应的文本内容为空');
        }

        return firstPart.text;
    }

    // 解析LLM响应
    parseResponse(responseText) {
        console.log('原始响应文本:', responseText);
        console.log('响应文本长度:', responseText.length);
        
        try {
            // 清理响应文本
            let cleanText = responseText.trim();
            
            // 尝试提取JSON代码块 (多种格式)
            const jsonMatches = [
                cleanText.match(/```json\s*([\s\S]*?)\s*```/),
                cleanText.match(/```\s*([\s\S]*?)\s*```/),
                cleanText.match(/```json([\s\S]*?)```/),
                cleanText.match(/```([\s\S]*?)```/)
            ];
            
            for (const match of jsonMatches) {
                if (match) {
                    cleanText = match[1].trim();
                    console.log('从代码块提取JSON:', cleanText);
                    break;
                }
            }
            
            // 如果响应以{开头，尝试直接解析
            if (cleanText.startsWith('{')) {
                try {
                    const parsed = JSON.parse(cleanText);
                    console.log('成功解析JSON:', parsed);
                    return this.validateResponse(parsed);
                } catch (e) {
                    console.log('直接解析失败:', e.message);
                }
            }
            
            // 多种策略寻找JSON
            const jsonExtractionStrategies = [
                // 策略1：寻找第一个{到最后一个}
                () => {
                    const jsonStart = cleanText.indexOf('{');
                    const jsonEnd = cleanText.lastIndexOf('}');
                    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                        return cleanText.substring(jsonStart, jsonEnd + 1);
                    }
                    return null;
                },
                // 策略2：寻找完整的JSON对象（匹配大括号）
                () => {
                    const jsonStart = cleanText.indexOf('{');
                    if (jsonStart === -1) return null;
                    
                    let braceCount = 0;
                    let jsonEnd = -1;
                    
                    for (let i = jsonStart; i < cleanText.length; i++) {
                        if (cleanText[i] === '{') braceCount++;
                        else if (cleanText[i] === '}') braceCount--;
                        
                        if (braceCount === 0) {
                            jsonEnd = i;
                            break;
                        }
                    }
                    
                    if (jsonEnd !== -1) {
                        return cleanText.substring(jsonStart, jsonEnd + 1);
                    }
                    return null;
                },
                // 策略3：逐行检查
                () => {
                    const lines = cleanText.split('\n');
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (line.startsWith('{')) {
                            const remainingText = lines.slice(i).join('\n');
                            const jsonEndIdx = remainingText.lastIndexOf('}');
                            if (jsonEndIdx !== -1) {
                                return remainingText.substring(0, jsonEndIdx + 1);
                            }
                        }
                    }
                    return null;
                }
            ];
            
            // 尝试每种策略
            for (let i = 0; i < jsonExtractionStrategies.length; i++) {
                const strategy = jsonExtractionStrategies[i];
                const jsonStr = strategy();
                
                if (jsonStr) {
                    console.log(`策略${i + 1}提取的JSON:`, jsonStr);
                    try {
                        const parsed = JSON.parse(jsonStr);
                        console.log(`策略${i + 1}解析JSON成功:`, parsed);
                        return this.validateResponse(parsed);
                    } catch (e) {
                        console.log(`策略${i + 1}JSON解析失败:`, e.message);
                    }
                }
            }
            
            throw new Error('无法在响应中找到有效的JSON格式');
            
        } catch (error) {
            console.error('JSON解析失败:', error);
            console.error('响应文本:', responseText);
            
            // 如果解析失败，返回基本格式
            return {
                currentCharacter: "系统",
                timeLocation: "未知时间地点",
                environment: "系统正在处理您的请求...",
                plot: responseText || "响应解析失败，但游戏继续进行。",
                dialogue: "",
                characterStatus: "正常",
                numericChanges: {},
                suggestedActions: ["继续探索", "查看状态", "重试"],
                imagePrompt: "fantasy RPG scene",
                gameState: {}
            };
        }
    }

    // 随机生成角色描述
    async generateRandomCharacter() {
        const prompt = `请为奇幻RPG游戏创建一个随机角色，用中文回复。要求：
1. 生成中文角色姓名（可以是古风、现代或奇幻风格）
2. 角色描述控制在100字以内，简洁明了
3. 包含：性别、年龄、职业、外貌特征、性格特点
4. 适合剑与魔法的奇幻世界设定

返回JSON格式：
{
    "name": "角色姓名",
    "description": "简洁的角色描述（100字以内）"
}

示例：
{
    "name": "林小雨",
    "description": "女性，22岁，精灵弓箭手。有着银色长发和翠绿双眸，身材纤细敏捷。性格开朗活泼，善于交际，对自然魔法有着天赋。来自月光森林，擅长远程射击和草药学。"
}`;

        const response = await this.callAPI(prompt);
        return this.parseResponse(response);
    }

    // 处理角色创建
    async createCharacter(characterData) {
        const prompt = `你是RPG游戏管理员。玩家要创建角色：${JSON.stringify(characterData)}

请生成：
1. 完整角色属性（性别、年龄、外貌、职业、技能等）
2. 开场场景描述
3. 建议的下一步行动

返回JSON格式：
{
    "currentCharacter": "角色名",
    "timeLocation": "时间地点",
    "environment": "环境描述",
    "plot": "开场剧情",
    "dialogue": "NPC对话",
    "characterStatus": "角色状态",
    "numericChanges": {},
    "suggestedActions": ["行动1", "行动2", "行动3"],
    "imagePrompt": "场景描述",
    "gameState": {
        "character": {角色完整属性}
    }
}`;

        const response = await this.callAPI(prompt);
        return this.parseResponse(response);
    }

    // 处理游戏动作
    async processAction(playerInput, gameContext) {
        // 使用完整的提示词构建方法
        const prompt = await this.buildPrompt(playerInput, gameContext);
        
        console.log('📤 发送完整提示词到LLM (前500字符):', prompt.substring(0, 500) + '...');
        console.log('📊 提示词总长度:', prompt.length);
        
        const response = await this.callAPI(prompt);
        return this.parseResponse(response);
    }

    // 处理特殊命令
    async handleSpecialCommand(command, gameContext) {
        let commandDescription = '';
        
        switch (command) {
            case 'status':
                commandDescription = '显示角色详细状态（HP、MP、技能、装备等）';
                break;
            case 'chars':
                commandDescription = '显示所有角色信息';
                break;
            case 'env':
                commandDescription = '显示环境详情（时间、地点、天气等）';
                break;
            default:
                commandDescription = `处理命令：${command}`;
        }
        
        const prompt = `RPG游戏指令：${command}
角色：${gameContext.playerCharacter?.name || '未知'}
要求：${commandDescription}

以文本格式详细回应，然后用JSON格式返回：
{
    "plot": "详细信息内容",
    "suggestedActions": ["继续", "查看其他", "返回游戏"]
}`;
        
        const response = await this.callAPI(prompt);
        return this.parseResponse(response);
    }

    // 验证响应格式
    validateResponse(response) {
        const requiredFields = [
            'currentCharacter',
            'timeLocation',
            'environment',
            'plot',
            'dialogue',
            'characterStatus',
            'numericChanges',
            'suggestedActions',
            'imagePrompt',
            'gameState'
        ];
        
        const missingFields = requiredFields.filter(field => !response.hasOwnProperty(field));
        
        if (missingFields.length > 0) {
            console.warn('响应缺少以下字段:', missingFields);
            // 填充缺失字段
            missingFields.forEach(field => {
                switch (field) {
                    case 'suggestedActions':
                        response[field] = ['继续探索', '查看状态', '休息'];
                        break;
                    case 'gameState':
                        response[field] = {};
                        break;
                    case 'numericChanges':
                        response[field] = {};
                        break;
                    default:
                        response[field] = '';
                }
            });
        }
        
        // 确保 numericChanges 是对象格式
        if (response.numericChanges && typeof response.numericChanges === 'string') {
            console.warn('numericChanges是字符串格式，尝试转换为对象:', response.numericChanges);
            try {
                // 尝试解析为JSON
                response.numericChanges = JSON.parse(response.numericChanges);
            } catch (e) {
                console.error('无法解析numericChanges字符串:', e);
                response.numericChanges = {};
            }
        }
        
        // 确保 numericChanges 是对象
        if (!response.numericChanges || typeof response.numericChanges !== 'object') {
            response.numericChanges = {};
        }
        
        // 确保 suggestedActions 是数组
        if (!Array.isArray(response.suggestedActions)) {
            response.suggestedActions = ['继续探索', '查看状态', '休息'];
        }
        
        return response;
    }

    // 错误处理
    async handleError(error, fallbackResponse = null) {
        console.error('LLM服务错误:', error);
        
        if (fallbackResponse) {
            return fallbackResponse;
        }
        
        return {
            currentCharacter: "系统",
            timeLocation: "未知时间地点",
            environment: "系统遇到了一些问题...",
            plot: "抱歉，游戏遇到了技术问题。请检查您的API密钥设置，或稍后重试。",
            dialogue: "",
            characterStatus: "系统错误",
            numericChanges: {},
            suggestedActions: ["检查设置", "重试", "重新开始"],
            imagePrompt: "error scene",
            gameState: {}
        };
    }
}

// 创建全局LLM服务实例
const llmService = new LLMService();

// 导出服务实例
window.llmService = llmService; 