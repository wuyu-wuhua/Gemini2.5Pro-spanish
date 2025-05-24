const MODEL_NAME_TEXT_TO_IMAGE = "wanx2.1-t2i-turbo";
const TEXT_TO_IMAGE_SUBMIT_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis";
const TASK_QUERY_BASE_URL = "https://dashscope.aliyuncs.com/api/v1/tasks/";

async function createImageGenerationTask(options, apiKey) {
    const {
        prompt,
        negative_prompt = "",
        size = "1024*1024",
        n = 1,
        seed = null,
    } = options;

    if (!prompt) {
        console.error("[Text2Image CF] Error: 'prompt' is a required field.");
        return null;
    }
    if (!apiKey) {
        console.error("[Text2Image CF] Error: DASHSCOPE_API_KEY is not available.");
        return null;
    }

    const headers = {
        "Authorization": `Bearer ${apiKey}`,
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

    console.log("[Text2Image CF] Submitting task to:", TEXT_TO_IMAGE_SUBMIT_URL);

    try {
        const response = await fetch(TEXT_TO_IMAGE_SUBMIT_URL, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });
        const responseData = await response.json();

        if (responseData && responseData.output && responseData.output.task_id) {
            console.log(`[Text2Image CF] Task created. ID: ${responseData.output.task_id}, Status: ${responseData.output.task_status}`);
            return responseData.output.task_id;
        } else if (responseData && responseData.code) {
            console.error(`[Text2Image CF] API Error: Code: ${responseData.code}, Message: ${responseData.message}, Request ID: ${responseData.request_id}`);
            return null;
        } else {
            console.error("[Text2Image CF] Failed to create task, unexpected response:", responseData);
            return null;
        }
    } catch (error) {
        console.error("[Text2Image CF] Error submitting task:", error.message, error.stack);
        return null;
    }
}

async function getTaskResult(taskId, apiKey) {
    if (!taskId || !apiKey) {
        console.error("[TaskResult CF] Task ID or API Key is missing.");
        return null;
    }
    const url = `${TASK_QUERY_BASE_URL}${taskId}`;
    const headers = { "Authorization": `Bearer ${apiKey}` };

    try {
        const response = await fetch(url, { headers: headers });
        const responseData = await response.json();

        if (responseData && responseData.output) {
            const taskStatus = responseData.output.task_status;
            if (taskStatus === "SUCCEEDED" || taskStatus === "FAILED" || taskStatus === "CANCELED") {
                return responseData.output;
            } else if (taskStatus === "PENDING" || taskStatus === "RUNNING") {
                return { task_status: taskStatus };
            } else {
                console.warn(`[TaskResult CF] Task ${taskId} unknown status: ${taskStatus}, Request ID: ${responseData.request_id}`);
                return null;
            }
        } else if (responseData && responseData.code) {
            console.error(`[TaskResult CF] API Error querying task: Code: ${responseData.code}, Message: ${responseData.message}, Request ID: ${responseData.request_id}`);
            return null;
        } else {
            console.error(`[TaskResult CF] Failed to query task ${taskId}, unexpected response:`, responseData);
            return null;
        }
    } catch (error) {
        console.error(`[TaskResult CF] Error querying task ${taskId}:`, error.message, error.stack);
        return null;
    }
}

export async function onRequestPost(context) {
    try {
        const requestBody = await context.request.json();
        const { prompt, negative_prompt, size, n, seed } = requestBody;
        const apiKey = context.env.DASHSCOPE_API_KEY;

        if (!prompt) {
            return new Response(JSON.stringify({ error: "prompt is required" }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        }
        if (!apiKey) {
            console.error("[GenerateImage CF] DASHSCOPE_API_KEY is not configured in Cloudflare Function environment.");
            return new Response(JSON.stringify({ error: "AI service API key not configured." }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        }

        const generationOptions = { prompt, negative_prompt, size, n, seed };
        const taskId = await createImageGenerationTask(generationOptions, apiKey);

        if (!taskId) {
            return new Response(JSON.stringify({ error: "Failed to create image generation task." }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        }

        console.log(`[GenerateImage CF] Task submitted, ID: ${taskId}. Polling for results...`);
        const maxAttempts = 20; // Reduced attempts for CF environment
        const pollInterval = 5000; // 5 seconds

        for (let i = 0; i < maxAttempts; i++) {
            const taskOutput = await getTaskResult(taskId, apiKey);
            if (taskOutput) {
                const currentStatus = taskOutput.task_status;
                console.log(`[GenerateImage CF] Poll ${i + 1}/${maxAttempts}: Task ${taskId} status: ${currentStatus}`);

                if (currentStatus === "SUCCEEDED") {
                    return new Response(JSON.stringify({
                        message: "Image generation successful",
                        results: taskOutput.results,
                        task_id: taskId,
                        details: taskOutput
                    }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    });
                } else if (currentStatus === "FAILED" || currentStatus === "CANCELED") {
                    return new Response(JSON.stringify({
                        error: `Image generation task ${currentStatus}`,
                        message: taskOutput.message || 'Unknown error',
                        task_id: taskId,
                        details: taskOutput
                    }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    });
                } else if (currentStatus === "PENDING" || currentStatus === "RUNNING") {
                    if (i < maxAttempts - 1) {
                        await new Promise(resolve => setTimeout(resolve, pollInterval));
                    } else {
                         return new Response(JSON.stringify({ error: "Image generation task timeout.", task_id: taskId }), {
                            status: 504, // Gateway Timeout
                            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                        });
                    }
                } else {
                     return new Response(JSON.stringify({ error: `Unknown task status: ${currentStatus}`, task_id: taskId, details: taskOutput }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    });
                }
            } else {
                if (i < maxAttempts - 1) {
                    await new Promise(resolve => setTimeout(resolve, pollInterval));
                } else {
                    return new Response(JSON.stringify({ error: "Failed to get task result after multiple attempts.", task_id: taskId }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    });
                }
            }
        }
         return new Response(JSON.stringify({ error: "Image generation polling loop exited unexpectedly." }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });

    } catch (error) {
        console.error("[GenerateImage CF] Error in onRequestPost:", error.message, error.stack);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error in function' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
    }
}

export async function onRequestOptions(context) {
  // Ensure your production domain is correctly set here
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
