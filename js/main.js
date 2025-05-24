// DOM元素
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const scenarioButtons = document.querySelectorAll('.scenario-btn');
const reviewCards = document.querySelectorAll('.review-card');
const langOptions = document.querySelectorAll('.lang-option');
const currentLangSpan = document.querySelector('.current-lang');
const sidebarItems = document.querySelectorAll('.sidebar-item');
const contentSections = document.querySelectorAll('.content-section');
const subPromptsContainer = document.getElementById('subPromptsContainer');
const sidebarContentHost = document.querySelector('.sidebar-content-host');

// New DOM elements for image preview
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreviewSrc = document.getElementById('imagePreviewSrc');
const removeImagePreviewBtn = document.getElementById('removeImagePreviewBtn');
const imageControlsContainer = document.getElementById('imageControlsContainer');
const aspectRatioButtonsContainer = document.querySelector('.image-aspect-ratio-selector');
const aspectRatioButtons = document.querySelectorAll('.aspect-ratio-btn');

// 用户头像
const userAvatar = 'https://placehold.co/40x40?text=U';

// Global variable for current chat messages being composed
let currentChatSessionMessages = [];
let currentChatIsDirty = false; // Tracks if the current chat has unsaved user changes
const MAX_HISTORY_ITEMS = 20; // Limit the number of history items
let currentSelectedFile = null;
let isAspectRatioOptionsVisible = false;
let isAttemptingLoginRedirect = false; // Flag to prevent login redirect loops

// <<<< ADDED: Aspect Ratio and Size Globals >>>>
const aspectRatioToSizeMap = {
    "1:1": "1024*1024",
    "4:3": "1024*768",
    "3:4": "768*1024",
    "16:9": "1440*810",
    "9:16": "810*1440"
};
const DEFAULT_ASPECT_RATIO = "1:1";
let currentSelectedSizeForAPI = aspectRatioToSizeMap[DEFAULT_ASPECT_RATIO];
// <<<< END ADDED GLOBALS >>>>

// Define sub-prompts for each scenario
const subPrompts = {
    'writing': ['subprompt-writing-1', 'subprompt-writing-2', 'subprompt-writing-3'],
    'learning': ['subprompt-learning-1', 'subprompt-learning-2', 'subprompt-learning-3'],
    'coding': ['subprompt-coding-1', 'subprompt-coding-2', 'subprompt-coding-3'],
    'travel': ['subprompt-travel-1', 'subprompt-travel-2', 'subprompt-travel-3'],
    'scriptwriting': ['subprompt-scriptwriting-1', 'subprompt-scriptwriting-2', 'subprompt-scriptwriting-3'],
    'summary': ['subprompt-summary-1', 'subprompt-summary-2', 'subprompt-summary-3'],
    'fiction': ['subprompt-fiction-1', 'subprompt-fiction-2', 'subprompt-fiction-3'],
    'ml': ['subprompt-ml-1', 'subprompt-ml-2', 'subprompt-ml-3'],
    'social': ['subprompt-social-1', 'subprompt-social-2', 'subprompt-social-3'],
    'text-to-image': ['subprompt-tti-1', 'subprompt-tti-2', 'subprompt-tti-3'],
    'image-to-image': ['subprompt-iti-1', 'subprompt-iti-2', 'subprompt-iti-3'],
    'image-analysis-detailed': ['subprompt-img-analyze-detail-1', 'subprompt-img-analyze-detail-2', 'subprompt-img-analyze-detail-3']
};

// New DOM elements for user authentication
const userAuthSection = document.getElementById('user-auth-section');
const loginButtonContainer = document.getElementById('login-button-container');

// Helper to get translations safely
function getSafeTranslations() {
    if (typeof translations !== 'undefined') {
        return translations;
    }
    console.warn("Translations object not found. Using fallback.");
    return {
        zh: { 'untitled-chat': '无标题对话', 'history-title': '历史对话', 'no-history': '暂无历史记录', 'welcome-message': '你好！我是 Gemini 2.5 Pro，有什么我可以帮助你的吗？' },
        en: { 'untitled-chat': 'Untitled Chat', 'history-title': 'Chat History', 'no-history': 'No history yet', 'welcome-message': "Hello! I'm Gemini 2.5 Pro, how can I help you?" },
        ru: { 'untitled-chat': 'Без названия чата', 'history-title': 'История чата', 'no-history': 'Еще нет истории', 'welcome-message': 'Привет! Чем могу помочь?' }
    };
}

// Helper function to generate a title for the history item
function generateChatTitle(messages) {
    if (messages && messages.length > 0) {
        const firstUserMessage = messages.find(m => m.sender === 'user');
        if (firstUserMessage) {
            return firstUserMessage.text.substring(0, 30) + (firstUserMessage.text.length > 30 ? '...' : '');
        }
    }
    const trans = getSafeTranslations();
    const currentLang = localStorage.getItem('language') || 'ru';
    return trans[currentLang]['untitled-chat'] || 'Untitled Chat';
}

// Function to clear the image preview
function clearImagePreview() {
    if (imagePreviewContainer) {
        imagePreviewContainer.style.display = 'none';
    }
    if (imagePreviewSrc) {
        imagePreviewSrc.src = '#';
    }
    const imageUploadInput = document.getElementById('imageUploadInput');
    if (imageUploadInput) {
        imageUploadInput.value = '';
    }
    currentSelectedFile = null;
    if (!userInput.value.trim().toLowerCase().match(/(生成|画|创作)/i)) {
        hideImageControls();
    }
    console.log("[ClearPreview] Image preview cleared.");
}

// 添加消息到聊天窗口 (Modified to apply class for AI multiline responses)
function addMessage(text, sender, isInitialOrHistory = false, optionalCssClass = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    if (optionalCssClass) {
        messageDiv.classList.add(optionalCssClass);
    }
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'avatar';
    
    const avatarImg = document.createElement('img');
    avatarImg.src = sender === 'user' ? userAvatar : 'images/AI.png';
    avatarImg.alt = sender === 'user' ? '用户' : 'Gemini';
    avatarImg.onerror = function() {
        this.src = `https://placehold.co/40x40?text=${sender === 'user' ? 'U' : 'G'}`;
    };
    avatarDiv.appendChild(avatarImg);
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const paragraph = document.createElement('p');
    paragraph.textContent = text; 

    // Apply multiline style only for actual AI responses (not thinking/error messages)
    if (sender === 'ai' && !optionalCssClass) { 
        paragraph.classList.add('ai-multiline-response');
    }
    
    contentDiv.appendChild(paragraph);

    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);

    // Add only user messages to currentChatSessionMessages here.
    // Final successful AI responses are added in sendMessage after API call.
    if (sender === 'user' && !isInitialOrHistory) {
        currentChatSessionMessages.push({ text, sender, timestamp: new Date().toISOString() });
        currentChatIsDirty = true; // Mark chat as dirty on new user input
        console.log("[AddMessage-User] Chat marked as dirty.");
    }
    
    return messageDiv; // Return the created message element
}

