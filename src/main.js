import { signInWithGoogle, signInWithGithub, signInWithEmail, signUpWithEmail, logout, onAuthChange } from './utils/firebase.js';
import { renderApp, renderLanding } from './app.js';

// Initialize app
let currentUser = null;
let currentPage = 'settings'; // Default to settings if not connected

// Auth state listener
onAuthChange((user) => {
    currentUser = user;
    updateHeaderButton(user);
    if (user) {
        // User is logged in, show main app
        document.getElementById('landing').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        renderApp(user);
    } else {
        // User is logged out, show landing page
        document.getElementById('landing').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
        renderLanding();
    }
});

// Update header button based on auth state
function updateHeaderButton(user) {
    // This is now handled by renderApp/renderLanding
    // Keep this function for backwards compatibility but it's mainly handled elsewhere
    const headerLoginBtn = document.getElementById('headerLoginButton');
    if (headerLoginBtn && !user) {
        headerLoginBtn.textContent = 'Login';
        headerLoginBtn.onclick = () => {
            showLoginModal();
        };
    }
}

// Auth button handlers
document.addEventListener('DOMContentLoaded', () => {
    // Header button will be handled by updateHeaderButton
    updateHeaderButton(currentUser);
});

// Show login modal with auth options
window.showLoginModal = function showLoginModal() {
    // Remove existing modal if present
    const existingModal = document.getElementById('loginModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'loginModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        animation: fadeIn 0.3s ease;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: rgba(15, 23, 41, 0.95);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 1.5rem;
        padding: 3rem;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    `;

    modalContent.innerHTML = `
        <h2 style="font-family: 'Space Grotesk', sans-serif; font-size: 1.75rem; margin-bottom: 1.5rem; text-align: center; color: #fff;">Get Started</h2>
        <div style="display: flex; flex-direction: column; gap: 1rem;">
            <button id="modalGoogleAuth" class="auth-button google" style="padding: 1rem 2rem; border: none; border-radius: 12px; font-size: 1.1rem; font-weight: 600; cursor: pointer; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; gap: 0.75rem; color: white; background: #4285f4; border: 2px solid #4285f4;">
                <span>🔵</span>
                Continue with Google
            </button>
            <button id="modalGithubAuth" class="auth-button github" style="padding: 1rem 2rem; border: none; border-radius: 12px; font-size: 1.1rem; font-weight: 600; cursor: pointer; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; gap: 0.75rem; color: white; background: #333; border: 2px solid #333;">
                <span>⚫</span>
                Continue with GitHub
            </button>
            <button id="modalEmailAuth" class="auth-button email" style="padding: 1rem 2rem; border: none; border-radius: 12px; font-size: 1.1rem; font-weight: 600; cursor: pointer; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; gap: 0.75rem; color: white; background: linear-gradient(135deg, #667eea, #764ba2);">
                <span>✉️</span>
                Continue with Email
            </button>
        </div>
        <button id="closeModal" style="position: absolute; top: 1rem; right: 1rem; background: transparent; border: none; color: #fff; font-size: 1.5rem; cursor: pointer; padding: 0.5rem; line-height: 1;">&times;</button>
    `;

    modalContent.style.position = 'relative';
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Close modal handlers
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.id === 'closeModal') {
            modal.remove();
        }
    });

    // Auth button handlers
    const googleBtn = document.getElementById('modalGoogleAuth');
    const githubBtn = document.getElementById('modalGithubAuth');
    const emailBtn = document.getElementById('modalEmailAuth');

    if (googleBtn) {
        googleBtn.addEventListener('click', async () => {
            try {
                await signInWithGoogle();
                modal.remove();
            } catch (error) {
                console.error('Google sign-in error:', error);
                alert('Failed to sign in with Google: ' + error.message);
            }
        });
    }

    if (githubBtn) {
        githubBtn.addEventListener('click', async () => {
            try {
                await signInWithGithub();
                modal.remove();
            } catch (error) {
                console.error('GitHub sign-in error:', error);
                alert('Failed to sign in with GitHub: ' + error.message);
            }
        });
    }

    if (emailBtn) {
        emailBtn.addEventListener('click', () => {
            const email = prompt('Enter your email:');
            if (email) {
                const password = prompt('Enter your password (or leave blank to sign up):');
                if (password) {
                    signInWithEmail(email, password).then(() => modal.remove()).catch(error => {
                        console.error('Email sign-in error:', error);
                        alert('Failed to sign in: ' + error.message);
                    });
                } else {
                    const newPassword = prompt('Create a password:');
                    if (newPassword) {
                        signUpWithEmail(email, newPassword).then(() => modal.remove()).catch(error => {
                            console.error('Email sign-up error:', error);
                            alert('Failed to sign up: ' + error.message);
                        });
                    }
                }
            }
        });
    }
};

// Export for app navigation
window.navigateToPage = (page) => {
    currentPage = page;
    if (currentUser) {
        renderApp(currentUser);
    }
};

