function updateUserLoginStatus() {
    const loggedInUserToken = localStorage.getItem('token');
    const userPicture = localStorage.getItem('picture');
    const userName = localStorage.getItem('name'); // Get user's name

    // In index.html and reviews.html, we expect a structure like this in the sidebar:
    // <div class="sidebar-item" data-tab="login">
    //     <a href="login.html" class="sidebar-link login-button-style">
    //         <i class="fas fa-arrow-right-to-bracket"></i> 
    //         <span data-i18n="menu-login">点击登录</span>
    //     </a>
    // </div>
    // <div id="user-auth-section" class="sidebar-item" style="display: none;">
    //     <!-- Populated by this script -->
    // </div>

    const loginButtonContainer = document.querySelector('.sidebar-item[data-tab="login"]');
    const userAuthSection = document.getElementById('user-auth-section');

    if (!userAuthSection) {
        console.warn('#user-auth-section not found. Sidebar updates will not be applied.');
        // If loginButtonContainer also doesn't exist on a page, gracefully exit.
        if (!loginButtonContainer) return;
    }

    if (loggedInUserToken) { // Simpler check, rely on name/picture for display specifics
        // User is logged in
        if (loginButtonContainer) {
            loginButtonContainer.style.display = 'none';
        }

        if (userAuthSection) {
            userAuthSection.style.display = 'block'; // Or 'flex' if it's a flex container
            
            let avatarHtml;
            const userNameInitial = (userName && userName.length > 0) ? userName.charAt(0).toUpperCase() : 'U';

            if (userPicture && userPicture !== 'null' && userPicture !== 'undefined') {
                avatarHtml = `<img src="${userPicture}" alt="${userName || 'User Avatar'}" style="width: 40px; height: 40px; border-radius: 50%;">`;
            } else {
                // Fallback to initial in a styled div
                avatarHtml = `
                    <div style="width: 40px; height: 40px; border-radius: 50%; background-color: #4285f4; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; font-weight: bold;">
                        ${userNameInitial}
                    </div>
                `;
            }

            userAuthSection.innerHTML = `
                <div class="user-avatar-container" style="position: relative; cursor: pointer; display: flex; align-items: center; padding: 10px; gap: 10px;">
                    ${avatarHtml}
                    <span class="user-name-display" style="color: var(--sidebar-text-color, #e0e0e0); font-weight: 500;">${userName || '用户'}</span>
                </div>
                <div class="user-dropdown" style="display: none; position: absolute; background-color: #444; border: 1px solid #555; border-radius: 4px; padding: 5px 0; top: 60px; /* Adjust as needed */ left: 10px; z-index: 100; min-width: 150px;">
                    <a href="profile.html" id="view-user-info" style="display: block; padding: 8px 15px; color: #e0e0e0; text-decoration: none;" data-i18n="profileLabelViewInfo">查看用户信息</a>
                    <a href="#" id="logout-button" style="display: block; padding: 8px 15px; color: #e0e0e0; text-decoration: none;" data-i18n="profileLabelLogout">退出登录</a>
                </div>
            `;

            const avatarContainer = userAuthSection.querySelector('.user-avatar-container');
            const dropdown = userAuthSection.querySelector('.user-dropdown');

            if (avatarContainer && dropdown) {
                avatarContainer.addEventListener('click', (event) => {
                    event.stopPropagation(); // Prevent click from bubbling up to document
                    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
                });

                // Close dropdown if clicked outside
                document.addEventListener('click', (event) => {
                    if (!avatarContainer.contains(event.target) && !dropdown.contains(event.target)) {
                        dropdown.style.display = 'none';
                    }
                });
            }
            
            const viewUserInfoButton = userAuthSection.querySelector('#view-user-info');
            if(viewUserInfoButton) {
                viewUserInfoButton.href = 'profile.html';
                viewUserInfoButton.addEventListener('click', (e) => {
                    if(dropdown) dropdown.style.display = 'none';
                });
            }

            const logoutButton = userAuthSection.querySelector('#logout-button');
            if (logoutButton) {
                logoutButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    localStorage.removeItem('token');
                    localStorage.removeItem('google_id');
                    localStorage.removeItem('name');
                    localStorage.removeItem('email');
                    localStorage.removeItem('picture');
                    localStorage.removeItem('isUserLoggedIn');
                    // Update UI immediately
                    if(dropdown) dropdown.style.display = 'none';
                    updateUserLoginStatus(); 
                    // Optionally, redirect to login page or refresh
                    // window.location.href = 'login.html'; 
                    window.location.reload(); // Reload to reflect changes and clear state simply
                });
            }
        }
    } else {
        // User is not logged in
        if (loginButtonContainer) {
            loginButtonContainer.style.display = 'block'; // Or 'flex'
        }
        if (userAuthSection) {
            userAuthSection.style.display = 'none';
            userAuthSection.innerHTML = ''; // Clear previous user info
        }
    }
}

// Call the function when the script is loaded and DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    updateUserLoginStatus();
    // Apply translations to dropdown items after they are created
    const currentLang = localStorage.getItem('language') || 'ru';
    if (typeof translations !== 'undefined' && translations[currentLang]) {
        const trans = translations[currentLang];
        const viewInfoLink = document.querySelector('#view-user-info[data-i18n="profileLabelViewInfo"]');
        const logoutLink = document.querySelector('#logout-button[data-i18n="profileLabelLogout"]');

        if (viewInfoLink && trans.profileLabelViewInfo) {
            viewInfoLink.textContent = trans.profileLabelViewInfo;
        }
        if (logoutLink && trans.profileLabelLogout) {
            logoutLink.textContent = trans.profileLabelLogout;
        }
    }
}); 