// Function to save the current chat session to history
function saveCurrentChatToHistory() {
    if (currentChatSessionMessages.length === 0) {
        currentChatIsDirty = false; // Ensure flag is false for empty chats
        return false; // Nothing to save
    }

    const history = loadChatHistory();
    const newSession = {
        id: `chat-${new Date().getTime()}`,
        title: generateChatTitle(currentChatSessionMessages),
        messages: [...currentChatSessionMessages],
        timestamp: new Date().toISOString()
    };

    history.unshift(newSession);
    if (history.length > MAX_HISTORY_ITEMS) {
        history.length = MAX_HISTORY_ITEMS;
    }

    localStorage.setItem('chatHistory', JSON.stringify(history));
    currentChatIsDirty = false; // Reset dirty flag after successful save
    console.log("[SaveHistory] Chat session saved. Dirty flag reset.");
    return true; // Indicate that save happened
}

// Function to load chat history from localStorage
function loadChatHistory() {
    const history = localStorage.getItem('chatHistory');
    return history ? JSON.parse(history) : [];
}

// Function to display chat history in the sidebar
function displayChatHistoryList() {
    if (!sidebarContentHost) return;
    sidebarContentHost.innerHTML = ''; 

    const history = loadChatHistory();
    const trans = getSafeTranslations();
    const currentLang = localStorage.getItem('language') || 'ru';

    const headerDiv = document.createElement('div');
    headerDiv.style.display = 'flex';
    headerDiv.style.justifyContent = 'space-between';
    headerDiv.style.alignItems = 'center';
    headerDiv.style.padding = '1rem 1rem 0.5rem 1rem';

    const titleElement = document.createElement('h3');
    titleElement.textContent = trans[currentLang]['history-title'] || 'История чата';
    titleElement.style.color = '#fff';
    titleElement.style.fontSize = '1rem';
    titleElement.style.fontWeight = '500';
    titleElement.style.margin = '0'; // Remove default margin from h3

    headerDiv.appendChild(titleElement);

    // "Clear All" History Button
    if (history.length > 0) { // Only show if there's history
        const clearAllButton = document.createElement('button');
        clearAllButton.innerHTML = '&#x1F5D1;'; // Trash can icon (Unicode)
        // Or use text: clearAllButton.textContent = trans[currentLang]['clear-all-history-btn'] || 'Clear All';
        // You'll need to add 'clear-all-history-btn' to translations.js if using text
        clearAllButton.title = trans[currentLang]['clear-all-history-tooltip'] || 'Очистить все истории'; // Tooltip
        clearAllButton.style.color = '#ccc';
        clearAllButton.style.backgroundColor = 'transparent';
        clearAllButton.style.border = 'none';
        clearAllButton.style.fontSize = '0.9rem'; // Adjust icon size
        clearAllButton.style.padding = '0.2rem 0.4rem';
        clearAllButton.style.cursor = 'pointer';
        clearAllButton.style.lineHeight = '1';
        clearAllButton.onmouseover = () => clearAllButton.style.color = '#ff6b6b'; // Red on hover
        clearAllButton.onmouseout = () => clearAllButton.style.color = '#ccc';

        clearAllButton.addEventListener('click', () => {
            const confirmClear = confirm(trans[currentLang]['confirm-clear-all-history'] || 'Вы уверены, что хотите удалить все истории? Это действие нельзя отменить.');
            if (confirmClear) {
                clearAllChatHistory();
            }
        });
        headerDiv.appendChild(clearAllButton);
    }
    sidebarContentHost.appendChild(headerDiv);

    const listElement = document.createElement('ul');
    listElement.style.padding = '0 0.5rem 1rem 0.5rem';
    listElement.style.margin = '0';
    listElement.style.listStyle = 'none';
    listElement.style.maxHeight = 'calc(100vh - 180px)'; // Adjusted max height due to headerDiv
    listElement.style.overflowY = 'auto';

    if (history.length === 0) {
        const noHistoryItem = document.createElement('li');
        noHistoryItem.textContent = trans[currentLang]['no-history'] || 'Еще нет истории';
        noHistoryItem.style.padding = '0.75rem 0.5rem';
        noHistoryItem.style.color = '#888';
        noHistoryItem.style.textAlign = 'center'; // Center if no history
        listElement.appendChild(noHistoryItem);
    } else {
        history.forEach(session => {
            const listItem = document.createElement('li');
            listItem.style.display = 'flex';
            listItem.style.justifyContent = 'space-between';
            listItem.style.alignItems = 'center';
            listItem.style.padding = '0.6rem 0.75rem';
            listItem.style.marginBottom = '0.25rem';
            listItem.style.borderRadius = '6px';
            listItem.style.cursor = 'pointer';
            listItem.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            listItem.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            listItem.setAttribute('data-history-id', session.id);

            const textContentDiv = document.createElement('div');
            textContentDiv.style.display = 'flex';
            textContentDiv.style.flexDirection = 'column';
            textContentDiv.style.overflow = 'hidden';
            textContentDiv.style.marginRight = '8px';

            listItem.onmouseover = () => listItem.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            listItem.onmouseout = () => {
                if (!listItem.classList.contains('active-history')) {
                     listItem.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                }
            };

            const titleSpan = document.createElement('span');
            titleSpan.textContent = session.title;
            titleSpan.style.color = '#eee';
            titleSpan.style.fontWeight = '500';
            titleSpan.style.fontSize = '0.85rem';
            titleSpan.style.whiteSpace = 'nowrap';
            titleSpan.style.overflow = 'hidden';
            titleSpan.style.textOverflow = 'ellipsis';

            const dateSpan = document.createElement('span');
            dateSpan.textContent = new Date(session.timestamp).toLocaleDateString();
            dateSpan.style.color = '#aaa';
            dateSpan.style.fontSize = '0.7rem';
            dateSpan.style.marginTop = '0.2rem';

            textContentDiv.appendChild(titleSpan);
            textContentDiv.appendChild(dateSpan);
            listItem.appendChild(textContentDiv);

            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '&times;';
            deleteButton.title = trans[currentLang]['delete-history-item-tooltip'] || 'Удалить эту запись истории';
            deleteButton.style.color = '#ccc';
            deleteButton.style.backgroundColor = 'transparent';
            deleteButton.style.border = 'none';
            deleteButton.style.fontSize = '1.2rem';
            deleteButton.style.padding = '0 0.3rem';
            deleteButton.style.cursor = 'pointer';
            deleteButton.style.lineHeight = '1';
            deleteButton.onmouseover = () => deleteButton.style.color = '#ff6b6b';
            deleteButton.onmouseout = () => deleteButton.style.color = '#ccc';
            
deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteChatHistoryItem(session.id, listItem);
            });
            listItem.appendChild(deleteButton);

            listItem.addEventListener('click', () => {
                if (listItem.classList.contains('active-history')) return;
                loadSpecificChat(session.id);
                document.querySelectorAll('.sidebar-content-host ul li').forEach(item => {
                    item.classList.remove('active-history');
                    item.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    item.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                });
                listItem.classList.add('active-history');
                listItem.style.backgroundColor = 'rgba(255, 215, 0, 0.2)';
                listItem.style.borderColor = 'rgba(255, 215, 0, 0.4)';
            });
            listElement.appendChild(listItem);
        });
    }
    sidebarContentHost.appendChild(listElement);
}

