require('dotenv').config(); // **IMPORTANT: Ensures .env variables are loaded first**

// DEBUG: Print environment variables to confirm they are loaded correctly
console.log("DEBUG ENV: GOOGLE_CLIENT_ID =", process.env.GOOGLE_CLIENT_ID);
console.log("DEBUG ENV: GOOGLE_CLIENT_SECRET =", process.env.GOOGLE_CLIENT_SECRET ? "Loaded (not empty)" : "NOT LOADED or EMPTY");

const express = require('express');
const OpenAI = require('openai'); // 1. 引入 OpenAI 模块
const cors = require('cors'); // 引入 cors
const axios = require('axios'); // <<<< ADDED for text-to-image
const passport = require('passport'); // <<<< ADDED
const GoogleStrategy = require('passport-google-oauth20').Strategy; // <<<< ADDED
const session = require('express-session'); // <<<< ADDED

// 使用 .env 文件中的 PORT，如果未定义则默认为 3001
const port = process.env.PORT || 3001;
const app = express(); // Initialize Express app

app.use(cors({
    origin: ['http://localhost:3000', 'https://erlinmall.com', 'https://www.erlinmall.com'], // MODIFIED for production
    credentials: true // Allow cookies to be sent
}));

// 1. 使用中间件来解析JSON格式的请求体
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// TODO: 配置会话中间件 (需要安装 express-session)
app.use(session({
    secret: process.env.SESSION_SECRET || 'a_very_strong_default_secret_key_12345', // Replace with a strong secret, ideally from .env
    resave: false,
    saveUninitialized: false, // Set to false, we don't want to save uninitialized sessions
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // Enable in production if using HTTPS
        httpOnly: true, // Recommended for security
        sameSite: 'lax' // Recommended for security 
    } 
}));

// TODO: 初始化 Passport (需要安装 passport)
app.use(passport.initialize());
app.use(passport.session());

// TODO: 配置 Passport Google OAuth 2.0 策略
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.NODE_ENV === 'production' ? "https://erlinmall.com/auth/google/callback" : "http://localhost:3001/auth/google/callback", // MODIFIED for production
    scope: ['profile', 'email']
  },
  function(accessToken, refreshToken, profile, cb) {
    // In a real app, you would find or create a user in your database here
    // For this example, we'll just pass the Google profile directly
    console.log('Google Profile received:', JSON.stringify(profile, null, 2));
    // Construct a user object as you want to store it in the session
    const user = {
        id: profile.id,
        displayName: profile.displayName,
        email: profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null,
        avatar: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null,
        provider: 'google' // Useful to know the auth provider
    };
    return cb(null, user);
  }
));

// TODO: 配置 Passport 序列化和反序列化用户
passport.serializeUser(function(user, cb) {
  process.nextTick(function() {
    return cb(null, user); // Store the whole user object in session for simplicity
  });
});

passport.deserializeUser(function(user, cb) {
  process.nextTick(function() {
    return cb(null, user); // Retrieve the whole user object from session
  });
});

// 2. 配置 OpenAI 实例
// 重要：请确保您的 API Key 已正确配置。
// 推荐使用环境变量 (process.env.DASHSCOPE_API_KEY)。
// 如果您没有设置环境变量，并且只是在本地测试，可以临时直接替换 apiKey 的值，
// 但请注意不要将包含真实 Key 的代码提交到版本控制系统。
const openai = new OpenAI({
    apiKey: process.env.DASHSCOPE_API_KEY, // 确保 .env 中 DASHSCOPE_API_KEY 是您的Key
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
});

// === Constants for Text-to-Image API ===
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY; // Re-use the API key
const TEXT_TO_IMAGE_SUBMIT_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis";
const TASK_QUERY_BASE_URL = "https://dashscope.aliyuncs.com/api/v1/tasks/";
const MODEL_NAME_TEXT_TO_IMAGE = "wanx2.1-t2i-turbo";

