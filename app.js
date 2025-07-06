// 游戏应用主逻辑
class GameApp {
    constructor() {
        this.gameState = {
            currentScene: 'menu', // menu, character-creation, game
            playerCharacter: null,
            gameHistory: [],
            isLoading: false,
            lastResponse: null
        };
        
        this.ui = {
            // 主要元素
            characterCreation: document.getElementById('character-creation'),
            gameInterface: document.getElementById('game-interface'),
            narrativeLog: document.getElementById('narrative-log'),
            playerInput: document.getElementById('player-input'),
            submitButton: document.getElementById('submit-action'),
            actionButtons: document.getElementById('action-buttons'),
            sceneImage: document.getElementById('scene-image'),
            imageLoading: document.getElementById('image-loading'),
            
            // 角色头像
            characterPortrait: document.getElementById('character-portrait'),
            portraitLoading: document.getElementById('portrait-loading'),
            portraitPlaceholder: document.getElementById('portrait-placeholder'),
            
            // 模态框
            statusModal: document.getElementById('status-modal'),
            statusContent: document.getElementById('status-content'),
            
            // 设置面板
            settingsPanel: document.getElementById('settings-panel'),
            geminiApiKey: document.getElementById('gemini-api-key'),
            
            // 加载界面
            loadingScreen: document.getElementById('loading-screen'),
            loadingText: document.getElementById('loading-text')
        };
        
        this.bindEvents();
    }

    // 初始化游戏
    async init() {
        try {
            // 初始化数据库
            await gameDB.init();
            console.log('数据库初始化完成');
            
            // 加载设置
            await this.loadSettings();
            
            // 检查是否有现有角色
            const playerCharacter = await gameDB.getPlayerCharacter();
            if (playerCharacter) {
                this.gameState.playerCharacter = playerCharacter;
                this.showGameInterface();
                this.addNarrativeEntry('欢迎回来，' + playerCharacter.name + '！');
            } else {
                this.showCharacterCreation();
            }
            
        } catch (error) {
            console.error('游戏初始化失败:', error);
            this.showError('游戏初始化失败，请刷新页面重试。');
        }
    }