// Function to delete a specific chat history item
function deleteChatHistoryItem(sessionId, listItemElement) {
    const trans = getSafeTranslations();
    const currentLang = localStorage.getItem('language') || 'ru';
    const confirmDelete = confirm(trans[currentLang]['confirm-delete-history-item'] || 'Вы уверены, что хотите удалить эту запись истории?');
    if (confirmDelete) {
    let history = loadChatHistory();
    history = history.filter(session => session.id !== sessionId);
        localStorage.setItem('chatHistory', JSON.stringify(history));
        
        // If the deleted chat was the one currently loaded, clear the chat window
        // You might need a way to track which chat is currently active
        // For now, let's assume if it's deleted, we clear the main chat.
        // A more robust way would be to check if `currentChatSessionMessages` corresponds to this `sessionId`.
        if (listItemElement && listItemElement.classList.contains('active-history')) {
            clearChat(false); // Don't save an empty session after deleting
            addMessage(trans[currentLang]['welcome-message'] || 'Привет! Чем могу помочь?', 'ai', true);
        }
        displayChatHistoryList(); // Refresh the list
    }
}

// Function to load a specific chat session into the main chat window
function loadSpecificChat(sessionId) {
    const history = loadChatHistory();
    const sessionToLoad = history.find(session => session.id === sessionId);

    if (sessionToLoad) {
        clearChat(false); // Ensure current chat (if any) is cleared WITHOUT saving, and dirty flag is reset
        currentChatSessionMessages = [...sessionToLoad.messages]; // Load messages
        sessionToLoad.messages.forEach(msg => {
            if (msg.type === 'image' && msg.url && msg.sender === 'ai') { // AI generated image
                const imageMessageDiv = document.createElement('div');
                imageMessageDiv.className = 'message ai-message image-message-wrapper';
                const avatarDiv = document.createElement('div');
                avatarDiv.className = 'avatar';
                const avatarImg = document.createElement('img');
                avatarImg.src = 'images/AI.png'; 
                avatarImg.alt = 'Gemini';
                avatarImg.onerror = function() { this.src = 'https://placehold.co/40x40?text=G'; };
                avatarDiv.appendChild(avatarImg);
                const contentDiv = document.createElement('div');
                contentDiv.className = 'message-content';
                const imgContainer = document.createElement('div');
                imgContainer.className = 'image-result-container';
                const imgElement = document.createElement('img');
                imgElement.src = msg.url;
                imgElement.alt = msg.text; 
                imgElement.className = 'generated-image';
                imgContainer.appendChild(imgElement);
                contentDiv.appendChild(imgContainer);
                imageMessageDiv.appendChild(avatarDiv);
                imageMessageDiv.appendChild(contentDiv);
                chatMessages.appendChild(imageMessageDiv);
            } else if (msg.type === 'user-image' && msg.sender === 'user') { // User uploaded image from history
                 const imageMessageDiv = document.createElement('div');
                imageMessageDiv.className = 'message user-message image-message-wrapper user-uploaded-image-display';
                
                const contentDiv = document.createElement('div');
                contentDiv.className = 'message-content';

                if (msg.url === 'local-image-placeholder') {
                    const fileNameP = document.createElement('p');
                    fileNameP.textContent = `(上传的图片: ${msg.fileName || '未知文件'}) - 由于存储限制，历史记录中不直接显示图片。`;
                    fileNameP.style.fontStyle = 'italic';
                    fileNameP.style.fontSize = '0.9em';
                    contentDiv.appendChild(fileNameP);
                } else if (msg.url) { // Should ideally be a small thumbnail if we implement that
                const imgContainer = document.createElement('div');
                imgContainer.className = 'image-result-container user-uploaded-image-container';
                const imgElement = document.createElement('img');
                imgElement.src = msg.url; 
                    imgElement.alt = msg.fileName || 'User uploaded image';
                imgElement.className = 'generated-image';
                imgContainer.appendChild(imgElement);
                contentDiv.appendChild(imgContainer);
                } else {
                     const errorP = document.createElement('p');
                    errorP.textContent = `(无法加载历史图片: ${msg.fileName || '未知文件'})`;
                    contentDiv.appendChild(errorP);
                }

                const avatarDiv = document.createElement('div');
                avatarDiv.className = 'avatar';
                const avatarImgUser = document.createElement('img');
                avatarImgUser.src = userAvatar; 
                avatarImgUser.alt = '用户';
                avatarImgUser.onerror = function() { this.src = 'https://placehold.co/40x40?text=U'; };
                avatarDiv.appendChild(avatarImgUser);
                
                imageMessageDiv.appendChild(avatarDiv); 
                imageMessageDiv.appendChild(contentDiv); 

                chatMessages.appendChild(imageMessageDiv);

            } else if (msg.sender && msg.text) { // Regular text message
                addMessage(msg.text, msg.sender, true); // Pass true for isInitialOrHistory
            }
        });
        chatMessages.scrollTop = chatMessages.scrollHeight;
        currentChatIsDirty = false; // Loaded session is not dirty initially
        userInput.focus();
        // Update title display or other UI elements if necessary
        const sessionTitleElement = document.getElementById('chatSessionTitle'); // Assuming you have an element for this
        if (sessionTitleElement) {
            sessionTitleElement.textContent = sessionToLoad.title;
        }
    } else {
        console.warn("Attempted to load a non-existent session:", sessionId);
    }
}

// 清空聊天窗口
function clearChat(saveIfNeeded = false) {
    if (saveIfNeeded && currentChatIsDirty && currentChatSessionMessages.length > 0) {
        console.log("[ClearChat] Dirty chat detected, saving before clearing.");
        saveCurrentChatToHistory(); // This will reset currentChatIsDirty to false
    } else {
        console.log(`[ClearChat] Not saving. saveIfNeeded: ${saveIfNeeded}, currentChatIsDirty: ${currentChatIsDirty}, message count: ${currentChatSessionMessages.length}`);
    }
    chatMessages.innerHTML = '';
    currentChatSessionMessages = [];
    currentChatIsDirty = false;
    clearImagePreview();
    hideImageControls();
    console.log("[ClearChat] Chat cleared. Dirty flag reset.");
}

