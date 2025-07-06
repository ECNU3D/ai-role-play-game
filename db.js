// 数据库管理模块
class GameDatabase {
    constructor() {
        this.db = null;
        this.dbName = 'RPGGameDB';
        this.version = 2;
    }

    // 初始化数据库
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                reject(new Error('数据库打开失败'));
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 创建角色存储
                if (!db.objectStoreNames.contains('characters')) {
                    const characterStore = db.createObjectStore('characters', { keyPath: 'id' });
                    characterStore.createIndex('name', 'name', { unique: false });
                    characterStore.createIndex('type', 'type', { unique: false });
                }

                // 创建世界状态存储
                if (!db.objectStoreNames.contains('worldState')) {
                    db.createObjectStore('worldState', { keyPath: 'key' });
                }

                // 创建游戏日志存储
                if (!db.objectStoreNames.contains('gameLog')) {
                    const logStore = db.createObjectStore('gameLog', { keyPath: 'id', autoIncrement: true });
                    logStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // 创建游戏设置存储
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }

                // 创建场景缓存存储
                if (!db.objectStoreNames.contains('scenesCache')) {
                    const sceneStore = db.createObjectStore('scenesCache', { keyPath: 'sceneId' });
                    sceneStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    // 角色管理
    async saveCharacter(character) {
        const transaction = this.db.transaction(['characters'], 'readwrite');
        const store = transaction.objectStore('characters');
        
        // 确保角色有唯一ID
        if (!character.id) {
            character.id = this.generateId();
        }
        
        // 添加时间戳
        character.lastUpdated = new Date().toISOString();
        
        return new Promise((resolve, reject) => {
            const request = store.put(character);
            request.onsuccess = () => resolve(character);
            request.onerror = () => reject(request.error);
        });
    }

    async getCharacter(id) {
        const transaction = this.db.transaction(['characters'], 'readonly');
        const store = transaction.objectStore('characters');
        
        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllCharacters() {
        const transaction = this.db.transaction(['characters'], 'readonly');
        const store = transaction.objectStore('characters');
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getCharactersByType(type) {
        const transaction = this.db.transaction(['characters'], 'readonly');
        const store = transaction.objectStore('characters');
        const index = store.index('type');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll(type);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteCharacter(id) {
        const transaction = this.db.transaction(['characters'], 'readwrite');
        const store = transaction.objectStore('characters');
        
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // 世界状态管理
    async saveWorldState(key, value) {
        const transaction = this.db.transaction(['worldState'], 'readwrite');
        const store = transaction.objectStore('worldState');
        
        const stateData = {
            key: key,
            value: value,
            timestamp: new Date().toISOString()
        };
        
        return new Promise((resolve, reject) => {
            const request = store.put(stateData);
            request.onsuccess = () => resolve(stateData);
            request.onerror = () => reject(request.error);
        });
    }

    async getWorldState(key) {
        const transaction = this.db.transaction(['worldState'], 'readonly');
        const store = transaction.objectStore('worldState');
        
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => {
                const result = request.result;
                resolve(result ? result.value : null);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getAllWorldState() {
        const transaction = this.db.transaction(['worldState'], 'readonly');
        const store = transaction.objectStore('worldState');
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const result = {};
                request.result.forEach(item => {
                    result[item.key] = item.value;
                });
                resolve(result);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // 游戏日志管理
    async saveGameLog(entry) {
        const transaction = this.db.transaction(['gameLog'], 'readwrite');
        const store = transaction.objectStore('gameLog');
        
        const logEntry = {
            ...entry,
            timestamp: new Date().toISOString()
        };
        
        return new Promise((resolve, reject) => {
            const request = store.add(logEntry);
            request.onsuccess = () => resolve(logEntry);
            request.onerror = () => reject(request.error);
        });
    }

    async getGameLog(limit = 50) {
        const transaction = this.db.transaction(['gameLog'], 'readonly');
        const store = transaction.objectStore('gameLog');
        const index = store.index('timestamp');
        
        return new Promise((resolve, reject) => {
            const request = index.openCursor(null, 'prev');
            const results = [];
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && results.length < limit) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    async clearGameLog() {
        const transaction = this.db.transaction(['gameLog'], 'readwrite');
        const store = transaction.objectStore('gameLog');
        
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // 设置管理
    async saveSetting(key, value) {
        const transaction = this.db.transaction(['settings'], 'readwrite');
        const store = transaction.objectStore('settings');
        
        const setting = {
            key: key,
            value: value,
            timestamp: new Date().toISOString()
        };
        
        return new Promise((resolve, reject) => {
            const request = store.put(setting);
            request.onsuccess = () => resolve(setting);
            request.onerror = () => reject(request.error);
        });
    }

    async getSetting(key) {
        const transaction = this.db.transaction(['settings'], 'readonly');
        const store = transaction.objectStore('settings');
        
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => {
                const result = request.result;
                resolve(result ? result.value : null);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // 工具方法
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // 创建默认角色数据结构
    createDefaultCharacter(name, type = 'player') {
        return {
            id: this.generateId(),
            name: name || '未命名角色',
            type: type, // player, npc, enemy
            
            // 基础属性
            gender: '',
            age: 0,
            height: '',
            weight: '',
            appearance: '',
            personality: '',
            hobbies: '',
            profession: '',
            race: '',
            organization: '',
            country: '',
            relationships: '',
            
            // 位置和目标
            currentLocation: '',
            currentTarget: '',
            shortTermGoal: '',
            mediumTermGoal: '',
            longTermGoal: '',
            
            // 成就和荣誉
            achievements: [],
            honors: [],
            
            // 数值属性
            hp: 100,
            maxHp: 100,
            mp: 50,
            maxMp: 50,
            stamina: 100,
            maxStamina: 100,
            attack: 10,
            defense: 10,
            magicAttack: 10,
            magicDefense: 10,
            luck: 10,
            dexterity: 10,
            intelligence: 10,
            wisdom: 10,
            charisma: 10,
            constitution: 10,
            strength: 10,
            money: 100,
            level: 1,
            experience: 0,
            
            // 装备系统
            equipment: {
                weapon: null,        // 武器
                armor: null,         // 护甲
                helmet: null,        // 头盔
                boots: null,         // 靴子
                gloves: null,        // 手套
                accessory1: null,    // 饰品1
                accessory2: null,    // 饰品2
                shield: null         // 盾牌
            },
            
            // 物品栏
            inventory: [],
            maxInventorySize: 50,
            
            // 技能
            skills: [],
            
            // 状态效果
            buffs: [],
            debuffs: [],
            
            // 生活状态
            hunger: 100,        // 饥饿度
            thirst: 100,        // 口渴度
            fatigue: 0,         // 疲劳度
            morale: 100,        // 士气
            
            // 头像URL
            portraitUrl: null,
            fullBodyImageUrl: null,
            
            // 创建时间
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        };
    }

    // 重置数据库
    async resetDatabase() {
        const transaction = this.db.transaction(['characters', 'worldState', 'gameLog', 'scenesCache'], 'readwrite');
        
        const characterStore = transaction.objectStore('characters');
        const worldStateStore = transaction.objectStore('worldState');
        const gameLogStore = transaction.objectStore('gameLog');
        const scenesCacheStore = transaction.objectStore('scenesCache');
        
        return Promise.all([
            new Promise((resolve, reject) => {
                const request = characterStore.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            }),
            new Promise((resolve, reject) => {
                const request = worldStateStore.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            }),
            new Promise((resolve, reject) => {
                const request = gameLogStore.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            }),
            new Promise((resolve, reject) => {
                const request = scenesCacheStore.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            })
        ]);
    }

    // 获取玩家角色
    async getPlayerCharacter() {
        const players = await this.getCharactersByType('player');
        return players.length > 0 ? players[0] : null;
    }

    // 保存玩家角色
    async savePlayerCharacter(character) {
        character.type = 'player';
        character.lastUpdated = new Date().toISOString();
        return await this.saveCharacter(character);
    }

    // 更新角色状态
    async updateCharacterStats(characterId, stats) {
        const character = await this.getCharacter(characterId);
        if (!character) {
            throw new Error('角色不存在');
        }
        
        // 更新数值属性
        Object.keys(stats).forEach(key => {
            if (character.hasOwnProperty(key)) {
                character[key] = stats[key];
            }
        });
        
        return await this.saveCharacter(character);
    }

    // 装备管理
    async equipItem(characterId, itemId, slot) {
        const character = await this.getCharacter(characterId);
        if (!character) {
            throw new Error('角色不存在');
        }
        
        // 查找物品栏中的物品
        const itemIndex = character.inventory.findIndex(item => item.id === itemId);
        if (itemIndex === -1) {
            throw new Error('物品不存在');
        }
        
        const item = character.inventory[itemIndex];
        if (!item.equipable || item.slot !== slot) {
            throw new Error('物品不能装备到此位置');
        }
        
        // 卸下当前装备
        if (character.equipment[slot]) {
            character.inventory.push(character.equipment[slot]);
        }
        
        // 装备新物品
        character.equipment[slot] = item;
        character.inventory.splice(itemIndex, 1);
        
        return await this.saveCharacter(character);
    }

    // 卸下装备
    async unequipItem(characterId, slot) {
        const character = await this.getCharacter(characterId);
        if (!character) {
            throw new Error('角色不存在');
        }
        
        if (!character.equipment[slot]) {
            throw new Error('该位置没有装备');
        }
        
        // 检查物品栏空间
        if (character.inventory.length >= character.maxInventorySize) {
            throw new Error('物品栏空间不足');
        }
        
        // 卸下装备到物品栏
        character.inventory.push(character.equipment[slot]);
        character.equipment[slot] = null;
        
        return await this.saveCharacter(character);
    }

    // 添加物品到物品栏
    async addItemToInventory(characterId, item) {
        const character = await this.getCharacter(characterId);
        if (!character) {
            throw new Error('角色不存在');
        }
        
        if (character.inventory.length >= character.maxInventorySize) {
            throw new Error('物品栏空间不足');
        }
        
        // 生成物品ID
        if (!item.id) {
            item.id = this.generateId();
        }
        
        character.inventory.push(item);
        return await this.saveCharacter(character);
    }

    // 从物品栏移除物品
    async removeItemFromInventory(characterId, itemId) {
        const character = await this.getCharacter(characterId);
        if (!character) {
            throw new Error('角色不存在');
        }
        
        const itemIndex = character.inventory.findIndex(item => item.id === itemId);
        if (itemIndex === -1) {
            throw new Error('物品不存在');
        }
        
        const removedItem = character.inventory.splice(itemIndex, 1)[0];
        await this.saveCharacter(character);
        return removedItem;
    }

    // 创建默认物品
    createDefaultItem(name, type, value = 0) {
        return {
            id: this.generateId(),
            name: name,
            type: type,         // weapon, armor, consumable, material, etc.
            value: value,
            description: '',
            quantity: 1,
            equipable: false,
            slot: null,         // weapon, armor, helmet, etc.
            effects: [],        // 物品效果
            requirements: {},   // 装备需求
            createdAt: new Date().toISOString()
        };
    }

    // 场景缓存管理
    async saveSceneCache(sceneId, environmentData) {
        const transaction = this.db.transaction(['scenesCache'], 'readwrite');
        const store = transaction.objectStore('scenesCache');
        
        const sceneCache = {
            sceneId: sceneId,
            environmentData: environmentData,
            timestamp: new Date().toISOString()
        };
        
        return new Promise((resolve, reject) => {
            const request = store.put(sceneCache);
            request.onsuccess = () => resolve(sceneCache);
            request.onerror = () => reject(request.error);
        });
    }

    async getSceneCache(sceneId) {
        const transaction = this.db.transaction(['scenesCache'], 'readonly');
        const store = transaction.objectStore('scenesCache');
        
        return new Promise((resolve, reject) => {
            const request = store.get(sceneId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async clearSceneCache(sceneId = null) {
        const transaction = this.db.transaction(['scenesCache'], 'readwrite');
        const store = transaction.objectStore('scenesCache');
        
        return new Promise((resolve, reject) => {
            if (sceneId) {
                // 清除特定场景的缓存
                const request = store.delete(sceneId);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            } else {
                // 清除所有场景缓存
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            }
        });
    }

    // 获取当前场景ID
    async getCurrentSceneId() {
        return await this.getWorldState('currentSceneId');
    }

    // 设置当前场景ID
    async setCurrentSceneId(sceneId) {
        return await this.saveWorldState('currentSceneId', sceneId);
    }
}

// 创建全局数据库实例
const gameDB = new GameDatabase();

// 导出数据库实例
window.gameDB = gameDB; 