// === Constants for Image Stylization (Image-to-Image) API ===
const IMAGE_STYLIZATION_SUBMIT_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis";
const MODEL_NAME_IMAGE_STYLIZATION = "wanx2.1-imageedit"; // As per user's cURL

// === Helper Functions for Text-to-Image ===

/**
 * Creates an image generation task with DashScope.
 * @param {object} options - Options for image generation (prompt, negative_prompt, size, n, seed, etc.)
 * @returns {Promise<string|null>} Task ID or null if failed.
 */
async function createImageGenerationTask(options) {
    const {
        prompt,
        negative_prompt = "",
        size = "1024*1024",
        n = 1,
        seed = null,
        prompt_extend = null,
        watermark = null
    } = options;

    if (!prompt) {
        console.error("[Text2Image] Error: 'prompt' is a required field.");
        return null;
    }

    const headers = {
        "Authorization": `Bearer ${DASHSCOPE_API_KEY}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable"
    };

    const payload = {
        model: MODEL_NAME_TEXT_TO_IMAGE,
        input: { prompt },
        parameters: { size, n }
    };

    if (negative_prompt) payload.input.negative_prompt = negative_prompt;
    if (seed !== null) payload.parameters.seed = seed;
    if (prompt_extend !== null) payload.parameters.prompt_extend = prompt_extend;
    if (watermark !== null) payload.parameters.watermark = watermark;

    console.log("[Text2Image] Submitting task to:", TEXT_TO_IMAGE_SUBMIT_URL);
    // console.log("[Text2Image] Payload:", JSON.stringify(payload, null, 2)); // Sensitive, avoid logging full payload with prompt in production

    try {
        const response = await axios.post(TEXT_TO_IMAGE_SUBMIT_URL, payload, { headers });
        // console.log("[Text2Image] Submission response data:", JSON.stringify(response.data, null, 2));
        if (response.data && response.data.output && response.data.output.task_id) {
            console.log(`[Text2Image] Task created successfully. Task ID: ${response.data.output.task_id}, Status: ${response.data.output.task_status}`);
            return response.data.output.task_id;
        } else if (response.data && response.data.code) {
            console.error(`[Text2Image] API Error: Code: ${response.data.code}, Message: ${response.data.message}, Request ID: ${response.data.request_id}`);
            return null;
        } else {
            console.error("[Text2Image] Failed to create task, unexpected response:", response.data);
            return null;
        }
    } catch (error) {
        if (error.response) {
            console.error("[Text2Image] API request error (server response):", error.response.status, error.response.data);
        } else if (error.request) {
            console.error("[Text2Image] API request error (no response):", error.request);
        } else {
            console.error("[Text2Image] Error submitting task:", error.message);
        }
        return null;
    }
}

/**
 * Queries the status/result of an image generation task.
 * @param {string} taskId - The ID of the task to query.
 * @returns {Promise<object|null>} Task output or null if failed/not ready.
 */
async function getTaskResult(taskId) {
    const url = `${TASK_QUERY_BASE_URL}${taskId}`;
    const headers = { "Authorization": `Bearer ${DASHSCOPE_API_KEY}` };

    try {
        const response = await axios.get(url, { headers });
        // console.log(`[Text2Image] Querying task ${taskId}, Status: ${response.data?.output?.task_status}`);
        if (response.data && response.data.output) {
            const taskStatus = response.data.output.task_status;
            if (taskStatus === "SUCCEEDED" || taskStatus === "FAILED" || taskStatus === "CANCELED") {
                return response.data.output;
            } else if (taskStatus === "PENDING" || taskStatus === "RUNNING") {
                return { task_status: taskStatus }; // Indicate it's still processing
            } else {
                console.warn(`[Text2Image] Task ${taskId} has unknown status: ${taskStatus}, Request ID: ${response.data.request_id}`);
                return null;
            }
        } else if (response.data && response.data.code) {
            console.error(`[Text2Image] API Error querying task: Code: ${response.data.code}, Message: ${response.data.message}, Request ID: ${response.data.request_id}`);
            return null;
        } else {
            console.error(`[Text2Image] Failed to query task ${taskId}, unexpected response:`, response.data);
            return null;
        }
    } catch (error) {
        if (error.response && error.response.status !== 200) {
            console.error(`[Text2Image] API request error querying task (server response ${error.response.status}):`, error.response.data?.message || error.response.data);
        } else if (error.request) {
            console.error("[Text2Image] API request error querying task (no response):", error.request);
        } else if (error.response?.status !== 200) { // Avoid logging for non-error http status during polling
            console.error("[Text2Image] Error querying task:", error.message);
        }
        return null;
    }
}

// === NEW Helper Functions for Image Stylization ===
/**
 * Creates an image stylization task with DashScope.
 * @param {object} options - Options for image stylization.
 * @param {string} options.base_image_data - Base64 encoded image data (or Data URL).
 * @param {string} options.style_prompt - Text prompt describing the desired style.
 * @param {number} [options.n=1] - Number of images to generate.
 * @returns {Promise<string|null>} Task ID or null if failed.
 */
async function createImageStylizationTask(options) {
    const {
        base_image_data, // Expecting Base64 data URL like "data:image/jpeg;base64,..."
        edit_prompt,     // Renamed from style_prompt for generality
        edit_function = "stylization_all", // Default to stylization, can be overridden
        n = 1,
        size // <<<< ADDED: size parameter
    } = options;

    if (!base_image_data || !edit_prompt) {
        console.error("[ImageEdit] Error: 'base_image_data' and 'edit_prompt' are required fields.");
        return null;
    }

    const headers = {
        "Authorization": `Bearer ${DASHSCOPE_API_KEY}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable"
    };

    const payload = {
        model: MODEL_NAME_IMAGE_STYLIZATION,
        input: {
            function: edit_function, // Use the provided or default function
            prompt: edit_prompt,
            base_image_data: base_image_data
        },
        parameters: { n }
    };

    if (size) payload.parameters.size = size; // <<<< ADDED: Conditionally add size to payload

    console.log(`[ImageEdit] Submitting ${edit_function} task to:`, IMAGE_STYLIZATION_SUBMIT_URL);
    // console.log("[ImageEdit] Payload:", JSON.stringify(payload)); // Avoid logging full base64

    try {
        const response = await axios.post(IMAGE_STYLIZATION_SUBMIT_URL, payload, { headers });
        if (response.data && response.data.output && response.data.output.task_id) {
            console.log(`[ImageEdit] Task created successfully (${edit_function}). Task ID: ${response.data.output.task_id}, Status: ${response.data.output.task_status}`);
            return response.data.output.task_id;
        } else if (response.data && response.data.code) {
            console.error(`[ImageEdit] API Error (${edit_function}): Code: ${response.data.code}, Message: ${response.data.message}, Request ID: ${response.data.request_id}`);
            return null;
        } else {
            console.error(`[ImageEdit] Failed to create task (${edit_function}), unexpected response:`, response.data);
            return null;
        }
    } catch (error) {
        if (error.response) {
            console.error(`[ImageEdit] API request error (server response, ${edit_function}):`, error.response.status, error.response.data);
        } else if (error.request) {
            console.error(`[ImageEdit] API request error (no response, ${edit_function}):`, error.request);
        } else {
            console.error(`[ImageEdit] Error submitting task (${edit_function}):`, error.message);
        }
        return null;
    }
}