// 发送消息的函数 (core logic changes for control visibility)
async function sendMessage() {
    let isImageRequest = false;
    const messageText = userInput.value.trim();
    let selectedImageSizeForPayload = null;

    let localSelectedFileForSend = currentSelectedFile; 
    let localSelectedFileDataUrlForSend = null;

    if (localSelectedFileForSend && imagePreviewContainer.style.display !== 'none' && imagePreviewSrc.src.startsWith('data:image')) {
        localSelectedFileDataUrlForSend = imagePreviewSrc.src;
    }

    if (!messageText && !localSelectedFileForSend) {
        console.log("No message text or selected file to send.");
        return;
    }

    const userMessagePartsForHistory = [];

    if (localSelectedFileForSend && localSelectedFileDataUrlForSend) {
        const imageMessageDiv = document.createElement('div');
        imageMessageDiv.className = 'message user-message image-message-wrapper user-uploaded-image-display';
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        const imgContainer = document.createElement('div');
        imgContainer.className = 'image-result-container user-uploaded-image-container'; 
        const imgElement = document.createElement('img');
        imgElement.src = localSelectedFileDataUrlForSend;
        imgElement.alt = localSelectedFileForSend.name;
        imgElement.className = 'generated-image'; 
        imgContainer.appendChild(imgElement);
        contentDiv.appendChild(imgContainer);
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'avatar';
        const avatarImg = document.createElement('img');
        avatarImg.src = userAvatar; 
        avatarImg.alt = '用户';
        avatarImg.onerror = function() { this.src = 'https://placehold.co/40x40?text=U'; };
        avatarDiv.appendChild(avatarImg);
        imageMessageDiv.appendChild(avatarDiv);
        imageMessageDiv.appendChild(contentDiv);
        chatMessages.appendChild(imageMessageDiv);
        userMessagePartsForHistory.push({
            type: 'user-image',
            url: 'local-image-placeholder',
            fileName: localSelectedFileForSend.name,
            sender: 'user',
            timestamp: new Date().toISOString()
        });
    }

    if (messageText) {
        addMessage(messageText, 'user');
        if (localSelectedFileForSend && localSelectedFileDataUrlForSend) {
            userMessagePartsForHistory.push({
                text: messageText,
                sender: 'user',
                timestamp: new Date().toISOString()
            });
        }
    }
    
    if (userMessagePartsForHistory.length > 0) {
        currentChatSessionMessages.push(...userMessagePartsForHistory);
        currentChatIsDirty = true;
    } else if (messageText && !localSelectedFileForSend) {
        // addMessage would have handled pushing to currentChatSessionMessages and setting dirty flag.
    }

    userInput.value = '';
    const thinkingMessageDiv = addMessage('AI正在思考中...', 'ai', false, 'thinking-message');

    let endpoint;
    let payload = {};
    let operationFailed = false; 
    let operationAllowsSizeSelection = false;

    if (localSelectedFileForSend && localSelectedFileDataUrlForSend) { // User uploaded an image
        isImageRequest = true;
        operationAllowsSizeSelection = true; // Image edit usually allows size selection
        
        if (messageText) {
            const analysisKeywords = ["分析", "描述这张图", "describe this image", "解读这张图片", "这是什么", "what is this", "看看这张图", "它的提示词是什么", "what's its prompt", "咒语是什么", "反向提示词"];
            let isAnalysis = analysisKeywords.some(k => messageText.toLowerCase().includes(k.toLowerCase()));

            if (isAnalysis) {
                endpoint = '/api/analyze-image';
                payload.imageDataB64 = localSelectedFileDataUrlForSend;
                payload.userQuestion = messageText;
                operationAllowsSizeSelection = false; // Analysis doesn't use size selection
                console.log(`Image Analysis request (with text): ${endpoint}`);
            } else {
                selectedImageSizeForPayload = currentSelectedSizeForAPI;
                const stylizationPrefixes = ["风格化：", "style:", "全局风格：", "整体风格："];
                const stylizationKeywordsInText = ["风格", "style"];
                let isStylization = false;
                let editPromptForApi = messageText;

                for (const prefix of stylizationPrefixes) {
                    if (messageText.toLowerCase().startsWith(prefix.toLowerCase())) {
                        isStylization = true;
                        editPromptForApi = messageText.substring(prefix.length).trim();
                        break;
                    }
                }
                if (!isStylization && stylizationKeywordsInText.some(k => messageText.toLowerCase().includes(k.toLowerCase()))) {
                    isStylization = true;
                }

                if (isStylization) {
                    endpoint = '/api/image-edit';
                    payload.base_image_data = localSelectedFileDataUrlForSend;
                    payload.edit_prompt = editPromptForApi;
                    payload.edit_function = "stylization_all";
                } else {
                    endpoint = '/api/image-edit';
                    payload.base_image_data = localSelectedFileDataUrlForSend;
                    payload.edit_prompt = messageText;
                    payload.edit_function = "description_edit";
                }
                payload.n = 1;
                if (selectedImageSizeForPayload) payload.size = selectedImageSizeForPayload;
                console.log(`Image Edit (${payload.edit_function}) size: ${payload.size || 'default'}`);
            }
        } else { // Image uploaded, but no accompanying text -> analyze
            endpoint = '/api/analyze-image';
            payload.imageDataB64 = localSelectedFileDataUrlForSend;
            payload.userQuestion = "请详细描述这张图片的内容和特点。";
            operationAllowsSizeSelection = false; // Analysis doesn't use size selection
            console.log(`Image Analysis request (no text): ${endpoint}`);
        }
    } else if (messageText && messageText.toLowerCase().match(/(生成|画|创作)/i) && 
               !messageText.toLowerCase().match(/\b(分析|描述|解读|这是什么|看看|提示词|咒语|风格化：|style:|全局风格：|整体风格：|编辑|修改)\b/i) ) {
        isImageRequest = true; 
        operationAllowsSizeSelection = true;
        selectedImageSizeForPayload = currentSelectedSizeForAPI; 
        endpoint = '/api/generate-image';
        payload.prompt = messageText;
        payload.size = selectedImageSizeForPayload;
        payload.n = 1;
        console.log(`Text-to-image generation request, size: ${payload.size}`);
    } else if (messageText) { // Standard text chat
        isImageRequest = false;
        operationAllowsSizeSelection = false;
        endpoint = '/api/chat';
        payload.message = messageText;
        console.log("Standard text chat request to:", endpoint);
        } else {
        if (thinkingMessageDiv && thinkingMessageDiv.parentNode) thinkingMessageDiv.parentNode.removeChild(thinkingMessageDiv);
        console.log("No valid action determined.");
        hideImageControls(); 
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return;
    }

    // Manage visibility of the main image controls container
    if (operationAllowsSizeSelection) {
        showImageControls();
    } else {
        hideImageControls();
    }
    
    // Clear preview if image data was used (after data is in payload and controls visibility decided)
    if (localSelectedFileForSend) { // If an image was involved in this send operation
        clearImagePreview(); 
        // clearImagePreview now conditionally hides controls, so check again
        // if operation STILL allows size selection (e.g. T2I without prior image), ensure controls are shown
        if (operationAllowsSizeSelection && endpoint === '/api/generate-image') {
            showImageControls();
        }
    }
    
    try {
        const backendBaseUrl = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") 
            ? 'http://localhost:3001' 
            : 'https://erlinmall.com';
        const fullEndpointUrl = `${backendBaseUrl}${endpoint}`;
        console.log("Attempting to fetch from:", fullEndpointUrl, "Payload:", JSON.stringify(payload).substring(0, 200) + "...");

        const response = await fetch(fullEndpointUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
            });

        if (thinkingMessageDiv && thinkingMessageDiv.parentNode) {
            thinkingMessageDiv.parentNode.removeChild(thinkingMessageDiv);
        }

            if (!response.ok) {
            let errorData = {};
            try { errorData = await response.json(); } catch (e) { console.warn("Failed to parse error response as JSON:", e); }
            console.error('API request failed:', response.status, errorData);
            const displayErrorMessage = errorData.details?.message || errorData.message || errorData.error || `服务错误 (${response.status})`;
            addMessage(`请求错误: ${displayErrorMessage}`, 'ai', false, 'error-message');
            currentChatSessionMessages.push({ text: `请求错误: ${displayErrorMessage}`, sender: 'ai', timestamp: new Date().toISOString(), optionalCssClass: 'error-message' });
            return;
        }

                const data = await response.json();
        console.log('Received data from backend:', data);

        // --- Handle AI Response ---
        if (data.analysis) { 
            addMessage(data.analysis, 'ai');
            currentChatSessionMessages.push({ text: data.analysis, sender: 'ai', timestamp: new Date().toISOString() });
        } else if (isImageRequest && data.results && data.results.length > 0 && (endpoint === '/api/image-edit' || endpoint === '/api/generate-image')) { 
            data.results.forEach(imgResult => {
                if (imgResult.url) {
                    const imageMessageDivAI = document.createElement('div');
                    imageMessageDivAI.className = 'message ai-message image-message-wrapper';
                    const avatarDivAI = document.createElement('div');
                    avatarDivAI.className = 'avatar';
                    const avatarImgAI = document.createElement('img');
                    avatarImgAI.src = 'images/AI.png'; 
                    avatarImgAI.alt = 'Gemini';
                    avatarImgAI.onerror = function() { this.src = 'https://placehold.co/40x40?text=G'; };
                    avatarDivAI.appendChild(avatarImgAI);
                    const contentDivAI = document.createElement('div');
                    contentDivAI.className = 'message-content';
                    const imgContainerAI = document.createElement('div');
                    imgContainerAI.className = 'image-result-container';
                    const imgElementAI = document.createElement('img');
                    imgElementAI.src = imgResult.url;
                    imgElementAI.alt = payload.prompt || payload.edit_prompt || (endpoint === '/api/generate-image' ? 'Generated image' : 'Edited image'); 
                    imgElementAI.className = 'generated-image';
                    imgContainerAI.appendChild(imgElementAI);
                    contentDivAI.appendChild(imgContainerAI);
                    imageMessageDivAI.appendChild(avatarDivAI);
                    imageMessageDivAI.appendChild(contentDivAI);
                    chatMessages.appendChild(imageMessageDivAI);
                    currentChatSessionMessages.push({ 
                        text: `[Image: ${imgResult.url}]`, 
                        type: 'image', 
                        url: imgResult.url, 
                        sender: 'ai', 
                        timestamp: new Date().toISOString() 
                    });
                }
            });
            if (endpoint === '/api/generate-image' && data.details && data.details.actual_prompt && data.details.actual_prompt !== payload.prompt) {
                 addMessage(`(模型实际使用提示词: ${data.details.actual_prompt})`, 'ai');
                 currentChatSessionMessages.push({ text: `(模型实际使用提示词: ${data.details.actual_prompt})`, sender: 'ai', timestamp: new Date().toISOString()});
                    }
        } else if (data.reply) { 
            addMessage(data.reply, 'ai'); 
            currentChatSessionMessages.push({ text: data.reply, sender: 'ai', timestamp: new Date().toISOString() });
        } else if (isImageRequest) { 
             const aiResponseMessage = data.message || 'AI服务处理成功，但未返回预期的结果格式。';
             addMessage(aiResponseMessage, 'ai');
             currentChatSessionMessages.push({ text: aiResponseMessage, sender: 'ai', timestamp: new Date().toISOString() });
                }
        
        saveCurrentChatToHistory();
        displayChatHistoryList(); 

        } catch (error) {
        console.error('Error sending message or processing response:', error);
        if (thinkingMessageDiv && thinkingMessageDiv.parentNode) {
            thinkingMessageDiv.parentNode.removeChild(thinkingMessageDiv);
        }
        addMessage('网络错误或无法连接到AI服务。', 'ai', false, 'error-message');
        currentChatSessionMessages.push({ text: '网络错误或无法连接到AI服务。', sender: 'ai', timestamp: new Date().toISOString(), optionalCssClass: 'error-message' });
            }
            chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 切换内容区域 (Modified switchTab)
