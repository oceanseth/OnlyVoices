import { db } from '../utils/firebase.js';
import { collection, getDocs, addDoc, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';

// Celebrity voices list (you can expand this)
const CELEBRITY_VOICES = [
    { id: 'celebrity-1', name: 'Morgan Freeman', description: 'Deep, authoritative voice' },
    { id: 'celebrity-2', name: 'David Attenborough', description: 'Warm, documentary-style narration' },
    { id: 'celebrity-3', name: 'Scarlett Johansson', description: 'Smooth, engaging voice' },
    { id: 'celebrity-4', name: 'James Earl Jones', description: 'Powerful, commanding voice' },
    { id: 'celebrity-5', name: 'Emma Watson', description: 'Clear, articulate voice' },
    { id: 'celebrity-6', name: 'Benedict Cumberbatch', description: 'Distinctive, expressive voice' },
];

export const renderVoices = async (container, user, userData) => {
    // Load user's favorite voices
    let favoriteVoices = [];
    try {
        const favoritesDoc = await getDoc(doc(db, 'users', user.uid, 'data', 'favorites'));
        if (favoritesDoc.exists()) {
            favoriteVoices = favoritesDoc.data().voices || [];
        }
    } catch (error) {
        console.error('Error loading favorites:', error);
    }

    // Load user's custom voices
    let customVoices = [];
    try {
        const voicesSnapshot = await getDocs(collection(db, 'users', user.uid, 'voices'));
        customVoices = voicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error loading custom voices:', error);
    }

    container.innerHTML = `
        <div class="voices-page">
            <div class="voices-header">
                <h2>Voices</h2>
                <button id="trainVoiceBtn" class="btn-primary">+ Train New Voice</button>
            </div>

            <div class="voices-tabs">
                <button class="tab-btn active" data-tab="celebrity">Celebrity Voices</button>
                <button class="tab-btn" data-tab="custom">My Voices</button>
                <button class="tab-btn" data-tab="favorites">Favorites</button>
            </div>

            <div class="tab-content active" id="celebrity-tab">
                <div class="voices-grid">
                    ${CELEBRITY_VOICES.map(voice => `
                        <div class="voice-card" data-voice-id="${voice.id}">
                            <div class="voice-avatar">🎭</div>
                            <h3>${voice.name}</h3>
                            <p>${voice.description}</p>
                            <button class="favorite-btn ${favoriteVoices.includes(voice.id) ? 'favorited' : ''}" 
                                    data-voice-id="${voice.id}">
                                ${favoriteVoices.includes(voice.id) ? '★ Favorited' : '☆ Favorite'}
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="tab-content" id="custom-tab">
                ${customVoices.length === 0 
                    ? `<div class="empty-state">
                        <p>You haven't created any custom voices yet.</p>
                        <p>Click "Train New Voice" to get started!</p>
                       </div>`
                    : `<div class="voices-grid">
                        ${customVoices.map(voice => `
                            <div class="voice-card" data-voice-id="${voice.id}">
                                <div class="voice-card-actions">
                                    <button class="edit-voice-btn" data-voice-id="${voice.id}" title="Edit/Retrain">
                                        ✏️
                                    </button>
                                    <button class="delete-voice-btn" data-voice-id="${voice.id}" title="Delete">
                                        🗑️
                                    </button>
                                </div>
                                <div class="voice-avatar">🎤</div>
                                <h3>${voice.name || 'Untitled Voice'}</h3>
                                <p class="voice-status ${voice.status || 'pending'}">
                                    ${voice.status === 'ready' ? '✓ Ready' : 
                                      voice.status === 'training' ? '⏳ Training...' : 
                                      voice.status === 'failed' ? '✗ Failed' : '⏳ Pending'}
                                </p>
                                ${voice.elevenlabsVoiceId ? 
                                    `<p class="voice-id">ID: ${voice.elevenlabsVoiceId}</p>` : ''}
                                <button class="favorite-btn ${favoriteVoices.includes(voice.id) ? 'favorited' : ''}" 
                                        data-voice-id="${voice.id}">
                                    ${favoriteVoices.includes(voice.id) ? '★ Favorited' : '☆ Favorite'}
                                </button>
                            </div>
                        `).join('')}
                       </div>`
                }
            </div>

            <div class="tab-content" id="favorites-tab">
                ${favoriteVoices.length === 0 
                    ? `<div class="empty-state">
                        <p>No favorite voices yet. Click the star on any voice to favorite it!</p>
                       </div>`
                    : `<div class="voices-grid">
                        ${[...CELEBRITY_VOICES.filter(v => favoriteVoices.includes(v.id)),
                            ...customVoices.filter(v => favoriteVoices.includes(v.id))].map(voice => `
                            <div class="voice-card" data-voice-id="${voice.id}">
                                <div class="voice-avatar">${voice.id.startsWith('celebrity') ? '🎭' : '🎤'}</div>
                                <h3>${voice.name || 'Untitled Voice'}</h3>
                                <p>${voice.description || ''}</p>
                                <button class="favorite-btn favorited" data-voice-id="${voice.id}">
                                    ★ Favorited
                                </button>
                            </div>
                        `).join('')}
                       </div>`
                }
            </div>
        </div>

        <!-- Train Voice Modal -->
        <div id="trainVoiceModal" class="modal hidden">
            <div class="modal-content">
                <h3>Train New Voice</h3>
                <div class="train-tabs">
                    <button class="train-tab-btn active" data-train-tab="record">Record Voice</button>
                    <button class="train-tab-btn" data-train-tab="upload">Upload Audio</button>
                    <button class="train-tab-btn" data-train-tab="youtube">YouTube URL</button>
                </div>

                <div class="train-tab-content active" id="record-tab">
                    <div class="form-group">
                        <label>Voice Name:</label>
                        <input type="text" id="voiceNameRecord" placeholder="My Custom Voice">
                    </div>
                    <div class="form-group">
                        <label>Sample Script to Read:</label>
                        <textarea id="sampleScript" rows="6" readonly>The quick brown fox jumps over the lazy dog. This is a sample script designed to capture the full range of your voice. Please read this clearly and at a natural pace. Try to enunciate each word carefully while maintaining your natural speaking rhythm. This will help create a more accurate voice model.</textarea>
                        <p class="help-text">Read this script clearly into your microphone</p>
                    </div>
                    <div class="form-group">
                        <div class="recording-controls">
                            <button id="startRecording" class="btn-primary">🎤 Start Recording</button>
                            <button id="stopRecording" class="btn-secondary" disabled>⏹ Stop Recording</button>
                            <button id="playRecording" class="btn-secondary" disabled>▶ Play</button>
                        </div>
                        <div id="recordingStatus" class="recording-status"></div>
                        <audio id="recordedAudio" controls style="display: none; width: 100%; margin-top: 1rem;"></audio>
                    </div>
                </div>

                <div class="train-tab-content" id="upload-tab">
                    <div class="form-group">
                        <label>Voice Name:</label>
                        <input type="text" id="voiceName" placeholder="My Custom Voice">
                    </div>
                    <div class="form-group">
                        <label>Upload Audio Files:</label>
                        <input type="file" id="audioFiles" multiple accept="audio/*">
                        <p class="help-text">Upload multiple audio files (MP3, WAV, etc.) for best results</p>
                    </div>
                </div>

                <div class="train-tab-content" id="youtube-tab">
                    <div class="form-group">
                        <label>Voice Name:</label>
                        <input type="text" id="voiceNameYoutube" placeholder="My Custom Voice">
                    </div>
                    <div class="form-group">
                        <label>YouTube URL:</label>
                        <input type="url" id="youtubeUrl" placeholder="https://www.youtube.com/watch?v=...">
                        <p class="help-text">We'll extract audio from the video and use it to train your voice</p>
                    </div>
                </div>

                <div class="modal-actions">
                    <button id="cancelTrain" class="btn-secondary">Cancel</button>
                    <button id="startTrain" class="btn-primary">Start Training</button>
                </div>
            </div>
        </div>
    `;

    // Add styles
    if (!document.getElementById('voices-styles')) {
        const style = document.createElement('style');
        style.id = 'voices-styles';
        style.textContent = `
            .voices-page {
                background: white;
                border-radius: 12px;
                padding: 2rem;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .voices-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 2rem;
            }
            .voices-header h2 {
                margin: 0;
                color: #333;
            }
            .voices-tabs {
                display: flex;
                gap: 0;
                border-bottom: 2px solid #e0e0e0;
                margin-bottom: 2rem;
            }
            .tab-btn {
                padding: 1rem 2rem;
                background: none;
                border: none;
                border-bottom: 3px solid transparent;
                cursor: pointer;
                font-size: 1rem;
                color: #666;
                transition: all 0.3s;
            }
            .tab-btn:hover {
                color: #667eea;
            }
            .tab-btn.active {
                color: #667eea;
                border-bottom-color: #667eea;
                font-weight: 600;
            }
            .tab-content {
                display: none;
            }
            .tab-content.active {
                display: block;
            }
            .voices-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                gap: 1.5rem;
            }
            .voice-card {
                background: #f9f9f9;
                border-radius: 12px;
                padding: 1.5rem;
                text-align: center;
                transition: transform 0.3s, box-shadow 0.3s;
                position: relative;
            }
            .voice-card:hover {
                transform: translateY(-4px);
                box-shadow: 0 8px 16px rgba(0,0,0,0.1);
            }
            .voice-card-actions {
                position: absolute;
                top: 0.75rem;
                right: 0.75rem;
                display: flex;
                gap: 0.5rem;
                opacity: 0;
                transition: opacity 0.3s;
                z-index: 10;
            }
            .voice-card:hover .voice-card-actions,
            .voice-card:active .voice-card-actions,
            .voice-card-actions:focus-within,
            .voice-card-actions:hover {
                opacity: 1;
            }
            @media (max-width: 768px) {
                .voice-card-actions {
                    opacity: 1; /* Always visible on mobile */
                }
            }
            .edit-voice-btn,
            .delete-voice-btn {
                background: rgba(255, 255, 255, 0.9);
                border: 1px solid #e0e0e0;
                border-radius: 6px;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 1rem;
                transition: all 0.2s;
                padding: 0;
            }
            .edit-voice-btn:hover {
                background: #e3f2fd;
                border-color: #2196f3;
                transform: scale(1.1);
            }
            .delete-voice-btn:hover {
                background: #ffebee;
                border-color: #f44336;
                transform: scale(1.1);
            }
            .delete-voice-btn:active,
            .edit-voice-btn:active {
                transform: scale(0.95);
            }
            .voice-avatar {
                font-size: 4rem;
                margin-bottom: 1rem;
            }
            .voice-card h3 {
                margin-bottom: 0.5rem;
                color: #333;
            }
            .voice-card p {
                color: #666;
                margin-bottom: 1rem;
                font-size: 0.9rem;
            }
            .voice-status {
                font-weight: 600;
            }
            .voice-status.ready {
                color: #28a745;
            }
            .voice-status.training, .voice-status.pending {
                color: #ffc107;
            }
            .voice-status.failed {
                color: #dc3545;
            }
            .voice-id {
                font-family: monospace;
                font-size: 0.8rem;
                color: #999;
            }
            .favorite-btn {
                width: 100%;
                padding: 0.75rem;
                background: #f5f5f5;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                transition: all 0.3s;
            }
            .favorite-btn:hover {
                background: #fff3cd;
                border-color: #ffc107;
            }
            .favorite-btn.favorited {
                background: #fff3cd;
                border-color: #ffc107;
                color: #856404;
            }
            .empty-state {
                text-align: center;
                padding: 3rem;
                color: #666;
            }
            .modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            }
            .modal.hidden {
                display: none;
            }
            .modal-content {
                background: white;
                border-radius: 12px;
                padding: 2rem;
                max-width: 600px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
            }
            .modal-content h3 {
                margin-bottom: 1.5rem;
                color: #333;
            }
            .train-tabs {
                display: flex;
                gap: 0;
                border-bottom: 2px solid #e0e0e0;
                margin-bottom: 1.5rem;
            }
            .train-tab-btn {
                padding: 0.75rem 1.5rem;
                background: none;
                border: none;
                border-bottom: 3px solid transparent;
                cursor: pointer;
                font-size: 1rem;
                color: #666;
            }
            .train-tab-btn.active {
                color: #667eea;
                border-bottom-color: #667eea;
                font-weight: 600;
            }
            .train-tab-content {
                display: none;
            }
            .train-tab-content.active {
                display: block;
            }
            .form-group {
                margin-bottom: 1.5rem;
            }
            .form-group label {
                display: block;
                margin-bottom: 0.5rem;
                font-weight: 600;
                color: #666;
            }
            .form-group input {
                width: 100%;
                padding: 0.75rem;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                font-size: 1rem;
            }
            .form-group input:focus {
                outline: none;
                border-color: #667eea;
            }
            .help-text {
                margin-top: 0.5rem;
                font-size: 0.85rem;
                color: #999;
            }
            .recording-controls {
                display: flex;
                gap: 1rem;
                margin-top: 1rem;
            }
            .recording-controls button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .recording-status {
                margin-top: 1rem;
                padding: 0.75rem;
                border-radius: 8px;
                font-weight: 600;
                text-align: center;
            }
            .recording-status.recording {
                background: #fee;
                color: #c33;
            }
            .recording-status.recorded {
                background: #efe;
                color: #3c3;
            }
            textarea {
                width: 100%;
                padding: 0.75rem;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                font-size: 1rem;
                font-family: inherit;
                resize: vertical;
            }
            textarea:focus {
                outline: none;
                border-color: #667eea;
            }
            .modal-actions {
                display: flex;
                gap: 1rem;
                justify-content: flex-end;
                margin-top: 2rem;
            }
            .btn-primary, .btn-secondary {
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: 8px;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
            }
            .btn-primary {
                background: #667eea;
                color: white;
            }
            .btn-secondary {
                background: #f5f5f5;
                color: #666;
            }
        `;
        document.head.appendChild(style);
    }

    // Tab switching
    container.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            container.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab + '-tab').classList.add('active');
        });
    });

    // Train voice modal
    const trainVoiceBtn = container.querySelector('#trainVoiceBtn');
    if (trainVoiceBtn) {
        trainVoiceBtn.addEventListener('click', () => {
            document.getElementById('trainVoiceModal').classList.remove('hidden');
        });
    }

    // Train tab switching
    container.querySelectorAll('.train-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.train-tab-btn').forEach(b => b.classList.remove('active'));
            container.querySelectorAll('.train-tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.trainTab + '-tab').classList.add('active');
        });
    });

    // Cancel train
    const cancelTrain = document.getElementById('cancelTrain');
    if (cancelTrain) {
        cancelTrain.addEventListener('click', () => {
            document.getElementById('trainVoiceModal').classList.add('hidden');
            
            // Reset form and button if editing
            const startBtn = document.getElementById('startTrain');
            if (startBtn && startBtn.dataset.originalText) {
                startBtn.textContent = startBtn.dataset.originalText;
                delete startBtn.dataset.voiceId;
                delete startBtn.dataset.originalText;
            }
            
            // Clear form fields
            const nameInputs = ['voiceName', 'voiceNameRecord', 'voiceNameYoutube'];
            nameInputs.forEach(id => {
                const input = document.getElementById(id);
                if (input) input.value = '';
            });
            const audioFiles = document.getElementById('audioFiles');
            if (audioFiles) audioFiles.value = '';
            const youtubeUrl = document.getElementById('youtubeUrl');
            if (youtubeUrl) youtubeUrl.value = '';
        });
    }

    // Voice recording functionality
    let mediaRecorder = null;
    let audioChunks = [];
    let recordedBlob = null;

    const startRecordingBtn = document.getElementById('startRecording');
    const stopRecordingBtn = document.getElementById('stopRecording');
    const playRecordingBtn = document.getElementById('playRecording');
    const recordingStatus = document.getElementById('recordingStatus');
    const recordedAudio = document.getElementById('recordedAudio');

    if (startRecordingBtn) {
        startRecordingBtn.addEventListener('click', async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];

                mediaRecorder.ondataavailable = (event) => {
                    audioChunks.push(event.data);
                };

                mediaRecorder.onstop = () => {
                    recordedBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    const audioUrl = URL.createObjectURL(recordedBlob);
                    recordedAudio.src = audioUrl;
                    recordedAudio.style.display = 'block';
                    playRecordingBtn.disabled = false;
                    recordingStatus.textContent = '✓ Recording complete!';
                    recordingStatus.className = 'recording-status recorded';
                    
                    // Stop all tracks
                    stream.getTracks().forEach(track => track.stop());
                };

                mediaRecorder.start();
                startRecordingBtn.disabled = true;
                stopRecordingBtn.disabled = false;
                playRecordingBtn.disabled = true;
                recordingStatus.textContent = '🔴 Recording...';
                recordingStatus.className = 'recording-status recording';
            } catch (error) {
                console.error('Error accessing microphone:', error);
                alert('Failed to access microphone. Please grant microphone permissions.');
            }
        });
    }

    if (stopRecordingBtn) {
        stopRecordingBtn.addEventListener('click', () => {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                startRecordingBtn.disabled = false;
                stopRecordingBtn.disabled = true;
            }
        });
    }

    if (playRecordingBtn) {
        playRecordingBtn.addEventListener('click', () => {
            if (recordedAudio.src) {
                recordedAudio.play();
            }
        });
    }

    // Start training
    const startTrain = document.getElementById('startTrain');
    if (startTrain) {
        startTrain.addEventListener('click', async () => {
            const activeTab = container.querySelector('.train-tab-content.active').id;
            const isRetraining = startTrain.dataset.voiceId;
            let voiceName, formData;

            if (activeTab === 'record-tab') {
                voiceName = document.getElementById('voiceNameRecord').value;
                
                if (!voiceName) {
                    alert('Please enter a voice name');
                    return;
                }
                if (!recordedBlob) {
                    alert('Please record audio first');
                    return;
                }

                formData = new FormData();
                formData.append('name', voiceName);
                formData.append('method', 'record');
                formData.append('audio', recordedBlob, 'recording.webm');
            } else if (activeTab === 'upload-tab') {
                voiceName = document.getElementById('voiceName').value;
                const files = document.getElementById('audioFiles').files;
                
                if (!voiceName) {
                    alert('Please enter a voice name');
                    return;
                }
                if (files.length === 0) {
                    alert('Please select at least one audio file');
                    return;
                }

                formData = new FormData();
                formData.append('name', voiceName);
                formData.append('method', 'upload');
                for (let i = 0; i < files.length; i++) {
                    formData.append('audio', files[i]);
                }
            } else {
                voiceName = document.getElementById('voiceNameYoutube').value;
                const youtubeUrl = document.getElementById('youtubeUrl').value;

                if (!voiceName) {
                    alert('Please enter a voice name');
                    return;
                }
                if (!youtubeUrl) {
                    alert('Please enter a YouTube URL');
                    return;
                }

                formData = new FormData();
                formData.append('name', voiceName);
                formData.append('method', 'youtube');
                formData.append('youtubeUrl', youtubeUrl);
            }

            try {
                let voiceRef;
                
                if (isRetraining) {
                    // Update existing voice document
                    voiceRef = doc(db, 'users', user.uid, 'voices', isRetraining);
                    await updateDoc(voiceRef, {
                        name: voiceName,
                        status: 'pending',
                        updatedAt: new Date(),
                        method: activeTab === 'record-tab' ? 'record' : activeTab === 'upload-tab' ? 'upload' : 'youtube'
                    });
                } else {
                    // Create new voice document in Firestore
                    voiceRef = await addDoc(collection(db, 'users', user.uid, 'voices'), {
                        name: voiceName,
                        status: 'pending',
                        createdAt: new Date(),
                        method: activeTab === 'record-tab' ? 'record' : activeTab === 'upload-tab' ? 'upload' : 'youtube'
                    });
                }

                // Call API to train voice
                const response = await fetch('/api/voices/train', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${await user.getIdToken()}`
                    },
                    body: formData
                });

                if (response.ok) {
                    const result = await response.json();
                    
                    // Update voice document with ElevenLabs voice ID
                    await updateDoc(voiceRef, {
                        status: 'training',
                        elevenlabsVoiceId: result.voiceId,
                        updatedAt: new Date()
                    });

                    alert(isRetraining ? 'Voice retraining started! You will be notified when it completes.' : 'Voice training started! You will be notified when it completes.');
                    document.getElementById('trainVoiceModal').classList.add('hidden');
                    
                    // Reset form and button
                    if (startTrain.dataset.originalText) {
                        startTrain.textContent = startTrain.dataset.originalText;
                        delete startTrain.dataset.voiceId;
                        delete startTrain.dataset.originalText;
                    }
                    
                    window.location.reload();
                } else {
                    throw new Error('Failed to start training');
                }
            } catch (error) {
                console.error('Error training voice:', error);
                alert('Failed to start training: ' + error.message);
            }
        });
    }

    // Delete voice buttons
    container.querySelectorAll('.delete-voice-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const voiceId = btn.dataset.voiceId;
            const voiceCard = btn.closest('.voice-card');
            const voiceName = voiceCard.querySelector('h3')?.textContent || 'this voice';

            if (!confirm(`Are you sure you want to delete "${voiceName}"? This action cannot be undone.`)) {
                return;
            }

            try {
                // Delete from Firestore
                const voiceRef = doc(db, 'users', user.uid, 'voices', voiceId);
                await voiceRef.delete();

                // TODO: Also delete from ElevenLabs if needed
                // const voiceDoc = await getDoc(voiceRef);
                // if (voiceDoc.exists() && voiceDoc.data().elevenlabsVoiceId) {
                //     // Call API to delete from ElevenLabs
                // }

                // Remove from UI
                voiceCard.style.transition = 'opacity 0.3s, transform 0.3s';
                voiceCard.style.opacity = '0';
                voiceCard.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    voiceCard.remove();
                    // Reload if no voices left
                    if (container.querySelectorAll('.voice-card').length === 0) {
                        window.location.reload();
                    }
                }, 300);
            } catch (error) {
                console.error('Error deleting voice:', error);
                alert('Failed to delete voice: ' + error.message);
            }
        });
    });

    // Edit/Retrain voice buttons
    container.querySelectorAll('.edit-voice-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const voiceId = btn.dataset.voiceId;
            
            try {
                // Get voice data
                const voiceRef = doc(db, 'users', user.uid, 'voices', voiceId);
                const voiceDoc = await getDoc(voiceRef);
                
                if (!voiceDoc.exists()) {
                    alert('Voice not found');
                    return;
                }

                const voiceData = voiceDoc.data();
                
                // Open the train voice modal with existing data
                const modal = document.getElementById('trainVoiceModal');
                if (modal) {
                    modal.classList.remove('hidden');
                    
                    // Pre-fill the form
                    const voiceNameInput = document.getElementById('voiceName') || document.getElementById('voiceNameRecord');
                    if (voiceNameInput) {
                        voiceNameInput.value = voiceData.name || '';
                    }
                    
                    // Show upload tab by default
                    const uploadTab = container.querySelector('[data-train-tab="upload"]');
                    if (uploadTab) {
                        container.querySelectorAll('.train-tab-btn').forEach(b => b.classList.remove('active'));
                        container.querySelectorAll('.train-tab-content').forEach(c => c.classList.remove('active'));
                        uploadTab.classList.add('active');
                        document.getElementById('upload-tab').classList.add('active');
                    }
                    
                    // Update the start button to indicate retraining
                    const startBtn = document.getElementById('startTrain');
                    if (startBtn) {
                        const originalText = startBtn.textContent;
                        startBtn.textContent = 'Retrain Voice';
                        startBtn.dataset.originalText = originalText;
                        startBtn.dataset.voiceId = voiceId;
                    }
                }
            } catch (error) {
                console.error('Error loading voice for editing:', error);
                alert('Failed to load voice: ' + error.message);
            }
        });
    });

    // Favorite buttons
    container.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const voiceId = btn.dataset.voiceId;
            const isFavorited = btn.classList.contains('favorited');

            try {
                const favoritesRef = doc(db, 'users', user.uid, 'data', 'favorites');
                const favoritesDoc = await getDoc(favoritesRef);
                
                let voices = [];
                if (favoritesDoc.exists()) {
                    voices = favoritesDoc.data().voices || [];
                }

                if (isFavorited) {
                    voices = voices.filter(id => id !== voiceId);
                    btn.classList.remove('favorited');
                    btn.textContent = '☆ Favorite';
                } else {
                    voices.push(voiceId);
                    btn.classList.add('favorited');
                    btn.textContent = '★ Favorited';
                }

                await setDoc(favoritesRef, { voices }, { merge: true });
            } catch (error) {
                console.error('Error updating favorites:', error);
                alert('Failed to update favorites: ' + error.message);
            }
        });
    });
};

