/*
NOTE: This Cloudflare Function is currently BYPASSED for the Google login flow.
The authentication service (aa.jstang.cn) is now configured to redirect
directly back to the frontend page (e.g., login.html or register.html)
which handles the Google user information directly in client-side JavaScript.
This function is kept for historical purposes or if the flow changes back.

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // 从 aa.jstang.cn 的回调中获取参数
  const google_id = url.searchParams.get('google_id');
  const name = url.searchParams.get('name');
  const email = url.searchParams.get('email');
  const picture = url.searchParams.get('picture');
  const state = url.searchParams.get('state'); // 期望这是编码后的原始前端 URL

  let finalFrontendUrlString;

  if (state) {
    try {
      finalFrontendUrlString = decodeURIComponent(state);
      // 安全性检查：确保 state 解码后是一个有效的、预期的 URL 格式
      // 例如，可以检查它是否以 '/' 开头（相对路径）或与您的应用同源
      const tempUrl = new URL(finalFrontendUrlString, url.origin); // 尝试基于当前源解析
      if (tempUrl.origin !== url.origin && !finalFrontendUrlString.startsWith('/')) {
        console.warn(`[AuthCallback] State parameter "${finalFrontendUrlString}" seems to be an external URL or invalid relative path. Falling back to root.`);
        finalFrontendUrlString = '/'; // 安全回退
      } else {
        // 如果是相对路径但不是以 / 开头 (例如 "path/page")，确保添加前导 /
        if (!finalFrontendUrlString.startsWith('/') && tempUrl.origin === url.origin) {
             // tempUrl.pathname already has the leading / if it's same origin and finalFrontendUrlString is just 'path'
             finalFrontendUrlString = tempUrl.pathname;
        } else if (!finalFrontendUrlString.startsWith('/')) {
             finalFrontendUrlString = '/' + finalFrontendUrlString; // 一般情况
        }
      }
    } catch (e) {
      console.error("[AuthCallback] Error decoding or parsing state parameter:", state, e);
      finalFrontendUrlString = '/design'; // 如果state无效，回退到默认页面
    }
  } else {
    console.warn("[AuthCallback] State parameter is missing. Falling back to default page /design.");
    finalFrontendUrlString = '/design'; // 如果没有 state，回退到默认页面
  }

  // 构建传递给前端的查询参数
  const paramsForFrontend = new URLSearchParams();
  if (google_id) paramsForFrontend.set('google_id', google_id);
  if (name) paramsForFrontend.set('name', name);
  if (email) paramsForFrontend.set('email', email);
  if (picture) paramsForFrontend.set('picture', picture);

  const queryStringForFrontend = paramsForFrontend.toString();
  
  // 确保 finalFrontendUrlString 是一个路径，然后附加查询字符串
  const finalRedirectPathAndQuery = `${finalFrontendUrlString}${queryStringForFrontend ? '?' + queryStringForFrontend : ''}`;
  
  // 构建完整的重定向URL (相对于当前应用源)
  const absoluteRedirectUrl = new URL(finalRedirectPathAndQuery, url.origin).toString();

  console.log(`[AuthCallback] Redirecting to: ${absoluteRedirectUrl}`);
  return Response.redirect(absoluteRedirectUrl, 302);
}
*/

// To effectively disable, we can return a simple response or an empty function
export async function onRequest(context) {
  // This function is intentionally left blank as the Google login callback
  // is now handled directly by the frontend. See comments above.
  // You could return a 404 or a simple message if this endpoint is ever hit.
  return new Response("Google callback is now handled client-side.", { status: 404 });
} 