function switchTab(tabId) {
    // Visually activate the correct sidebar item
    sidebarItems.forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
    });

    // Manage main content sections and sidebar history host
    contentSections.forEach(section => section.classList.remove('active'));

    if (tabId === 'capabilities') {
        const capabilitiesSection = document.getElementById('capabilities-section');
        if (capabilitiesSection) capabilitiesSection.classList.add('active');
        if (sidebarContentHost) sidebarContentHost.style.display = 'none'; // Hide history pane
    } else if (tabId === 'chat' || tabId === 'history' || tabId === 'newchat') {
        const chatSection = document.getElementById('chat-section');
        if (chatSection) chatSection.classList.add('active');
        if (sidebarContentHost) sidebarContentHost.style.display = 'block'; // Show history pane

        if (tabId === 'history') {
            displayChatHistoryList(); // Refresh/show history list
        }
        // If 'newchat', specific logic is in its event listener (save, clear, etc.)
        // If 'chat', just ensure chat section and history pane are visible.
    }

    if ((tabId === 'chat' || tabId === 'newchat') && chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// 事件监听器 (sendButton, userInput as before)
if (sendButton) { sendButton.addEventListener('click', sendMessage); }
if (userInput) {
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
}

// 侧边栏菜单事件 (Modified to correctly handle <a> tags and avoid interference with login link)
if (sidebarItems) {
    sidebarItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const tabId = item.getAttribute('data-tab');
            const isActive = item.classList.contains('active');

            // Handle clicks on actual <a> tags like login.html separately
            if (e.target.closest('a.sidebar-link')) {
                if (currentChatIsDirty && currentChatSessionMessages.length > 0) {
                    console.log("[LoginLinkClick] Current chat is dirty, saving before navigating.");
                    saveCurrentChatToHistory();
                    // displayChatHistoryList(); // Not needed, navigating away
                }
                return; // Allow default <a> tag behavior
            }

            // If clicking on a new sidebar item (not the already active one)
            // and the chat is dirty, save it before proceeding.
            // Exclude 'newchat' because it has specific save-then-clear logic.
            if (!isActive && tabId !== 'newchat' && currentChatIsDirty && currentChatSessionMessages.length > 0) {
                console.log(`[SidebarSwitchTo-${tabId}] Current chat is dirty, saving before switching.`);
                saveCurrentChatToHistory();
                displayChatHistoryList(); // Update history list as we are likely staying on the page or need it updated before nav
            }

            // Proceed with tab-specific actions
            if (tabId === 'capabilities') {
                // Save would have occurred above if relevant.
                window.location.href = 'capabilities.html';
            } else if (tabId === 'newchat') {
                console.log("[NewChatButton] Clicked.");
                // Specific logic for 'newchat': save if dirty, then clear for new chat.
                if (currentChatIsDirty && currentChatSessionMessages.length > 0) {
                    console.log("[NewChatButton] Current chat is dirty and has messages, saving it.");
                    saveCurrentChatToHistory();
                    displayChatHistoryList(); 
                } else {
                    console.log(`[NewChatButton] Current chat not saved. Dirty: ${currentChatIsDirty}, Msgs: ${currentChatSessionMessages.length}`);
                }
                clearChat(false); // Clear current chat content and reset dirty flag
                switchTab('chat'); // Switch to the chat view layout
                const trans = getSafeTranslations();
                const currentLang = localStorage.getItem('language') || 'ru';
                addMessage(trans[currentLang]['welcome-message'] || 'Привет! Чем могу помочь?', 'ai', true); // Add welcome message
                console.log(`[NewChatButton] New chat started. Dirty flag is ${currentChatIsDirty}.`);
            } else if (tabId === 'chat' || tabId === 'history') {
                if (!isActive) { // Only switch if not already on this tab
                switchTab(tabId); 
                }
            } else {
                // Optional: handle unknown tabId or do nothing
                // console.log('Clicked on sidebar item with unhandled tabId:', tabId);
            }
        });
    });
}