// === Google OAuth 路由 ===

// 路由：用户点击"使用 Google 继续"后，前端会跳转到这里
// 这个路由的目的是将用户重定向到 Google 的 OAuth 授权页面
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// 路由：Google OAuth 成功（或失败）后，会重定向到这个回调 URL
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: process.env.NODE_ENV === 'production' ? 'https://erlinmall.com/login-failed.html' : '/login-failed', failureMessage: true }),
  function(req, res) {
    // Successful authentication, redirect home.
    console.log('Google authentication successful, user:', req.user);
    res.redirect(process.env.NODE_ENV === 'production' ? 'https://erlinmall.com/index.html' : 'http://localhost:3000/index.html'); // MODIFIED for production
  }
);

app.get('/login-failed', (req, res) => {
  const errorMessage = req.session.messages && req.session.messages.length > 0 ? req.session.messages.join(', ') : 'Login failed';
  console.error('Google Login Failed:', errorMessage);
  // Redirect to a frontend page that displays the error
  const loginFailedUrl = process.env.NODE_ENV === 'production' ? 'https://erlinmall.com/login-failed.html' : 'http://localhost:3000/login-failed.html';
  res.redirect(`${loginFailedUrl}?error=${encodeURIComponent(errorMessage)}`);
});

app.get('/api/current-user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ user: req.user });
  } else {
    res.json({ user: null });
  }
});

