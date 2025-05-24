# Gemini 2.5 Pro 中文演示站

这是一个展示 Google Gemini 2.5 Pro 能力的中文演示网站，提供在线对话体验、能力介绍和用户评价展示。

## 项目结构

```
.
├── index.html           # 主页 - 对话界面
├── capabilities.html    # 能力介绍页面
├── reviews.html         # 用户评价页面
├── styles/
│   └── main.css         # 主样式文件
├── js/
│   └── main.js          # 主JavaScript文件
└── images/              # 图片资源目录
```

## 功能特点

1. **交互式对话界面**
   - 模拟与 Gemini 2.5 Pro 的对话
   - 支持多种预设场景

2. **能力介绍**
   - Gemini 2.5 Pro 在各项基准测试中的表现
   - 核心能力展示
   - 与上一代模型的对比

3. **用户评价**
   - 按不同能力分类的用户评价
   - 评分统计与展示

## 使用方法

1. 克隆仓库到本地
2. 直接在浏览器中打开 `index.html` 或通过本地服务器运行
3. 也可部署到任何静态网站托管服务

## 技术栈

- HTML5
- CSS3 (响应式设计)
- JavaScript (原生)
- Font Awesome 图标

## 自定义

1. 替换 `images` 文件夹中的图片资源
2. 修改 `styles/main.css` 中的颜色变量以更改主题
3. 在 `js/main.js` 中可以自定义对话逻辑

## 接入真实 API

目前网站使用模拟响应，若要接入真实的 Gemini API：

1. 注册 Google AI Studio 获取 API 密钥
2. 修改 `js/main.js` 中的 `getAIResponse` 函数，替换为实际的 API 调用

```javascript
async function getAIResponse(message) {
    try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer YOUR_API_KEY'
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: message }
                        ]
                    }
                ]
            })
        });
        
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        return '抱歉，我暂时无法回答这个问题。';
    }
}
```

## 许可证

MIT

## 注意事项

- 此演示站点仅用于展示目的，不代表 Google 官方
- Gemini 2.5 Pro 是 Google 的产品，相关版权归 Google 所有 