// Helper function to check if we are on index.html (existing)
function isOnIndexPath() {
    return window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/');
}

// 场景按钮事件 (existing, ensure no conflicts)
if (scenarioButtons) {
    scenarioButtons.forEach(button => {
        // Ensure no duplicate listeners if this script runs multiple times (though it shouldn't)
        button.removeEventListener('click', handleScenarioButtonClick); 
        button.addEventListener('click', handleScenarioButtonClick);
    });
}

// 语言切换 (Modified to use setTimeout for applyTranslations)
function switchLanguage(lang) {
    if (lang && lang === 'ru') { // Only RU is supported now
        localStorage.setItem('language', lang); // Set in storage first

        if (currentLangSpan) {
            currentLangSpan.textContent = 'Русский'; // Directly set to Russian
        }
        langOptions.forEach(option => {
            option.classList.toggle('active', option.getAttribute('data-lang') === lang);
        });

        applyTranslations(lang); // Pass the new language directly

        // Re-render dynamic sub-prompts for active scenario using NEW lang
        const activeScenarioButton = document.querySelector('.scenario-btn.active');
        if (activeScenarioButton && subPromptsContainer) {
            const scenarioKey = activeScenarioButton.getAttribute('data-scenario');
            subPromptsContainer.innerHTML = ''; 
            
            const promptKeys = subPrompts[scenarioKey];
            const trans = getSafeTranslations(); 

            if (promptKeys && trans && trans[lang]) { // Use the new 'lang' here
                const langPrompts = trans[lang];
                promptKeys.forEach(key => {
                    const promptText = langPrompts[key];
                    if (promptText) {
                        const subPromptButton = document.createElement('button');
                        subPromptButton.className = 'sub-prompt-btn';
                        subPromptButton.textContent = promptText;
                        subPromptButton.onclick = () => {
                            userInput.value = promptText;
                            userInput.focus();
                            if (scenarioKey === 'text-to-image') {
                                showImageControls();
                            }
                        };
                        subPromptsContainer.appendChild(subPromptButton);
                    }
                });
            }
        }

        // Update history list titles (uses localStorage, which is now NEW lang)
        if (sidebarContentHost && sidebarContentHost.style.display !== 'none') {
            displayChatHistoryList();
        }

        // Update welcome message in chat using NEW lang
        if (chatMessages && chatMessages.children.length === 1 && chatMessages.children[0].classList.contains('ai-message')) {
            const trans = getSafeTranslations();
            const welcomeText = trans[lang] ? trans[lang]['welcome-message'] : 'Привет! Чем могу помочь?';
            chatMessages.innerHTML = ''; 
            addMessage(welcomeText, 'ai', true);
        }
    }
}

// Apply translations (Modified to accept language parameter)
function applyTranslations(languageToApply) {
    const currentLang = languageToApply || localStorage.getItem('language') || 'ru';
    const trans = getSafeTranslations();
    
    document.querySelectorAll('[data-i18n], [data-translate-key]').forEach(el => {
        const key = el.getAttribute('data-i18n') || el.getAttribute('data-translate-key');
        if (trans[currentLang] && trans[currentLang][key]) {
            // Special handling for footer elements based on structure
            if (el.parentElement && (el.parentElement.classList.contains('footer-top-line') || el.parentElement.classList.contains('footer-bottom-line'))) {
                el.textContent = trans[currentLang][key];
            } else if (el.tagName === 'SPAN' && el.parentElement && el.parentElement.parentElement && (el.parentElement.parentElement.classList.contains('footer-top-line') || el.parentElement.parentElement.classList.contains('footer-bottom-line')) && key === 'contactUs') {
                 el.textContent = trans[currentLang][key]; // For contactUs span
            } else {
                 el.textContent = trans[currentLang][key]; // General case
            }
        }
    });
    
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (trans[currentLang] && trans[currentLang][key]) {
            el.placeholder = trans[currentLang][key];
        }
    });

    const pageTitleElement = document.querySelector('title');
    if (pageTitleElement) {
        const titleKey = pageTitleElement.getAttribute('data-i18n');
        if (titleKey && trans[currentLang] && trans[currentLang][titleKey]) {
            document.title = trans[currentLang][titleKey];
        } else {
            // Fallback title if data-i18n key is missing or not in translations
            document.title = trans[currentLang]?.[trans[currentLang]['htmlTitle'] ? 'htmlTitle' : 'main-title'] || "Gemini 2.5 Pro";
        }
    }

    const googleLoginSpan = loginButtonContainer?.querySelector('span[data-i18n="menu-login-google"]');
    if (googleLoginSpan && trans[currentLang] && trans[currentLang]['menu-login-google']) {
        googleLoginSpan.textContent = trans[currentLang]['menu-login-google'];
    }

    if (userAuthSection && userAuthSection.style.display !== 'none') {
        const logoutSpan = userAuthSection.querySelector('span[data-i18n="menu-logout"]');
        if (logoutSpan && trans[currentLang] && trans[currentLang]['menu-logout']) {
            logoutSpan.textContent = trans[currentLang]['menu-logout'];
        }
    }
}