app.get('/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    req.session.destroy((err) => {
      if (err) {
        console.log('Error : Failed to destroy the session during logout.', err);
        return next(err);
      }
      res.clearCookie('connect.sid'); // Default session cookie name
      console.log('User logged out successfully.');
      res.redirect(process.env.NODE_ENV === 'production' ? 'https://erlinmall.com/index.html' : 'http://localhost:3000/index.html'); // MODIFIED for production
    });
  });
});

// 3. 修改 /api/chat POST 路由以调用通义千问
app.post('/api/chat', async (req, res) => {
    console.log(`后端 (${port}) 收到 /api/chat 的POST请求`); // 添加端口信息以便调试
    const userMessage = req.body.message;

    if (!userMessage) {
        return res.status(400).json({ error: '请求体中必须包含 "message" 字段。' });
    }

    try {
        console.log(`后端向通义千问发送消息: ${userMessage}`);
        const completion = await openai.chat.completions.create({
            model: "qwen-plus",  
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: userMessage }
            ],
        });

        const aiReply = completion.choices[0].message.content;
        console.log('后端收到通义千问的回复:', aiReply);

        res.json({
            reply: aiReply
        });

    } catch (error) {
        console.error('后端调用通义千问API时出错:', error.message);
        let errorMessage = '调用AI大模型服务失败，请稍后再试。';
        if (error.response && error.response.data && error.response.data.error && error.response.data.error.message) {
            errorMessage = error.response.data.error.message;
        } else if (error.name === 'APIError' && error.status) {
             errorMessage = `API Error (${error.status}): ${error.message}`;
        } else if (error.message) {
            errorMessage = error.message; 
        }
        
        res.status(error.status || 500).json({ 
            error: '调用AI服务时出错', 
            details: errorMessage 
        });
    }
});

