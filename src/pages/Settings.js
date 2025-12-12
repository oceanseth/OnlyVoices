import { db } from '../utils/firebase.js';
import { doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';

export const renderSettings = async (container, user, userData) => {
    container.innerHTML = `
        <div class="settings-page">
            <h2>Settings</h2>
            
            <div class="settings-section">
                <h3>ElevenLabs API Key</h3>
                <p class="section-description">Enter your ElevenLabs API key to enable voice generation</p>
                <div class="input-group">
                    <input type="password" id="elevenlabsKey" 
                           placeholder="sk-..." 
                           value="${userData?.elevenlabsApiKey || ''}">
                    <button id="saveElevenLabs" class="btn-primary">Save</button>
                </div>
            </div>

            <div class="settings-section audible-section">
                <h3>Audible Account</h3>
                <p class="section-description">Connect your Audible account to import your audiobook library</p>
                ${userData?.audibleConnected 
                    ? `<div class="connected-status">
                        <span class="status-badge success">✓ Connected</span>
                        <p>Your Audible library is synced</p>
                        <button id="disconnectAudible" class="btn-secondary">Disconnect</button>
                       </div>`
                    : `<div>
                        <button id="connectAudible" class="btn-primary">Connect Audible Account</button>
                        <div class="audible-form-container">
                            <div class="form-group">
                                <label for="audibleUsername">Audible Username/Email</label>
                                <input type="text" id="audibleUsername" placeholder="your@email.com" />
                            </div>
                            <div class="form-group">
                                <label for="audiblePassword">Password</label>
                                <input type="password" id="audiblePassword" placeholder="Enter your password" />
                            </div>
                            <button id="submitAudibleForm" class="btn-primary">Connect</button>
                        </div>
                       </div>`
                }
            </div>

            <div class="settings-section">
                <h3>Account Information</h3>
                <div class="info-item">
                    <label>Email:</label>
                    <span>${user.email}</span>
                </div>
                <div class="info-item">
                    <label>User ID:</label>
                    <span class="mono">${user.uid}</span>
                </div>
            </div>
        </div>
    `;

    // Add styles
    if (!document.getElementById('settings-styles')) {
        const style = document.createElement('style');
        style.id = 'settings-styles';
        style.textContent = `
            .settings-page {
                background: white;
                border-radius: 12px;
                padding: 2rem;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .settings-page h2 {
                margin-bottom: 2rem;
                color: #333;
            }
            .settings-section {
                margin-bottom: 3rem;
                padding-bottom: 2rem;
                border-bottom: 1px solid #e0e0e0;
            }
            .settings-section:last-child {
                border-bottom: none;
            }
            .settings-section h3 {
                margin-bottom: 0.5rem;
                color: #667eea;
            }
            .section-description {
                color: #666;
                margin-bottom: 1rem;
                font-size: 0.95rem;
            }
            .input-group {
                display: flex;
                gap: 1rem;
                max-width: 600px;
            }
            .input-group input {
                flex: 1;
                padding: 0.75rem;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                font-size: 1rem;
            }
            .input-group input:focus {
                outline: none;
                border-color: #667eea;
            }
            .btn-primary, .btn-secondary {
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: 8px;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s;
            }
            .btn-primary {
                background: #667eea;
                color: white;
            }
            .btn-primary:hover {
                background: #5568d3;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }
            .btn-secondary {
                background: #f5f5f5;
                color: #666;
                border: 1px solid #e0e0e0;
            }
            .btn-secondary:hover {
                background: #e0e0e0;
            }
            .connected-status {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }
            .status-badge {
                display: inline-block;
                padding: 0.5rem 1rem;
                border-radius: 20px;
                font-size: 0.9rem;
                font-weight: 600;
            }
            .status-badge.success {
                background: #d4edda;
                color: #155724;
            }
            .info-item {
                display: flex;
                gap: 1rem;
                margin-bottom: 1rem;
            }
            .info-item label {
                font-weight: 600;
                min-width: 100px;
                color: #666;
            }
            .mono {
                font-family: monospace;
                font-size: 0.9rem;
                color: #999;
            }
            .audible-form-container {
                max-width: 600px;
                margin-top: 1.5rem;
                max-height: 0;
                overflow: hidden;
                opacity: 0;
                transform: translateY(-10px);
                transition: all 0.4s ease;
            }
            .audible-form-container.visible {
                max-height: 500px;
                opacity: 1;
                transform: translateY(0);
            }
            .form-group {
                margin-bottom: 1.5rem;
            }
            .form-group label {
                display: block;
                margin-bottom: 0.5rem;
                font-weight: 600;
                color: #333;
            }
            .form-group input {
                width: 100%;
                padding: 0.75rem;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                font-size: 1rem;
                transition: border-color 0.3s;
            }
            .form-group input:focus {
                outline: none;
                border-color: #667eea;
            }
            .audible-form-container .btn-primary {
                width: 100%;
            }
        `;
        document.head.appendChild(style);
    }

    // Event handlers
    const saveElevenLabs = container.querySelector('#saveElevenLabs');
    if (saveElevenLabs) {
        saveElevenLabs.addEventListener('click', async () => {
            const key = container.querySelector('#elevenlabsKey').value;
            if (!key) {
                alert('Please enter an API key');
                return;
            }

            try {
                const userRef = doc(db, 'users', user.uid);
                await setDoc(userRef, {
                    elevenlabsApiKey: key,
                    updatedAt: new Date()
                }, { merge: true });

                alert('ElevenLabs API key saved successfully!');
            } catch (error) {
                console.error('Error saving API key:', error);
                if (error.code === 'permission-denied') {
                    alert('Permission denied. Please make sure Firestore security rules are deployed. See firestore.rules file.');
                } else {
                    alert('Failed to save API key: ' + error.message);
                }
            }
        });
    }

    const connectAudible = container.querySelector('#connectAudible');
    if (connectAudible) {
        connectAudible.addEventListener('click', () => {
            // Show animated form fields
            const audibleSection = container.querySelector('.audible-section');
            const formContainer = audibleSection.querySelector('.audible-form-container');
            
            if (formContainer) {
                formContainer.classList.add('visible');
                connectAudible.style.display = 'none';
            }
        });
    }

    // Handle form submission
    const submitAudibleForm = container.querySelector('#submitAudibleForm');
    if (submitAudibleForm) {
        submitAudibleForm.addEventListener('click', async () => {
            const username = container.querySelector('#audibleUsername')?.value;
            const password = container.querySelector('#audiblePassword')?.value;
            
            if (!username || !password) {
                alert('Please enter both username and password');
                return;
            }

            submitAudibleForm.disabled = true;
            submitAudibleForm.textContent = 'Connecting...';

            try {
                const token = await user.getIdToken();
                const response = await fetch('/api/audible/connect', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok) {
                    const userRef = doc(db, 'users', user.uid);
                    await updateDoc(userRef, {
                        audibleConnected: true,
                        audibleUsername: username,
                        updatedAt: new Date()
                    });

                    alert('Audible account connected successfully!');
                    window.location.reload();
                } else {
                    throw new Error(data.error || 'Failed to connect Audible account');
                }
            } catch (error) {
                console.error('Error connecting Audible:', error);
                alert('Failed to connect Audible account: ' + error.message);
                submitAudibleForm.disabled = false;
                submitAudibleForm.textContent = 'Connect';
            }
        });
    }

    const disconnectAudible = container.querySelector('#disconnectAudible');
    if (disconnectAudible) {
        disconnectAudible.addEventListener('click', async () => {
            if (confirm('Are you sure you want to disconnect your Audible account?')) {
                try {
                    const userRef = doc(db, 'users', user.uid);
                    await updateDoc(userRef, {
                        audibleConnected: false,
                        audibleUsername: null,
                        updatedAt: new Date()
                    });

                    alert('Audible account disconnected');
                    window.location.reload();
                } catch (error) {
                    console.error('Error disconnecting Audible:', error);
                    alert('Failed to disconnect: ' + error.message);
                }
            }
        });
    }
};