// 页面加载完成后执行 (Modified DOMContentLoaded)
document.addEventListener('DOMContentLoaded', async () => {
    // Fetch current user status
    try {
        const response = await fetch('/api/current-user');
        if (!response.ok) {
            console.error('Failed to fetch current user status', response.status);
            updateUserLoginUI(null); // Assume not logged in on error
        } else {
            const data = await response.json();
            updateUserLoginUI(data.user); 
        }
    } catch (error) {
        console.error('Error fetching current user:', error);
        updateUserLoginUI(null); // Assume not logged in on error
    }

    const savedLang = localStorage.getItem('language') || 'ru';
    // switchLanguage(savedLang); // OLD CALL
    // Instead of calling switchLanguage (which does more than just apply initial translations),
    // directly set up the language UI and then call applyTranslations.
    if (currentLangSpan) {
        currentLangSpan.textContent = 'Русский'; // Set to Russian
    }
    langOptions.forEach(option => {
        option.classList.toggle('active', option.getAttribute('data-lang') === savedLang);
        // Since only RU is supported, ensure only RU option can be active if it exists
        if (option.getAttribute('data-lang') !== 'ru') option.style.display = 'none'; else option.style.display = 'block';
    });
    applyTranslations(savedLang); // Call with the saved language

    if (isOnIndexPath()) { 
        // switchTab('chat'); // This line might be redundant if default HTML active classes are set right.
                           // Or, ensure it correctly sets up the view without causing re-translation issues.
                           // For now, let main.js sidebar logic handle initial tab state.

        if (chatMessages && chatMessages.children.length === 0) { 
            const trans = getSafeTranslations();
            const welcomeText = trans[savedLang] ? trans[savedLang]['welcome-message'] : 'Привет! Чем могу помочь?';
            addMessage(welcomeText, 'ai', true); 
        }
        // ... (rest of isOnIndexPath logic) ...
    }
    // ... (rest of DOMContentLoaded) ...

    if (document.querySelector('.rating-summary')) { /* ... existing rating summary ... */ }
    setupMarquee();

    const uploadImageBtn = document.getElementById('uploadImageBtn');
    const imageUploadInput = document.getElementById('imageUploadInput');

    if (uploadImageBtn && imageUploadInput && imagePreviewContainer && imagePreviewSrc && removeImagePreviewBtn) {
        uploadImageBtn.addEventListener('click', () => {
            imageUploadInput.click(); 
        });

        imageUploadInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                if (file.type.startsWith('image/')) {
                    currentSelectedFile = file;
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        imagePreviewSrc.src = e.target.result;
                        imagePreviewContainer.style.display = 'flex';
                        showImageControls(); // Show controls when image is previewed
                    }
                    reader.readAsDataURL(file);
                } else {
                    alert('请选择一个图片文件。');
                    imageUploadInput.value = '';
                    currentSelectedFile = null;
                    // hideImageControls(); // Already handled by clearImagePreview if it was called
                }
            }
        });

        removeImagePreviewBtn.addEventListener('click', () => {
            clearImagePreview(); // This will conditionally hide controls
        });
    } else {
        console.warn("One or more image preview DOM elements not found.");
    }

    // Add beforeunload event listener to save chat if dirty
    window.addEventListener('beforeunload', function (e) {
        if (currentChatIsDirty && currentChatSessionMessages.length > 0) {
            console.log("[BeforeUnload] Current chat is dirty, attempting to save.");
            saveCurrentChatToHistory();
            // Most modern browsers do not allow customizing the unload message,
            // and trying to prevent unload can be disruptive.
            // The main goal here is to silently save.
            }
        });

    // MODIFIED: Aspect Ratio Button Event Listeners & Initial State 
    if (imageControlsContainer && aspectRatioButtonsContainer && aspectRatioButtons.length > 0) {
        aspectRatioButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                aspectRatioButtons.forEach(btn => btn.classList.remove('active'));
                e.currentTarget.classList.add('active');
                const selectedRatio = e.currentTarget.dataset.ratio;
                currentSelectedSizeForAPI = aspectRatioToSizeMap[selectedRatio] || aspectRatioToSizeMap[DEFAULT_ASPECT_RATIO];
                console.log("Aspect ratio selected:", selectedRatio, "API size:", currentSelectedSizeForAPI);
            });
        });

        const defaultButton = Array.from(aspectRatioButtons).find(btn => btn.dataset.ratio === DEFAULT_ASPECT_RATIO);
        if (defaultButton) defaultButton.classList.add('active');
        
        hideImageControls(); 
    } else {
        console.warn("Image size control elements (container or ratio buttons) not found.");
    }
    
    if (userInput && imageControlsContainer) {
        userInput.addEventListener('input', () => {
            const text = userInput.value.trim().toLowerCase();
            if (text.match(/(生成|画|创作)/i) && !currentSelectedFile) {
                showImageControls();
            } else if (!currentSelectedFile && !text.match(/(生成|画|创作)/i)) {
                hideImageControls();
            }
        });
    }

    // START: Login Guard Logic
    function ensureUserIsLoggedIn(event, actionDescription = '使用此功能') {
        if (isAttemptingLoginRedirect) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            return false; // Already attempting to redirect, prevent further actions
        }

        const isLoggedIn = localStorage.getItem('token'); 
        if (!isLoggedIn) {
            if (!window.location.pathname.endsWith('login.html') && !window.location.pathname.endsWith('register.html')) {
                isAttemptingLoginRedirect = true; // Set flag before alert
                
                const trans = getSafeTranslations();
                const currentLang = localStorage.getItem('language') || 'ru';
                const alertMessage = trans[currentLang]?.['login-required-alert'] || 'Пожалуйста, войдите, чтобы начать диалог.';
                alert(alertMessage);
                
                // Prevent default to stop further processing of the event that triggered this
                if (event) {
                    event.preventDefault();
                    event.stopPropagation();
                }

                setTimeout(() => { 
                    window.location.href = 'login.html';
                    // Fallback to reset the flag if redirection somehow fails or is blocked
                    // and the user remains on the current page.
                    setTimeout(() => {
                        isAttemptingLoginRedirect = false;
                    }, 1500); // Reset after 1.5 seconds if still on page.
                }, 50); // 50ms delay for the primary redirect
            }
            return false; // Indicate login is required
        }
        isAttemptingLoginRedirect = false; // Reset if user is already logged in or on login/register page
        return true; // User is logged in
    }

    // Attach login guards to interactive elements on index.html
    if (document.body.contains(userInput) && document.body.contains(sendButton)) { // Check if on index.html essentially
        const uploadImageBtn = document.getElementById('uploadImageBtn');

        if (userInput) {
            userInput.addEventListener('focus', function(event) {
                ensureUserIsLoggedIn(event, '开始对话');
            }, true);
        }
        if (uploadImageBtn) {
            uploadImageBtn.addEventListener('click', function(event) {
                ensureUserIsLoggedIn(event, '上传图片');
            }, true);
        }
        if (sendButton) {
            // For sendButton, the actual message sending logic might also need a check, 
            // but this click listener will attempt to redirect before that logic runs.
            sendButton.addEventListener('click', function(event) {
                ensureUserIsLoggedIn(event, '发送消息');
            }, true);
        }
    }
    // END: Login Guard Logic -DOMContentLoaded part

});

// (Make sure handleScenarioButtonClick, switchLanguage, updateScenarioPrompts (if used) are defined as before)
// updateScenarioPrompts function (if it was still in use, seems superseded by direct translation)
function updateScenarioPrompts() {
    // This function might be redundant if scenario prompts are handled by applyTranslations directly
    // or if their data-attributes are directly translated.
}