// === NEW: Text-to-Image API Route ===
app.post('/api/generate-image', async (req, res) => {
    console.log(`后端 (${port}) 收到 /api/generate-image POST请求`);
    const { prompt, negative_prompt, size, n, seed, prompt_extend, watermark } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: '请求体中必须包含 "prompt" 字段。' });
    }

    const generationOptions = {
        prompt,
        negative_prompt,
        size: size || "1024*1024", // Default if not provided
        n: n || 1,                 // Default if not provided
        seed,
        prompt_extend,
        watermark
    };

    try {
        const taskId = await createImageGenerationTask(generationOptions);

        if (!taskId) {
            return res.status(500).json({ error: '创建图像生成任务失败。请检查服务器日志。' });
        }

        console.log(`[Text2Image] 任务已提交，ID: ${taskId}. 开始轮询结果...`);
        const maxAttempts = 30; 
        const pollInterval = 6000; // 6 seconds

        for (let i = 0; i < maxAttempts; i++) {
            const taskOutput = await getTaskResult(taskId);
            if (taskOutput) {
                const currentStatus = taskOutput.task_status;
                console.log(`[Text2Image] 轮询 ${i + 1}/${maxAttempts}: 任务 ${taskId} 状态: ${currentStatus}`);

                if (currentStatus === "SUCCEEDED") {
                    console.log("[Text2Image] 图片生成成功！");
                    if (taskOutput.results && taskOutput.results.length > 0) {
                        return res.json({
                            message: "图片生成成功",
                            results: taskOutput.results, // Contains URLs and other info
                            task_id: taskId,
                            details: taskOutput
                        });
                    } else {
                        console.error("[Text2Image] 任务成功，但未在 results 中找到图片。详细输出:", taskOutput);
                        return res.status(500).json({ error: '任务成功但未返回图片结果。', task_id: taskId, details: taskOutput });
                    }
                } else if (currentStatus === "FAILED" || currentStatus === "CANCELED") {
                    console.error(`[Text2Image] 图片生成任务 ${currentStatus}. 详细信息:`, taskOutput.message || taskOutput);
                    return res.status(500).json({ 
                        error: `图片生成任务 ${currentStatus}`, 
                        message: taskOutput.message || '未知错误', 
                        task_id: taskId,
                        details: taskOutput 
                    });
                } else if (currentStatus === "PENDING" || currentStatus === "RUNNING") {
                    if (i < maxAttempts - 1) {
                        await new Promise(resolve => setTimeout(resolve, pollInterval));
                    } else {
                        console.error("[Text2Image] 轮询超时，任务未在预期时间内完成。");
                        return res.status(504).json({ error: '图像生成任务超时。', task_id: taskId });
                    }
                } else {
                     console.error(`[Text2Image] 任务查询返回未知状态 (${currentStatus}) 或错误，停止轮询。详细:`, taskOutput);
                     return res.status(500).json({ error: `任务查询返回未知状态: ${currentStatus}`, task_id: taskId, details: taskOutput });
                }
            } else { // getTaskResult returned null (error during query)
                if (i < maxAttempts - 1) {
                    console.log("[Text2Image] 查询任务状态时可能发生临时错误，稍后重试...");
                    await new Promise(resolve => setTimeout(resolve, pollInterval));
                } else {
                     console.error("[Text2Image] 多次查询任务状态失败，停止轮询。");
                     return res.status(500).json({ error: '多次查询任务状态失败。', task_id: taskId });
                }
            }
        }
    } catch (error) {
        console.error('[Text2Image] /api/generate-image 路由处理时发生意外错误:', error);
        res.status(500).json({ error: '处理图像生成请求时发生意外错误。' });
    }
});

