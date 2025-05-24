import OpenAI from 'openai';

export async function onRequestPost(context) {
    try {
        const requestBody = await context.request.json();
        const { imageDataB64, userQuestion } = requestBody;
        const apiKey = context.env.DASHSCOPE_API_KEY;

        if (!imageDataB64) {
            return new Response(JSON.stringify({ error: "imageDataB64 is required" }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        }
        if (!apiKey) {
            console.error("[AnalyzeImage CF] DASHSCOPE_API_KEY is not configured.");
            return new Response(JSON.stringify({ error: "AI service API key not configured." }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        }

        const messagesContent = [];
        messagesContent.push({
            type: "image_url",
            image_url: { "url": imageDataB64 } 
        });
        messagesContent.push({
            type: "text",
            text: userQuestion || "这张图片里有什么？请详细描述。"
        });

        console.log("[AnalyzeImage CF] Submitting to qwen-vl-max...");

        const openai = new OpenAI({
            apiKey: apiKey,
            baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
        });

        const response = await openai.chat.completions.create({
            model: "qwen-vl-max",
            messages: [{
                role: "user",
                content: messagesContent
            }],
        });

        if (response.choices && response.choices.length > 0 && response.choices[0].message && response.choices[0].message.content) {
            const aiResponseText = response.choices[0].message.content;
            console.log("[AnalyzeImage CF] Analysis successful.");
            return new Response(JSON.stringify({
                message: "图像分析成功",
                analysis: aiResponseText,
                details: {
                    model: response.model,
                    usage: response.usage
                }
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        } else {
            console.error("[AnalyzeImage CF] Failed, unexpected API response:", response);
            return new Response(JSON.stringify({ error: "图像分析失败，API响应格式不符合预期。", details: response }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        }

    } catch (error) {
        console.error("[AnalyzeImage CF] Error:", error.message, error.stack);
        let statusCode = 500;
        let errorMessage = '处理图像分析请求时发生内部错误。';
        if (error.status) { // OpenAI SDK direct error
             statusCode = error.status;
             errorMessage = error.message;
        } else if (error.message) {
            errorMessage = error.message;
        }
        return new Response(JSON.stringify({ error: `图像分析请求失败: ${errorMessage}` }), {
            status: statusCode,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
    }
}

export async function onRequestOptions(context) {
  const allowedOrigin = context.env.NODE_ENV === 'production' ? 'https://erlinmall.com' : '*';
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