    // 绑定事件
    bindEvents() {
        // 角色创建
        document.getElementById('create-character-btn').addEventListener('click', () => {
            this.createCharacter();
        });

        // 随机生成角色
        document.getElementById('random-character-btn').addEventListener('click', () => {
            this.generateRandomCharacter();
        });

        // 游戏输入
        this.ui.submitButton.addEventListener('click', () => {
            this.processPlayerInput();
        });

        this.ui.playerInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.processPlayerInput();
            }
        });

        // 快捷命令
        document.querySelectorAll('.command-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const command = e.target.dataset.command;
                this.processSpecialCommand(command);
            });
        });

        // 设置按钮
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.showSettings();
        });

        document.getElementById('test-api').addEventListener('click', () => {
            this.testAPIConnection();
        });

        document.getElementById('save-settings').addEventListener('click', () => {
            this.saveSettings();
        });

        document.getElementById('close-settings').addEventListener('click', () => {
            this.hideSettings();
        });

        // 重置游戏
        document.getElementById('reset-game-btn').addEventListener('click', () => {
            this.resetGame();
        });

        // 模态框关闭
        document.querySelector('.close').addEventListener('click', () => {
            this.hideModal();
        });

        // 点击模态框外部关闭
        this.ui.statusModal.addEventListener('click', (e) => {
            if (e.target === this.ui.statusModal) {
                this.hideModal();
            }
        });

        // 设置面板外部点击关闭
        this.ui.settingsPanel.addEventListener('click', (e) => {
            if (e.target === this.ui.settingsPanel) {
                this.hideSettings();
            }
        });
    }

    // 显示角色创建界面
    showCharacterCreation() {
        this.ui.characterCreation.classList.remove('hidden');
        this.ui.gameInterface.classList.add('hidden');
        this.gameState.currentScene = 'character-creation';
    }

    // 显示游戏界面
    showGameInterface() {
        this.ui.characterCreation.classList.add('hidden');
        this.ui.gameInterface.classList.remove('hidden');
        this.gameState.currentScene = 'game';
        
        // 清空状态变化显示
        this.clearStatusChanges();
        
        // 显示角色头像
        this.showCharacterPortrait();
    }

    // 生成随机角色
    async generateRandomCharacter() {
        if (!llmService.apiKey) {
            this.showError('请先在设置中配置API密钥');
            this.showSettings();
            return;
        }

        this.showLoading('正在生成随机角色...');

        try {
            // 调用LLM生成随机角色
            const response = await llmService.generateRandomCharacter();
            
            // 填充表单
            if (response.name) {
                document.getElementById('char-name').value = response.name;
            }
            
            if (response.description) {
                document.getElementById('char-description').value = response.description;
            }

            this.showSuccess('随机角色生成成功！您可以修改角色信息后创建。');

        } catch (error) {
            console.error('生成随机角色失败:', error);
            this.showError('生成随机角色失败: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    // 创建角色
    async createCharacter() {
        const name = document.getElementById('char-name').value.trim();
        const description = document.getElementById('char-description').value.trim();

        if (!name) {
            this.showError('请输入角色姓名');
            return;
        }

        if (!llmService.apiKey) {
            this.showError('请先在设置中配置API密钥');
            this.showSettings();
            return;
        }

        this.showLoading('正在创建角色...');

        try {
            // 准备角色数据
            const characterData = {
                name: name,
                description: description || ''
            };

            // 使用LLM创建完整角色
            const llmResponse = await llmService.createCharacter(characterData);
            
            // 创建角色对象
            const character = gameDB.createDefaultCharacter(name);
            
            // 从LLM响应中更新角色信息（安全合并，保护数值类型）
            if (llmResponse.gameState && llmResponse.gameState.character) {
                const llmCharacter = llmResponse.gameState.character;
                
                // 安全地合并属性，确保数值字段保持正确类型
                const numericFields = ['hp', 'maxHp', 'mp', 'maxMp', 'stamina', 'maxStamina', 
                                     'attack', 'defense', 'magicAttack', 'magicDefense', 
                                     'luck', 'dexterity', 'intelligence', 'wisdom', 'charisma', 
                                     'constitution', 'strength', 'money', 'level', 'experience',
                                     'hunger', 'thirst', 'fatigue', 'morale', 'age'];
                
                for (const [key, value] of Object.entries(llmCharacter)) {
                    if (numericFields.includes(key)) {
                        // 确保数值字段是数字类型
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue)) {
                            character[key] = numValue;
                        }
                        // 如果不是有效数字，保持原有默认值
                    } else {
                        // 非数值字段正常赋值
                        character[key] = value;
                    }
                }
            }

            // 保存角色到数据库
            await gameDB.savePlayerCharacter(character);
            this.gameState.playerCharacter = character;

            // 记录游戏日志
            await gameDB.saveGameLog({
                type: 'character_creation',
                playerInput: `创建角色: ${name}`,
                response: llmResponse
            });

            // 显示游戏界面
            this.showGameInterface();
            
            // 显示开场场景
            this.displayGameResponse(llmResponse);
            
            // 异步生成图像
            if (llmResponse.imagePrompt) {
                this.generateSceneImage(llmResponse.imagePrompt);
            }

            // 生成角色头像
            this.generateCharacterPortrait();

            // 生成角色全身图像
            this.generateCharacterFullBodyImage();

        } catch (error) {
            console.error('角色创建失败:', error);
            
            // 提供更详细的错误信息
            let errorMessage = error.message;
            if (error.message.includes('API密钥')) {
                errorMessage = '请检查您的API密钥是否正确设置。点击右上角的"设置"按钮来配置API密钥。';
            } else if (error.message.includes('网络连接')) {
                errorMessage = '网络连接失败，请检查您的网络连接后重试。';
            } else if (error.message.includes('API调用失败')) {
                errorMessage = 'API调用失败，请检查您的API密钥是否有效，或稍后重试。';
            }
            
            this.showError('角色创建失败: ' + errorMessage);
        } finally {
            this.hideLoading();
        }
    }

    // 处理玩家输入
    async processPlayerInput() {
        const input = this.ui.playerInput.value.trim();
        if (!input) return;

        // 清空输入框
        this.ui.playerInput.value = '';

        // 检查是否是特殊命令
        if (input.startsWith('/')) {
            const command = input.substring(1).toLowerCase();
            return this.processSpecialCommand(command);
        }

        await this.processGameAction(input);
    }

    // 处理游戏动作
    async processGameAction(input) {
        if (!this.gameState.playerCharacter) {
            this.showError('请先创建角色');
            return;
        }

        // 处理特殊的建议动作
        if (input === '刷新环境') {
            await this.showEnvironmentInfo(true);
            return;
        }

        if (!llmService.apiKey) {
            this.showError('请先在设置中配置API密钥');
            return;
        }

        this.showLoading('正在处理您的行动...');

        try {
            // 准备游戏上下文
            const gameContext = {
                playerCharacter: this.gameState.playerCharacter,
                worldState: await gameDB.getAllWorldState(),
                otherCharacters: await gameDB.getCharactersByType('npc'),
                gameHistory: this.gameState.gameHistory.slice(-5) // 最近5条记录
            };

            // 调用LLM处理行动
            const llmResponse = await llmService.processAction(input, gameContext);

            // 更新游戏状态
            await this.updateGameState(llmResponse);

            // 记录游戏日志
            await gameDB.saveGameLog({
                type: 'game_action',
                playerInput: input,
                response: llmResponse
            });

            // 显示响应
            this.displayGameResponse(llmResponse);

            // 生成场景图像
            if (llmResponse.imagePrompt) {
                this.generateSceneImage(llmResponse.imagePrompt);
            }

            // 检查是否需要更新场景（场景推进时清除环境缓存）
            await this.checkAndUpdateScene(llmResponse);

            // 记录到历史
            this.gameState.gameHistory.push({
                playerInput: input,
                response: llmResponse
            });

        } catch (error) {
            console.error('处理游戏行动失败:', error);
            this.showError('处理游戏行动失败: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    // 处理特殊命令
    async processSpecialCommand(command) {
        if (!this.gameState.playerCharacter) {
            this.showError('请先创建角色');
            return;
        }

        switch (command) {
            case 'status':
                this.showCharacterStatus();
                break;
            case 'chars':
                this.showCharacterDetails();
                break;
            case 'env':
                // 环境信息需要LLM处理
                await this.showEnvironmentInfo();
                break;
            case 'refresh-env':
                // 强制刷新环境信息
                await this.showEnvironmentInfo(true);
                break;
            default:
                this.showError('未知命令: ' + command);
        }
    }

    // 显示角色状态
    showCharacterStatus() {
        const character = this.gameState.playerCharacter;
        
        const statusHTML = `
            <div class="character-status">
                <h2>📊 ${character.name} 的状态</h2>
                <div class="status-section">
                    <h3>🏆 基础属性</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">等级:</span>
                            <span class="stat-value">${character.level || 1}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">经验值:</span>
                            <span class="stat-value" style="color: ${(() => {
                                const exp = character.experience || 0;
                                const level = character.level || 1;
                                const nextLevelExp = level ** 2 * 100 + level * 50;
                                const progress = exp / nextLevelExp;
                                return progress >= 0.8 ? '#6bcf7f' : progress >= 0.5 ? '#ffd93d' : '#4ecdc4';
                            })()}">${character.experience || 0} / ${((character.level || 1) ** 2 * 100 + (character.level || 1) * 50)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">生命值:</span>
                            <span class="stat-value" style="color: ${character.hp <= (character.maxHp * 0.3) ? '#ff6b6b' : character.hp <= (character.maxHp * 0.7) ? '#ffd93d' : '#6bcf7f'}">${character.hp || 0}/${character.maxHp || 100}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">魔法值:</span>
                            <span class="stat-value" style="color: #4ecdc4">${character.mp || 0}/${character.maxMp || 50}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">体力:</span>
                            <span class="stat-value" style="color: #45b7d1">${character.stamina || 0}/${character.maxStamina || 100}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">金钱:</span>
                            <span class="stat-value" style="color: #f39c12">${character.money || 0} 金币</span>
                        </div>
                    </div>
                </div>
                <div class="status-section">
                    <h3>⚔️ 战斗属性</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">攻击力:</span>
                            <span class="stat-value">${character.attack || 10}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">防御力:</span>
                            <span class="stat-value">${character.defense || 5}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">魔法攻击:</span>
                            <span class="stat-value">${character.magicAttack || 5}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">魔法防御:</span>
                            <span class="stat-value">${character.magicDefense || 5}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">敏捷:</span>
                            <span class="stat-value">${character.dexterity || 10}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">幸运:</span>
                            <span class="stat-value">${character.luck || 10}</span>
                        </div>
                    </div>
                </div>
                <div class="status-section">
                    <h3>🌟 生活状态</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">饥饿度:</span>
                            <span class="stat-value" style="color: ${(character.hunger || 50) <= 30 ? '#ff6b6b' : (character.hunger || 50) <= 70 ? '#ffd93d' : '#6bcf7f'}">${character.hunger || 50}/100</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">口渴度:</span>
                            <span class="stat-value" style="color: ${(character.thirst || 50) <= 30 ? '#ff6b6b' : (character.thirst || 50) <= 70 ? '#ffd93d' : '#6bcf7f'}">${character.thirst || 50}/100</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">疲劳度:</span>
                            <span class="stat-value" style="color: ${(character.fatigue || 0) >= 70 ? '#ff6b6b' : (character.fatigue || 0) >= 40 ? '#ffd93d' : '#6bcf7f'}">${character.fatigue || 0}/100</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">士气:</span>
                            <span class="stat-value" style="color: ${(character.morale || 80) <= 30 ? '#ff6b6b' : (character.morale || 80) <= 70 ? '#ffd93d' : '#6bcf7f'}">${character.morale || 80}/100</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.showModal(statusHTML);
    }

    // 显示角色详情
    showCharacterDetails() {
        const character = this.gameState.playerCharacter;
        
        // 装备列表（显示所有装备槽位）
        const slotNames = {
            weapon: '⚔️ 武器',
            armor: '🛡️ 护甲',
            helmet: '🪖 头盔',
            boots: '👢 靴子',
            gloves: '🧤 手套',
            accessory1: '💎 饰品1',
            accessory2: '💍 饰品2',
            shield: '🛡️ 盾牌'
        };
        
        const equipmentHTML = Object.entries(slotNames).map(([slot, slotName]) => {
            const item = character.equipment && character.equipment[slot];
            if (item && item.name) {
                return `
                    <div class="equipment-item equipped">
                        <span class="equipment-slot">${slotName}:</span>
                        <span class="equipment-name">${item.name}</span>
                        ${item.description ? `<div class="equipment-description">${item.description}</div>` : ''}
                    </div>
                `;
            } else {
                return `
                    <div class="equipment-item empty">
                        <span class="equipment-slot">${slotName}:</span>
                        <span class="equipment-name empty">未装备</span>
                    </div>
                `;
            }
        }).join('');

        // 物品栏
        const inventoryHTML = (character.inventory && character.inventory.length > 0) ? 
            character.inventory.map(item => `
                <div class="inventory-item">
                    <span class="item-name">${item.name || '未知物品'}</span>
                    <span class="item-quantity">x${item.quantity || 1}</span>
                    ${item.description ? `<div class="item-description">${item.description}</div>` : ''}
                </div>
            `).join('') : 
            '<div class="empty-inventory">🎒 背包为空</div>';

        // 基本信息
        const basicInfoItems = [
            { key: 'gender', label: '性别', icon: '👤' },
            { key: 'age', label: '年龄', icon: '🎂' },
            { key: 'race', label: '种族', icon: '🧬' },
            { key: 'profession', label: '职业', icon: '⚔️' },
            { key: 'appearance', label: '外貌', icon: '👁️' },
            { key: 'personality', label: '性格', icon: '🎭' }
        ];

        const characterInfoHTML = basicInfoItems
            .filter(item => character[item.key])
            .map(item => `
                <div class="info-item">
                    <span class="info-icon">${item.icon}</span>
                    <span class="info-label">${item.label}:</span>
                    <span class="info-value">${character[item.key]}</span>
                </div>
            `).join('');

        const finalCharacterInfoHTML = characterInfoHTML || '<div class="no-info">📝 基本信息未设定</div>';

        const detailsHTML = `
            <div class="character-details">
                <h2>👤 ${character.name} 的详细信息</h2>
                
                <div class="character-image-section">
                    ${character.fullBodyImageUrl ? 
                        `<img src="${character.fullBodyImageUrl}" alt="角色全身图" class="character-full-image">` :
                        '<div class="no-image">🎨 角色全身图生成中...</div>'
                    }
                </div>

                <div class="details-section">
                    <h3>📋 基本信息</h3>
                    <div class="character-info">
                        ${finalCharacterInfoHTML}
                    </div>
                </div>

                <div class="details-section">
                    <h3>⚔️ 当前装备</h3>
                    <div class="equipment-list">
                        ${equipmentHTML}
                    </div>
                </div>

                <div class="details-section">
                    <h3>🎁 背包物品 (${character.inventory ? character.inventory.length : 0}/${character.maxInventorySize || 50})</h3>
                    <div class="inventory-list">
                        ${inventoryHTML}
                    </div>
                </div>
            </div>
        `;
        
        this.showModal(detailsHTML);
    }

    // 检查并更新场景（当场景发生变化时）
    async checkAndUpdateScene(llmResponse) {
        try {
            // 检查响应中是否包含场景变化的关键词
            const sceneChangeKeywords = [
                '来到', '到达', '进入', '离开', '走向', '前往', '返回',
                '传送', '移动', '穿过', '越过', '跨过', '走出', '走进',
                '场景', '地点', '位置', '环境', '区域', '房间', '街道',
                '森林', '城市', '村庄', '山脉', '海边', '洞穴', '建筑'
            ];
            
            // 检查plot内容是否包含场景变化关键词
            let hasSceneChange = false;
            if (llmResponse.plot) {
                hasSceneChange = sceneChangeKeywords.some(keyword => 
                    llmResponse.plot.includes(keyword)
                );
            }
            
            // 检查是否有位置相关的世界状态变化
            if (llmResponse.gameState && llmResponse.gameState.worldState) {
                const worldStateKeys = Object.keys(llmResponse.gameState.worldState);
                hasSceneChange = hasSceneChange || worldStateKeys.some(key => 
                    key.includes('location') || key.includes('position') || key.includes('scene')
                );
            }
            
            // 如果检测到场景变化，更新场景ID并清除缓存
            if (hasSceneChange) {
                console.log('检测到场景变化，更新场景ID');
                
                // 生成新的场景ID
                const newSceneId = gameDB.generateId();
                await gameDB.setCurrentSceneId(newSceneId);
                
                // 清除所有场景缓存（因为场景已经变化）
                await gameDB.clearSceneCache();
                
                console.log('场景ID已更新为:', newSceneId);
            }
            
        } catch (error) {
            console.error('检查场景变化失败:', error);
            // 不影响游戏进行，继续执行
        }
    }

    // 显示环境信息（使用缓存机制）
    async showEnvironmentInfo(forceRefresh = false) {
        if (!llmService.apiKey) {
            this.showError('请先在设置中配置API密钥');
            return;
        }

        try {
            // 获取当前场景ID
            const currentSceneId = await gameDB.getCurrentSceneId();
            
            // 如果没有场景ID，生成一个新的
            if (!currentSceneId) {
                const newSceneId = gameDB.generateId();
                await gameDB.setCurrentSceneId(newSceneId);
            }
            
            const sceneId = currentSceneId || await gameDB.getCurrentSceneId();
            
            // 尝试获取缓存的环境信息
            const cachedScene = await gameDB.getSceneCache(sceneId);
            
            // 检查是否需要强制刷新或缓存版本过旧
            const cacheVersion = 'v2.0'; // 提示词优化版本
            const shouldUseCache = !forceRefresh && cachedScene && 
                                   cachedScene.environmentData.version === cacheVersion;
            
            if (shouldUseCache) {
                // 使用缓存的环境信息
                let cachedHTML = cachedScene.environmentData.description || '环境信息获取完成';
                
                // 如果缓存中有图像URL但HTML中没有，则重新构建HTML
                if (cachedScene.environmentData.imageUrl && !cachedHTML.includes('<img')) {
                    cachedHTML = `
                        <div class="environment-info">
                            <h2>当前环境</h2>
                            <img src="${cachedScene.environmentData.imageUrl}" alt="场景图像" class="scene-image">
                            <div class="environment-description">
                                ${cachedScene.environmentData.textDescription || '环境信息获取完成'}
                            </div>
                        </div>
                    `;
                }
                
                this.showModal(cachedHTML);
                return;
            }

            // 如果是强制刷新，先清除当前场景缓存
            if (forceRefresh) {
                await gameDB.clearSceneCache(sceneId);
                console.log('🗑️ 已清除场景缓存，强制重新生成环境信息');
            }

            // 没有缓存或强制刷新，生成新的环境信息
            this.showLoading(forceRefresh ? '正在重新生成环境信息...' : '正在查看环境信息...');

            const gameContext = {
                playerCharacter: this.gameState.playerCharacter,
                worldState: await gameDB.getAllWorldState(),
                otherCharacters: await gameDB.getAllCharacters(),
                gameHistory: await gameDB.getGameLog(10) // 获取最近10条游戏记录
            };

            const llmResponse = await llmService.handleSpecialCommand('env', gameContext);
            
            // 生成环境场景图像
            let sceneImageUrl = null;
            if (llmResponse.plot) {
                try {
                    sceneImageUrl = await this.generateEnvironmentImage(llmResponse.plot);
                } catch (imageError) {
                    console.warn('场景图像生成失败:', imageError);
                }
            }

            // 构建环境信息HTML
            const environmentHTML = `
                <div class="environment-info">
                    <h2>当前环境</h2>
                    ${sceneImageUrl ? `<img src="${sceneImageUrl}" alt="场景图像" class="scene-image">` : ''}
                    <div class="environment-description">
                        ${llmResponse.plot || '环境信息获取完成'}
                    </div>
                </div>
            `;

            // 缓存环境信息
            const environmentData = {
                description: environmentHTML,
                textDescription: llmResponse.plot,
                imageUrl: sceneImageUrl,
                generatedAt: new Date().toISOString(),
                version: 'v2.0' // 添加版本信息，用于缓存失效检查
            };
            
            await gameDB.saveSceneCache(sceneId, environmentData);
            
            this.showModal(environmentHTML);

        } catch (error) {
            console.error('获取环境信息失败:', error);
            this.showError('获取环境信息失败: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    // 更新游戏状态
    async updateGameState(llmResponse) {
        if (!llmResponse.gameState) return;

        // 更新角色状态
        if (llmResponse.gameState.character) {
            Object.assign(this.gameState.playerCharacter, llmResponse.gameState.character);
            await gameDB.savePlayerCharacter(this.gameState.playerCharacter);
        }

        // 处理数值变化
        if (llmResponse.numericChanges && typeof llmResponse.numericChanges === 'object') {
            console.log('🔄 开始处理数值变化:', llmResponse.numericChanges);
            
            // 显示所有可修改的数值字段
            const numericFields = Object.keys(this.gameState.playerCharacter).filter(key => 
                typeof this.gameState.playerCharacter[key] === 'number'
            );
            console.log('   可修改的数值字段:', numericFields);
            console.log('   角色当前数值状态:', numericFields.reduce((obj, key) => {
                obj[key] = this.gameState.playerCharacter[key];
                return obj;
            }, {}));
            
            const updates = {};
            const ignoredFields = [];
            const processedChanges = {};
            
            for (const [key, value] of Object.entries(llmResponse.numericChanges)) {
                // 解析数值变化（处理字符串格式）
                let numericValue = value;
                if (typeof value === 'string') {
                    // 提取数字部分，支持 "+5" 或 "-3 (说明文字)" 格式
                    const match = value.match(/^([+-]?\d+)/);
                    if (match) {
                        numericValue = parseInt(match[1]);
                    } else {
                        console.error(`❌ 数值格式错误：无法解析字段 "${key}" 的值 "${value}"`);
                        console.error(`   期望格式: 数字、"+5"、"-3" 或 "-10 (说明文字)"`);
                        ignoredFields.push(`${key} (格式错误)`);
                        continue;
                    }
                }
                
                // 检查字段是否存在
                if (this.gameState.playerCharacter.hasOwnProperty(key)) {
                    const currentValue = this.gameState.playerCharacter[key];
                    
                    // 确保当前值是数字
                    if (typeof currentValue !== 'number') {
                        console.error(`❌ 字段类型错误：字段 "${key}" 的当前值不是数字`);
                        console.error(`   当前值: ${currentValue} (类型: ${typeof currentValue})`);
                        console.error(`   只能修改数字类型的字段`);
                        ignoredFields.push(`${key} (非数字字段)`);
                        continue;
                    }
                    
                    const newValue = currentValue + numericValue;
                    
                    // 确保数值不超过最大值或低于最小值
                    if (key === 'hp' && this.gameState.playerCharacter.maxHp) {
                        updates[key] = Math.min(Math.max(newValue, 0), this.gameState.playerCharacter.maxHp);
                    } else if (key === 'mp' && this.gameState.playerCharacter.maxMp) {
                        updates[key] = Math.min(Math.max(newValue, 0), this.gameState.playerCharacter.maxMp);
                    } else if (key === 'stamina' && this.gameState.playerCharacter.maxStamina) {
                        updates[key] = Math.min(Math.max(newValue, 0), this.gameState.playerCharacter.maxStamina);
                    } else if (key === 'hunger' || key === 'thirst' || key === 'morale') {
                        updates[key] = Math.min(Math.max(newValue, 0), 100);
                    } else if (key === 'fatigue') {
                        updates[key] = Math.max(newValue, 0);
                    } else if (key === 'money' || key === 'experience') {
                        updates[key] = Math.max(newValue, 0); // 金钱和经验不能为负
                    } else {
                        updates[key] = newValue;
                    }
                    
                    processedChanges[key] = {
                        change: numericValue,
                        from: currentValue,
                        to: updates[key],
                        originalValue: value
                    };
                } else {
                    console.error(`❌ 数值变化错误：尝试修改不存在的字段 "${key}" = ${value}`);
                    console.error(`   角色当前拥有的数值字段:`, Object.keys(this.gameState.playerCharacter).filter(k => typeof this.gameState.playerCharacter[k] === 'number'));
                    ignoredFields.push(key);
                }
            }
            
            // 应用更新
            if (Object.keys(updates).length > 0) {
                await gameDB.updateCharacterStats(this.gameState.playerCharacter.id, updates);
                Object.assign(this.gameState.playerCharacter, updates);
                
                console.log('✅ 数值变化处理成功:');
                console.log('   应用的更新:', updates);
                console.log('   详细变化:', processedChanges);
                console.log('   原始numericChanges:', llmResponse.numericChanges);
                
                // 检查是否需要升级（如果经验值发生变化）
                if (updates.experience !== undefined) {
                    await this.checkLevelUp();
                }
                
                // 显示数值变化提示
                this.showNumericChanges(processedChanges);
            }
            
            // 显示被忽略的字段
            if (ignoredFields.length > 0) {
                console.error('🚫 数值变化处理完成，以下字段被忽略:');
                console.error('   被忽略的字段:', ignoredFields);
                console.error('   原始numericChanges:', llmResponse.numericChanges);
                                 this.addNarrativeEntry(`系统：忽略了不存在或格式错误的字段 [${ignoredFields.join(', ')}]`, 'warning');
            }
        } else if (llmResponse.numericChanges) {
            console.log('⚠️  numericChanges 存在但格式不正确:', llmResponse.numericChanges);
            console.log('   期望格式: 对象 { "字段名": 数值变化 }');
        }

        // 处理物品获得
        if (llmResponse.gameState.addItems && Array.isArray(llmResponse.gameState.addItems)) {
            for (const itemData of llmResponse.gameState.addItems) {
                const item = gameDB.createDefaultItem(itemData.name, itemData.type, itemData.value);
                if (itemData.description) item.description = itemData.description;
                if (itemData.equipable) item.equipable = itemData.equipable;
                if (itemData.slot) item.slot = itemData.slot;
                if (itemData.effects) item.effects = itemData.effects;
                
                await gameDB.addItemToInventory(this.gameState.playerCharacter.id, item);
            }
        }

        // 处理装备变化
        if (llmResponse.gameState.equipmentChanges) {
            const changes = llmResponse.gameState.equipmentChanges;
            let equipmentChanged = false;
            
            if (changes.equip) {
                for (const [slot, itemId] of Object.entries(changes.equip)) {
                    await gameDB.equipItem(this.gameState.playerCharacter.id, itemId, slot);
                    equipmentChanged = true;
                }
            }
            if (changes.unequip && Array.isArray(changes.unequip)) {
                for (const slot of changes.unequip) {
                    await gameDB.unequipItem(this.gameState.playerCharacter.id, slot);
                    equipmentChanged = true;
                }
            }
            
            // 如果装备发生变化，重新生成角色头像和全身图
            if (equipmentChanged) {
                // 更新角色数据
                this.gameState.playerCharacter = await gameDB.getPlayerCharacter();
                this.generateCharacterPortrait();
                this.generateCharacterFullBodyImage();
            }
        }

        // 更新世界状态
        for (const [key, value] of Object.entries(llmResponse.gameState)) {
            if (!['character', 'addItems', 'equipmentChanges'].includes(key)) {
                await gameDB.saveWorldState(key, value);
            }
        }
    }

    // 检查升级
    async checkLevelUp() {
        const character = this.gameState.playerCharacter;
        const currentLevel = character.level || 1;
        const currentExp = character.experience || 0;
        
        // 计算升级所需经验值（等级^2 * 100 + 等级 * 50）
        const getExpRequirement = (level) => level * level * 100 + level * 50;
        
        let newLevel = currentLevel;
        
        // 检查是否可以升级
        while (currentExp >= getExpRequirement(newLevel)) {
            newLevel++;
        }
        
        // 如果等级有变化，执行升级
        if (newLevel > currentLevel) {
            const levelGain = newLevel - currentLevel;
            
            // 升级奖励
            const hpGain = levelGain * 20; // 每级增加20生命值
            const mpGain = levelGain * 10; // 每级增加10魔法值
            const staminaGain = levelGain * 15; // 每级增加15体力
            const statGain = levelGain * 2; // 每级增加2点属性
            
            // 更新角色数据
            const updates = {
                level: newLevel,
                maxHp: character.maxHp + hpGain,
                hp: character.hp + hpGain, // 升级时回复生命值
                maxMp: character.maxMp + mpGain,
                mp: character.mp + mpGain, // 升级时回复魔法值
                maxStamina: character.maxStamina + staminaGain,
                stamina: character.stamina + staminaGain, // 升级时回复体力
                attack: character.attack + statGain,
                defense: character.defense + statGain,
                magicAttack: character.magicAttack + Math.floor(statGain * 0.8),
                magicDefense: character.magicDefense + Math.floor(statGain * 0.8)
            };
            
            // 保存到数据库
            await gameDB.updateCharacterStats(character.id, updates);
            Object.assign(character, updates);
            
            // 显示升级消息
            const levelUpMessage = `🎉 恭喜升级！等级提升至 ${newLevel} 级！`;
            this.addNarrativeEntry(levelUpMessage, 'success');
            
            // 创建升级变化数据并显示在状态变化UI中
            const levelUpChanges = {
                level: {
                    from: currentLevel,
                    to: newLevel,
                    change: levelGain,
                    originalValue: "升级奖励"
                },
                maxHp: {
                    from: character.maxHp - hpGain,
                    to: character.maxHp,
                    change: hpGain,
                    originalValue: "升级奖励"
                },
                hp: {
                    from: character.hp - hpGain,
                    to: character.hp,
                    change: hpGain,
                    originalValue: "升级回复"
                },
                maxMp: {
                    from: character.maxMp - mpGain,
                    to: character.maxMp,
                    change: mpGain,
                    originalValue: "升级奖励"
                },
                mp: {
                    from: character.mp - mpGain,
                    to: character.mp,
                    change: mpGain,
                    originalValue: "升级回复"
                },
                maxStamina: {
                    from: character.maxStamina - staminaGain,
                    to: character.maxStamina,
                    change: staminaGain,
                    originalValue: "升级奖励"
                },
                stamina: {
                    from: character.stamina - staminaGain,
                    to: character.stamina,
                    change: staminaGain,
                    originalValue: "升级回复"
                },
                attack: {
                    from: character.attack - statGain,
                    to: character.attack,
                    change: statGain,
                    originalValue: "升级奖励"
                },
                defense: {
                    from: character.defense - statGain,
                    to: character.defense,
                    change: statGain,
                    originalValue: "升级奖励"
                }
            };
            
            this.showNumericChanges(levelUpChanges);
            
            console.log(`🎉 角色升级: ${currentLevel} → ${newLevel}`, updates);
        }
    }

    // 显示数值变化详情
    showNumericChanges(processedChanges) {
        if (Object.keys(processedChanges).length === 0) return;
        
        const fieldNames = {
            hp: '生命值',
            mp: '魔法值', 
            stamina: '体力',
            money: '金钱',
            experience: '经验值',
            attack: '攻击力',
            defense: '防御力',
            magicAttack: '魔法攻击',
            magicDefense: '魔法防御',
            dexterity: '敏捷',
            luck: '幸运',
            hunger: '饥饿度',
            thirst: '口渴度',
            fatigue: '疲劳度',
            morale: '士气',
            level: '等级',
            maxHp: '生命上限',
            maxMp: '魔法上限',
            maxStamina: '体力上限'
        };
        
        // 过滤掉变化为0的项目（无效变化）
        const validChanges = Object.entries(processedChanges).filter(([key, data]) => {
            return data.change !== 0 && fieldNames[key]; // 只显示有实际变化且有中文名的字段
        });
        
        if (validChanges.length === 0) return;
        
        // 更新状态变化UI
        this.updateStatusChangesUI(validChanges, fieldNames);
        
        // 同时在叙事日志中显示简化版本
        const changes = validChanges.map(([key, data]) => {
            const fieldName = fieldNames[key] || key;
            const changePrefix = data.change > 0 ? '+' : '';
            return `${fieldName} ${changePrefix}${data.change}`;
        }).join(', ');
        
        this.addNarrativeEntry(`📊 ${changes}`, 'system');
    }
    
    // 更新状态变化UI
    updateStatusChangesUI(validChanges, fieldNames) {
        const statusChangesContent = document.getElementById('status-changes-content');
        
        // 清空之前的内容
        statusChangesContent.innerHTML = '';
        
        // 创建变化项目
        validChanges.forEach(([key, data]) => {
            const fieldName = fieldNames[key] || key;
            const changeItem = document.createElement('div');
            
            // 确定变化类型（正面、负面、中性）
            let changeType = 'neutral';
            if (['hp', 'mp', 'stamina', 'money', 'experience', 'attack', 'defense', 
                 'magicAttack', 'magicDefense', 'dexterity', 'luck', 'morale', 
                 'level', 'maxHp', 'maxMp', 'maxStamina'].includes(key)) {
                changeType = data.change > 0 ? 'positive' : 'negative';
            } else if (['hunger', 'thirst', 'fatigue'].includes(key)) {
                // 饥饿、口渴、疲劳度增加是负面的
                changeType = data.change > 0 ? 'negative' : 'positive';
            }
            
            changeItem.className = `change-item ${changeType}`;
            
            // 提取描述（如果有）
            const description = typeof data.originalValue === 'string' && data.originalValue.includes('(') 
                ? data.originalValue.split('(')[1].replace(')', '')
                : '';
            
            changeItem.innerHTML = `
                <div class="change-info">
                    <span class="change-label">${fieldName}</span>
                    ${description ? `<div class="change-description">${description}</div>` : ''}
                </div>
                <div class="change-values">
                    <span class="change-value">
                        ${data.from}<span class="change-arrow">→</span>${data.to}
                        <span style="color: ${changeType === 'positive' ? '#6bcf7f' : changeType === 'negative' ? '#ff6b6b' : '#4ecdc4'};">
                            (${data.change > 0 ? '+' : ''}${data.change})
                        </span>
                    </span>
                </div>
            `;
            
            statusChangesContent.appendChild(changeItem);
        });
        
                 // 自动滚动到最新的变化
         setTimeout(() => {
             statusChangesContent.scrollTop = statusChangesContent.scrollHeight;
         }, 100);
     }
     
     // 清空状态变化显示
     clearStatusChanges() {
         const statusChangesContent = document.getElementById('status-changes-content');
         if (statusChangesContent) {
             statusChangesContent.innerHTML = '<div class="no-changes">暂无状态变化</div>';
         }
     }

    // 显示游戏响应
    displayGameResponse(response) {
        console.log('显示游戏响应:', response);
        
        // 创建叙事条目
        const entry = document.createElement('div');
        entry.className = 'narrative-entry';
        
        let content = '';
        
        if (response.currentCharacter) {
            content += `<h3>当前角色：${response.currentCharacter}</h3>`;
        }
        
        if (response.timeLocation) {
            content += `<p><strong>时间地点：</strong>${response.timeLocation}</p>`;
        }
        
        if (response.environment) {
            content += `<p><strong>环境：</strong>${response.environment}</p>`;
        }
        
        if (response.plot) {
            content += `<p><strong>情节：</strong>${response.plot}</p>`;
        }
        
        if (response.dialogue) {
            content += `<p><strong>对话：</strong>`;
            if (Array.isArray(response.dialogue)) {
                response.dialogue.forEach(dialog => {
                    content += `<br/><em>${dialog.speaker}：</em>"${dialog.line}"`;
                });
            } else {
                content += response.dialogue;
            }
            content += `</p>`;
        }
        
        if (response.characterStatus) {
            content += `<p><strong>状态：</strong>${response.characterStatus}</p>`;
        }
        
        // 数值变化现在通过 showNumericChanges 方法单独显示，这里不再重复显示
        
        entry.innerHTML = content;
        
        // 添加到叙事日志
        this.ui.narrativeLog.appendChild(entry);
        
        // 滚动到底部
        this.ui.narrativeLog.scrollTop = this.ui.narrativeLog.scrollHeight;
        
        // 更新建议动作
        this.updateSuggestedActions(response.suggestedActions || []);
        
        // 保存最后的响应
        this.gameState.lastResponse = response;
    }

    // 更新建议动作
    updateSuggestedActions(actions) {
        this.ui.actionButtons.innerHTML = '';
        
        actions.forEach((action, index) => {
            const button = document.createElement('button');
            button.className = 'action-btn';
            button.textContent = action;
            button.addEventListener('click', () => {
                this.ui.playerInput.value = action;
                this.processPlayerInput();
            });
            this.ui.actionButtons.appendChild(button);
        });
    }

    // 生成场景图像
    async generateSceneImage(prompt) {
        if (!imageService.apiKey) {
            console.log('图像生成跳过：未设置API密钥');
            // 显示占位图像
            this.ui.sceneImage.src = imageService.createPlaceholderImage('未设置API密钥');
            this.ui.sceneImage.classList.remove('hidden');
            this.ui.imageLoading.classList.add('hidden');
            return;
        }

        // 显示加载状态
        this.ui.imageLoading.classList.remove('hidden');
        this.ui.sceneImage.classList.add('hidden');

        try {
            const result = await imageService.generateImageWithCache(prompt);
            
            this.ui.sceneImage.src = result.imageUrl;
            this.ui.sceneImage.classList.remove('hidden');
            this.ui.imageLoading.classList.add('hidden');
            
        } catch (error) {
            console.error('图像生成失败:', error);
            this.ui.imageLoading.classList.add('hidden');
            
            // 显示占位图像
            this.ui.sceneImage.src = imageService.createPlaceholderImage('图像生成失败');
            this.ui.sceneImage.classList.remove('hidden');
        }
    }

    // 生成环境图像（专门为环境模态框使用）
    async generateEnvironmentImage(prompt) {
        if (!imageService.apiKey) {
            console.log('环境图像生成跳过：未设置API密钥');
            return null;
        }

        try {
            const result = await imageService.generateImageWithCache(prompt);
            return result.imageUrl;
        } catch (error) {
            console.error('环境图像生成失败:', error);
            return null;
        }
    }

    // 生成角色头像
    async generateCharacterPortrait() {
        if (!this.gameState.playerCharacter) {
            console.log('角色头像生成跳过：无角色数据');
            return;
        }

        if (!imageService.apiKey) {
            console.log('角色头像生成跳过：未设置API密钥');
            this.ui.portraitPlaceholder.innerHTML = '<p>未设置API密钥</p>';
            return;
        }

        // 显示加载状态
        this.ui.portraitLoading.classList.remove('hidden');
        this.ui.characterPortrait.classList.add('hidden');
        this.ui.portraitPlaceholder.classList.add('hidden');

        try {
            // 构建角色头像提示词
            const portraitPrompt = this.buildCharacterPortraitPrompt();
            
            const result = await imageService.generateImageWithCache(portraitPrompt);
            
            // 显示角色头像
            this.ui.characterPortrait.src = result.imageUrl;
            this.ui.characterPortrait.classList.remove('hidden');
            this.ui.portraitLoading.classList.add('hidden');
            
            // 保存头像URL到角色数据
            this.gameState.playerCharacter.portraitUrl = result.imageUrl;
            await gameDB.savePlayerCharacter(this.gameState.playerCharacter);
            
        } catch (error) {
            console.error('角色头像生成失败:', error);
            this.ui.portraitLoading.classList.add('hidden');
            
            // 显示占位图像
            this.ui.portraitPlaceholder.innerHTML = '<p>头像生成失败</p>';
            this.ui.portraitPlaceholder.classList.remove('hidden');
        }
    }

    // 构建角色头像提示词
    buildCharacterPortraitPrompt() {
        const character = this.gameState.playerCharacter;
        let prompt = `Character portrait for RPG game, high quality digital art, `;
        
        // 基本描述
        if (character.name) {
            prompt += `character named ${character.name}, `;
        }
        
        if (character.gender) {
            prompt += `${character.gender}, `;
        }
        
        if (character.age) {
            prompt += `age ${character.age}, `;
        }
        
        if (character.race) {
            prompt += `${character.race} race, `;
        }
        
        if (character.profession) {
            prompt += `${character.profession} class, `;
        }
        
        if (character.appearance) {
            prompt += `${character.appearance}, `;
        }
        
        // 装备描述
        const equippedItems = [];
        if (character.equipment) {
            Object.entries(character.equipment).forEach(([slot, item]) => {
                if (item && item.name) {
                    equippedItems.push(`${item.name} on ${slot}`);
                }
            });
        }
        
        if (equippedItems.length > 0) {
            prompt += `equipped with ${equippedItems.join(', ')}, `;
        }
        
        // 风格描述
        prompt += `fantasy art style, detailed face, portrait view, professional lighting, vibrant colors`;
        
        return prompt;
    }

    // 显示现有角色头像
    showCharacterPortrait() {
        if (!this.gameState.playerCharacter) {
            return;
        }

        if (this.gameState.playerCharacter.portraitUrl) {
            this.ui.characterPortrait.src = this.gameState.playerCharacter.portraitUrl;
            this.ui.characterPortrait.classList.remove('hidden');
            this.ui.portraitPlaceholder.classList.add('hidden');
        } else {
            this.ui.characterPortrait.classList.add('hidden');
            this.ui.portraitPlaceholder.classList.remove('hidden');
        }
    }

    // 生成角色全身图像
    async generateCharacterFullBodyImage() {
        if (!this.gameState.playerCharacter) {
            console.log('角色全身图生成跳过：无角色数据');
            return;
        }

        if (!imageService.apiKey) {
            console.log('角色全身图生成跳过：未设置API密钥');
            return;
        }

        try {
            // 构建角色全身图提示词
            const fullBodyPrompt = this.buildCharacterFullBodyPrompt();
            
            const result = await imageService.generateImageWithCache(fullBodyPrompt);
            
            // 保存全身图URL到角色数据
            this.gameState.playerCharacter.fullBodyImageUrl = result.imageUrl;
            await gameDB.savePlayerCharacter(this.gameState.playerCharacter);
            
            console.log('角色全身图生成成功:', result.imageUrl);
            
        } catch (error) {
            console.error('角色全身图生成失败:', error);
        }
    }

    // 构建角色全身图提示词
    buildCharacterFullBodyPrompt() {
        const character = this.gameState.playerCharacter;
        let prompt = `Full body character illustration for RPG game, high quality digital art, `;
        
        // 基本描述
        if (character.name) {
            prompt += `character named ${character.name}, `;
        }
        
        if (character.gender) {
            prompt += `${character.gender}, `;
        }
        
        if (character.age) {
            prompt += `age ${character.age}, `;
        }
        
        if (character.race) {
            prompt += `${character.race} race, `;
        }
        
        if (character.profession) {
            prompt += `${character.profession} class, `;
        }
        
        if (character.appearance) {
            prompt += `${character.appearance}, `;
        }
        
        // 装备描述
        const equippedItems = [];
        if (character.equipment) {
            Object.entries(character.equipment).forEach(([slot, item]) => {
                if (item && item.name) {
                    equippedItems.push(`${item.name} on ${slot}`);
                }
            });
        }
        
        if (equippedItems.length > 0) {
            prompt += `equipped with ${equippedItems.join(', ')}, `;
        }
        
        // 姿势和风格描述
        prompt += `standing pose, full body view, fantasy art style, detailed character design, `;
        prompt += `professional lighting, vibrant colors, game character concept art, white background`;
        
        return prompt;
    }

    // 添加叙事条目
    addNarrativeEntry(message, type = 'system') {
        const entry = document.createElement('div');
        entry.className = `narrative-entry ${type}`;
        
        // 格式化消息，保持换行
        const formattedMessage = message.replace(/\n/g, '<br/>');
        
        if (type === 'system') {
            entry.innerHTML = `<p><strong>系统：</strong>${formattedMessage}</p>`;
        } else if (type === 'warning') {
            entry.innerHTML = `<p><strong>⚠️ 警告：</strong>${formattedMessage}</p>`;
        } else if (type === 'error') {
            entry.innerHTML = `<p><strong>❌ 错误：</strong>${formattedMessage}</p>`;
        } else if (type === 'success') {
            entry.innerHTML = `<p><strong>✅ 成功：</strong>${formattedMessage}</p>`;
        } else {
            entry.innerHTML = `<p>${formattedMessage}</p>`;
        }
        
        this.ui.narrativeLog.appendChild(entry);
        this.ui.narrativeLog.scrollTop = this.ui.narrativeLog.scrollHeight;
    }

    // 显示/隐藏加载界面
    showLoading(message = '正在加载...') {
        this.ui.loadingText.textContent = message;
        this.ui.loadingScreen.classList.remove('hidden');
        this.gameState.isLoading = true;
        
        // 启动动态文字轮播
        this.startDynamicLoading();
    }

    hideLoading() {
        this.ui.loadingScreen.classList.add('hidden');
        this.gameState.isLoading = false;
        
        // 停止动态文字轮播
        this.stopDynamicLoading();
    }

    // 启动动态加载文字效果
    startDynamicLoading() {
        // 清除之前的定时器
        if (this.loadingInterval) {
            clearInterval(this.loadingInterval);
        }

        // 动态加载文字列表
        const loadingMessages = [
            '正在与神秘的AI法师沟通...',
            '古老的魔法书页面正在翻动...',
            '命运之轮正在缓缓转动...',
            '时空之门正在开启...',
            '探索者的故事正在编织...',
            '魔法水晶正在闪烁...',
            '龙语正在被解读...',
            '预言之书正在书写...',
            '星辰正在排列组合...',
            '远古的智慧正在苏醒...',
            '冒险的篇章即将开始...',
            '神秘的符文正在发光...',
            '时间的齿轮正在运转...',
            '魔法阵正在激活...',
            '传说中的故事正在续写...'
        ];

        let currentIndex = 0;
        
        // 立即显示第一个消息
        this.ui.loadingText.textContent = loadingMessages[currentIndex];
        
        // 设置定时器轮播文字
        this.loadingInterval = setInterval(() => {
            if (!this.gameState.isLoading) {
                this.stopDynamicLoading();
                return;
            }
            
            currentIndex = (currentIndex + 1) % loadingMessages.length;
            this.ui.loadingText.textContent = loadingMessages[currentIndex];
        }, 2000); // 每2秒切换一次
    }

    // 停止动态加载文字效果
    stopDynamicLoading() {
        if (this.loadingInterval) {
            clearInterval(this.loadingInterval);
            this.loadingInterval = null;
        }
    }

    // 显示/隐藏模态框
    showModal(content) {
        this.ui.statusContent.innerHTML = `<pre>${content}</pre>`;
        this.ui.statusModal.classList.remove('hidden');
    }

    hideModal() {
        this.ui.statusModal.classList.add('hidden');
    }

    // 显示/隐藏设置面板
    showSettings() {
        this.ui.settingsPanel.classList.remove('hidden');
    }

    hideSettings() {
        this.ui.settingsPanel.classList.add('hidden');
    }

    // 测试API连接
    async testAPIConnection() {
        const apiKey = this.ui.geminiApiKey.value.trim();
        
        if (!apiKey) {
            this.showError('请先输入API密钥');
            return;
        }

        this.showLoading('正在测试API连接...');

        try {
            // 临时设置API密钥
            llmService.setApiKey(apiKey);
            
            // 发送简单的测试请求
            const testPrompt = '请用JSON格式回应：{"status": "success", "message": "API连接成功"}';
            const response = await llmService.callAPI(testPrompt);
            
            console.log('API测试响应:', response);
            
            // 尝试解析响应
            const parsed = llmService.parseResponse(response);
            
            if (parsed) {
                this.showSuccess('API连接测试成功！可以开始游戏了。');
            } else {
                this.showError('API连接成功，但响应格式异常。建议检查控制台日志。');
            }
            
        } catch (error) {
            console.error('API测试失败:', error);
            this.showError('API连接测试失败: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    // 加载设置
    async loadSettings() {
        const apiKey = await gameDB.getSetting('gemini_api_key');
        if (apiKey) {
            llmService.setApiKey(apiKey);
            imageService.setApiKey(apiKey);
            this.ui.geminiApiKey.value = apiKey;
        }
    }

    // 保存设置
    async saveSettings() {
        const apiKey = this.ui.geminiApiKey.value.trim();
        
        if (!apiKey) {
            this.showError('请输入API密钥');
            return;
        }

        try {
            await gameDB.saveSetting('gemini_api_key', apiKey);
            llmService.setApiKey(apiKey);
            imageService.setApiKey(apiKey);
            
            this.hideSettings();
            this.showSuccess('设置已保存');
            
        } catch (error) {
            console.error('保存设置失败:', error);
            this.showError('保存设置失败: ' + error.message);
        }
    }

    // 重置游戏
    async resetGame() {
        if (!confirm('确定要重置游戏吗？这将删除所有角色和游戏数据。')) {
            return;
        }

        this.showLoading('正在重置游戏...');

        try {
            await gameDB.resetDatabase();
            this.gameState.playerCharacter = null;
            this.gameState.gameHistory = [];
            
            // 清除场景缓存
            await gameDB.clearSceneCache();
            
            // 清空UI
            this.ui.narrativeLog.innerHTML = '';
            this.ui.actionButtons.innerHTML = '';
            this.ui.sceneImage.src = '';
            this.ui.sceneImage.classList.add('hidden');
            this.ui.imageLoading.classList.add('hidden');
            
            // 清空角色头像
            this.ui.characterPortrait.src = '';
            this.ui.characterPortrait.classList.add('hidden');
            this.ui.portraitLoading.classList.add('hidden');
            this.ui.portraitPlaceholder.classList.remove('hidden');
            this.ui.portraitPlaceholder.innerHTML = '<p>暂无角色头像</p>';
            
            // 清空状态变化显示
            this.clearStatusChanges();
            
            // 清空全身图数据（在内存中）
            if (this.gameState.playerCharacter) {
                this.gameState.playerCharacter.fullBodyImageUrl = null;
            }
            
            // 显示角色创建界面
            this.showCharacterCreation();
            
            this.showSuccess('游戏已重置');
            
        } catch (error) {
            console.error('重置游戏失败:', error);
            this.showError('重置游戏失败: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    // 显示错误消息
    showError(message) {
        this.addNarrativeEntry(message, 'error');
        console.error(message);
    }

    // 显示成功消息
    showSuccess(message) {
        this.addNarrativeEntry(message, 'success');
        console.log(message);
    }
}

// 初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    const game = new GameApp();
    game.init();
    
    // 将游戏实例暴露到全局作用域（用于调试）
    window.game = game;
}); 