// 图像生成服务模块
class ImageService {
    constructor() {
        this.apiKey = null;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent';
        this.cache = new Map();
        this.maxCacheSize = 20;
    }

    // 设置API密钥
    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }

    // 增强图像提示
    enhancePrompt(basicPrompt) {
        // 基础的奇幻RPG风格提示
        const baseStyle = "fantasy RPG, detailed digital art, high quality, cinematic lighting, vibrant colors, medieval fantasy setting";
        
        // 根据场景类型添加特定描述
        let enhancedPrompt = basicPrompt;
        
        // 如果提示太简单，添加更多细节
        if (basicPrompt.length < 50) {
            enhancedPrompt += ", detailed fantasy scene, magical atmosphere, medieval architecture";
        }
        
        // 组合最终提示
        return `${enhancedPrompt}, ${baseStyle}`;
    }

    // 生成图像
    async generateImage(prompt) {
        if (!this.apiKey) {
            throw new Error('API密钥未设置');
        }

        const enhancedPrompt = this.enhancePrompt(prompt);
        
        const requestBody = {
            contents: [{
                parts: [{
                    text: enhancedPrompt
                }]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024,
                topK: 40,
                topP: 0.95,
                responseModalities: ["TEXT", "IMAGE"]
            }
        };

        try {
            const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`图像生成API调用失败: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
                throw new Error('图像生成API响应格式不正确');
            }

            // 查找图像数据
            const content = data.candidates[0].content;
            let imageData = null;
            let textResponse = null;

            for (const part of content.parts) {
                if (part.inlineData) {
                    imageData = part.inlineData.data;
                } else if (part.text) {
                    textResponse = part.text;
                }
            }

            if (!imageData) {
                throw new Error('未找到图像数据');
            }

            // 转换为可用的图像URL
            const imageUrl = `data:image/jpeg;base64,${imageData}`;
            
            return {
                imageUrl: imageUrl,
                description: textResponse,
                prompt: enhancedPrompt
            };

        } catch (error) {
            console.error('图像生成错误:', error);
            throw error;
        }
    }

    // 异步生成图像（不阻塞游戏流程）
    async generateImageAsync(prompt, callback) {
        try {
            const result = await this.generateImage(prompt);
            if (callback) {
                callback(null, result);
            }
            return result;
        } catch (error) {
            if (callback) {
                callback(error, null);
            }
            throw error;
        }
    }

    // 创建占位图像
    createPlaceholderImage(text = "生成中...") {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // 绘制背景
        const gradient = ctx.createLinearGradient(0, 0, 512, 512);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 512);
        
        // 绘制边框
        ctx.strokeStyle = '#4a5568';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, 510, 510);
        
        // 绘制文本
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(text, 256, 256);
        
        return canvas.toDataURL();
    }

    // 从缓存获取图像
    getFromCache(prompt) {
        const cacheKey = this.hashPrompt(prompt);
        return this.cache.get(cacheKey);
    }

    // 保存到缓存
    saveToCache(prompt, imageData) {
        const cacheKey = this.hashPrompt(prompt);
        
        // 如果缓存已满，删除最旧的项
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(cacheKey, {
            ...imageData,
            timestamp: Date.now()
        });
    }

    // 简单哈希函数
    hashPrompt(prompt) {
        let hash = 0;
        for (let i = 0; i < prompt.length; i++) {
            const char = prompt.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return hash.toString();
    }

    // 带缓存的图像生成
    async generateImageWithCache(prompt) {
        // 首先检查缓存
        const cached = this.getFromCache(prompt);
        if (cached) {
            console.log('从缓存加载图像');
            return cached;
        }

        // 如果缓存中没有，则生成新图像
        try {
            const result = await this.generateImage(prompt);
            this.saveToCache(prompt, result);
            return result;
        } catch (error) {
            console.error('图像生成失败:', error);
            // 返回占位图像
            return {
                imageUrl: this.createPlaceholderImage("生成失败"),
                description: "图像生成失败",
                prompt: prompt
            };
        }
    }

    // 预生成图像（提前生成常用场景）
    async preGenerateImages() {
        const commonScenes = [
            "fantasy tavern interior, warm lighting, medieval setting",
            "forest path, magical atmosphere, sunlight filtering through trees",
            "medieval town square, fantasy architecture, bustling marketplace",
            "ancient castle, imposing towers, mysterious atmosphere",
            "mountain landscape, epic fantasy vista, dramatic clouds"
        ];

        const promises = commonScenes.map(scene => 
            this.generateImageWithCache(scene).catch(error => {
                console.warn(`预生成图像失败: ${scene}`, error);
                return null;
            })
        );

        try {
            await Promise.all(promises);
            console.log('预生成图像完成');
        } catch (error) {
            console.warn('预生成图像过程中出现错误', error);
        }
    }

    // 清理缓存
    clearCache() {
        this.cache.clear();
    }

    // 获取缓存统计
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize,
            items: Array.from(this.cache.entries()).map(([key, value]) => ({
                key,
                timestamp: value.timestamp,
                prompt: value.prompt
            }))
        };
    }
}

// 创建全局图像服务实例
const imageService = new ImageService();

// 导出服务实例
window.imageService = imageService; 