app.post('/api/analyze-image', async (req, res) => {
    console.log(`后端 (${port}) 收到 /api/analyze-image POST请求`);
    const { imageDataB64, userQuestion } = req.body; // 假设前端发送 Base64 图像数据和问题

    if (!imageDataB64) {
        return res.status(400).json({ error: '请求体中必须包含 "imageDataB64" (Base64 编码的图像数据)。' });
    }
    if (!process.env.DASHSCOPE_API_KEY) {
        console.error("[AnalyzeImage] DASHSCOPE_API_KEY is not set.");
        return res.status(500).json({ error: '服务器API Key未配置。' });
    }
    
    const messagesContent = [];
    messagesContent.push({
        type: "image_url",
        image_url: { "url": imageDataB64 } // 直接使用前端传来的 Base64 Data URL
    });
    messagesContent.push({
        type: "text",
        text: userQuestion || "这张图片里有什么？请详细描述。" // 默认问题
    });

    console.log("[AnalyzeImage] Submitting task to qwen-vl-max via OpenAI compatible API...");
    // 为避免日志过长，不打印完整的 Base64 图像数据
    // console.log("[AnalyzeImage] Payload (messages structure):", JSON.stringify([{role: "user", content: messagesContent.map(c => c.type === 'text' ? c : {type: c.type, image_url: 'data_url_hidden'})}], null, 2));

    try {
        // openai 实例应该已经在文件顶部定义和初始化了
        const response = await openai.chat.completions.create({
            model: "qwen-vl-max", // 使用 qwen-vl-max 模型
            messages: [{
                role: "user",
                content: messagesContent
            }],
            // stream: false, // VL模型通常回答较短，可能不需要流
        });

        // console.log("[AnalyzeImage] API Response:", JSON.stringify(response, null, 2));

        if (response.choices && response.choices.length > 0 && response.choices[0].message && response.choices[0].message.content) {
            const aiResponseText = response.choices[0].message.content;
            console.log("[AnalyzeImage] Image analysis successful.");
            return res.json({
                message: "图像分析成功",
                analysis: aiResponseText,
                details: {
                    model: response.model,
                    usage: response.usage
                }
            });
        } else {
            console.error("[AnalyzeImage] Failed to analyze image, unexpected API response structure:", response);
            return res.status(500).json({ error: '图像分析失败，API响应格式不符合预期。', details: response });
        }
    } catch (error) {
        console.error("[AnalyzeImage] Error calling OpenAI compatible API for qwen-vl-max:", error);
        let statusCode = 500;
        let errorMessage = '处理图像分析请求时发生内部错误。';
        if (error.response) { // Axios-like error structure if openai.chat.completions.create wraps it
            statusCode = error.response.status || 500;
            errorMessage = error.response.data?.error?.message || error.response.data?.message || 'API请求错误';
            console.error("[AnalyzeImage] API Error Details:", error.response.data);
        } else if (error.status) { // OpenAI SDK direct error
             statusCode = error.status;
             errorMessage = error.message;
             if (error.error?.message) errorMessage += ` (${error.error.message})`;
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        return res.status(statusCode).json({ error: `图像分析请求失败: ${errorMessage}` });
    }
});

// === NEW: Image Stylization API Route (now generic Image Edit) ===
app.post('/api/image-edit', async (req, res) => { // Renamed route for clarity
    console.log(`后端 (${port}) 收到 /api/image-edit POST请求`);
    // Accept prompt under either name for backward compatibility or clarity
    const prompt = req.body.edit_prompt || req.body.style_prompt;
    const { base_image_data, edit_function, n, size } = req.body; // <<<< ADDED: size from req.body

    if (!base_image_data || !prompt) {
        return res.status(400).json({ error: '请求体中必须包含 "base_image_data" (Base64 编码的图像数据) 和 "edit_prompt" (编辑或风格提示)。' });
    }
    if (!DASHSCOPE_API_KEY) { 
        console.error("[ImageEditRoute] DASHSCOPE_API_KEY is not set.");
        return res.status(500).json({ error: '服务器API Key未配置。' });
    }

    const actual_edit_function = edit_function || "stylization_all"; // Default to stylization if not specified

    const editOptions = {
        base_image_data,
        edit_prompt: prompt,
        edit_function: actual_edit_function,
        n: n || 1,
        size: size // <<<< ADDED: pass size to task creator
    };

    try {
        const taskId = await createImageStylizationTask(editOptions); // Now a generic image edit task

        if (!taskId) {
            return res.status(500).json({ error: `创建图像编辑任务 (${actual_edit_function}) 失败。请检查服务器日志。` });
        }

        console.log(`[ImageEditRoute] 任务 (${actual_edit_function}) 已提交，ID: ${taskId}. 开始轮询结果...`);
        const maxAttempts = 30; 
        const pollInterval = 6000; // 6 seconds

        for (let i = 0; i < maxAttempts; i++) {
            const taskOutput = await getTaskResult(taskId); // Reusing the generic getTaskResult
            if (taskOutput) {
                const currentStatus = taskOutput.task_status;
                console.log(`[ImageEditRoute] 轮询 ${i + 1}/${maxAttempts}: 任务 ${taskId} (${actual_edit_function}) 状态: ${currentStatus}`);

                if (currentStatus === "SUCCEEDED") {
                    console.log(`[ImageEditRoute] 图片编辑 (${actual_edit_function}) 成功！`);
                    if (taskOutput.results && taskOutput.results.length > 0 && taskOutput.results[0].url) {
                        return res.json({
                            message: `图片编辑 (${actual_edit_function}) 成功`,
                            results: taskOutput.results, // Contains URLs
                            task_id: taskId,
                            details: taskOutput
                        });
                    } else {
                        console.error("[ImageEditRoute] 任务成功，但未在 results 中找到图片URL。详细输出:", taskOutput);
                        return res.status(500).json({ error: '任务成功但未返回有效的图片结果URL。', task_id: taskId, details: taskOutput });
                    }
                } else if (currentStatus === "FAILED" || currentStatus === "CANCELED") {
                    console.error(`[ImageEditRoute] 图片编辑任务 (${actual_edit_function}) ${currentStatus}. 详细信息:`, taskOutput.message || taskOutput);
                    return res.status(500).json({ 
                        error: `图片编辑任务 (${actual_edit_function}) ${currentStatus}`, 
                        message: taskOutput.message || '未知错误', 
                        task_id: taskId,
                        details: taskOutput 
                    });
                } else if (currentStatus === "PENDING" || currentStatus === "RUNNING") {
                    if (i < maxAttempts - 1) {
                        await new Promise(resolve => setTimeout(resolve, pollInterval));
                    } else {
                        console.error(`[ImageEditRoute] 轮询超时，任务 (${actual_edit_function}) 未在预期时间内完成。`);
                        return res.status(504).json({ error: `图像编辑任务 (${actual_edit_function}) 超时。`, task_id: taskId });
                    }
                } else {
                     console.error(`[ImageEditRoute] 任务查询返回未知状态 (${currentStatus}) 或错误 (${actual_edit_function})，停止轮询。详细:`, taskOutput);
                     return res.status(500).json({ error: `任务查询返回未知状态 (${actual_edit_function}): ${currentStatus}`, task_id: taskId, details: taskOutput });
                }
            } else { 
                if (i < maxAttempts - 1) {
                    console.log("[ImageEditRoute] 查询任务状态时可能发生临时错误，稍后重试...");
                    await new Promise(resolve => setTimeout(resolve, pollInterval));
                } else {
                     console.error("[ImageEditRoute] 多次查询任务状态失败，停止轮询。");
                     return res.status(500).json({ error: '多次查询任务状态失败。', task_id: taskId });
                }
            }
        }
    } catch (error) {
        console.error(`[ImageEditRoute] /api/image-edit (${actual_edit_function}) 路由处理时发生意外错误:`, error);
        res.status(500).json({ error: `处理图像编辑请求 (${actual_edit_function}) 时发生意外错误。` });
    }
});

// 4. 启动服务器
app.listen(port, () => {
    console.log(`后端API服务正在 http://localhost:${port} 上运行`);
    const siteUrl = process.env.NODE_ENV === 'production' ? 'https://erlinmall.com' : `http://localhost:3000`;
    const apiUrl = process.env.NODE_ENV === 'production' ? 'https://erlinmall.com' : `http://localhost:${port}`;
    console.log(`Production Site URL: https://erlinmall.com`);
    console.log(`Development Site URL: http://localhost:3000`);
    console.log(`API accessible (potentially via reverse proxy in prod) at path /api/* relative to site URL.`);
    console.log(`Frontend should point API requests to: ${apiUrl}`);

    if (!process.env.DASHSCOPE_API_KEY) {
        console.warn("警告：环境变量 DASHSCOPE_API_KEY 未设置或为空。请确保 .env 文件已正确配置并加载。");
    } else {
        // 为了安全，不在生产日志中打印部分KEY，但可以确认它已加载
        if (process.env.DASHSCOPE_API_KEY.startsWith("sk-")) {
            console.log("DASHSCOPE_API_KEY 已成功加载 (sk-开头)。");
        } else {
            console.warn("警告：DASHSCOPE_API_KEY 可能不是有效的sk-密钥格式。");
        }
    }
    console.log("提示：请确保在 .env 文件中配置 GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET 和 SESSION_SECRET 用于 Google OAuth 登录。");
}); 