// handleScenarioButtonClick function (ensure it's present)
function handleScenarioButtonClick(event) {
    const clickedButton = event.currentTarget;
    const scenarioKey = clickedButton.getAttribute('data-scenario');

    scenarioButtons.forEach(btn => btn.classList.remove('active'));
    clickedButton.classList.add('active');

    subPromptsContainer.innerHTML = '';
    const promptKeys = subPrompts[scenarioKey];
    const trans = getSafeTranslations();
    if (promptKeys && trans) {
        const currentLang = localStorage.getItem('language') || 'ru';
        const langPrompts = trans[currentLang];

        if (langPrompts) {
            promptKeys.forEach(key => {
                const promptText = langPrompts[key];
                if (promptText) {
                    const subPromptButton = document.createElement('button');
                    subPromptButton.className = 'sub-prompt-btn';
                    subPromptButton.textContent = promptText;
                    subPromptButton.onclick = () => {
                        userInput.value = promptText; 
                        userInput.focus();
                        // If it's a text-to-image scenario, show controls
                        if (scenarioKey === 'text-to-image') {
                            showImageControls();
                        }
                    };
                    subPromptsContainer.appendChild(subPromptButton);
                }
            });
        }
    }
    // Show image controls if scenario is text-to-image or image-to-image
    if (scenarioKey === 'text-to-image' || scenarioKey === 'image-to-image') {
        showImageControls();
    } else if (!currentSelectedFile) { 
        hideImageControls();
    }
} 

// Marquee setup (ensure it's present)
function setupMarquee() {
    console.log('[Marquee] setupMarquee called');
    const marqueeRows = document.querySelectorAll('.marquee-row');
    console.log(`[Marquee] Found ${marqueeRows.length} marquee rows.`);

    if (!marqueeRows.length) return;

    marqueeRows.forEach((row, index) => {
        console.log(`[Marquee] Processing row #${row.id} (index ${index})`);
        const cards = Array.from(row.children);
        console.log(`[Marquee] Row #${row.id} initial card count: ${cards.length}`);

        if (cards.length === 0) {
            console.warn(`[Marquee] Row #${row.id} has no cards to duplicate.`);
            return;
        }

        // Duplicate cards for seamless looping
        const initialCardCount = cards.length;
        for (let i = 0; i < initialCardCount; i++) {
            const clone = cards[i].cloneNode(true);
            clone.setAttribute('aria-hidden', 'true');
            row.appendChild(clone);
        }
        console.log(`[Marquee] Row #${row.id} new total child count: ${row.children.length}`);
    });
}
// Define scroll-left and scroll-right if not already in CSS
// @keyframes scroll-left { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }
// @keyframes scroll-right { 0% { transform: translateX(-50%); } 100% { transform: translateX(0%); } }
// These keyframes should be in your main.css

// Ensure langOptions event listeners are correctly set up
if (langOptions) {
    langOptions.forEach(option => {
        // Remove previous listener to avoid duplicates if script re-runs
        const newOption = option.cloneNode(true);
        option.parentNode.replaceChild(newOption, option);
        
        newOption.addEventListener('click', (e) => {
            e.preventDefault();
            const lang = newOption.getAttribute('data-lang');
            if (lang === 'ru') { // Only allow switching to RU
                switchLanguage(lang);
            }
        });
    });
}

// Function to clear all chat history
function clearAllChatHistory() {
    const trans = getSafeTranslations();
    const currentLang = localStorage.getItem('language') || 'ru';
    // Confirmation is now handled in the event listener for the button
    localStorage.removeItem('chatHistory');
    displayChatHistoryList(); // Refresh the list (will show "No history")
    clearChat(); // Clear the current chat window as well
    // Optionally, add a message to the chat window
    addMessage(trans[currentLang]['all-history-cleared-message'] || '所有历史记录已清空。', 'system-notification', true);
}

// Function to update UI based on user login status
function updateUserLoginUI(userData) {
    if (!userAuthSection || !loginButtonContainer) {
        console.warn('User auth UI elements not found.');
        return;
    }

    if (userData) { // User is logged in
        userAuthSection.innerHTML = `
            <img src="${userData.avatar || 'https://placehold.co/30x30?text=' + (userData.displayName ? userData.displayName[0] : 'U')}" alt="${userData.displayName || 'User'}" style="width: 30px; height: 30px; border-radius: 50%; margin-right: 10px;">
            <span style="flex-grow: 1; color: #fff; font-size: 0.9rem;">${userData.displayName || userData.email || 'Пользователь'}</span>
            <a href="/logout" id="logout-link" style="color: #ffd700; text-decoration: none; font-size: 0.9rem; margin-left: 10px;"><i class="fas fa-sign-out-alt"></i> <span data-i18n="menu-logout">Выйти</span></a>
        `;
        userAuthSection.style.display = 'flex'; // Make it visible and align items
        userAuthSection.style.alignItems = 'center';
        loginButtonContainer.style.display = 'none';

        // Add i18n to logout span if possible
        const logoutSpan = userAuthSection.querySelector('span[data-i18n="menu-logout"]');
        if (logoutSpan) {
            const trans = getSafeTranslations();
            const currentLang = localStorage.getItem('language') || 'ru';
            logoutSpan.textContent = trans[currentLang]['menu-logout'] || 'Выйти';
        }

    } else { // User is not logged in
        userAuthSection.style.display = 'none';
        userAuthSection.innerHTML = '';
        loginButtonContainer.style.display = 'flex'; // Show the Google login button
    }
} 

// MODIFIED show/hide functions
function showImageControls() {
    if (imageControlsContainer) {
        imageControlsContainer.style.display = 'flex'; 
        // aspectRatioButtonsContainer should be visible if its parent #imageControlsContainer is flex
        // and aspectRatioButtonsContainer itself is set to display:flex in HTML/CSS or here.
        if (aspectRatioButtonsContainer) {
             aspectRatioButtonsContainer.style.display = 'flex'; // Ensure the options are visible when parent is shown
        }
    }
}

function hideImageControls() {
    if (imageControlsContainer) {
        imageControlsContainer.style.display = 'none';
    }
    // No need to manage master button or options container display separately anymore within these functions,
    // as the options container is the direct child now.
}
// <<<< END MODIFIED FUNCTIONS >>>> 

document.addEventListener('DOMContentLoaded', () => {
    // Attach login guards to interactive elements only if they exist on the current page (primarily for index.html)
    const guardedUserInput = document.getElementById('userInput');
    const guardedUploadButton = document.getElementById('uploadImageBtn'); // ID from index.html
    const guardedSendButton = document.getElementById('sendButton');

    if (guardedUserInput) {
        guardedUserInput.addEventListener('focus', function(event) {
            // Check if the function exists to prevent errors if main.js loads before auth.js somehow, though unlikely
            if (typeof ensureUserIsLoggedIn === 'function') {
                ensureUserIsLoggedIn(event, '开始对话');
            }
        }, true);
    }
    if (guardedUploadButton) {
        guardedUploadButton.addEventListener('click', function(event) {
            if (typeof ensureUserIsLoggedIn === 'function') {
                ensureUserIsLoggedIn(event, '上传图片');
            }
        }, true);
    }
    if (guardedSendButton) {
        guardedSendButton.addEventListener('click', function(event) {
            if (typeof ensureUserIsLoggedIn === 'function') {
                ensureUserIsLoggedIn(event, '发送消息');
            }
        }, true);
    }
}); 