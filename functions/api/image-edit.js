const MODEL_NAME_IMAGE_EDIT = "wanx2.1-imageedit"; 
const IMAGE_EDIT_SUBMIT_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis";
const TASK_QUERY_BASE_URL = "https://dashscope.aliyuncs.com/api/v1/tasks/";

async function createImageEditTask(options, apiKey) {
    const {
        base_image_data, 
        edit_prompt,
        edit_function = "stylization_all",
        n = 1,
        size
    } = options;

    if (!base_image_data || !edit_prompt) {
        console.error("[ImageEdit CF] Error: 'base_image_data' and 'edit_prompt' are required.");
        return null;
    }
    if (!apiKey) {
        console.error("[ImageEdit CF] Error: DASHSCOPE_API_KEY is not available.");
        return null;
    }

    const headers = {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable"
    };

    const payload = {
        model: MODEL_NAME_IMAGE_EDIT,
        input: {
            function: edit_function,
            prompt: edit_prompt,
            base_image_data: base_image_data 
        },
        parameters: { n }
    };
    if (size) payload.parameters.size = size;

    console.log(`[ImageEdit CF] Submitting ${edit_function} task to:`, IMAGE_EDIT_SUBMIT_URL);

    try {
        const response = await fetch(IMAGE_EDIT_SUBMIT_URL, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });
        const responseData = await response.json();

        if (responseData && responseData.output && responseData.output.task_id) {
            console.log(`[ImageEdit CF] Task created (${edit_function}). ID: ${responseData.output.task_id}, Status: ${responseData.output.task_status}`);
            return responseData.output.task_id;
        } else if (responseData && responseData.code) {
            console.error(`[ImageEdit CF] API Error (${edit_function}): Code: ${responseData.code}, Message: ${responseData.message}, Request ID: ${responseData.request_id}`);
            return null;
        } else {
            console.error(`[ImageEdit CF] Failed to create task (${edit_function}), unexpected response:`, responseData);
            return null;
        }
    } catch (error) {
        console.error(`[ImageEdit CF] Error submitting task (${edit_function}):`, error.message, error.stack);
        return null;
    }
}

async function getTaskResult(taskId, apiKey) { // Re-using this helper from generate-image logic
    if (!taskId || !apiKey) {
        console.error("[TaskResult CF ImageEdit] Task ID or API Key is missing.");
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
                console.warn(`[TaskResult CF ImageEdit] Task ${taskId} unknown status: ${taskStatus}, Request ID: ${responseData.request_id}`);
                return null;
            }
        } else if (responseData && responseData.code) {
            console.error(`[TaskResult CF ImageEdit] API Error: Code: ${responseData.code}, Message: ${responseData.message}, Request ID: ${responseData.request_id}`);
            return null;
        } else {
            console.error(`[TaskResult CF ImageEdit] Failed to query task ${taskId}, unexpected response:`, responseData);
            return null;
        }
    } catch (error) {
        console.error(`[TaskResult CF ImageEdit] Error querying task ${taskId}:`, error.message, error.stack);
        return null;
    }
}

export async function onRequestPost(context) {
    try {
        const requestBody = await context.request.json();
        const prompt = requestBody.edit_prompt || requestBody.style_prompt;
        const { base_image_data, edit_function, n, size } = requestBody;
        const apiKey = context.env.DASHSCOPE_API_KEY;

        if (!base_image_data || !prompt) {
            return new Response(JSON.stringify({ error: "base_image_data and edit_prompt are required" }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        }
        if (!apiKey) {
            console.error("[ImageEditRoute CF] DASHSCOPE_API_KEY is not configured.");
            return new Response(JSON.stringify({ error: "AI service API key not configured." }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        }

        const actual_edit_function = edit_function || "stylization_all";
        const editOptions = { base_image_data, edit_prompt: prompt, edit_function: actual_edit_function, n: n || 1, size };
        const taskId = await createImageEditTask(editOptions, apiKey);

        if (!taskId) {
            return new Response(JSON.stringify({ error: `Failed to create image edit task (${actual_edit_function}).` }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        }

        console.log(`[ImageEditRoute CF] Task (${actual_edit_function}) submitted, ID: ${taskId}. Polling...`);
        const maxAttempts = 20;
        const pollInterval = 5000;

        for (let i = 0; i < maxAttempts; i++) {
            const taskOutput = await getTaskResult(taskId, apiKey);
            if (taskOutput) {
                const currentStatus = taskOutput.task_status;
                console.log(`[ImageEditRoute CF] Poll ${i + 1}/${maxAttempts}: Task ${taskId} (${actual_edit_function}) status: ${currentStatus}`);

                if (currentStatus === "SUCCEEDED") {
                    return new Response(JSON.stringify({
                        message: `Image edit (${actual_edit_function}) successful`,
                        results: taskOutput.results,
                        task_id: taskId,
                        details: taskOutput
                    }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    });
                } else if (currentStatus === "FAILED" || currentStatus === "CANCELED") {
                     return new Response(JSON.stringify({
                        error: `Image edit task (${actual_edit_function}) ${currentStatus}`,
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
                        return new Response(JSON.stringify({ error: `Image edit task (${actual_edit_function}) timeout.`, task_id: taskId }), {
                            status: 504,
                            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                        });
                    }
                } else {
                    return new Response(JSON.stringify({ error: `Unknown task status (${actual_edit_function}): ${currentStatus}`, task_id: taskId, details: taskOutput }), {
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
        return new Response(JSON.stringify({ error: "Image edit polling loop exited unexpectedly." }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });

    } catch (error) {
        console.error("[ImageEditRoute CF] Error in onRequestPost:", error.message, error.stack);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error in function' }), {
            status: 500,
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
