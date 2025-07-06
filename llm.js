// LLM服务模块
class LLMService {
    constructor() {
        this.apiKey = null;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
        this.systemPrompt = this.loadSystemPrompt();
    }

    // 加载系统提示
    loadSystemPrompt() {
        return `你是RPG游戏管理员，管理一个中世纪奇幻世界（剑与魔法）。快速推进剧情，创造有趣的冒险。

## 核心规则
- HP需治疗恢复，MP靠休息恢复
- 技能消耗MP，行动必须符合逻辑
- 不能使用没有的物品/技能，不能超支金钱
- 动作违规时阻止并说明原因

## 必须返回JSON格式
{
    "currentCharacter": "角色名",
    "timeLocation": "时间地点",
    "environment": "环境描述", 
    "plot": "剧情发展",
    "dialogue": "NPC对话",
    "characterStatus": "角色状态",
    "numericChanges": {"字段": 数值变化},
    "suggestedActions": ["行动1", "行动2", "行动3"],
    "imagePrompt": "场景描述",
    "gameState": {}
}

## 重要
- numericChanges必须是对象格式，如{"hp": -10}
- 只能修改已存在的数值字段
- 快速推进剧情，避免冗长描述`;
    }

    // 设置API密钥
    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }

    // 过滤角色信息，只保留游戏逻辑相关字段
    filterCharacterForPrompt(character) {
        // 需要排除的字段（图片URL、UI相关等）
        const excludeFields = [
            'portraitUrl', 
            'fullBodyImageUrl', 
            'avatarUrl',
            'imageUrl',
            'characterImageUrl',
            'createdAt', 
            'updatedAt',
            'lastImageGenerated',
            'imageGenerationHistory',
            'uiState',
            'displaySettings'
        ];
        
        // 创建过滤后的角色对象
        const filtered = {};
        
        // 复制所有字段，但排除不需要的字段
        for (const [key, value] of Object.entries(character)) {
            // 检查是否在排除列表中，或者字段名包含URL相关关键词
            const isUrlField = key.toLowerCase().includes('url') || 
                              key.toLowerCase().includes('image') || 
                              key.toLowerCase().includes('picture') ||
                              key.toLowerCase().includes('photo');
            
            if (!excludeFields.includes(key) && !isUrlField) {
                // 对于equipment和inventory，也需要过滤掉图片相关字段
                if (key === 'equipment' && typeof value === 'object' && value !== null) {
                    filtered[key] = this.filterEquipmentForPrompt(value);
                } else if (key === 'inventory' && Array.isArray(value)) {
                    filtered[key] = this.filterInventoryForPrompt(value);
                } else {
                    filtered[key] = value;
                }
            }
        }
        
        return filtered;
    }

    // 过滤装备信息
    filterEquipmentForPrompt(equipment) {
        const filtered = {};
        for (const [slot, item] of Object.entries(equipment)) {
            if (item && typeof item === 'object') {
                // 过滤掉所有图片相关字段
                const filteredItem = {};
                for (const [key, value] of Object.entries(item)) {
                    const isUrlField = key.toLowerCase().includes('url') || 
                                      key.toLowerCase().includes('image') || 
                                      key.toLowerCase().includes('picture') ||
                                      key.toLowerCase().includes('photo');
                    if (!isUrlField) {
                        filteredItem[key] = value;
                    }
                }
                filtered[slot] = filteredItem;
            } else {
                filtered[slot] = item;
            }
        }
        return filtered;
    }

    // 过滤背包信息
    filterInventoryForPrompt(inventory) {
        return inventory.map(item => {
            if (item && typeof item === 'object') {
                // 过滤掉所有图片相关字段
                const filteredItem = {};
                for (const [key, value] of Object.entries(item)) {
                    const isUrlField = key.toLowerCase().includes('url') || 
                                      key.toLowerCase().includes('image') || 
                                      key.toLowerCase().includes('picture') ||
                                      key.toLowerCase().includes('photo');
                    if (!isUrlField) {
                        filteredItem[key] = value;
                    }
                }
                return filteredItem;
            }
            return item;
        });
    }

    // 构建完整的提示
    async buildPrompt(playerInput, gameContext) {
        let prompt = this.systemPrompt;
        
        // 添加角色信息
        if (gameContext.playerCharacter) {
            // 过滤角色信息，只发送游戏相关字段，排除图片URL等无关字段
            const originalSize = JSON.stringify(gameContext.playerCharacter).length;
            const filteredCharacter = this.filterCharacterForPrompt(gameContext.playerCharacter);
            const filteredSize = JSON.stringify(filteredCharacter).length;
            
            console.log(`🔧 角色信息过滤: ${originalSize} → ${filteredSize} 字符 (节省 ${originalSize - filteredSize} 字符)`);
            
            prompt += `\n\n## 当前角色信息\n${JSON.stringify(filteredCharacter, null, 2)}`;
            
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
                // 过滤掉可能的图片URL字段
                if (!key.toLowerCase().includes('url') && !key.toLowerCase().includes('image')) {
                    prompt += `- ${key}: ${JSON.stringify(value)}\n`;
                }
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
        // 过滤角色创建数据，排除可能的图片URL字段
        const filteredData = this.filterCharacterForPrompt(characterData);
        const prompt = `你是RPG游戏管理员。玩家要创建角色：${JSON.stringify(filteredData)}

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