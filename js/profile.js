document.addEventListener('DOMContentLoaded', () => {
    const profileAvatarDisplay = document.getElementById('profileAvatarDisplay');
    const profileUserName = document.getElementById('profileUserName');
    const profileUserEmail = document.getElementById('profileUserEmail');
    const profileUserGoogleID = document.getElementById('profileUserGoogleID');

    // Function to get translations safely
    function getSafeTranslations() {
        if (typeof translations !== 'undefined') {
            return translations;
        }
        console.warn("Translations object not found for profile page. Using fallback.");
        return {
            zh: { 
                'profilePageTitle': '用户信息 - Gemini 2.5 Pro',
                'userProfileTitle': '用户信息',
                'profileLabelName': '用户名称:',
                'profileLabelEmail': '用户邮箱:',
                'profileLabelGoogleID': 'Google ID:',
                'profileBackToHome': '返回首页'
            },
            en: { 
                'profilePageTitle': 'User Profile - Gemini 2.5 Pro',
                'userProfileTitle': 'User Information',
                'profileLabelName': 'User Name:',
                'profileLabelEmail': 'Email:',
                'profileLabelGoogleID': 'Google ID:',
                'profileBackToHome': 'Back to Home'
             }
        };
    }

    function applyProfilePageTranslations() {
        const currentLang = localStorage.getItem('language') || 'ru';
        const trans = getSafeTranslations();
        
        if (trans[currentLang]) {
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (trans[currentLang][key]) {
                    el.textContent = trans[currentLang][key];
                }
            });
            const titleElement = document.querySelector('title');
            if (titleElement) {
                const titleKey = titleElement.getAttribute('data-i18n');
                if (titleKey && trans[currentLang][titleKey]) {
                    document.title = trans[currentLang][titleKey];
                }
            }
        }
    }

    function loadUserProfile() {
        const userName = localStorage.getItem('name');
        const userEmail = localStorage.getItem('email');
        const userPicture = localStorage.getItem('picture');
        const googleId = localStorage.getItem('google_id');

        if (profileUserName) {
            profileUserName.textContent = userName || 'N/A';
        }
        if (profileUserEmail) {
            profileUserEmail.textContent = userEmail || 'N/A';
        }
        if (profileUserGoogleID) {
            profileUserGoogleID.textContent = googleId || 'N/A';
        }

        if (profileAvatarDisplay) {
            profileAvatarDisplay.innerHTML = ''; // Clear previous avatar
            const userNameInitial = (userName && userName.length > 0) ? userName.charAt(0).toUpperCase() : 'U';
            if (userPicture && userPicture !== 'null' && userPicture !== 'undefined') {
                const img = document.createElement('img');
                img.src = userPicture;
                img.alt = userName || 'User Avatar';
                profileAvatarDisplay.appendChild(img);
            } else {
                const initialDiv = document.createElement('div');
                initialDiv.className = 'profile-avatar-initial';
                initialDiv.textContent = userNameInitial;
                profileAvatarDisplay.appendChild(initialDiv);
            }
        }
    }

    // Initial load
    applyProfilePageTranslations(); // Apply translations first
    loadUserProfile();

    // Listen for language changes from main.js (if language switcher is on this page)
    // This assumes main.js might dispatch a custom event or directly call a global function for language changes.
    // For simplicity, we'll re-apply on DOMContentLoaded and rely on user re-navigating or main.js handling global lang switch.
    // If main.js has a function like `switchLanguageAndBroadcast()`, we could listen for a custom event.
    const langOptions = document.querySelectorAll('.lang-option');
    if (langOptions) {
        langOptions.forEach(option => {
            // Remove previous listener to avoid duplicates if script re-runs
            const newOption = option.cloneNode(true);
            option.parentNode.replaceChild(newOption, option);

            newOption.addEventListener('click', (e) => {
                e.preventDefault();
                const lang = newOption.getAttribute('data-lang');
                if (lang && lang === 'ru') { // Only allow RU
                    localStorage.setItem('language', lang);
                    const currentLangSpan = document.querySelector('.current-lang');
                    if (currentLangSpan) {
                        currentLangSpan.textContent = 'Русский';
                    }
                    document.querySelectorAll('.lang-option').forEach(opt => {
                        opt.classList.toggle('active', opt.getAttribute('data-lang') === lang);
                        if (opt.getAttribute('data-lang') !== 'ru') opt.style.display = 'none'; else opt.style.display = 'block';
                    });
                    applyProfilePageTranslations(); // Re-apply translations for profile page elements
                    // Note: auth.js also handles its own translation updates for sidebar user info
                }
            });
        });

        // Update current language display on load
        const savedLang = localStorage.getItem('language') || 'ru';
        const currentLangSpan = document.querySelector('.current-lang');
        if (currentLangSpan) {
            currentLangSpan.textContent = 'Русский';
        }
        document.querySelectorAll('.lang-option').forEach(opt => {
            opt.classList.toggle('active', opt.getAttribute('data-lang') === savedLang);
            if (opt.getAttribute('data-lang') !== 'ru') opt.style.display = 'none'; else opt.style.display = 'block';
        });
    }

    // Ensure the sidebar login/user state is updated by auth.js
    if (typeof updateUserLoginStatus === 'function') {
        updateUserLoginStatus();
    }
}); 