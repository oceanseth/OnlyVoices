import { db } from './utils/firebase.js';
import { doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc } from 'firebase/firestore';
import { renderSettings } from './pages/Settings.js';
import { renderBooks } from './pages/Books.js';
import { renderVoices } from './pages/Voices.js';

let currentPage = 'settings';
let userData = null;

// Global function to set current page
window.setCurrentPage = (page) => {
    currentPage = page;
};

export const renderApp = async (user) => {
    const container = document.getElementById('app-container');
    
    // Load user data
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        userData = userDoc.exists() ? userDoc.data() : null;
    } catch (error) {
        console.error('Error loading user data:', error);
        userData = null;
    }

    // Determine default page
    if (!userData?.audibleConnected && currentPage === 'books') {
        currentPage = 'settings';
    }

    // Update the fixed header with user info and navigation
    updateAppHeader(user, userData, currentPage);
    
    container.innerHTML = `
        <div class="app-wrapper">
            <main class="app-main" id="app-main">
                <!-- Content will be rendered here -->
            </main>
        </div>
    `;

    // Add styles for app wrapper
    if (!document.getElementById('app-styles')) {
        const style = document.createElement('style');
        style.id = 'app-styles';
        style.textContent = `
            .app-wrapper {
                min-height: 100vh;
                background: #f5f5f5;
                padding-top: 80px; /* Account for fixed header */
            }
            .app-main {
                max-width: 1200px;
                margin: 0 auto;
                padding: 2rem;
            }
            .header-nav {
                display: flex;
                gap: 0;
                margin-left: 2rem;
                border-left: 1px solid rgba(255, 255, 255, 0.2);
                padding-left: 2rem;
            }
            .header-nav-btn {
                padding: 0.5rem 1.5rem;
                background: none;
                border: none;
                border-bottom: 3px solid transparent;
                cursor: pointer;
                font-size: 0.95rem;
                color: rgba(255, 255, 255, 0.9);
                transition: all 0.3s;
                font-weight: 500;
            }
            .header-nav-btn:hover:not(.disabled) {
                color: white;
                background: rgba(255, 255, 255, 0.1);
            }
            .header-nav-btn.active {
                color: white;
                border-bottom-color: white;
                font-weight: 600;
            }
            .header-nav-btn.disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .header-user-info {
                display: flex;
                align-items: center;
                gap: 1rem;
                margin-left: auto;
            }
            .header-user-name {
                color: rgba(255, 255, 255, 0.9);
                font-size: 0.95rem;
            }
            .header-logout-btn {
                padding: 0.5rem 1rem;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 8px;
                color: white;
                cursor: pointer;
                font-size: 0.9rem;
                transition: all 0.3s;
            }
            .header-logout-btn:hover {
                background: rgba(255, 255, 255, 0.2);
            }
            @media (max-width: 768px) {
                .header-nav {
                    display: none; /* Hide nav on mobile, can add mobile menu later */
                }
                .header-user-name {
                    display: none; /* Hide name on mobile to save space */
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Navigation handlers (in fixed header)
    document.querySelectorAll('.header-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            if (!btn.disabled) {
                currentPage = page;
                renderApp(user);
            }
        });
    });

    // Logout handler (in fixed header)
    const logoutBtn = document.querySelector('#headerLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            const { logout } = await import('./utils/firebase.js');
            await logout();
        });
    }

    // Render current page
    const main = container.querySelector('#app-main');
    switch (currentPage) {
        case 'voices':
            renderVoices(main, user, userData);
            break;
        case 'books':
            renderBooks(main, user, userData);
            break;
        case 'settings':
            renderSettings(main, user, userData);
            break;
    }
};

// Update the fixed header with user info and navigation
function updateAppHeader(user, userData, currentPage) {
    const header = document.querySelector('.header');
    if (!header) return;

    // Update login button to show user info and navigation
    const loginButton = document.getElementById('headerLoginButton');
    const existingNav = header.querySelector('.header-nav');
    const existingUserInfo = header.querySelector('.header-user-info');
    
    if (user) {
        // Remove existing nav/user info if present
        if (existingNav) existingNav.remove();
        if (existingUserInfo) existingUserInfo.remove();
        if (loginButton) loginButton.remove();
        
        // Add navigation and user info
        const nav = document.createElement('div');
        nav.className = 'header-nav';
        nav.innerHTML = `
            <button class="header-nav-btn ${currentPage === 'voices' ? 'active' : ''}" data-page="voices">
                🎭 Voices
            </button>
            <button class="header-nav-btn ${currentPage === 'books' ? 'active' : ''} ${!userData?.audibleConnected ? 'disabled' : ''}" 
                    data-page="books" ${!userData?.audibleConnected ? 'disabled' : ''}>
                📚 Books
            </button>
            <button class="header-nav-btn ${currentPage === 'settings' ? 'active' : ''}" data-page="settings">
                ⚙️ Settings
            </button>
        `;
        
        const userInfo = document.createElement('div');
        userInfo.className = 'header-user-info';
        userInfo.innerHTML = `
            <span class="header-user-name">${user.displayName || user.email?.split('@')[0] || 'User'}</span>
            <button id="headerLogoutBtn" class="header-logout-btn">Logout</button>
        `;
        
        header.appendChild(nav);
        header.appendChild(userInfo);
    } else {
        // Remove nav and user info if present
        if (existingNav) existingNav.remove();
        if (existingUserInfo) existingUserInfo.remove();
        
        // Add login button if not present
        if (!loginButton) {
            const btn = document.createElement('button');
            btn.className = 'login-button';
            btn.id = 'headerLoginButton';
            btn.textContent = 'Login';
            btn.onclick = () => {
                if (window.showLoginModal) {
                    window.showLoginModal();
                }
            };
            header.appendChild(btn);
        } else {
            loginButton.textContent = 'Login';
            loginButton.onclick = () => {
                if (window.showLoginModal) {
                    window.showLoginModal();
                }
            };
        }
    }
}

export const renderLanding = () => {
    // Reset header to login button
    const header = document.querySelector('.header');
    if (header) {
        const userInfo = header.querySelector('.header-user-info');
        const nav = header.querySelector('.header-nav');
        const loginButton = document.getElementById('headerLoginButton');
        
        if (userInfo) userInfo.remove();
        if (nav) nav.remove();
        
        if (!loginButton) {
            const userInfoContainer = header.querySelector('.header-user-info')?.parentElement;
            if (userInfoContainer) {
                const btn = document.createElement('button');
                btn.className = 'login-button';
                btn.id = 'headerLoginButton';
                btn.textContent = 'Login';
                btn.onclick = () => showLoginModal();
                userInfoContainer.appendChild(btn);
            }
        }
    }
};

// Export current page setter
window.setCurrentPage = (page) => {
    currentPage = page;
};

