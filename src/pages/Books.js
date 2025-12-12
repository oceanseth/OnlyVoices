import { db } from '../utils/firebase.js';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

export const renderBooks = async (container, user, userData) => {
    if (!userData?.audibleConnected) {
        container.innerHTML = `
            <div class="books-page">
                <div class="empty-state">
                    <h2>📚 Your Books</h2>
                    <p>Connect your Audible account in Settings to see your audiobook library.</p>
                    <button onclick="window.navigateToPage('settings')" class="btn-primary">Go to Settings</button>
                </div>
            </div>
        `;
        return;
    }

    // Load books from Firestore
    let books = [];
    try {
        const booksSnapshot = await getDocs(collection(db, 'users', user.uid, 'books'));
        books = booksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error loading books:', error);
    }

    // Load user's voices
    let voices = [];
    try {
        const voicesSnapshot = await getDocs(collection(db, 'users', user.uid, 'voices'));
        voices = voicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error loading voices:', error);
    }

    container.innerHTML = `
        <div class="books-page">
            <h2>Your Audiobooks</h2>
            
            <div class="books-grid">
                ${books.length === 0 
                    ? `<div class="empty-state">
                        <p>No books found. Your Audible library will appear here once synced.</p>
                        <button id="syncBooks" class="btn-primary">Sync Audible Library</button>
                       </div>`
                    : books.map(book => `
                        <div class="book-card" data-book-id="${book.id}">
                            <div class="book-cover">📖</div>
                            <h3>${book.title || 'Untitled'}</h3>
                            <p class="book-author">${book.author || 'Unknown Author'}</p>
                            <div class="book-actions">
                                <button class="btn-primary render-btn" data-book-id="${book.id}">
                                    Render with Voice
                                </button>
                            </div>
                        </div>
                    `).join('')
                }
            </div>
        </div>

        <!-- Render Modal -->
        <div id="renderModal" class="modal hidden">
            <div class="modal-content">
                <h3>Render Audiobook</h3>
                <div class="form-group">
                    <label>Select Voice:</label>
                    <select id="voiceSelect">
                        <option value="">Choose a voice...</option>
                        ${voices.map(voice => `
                            <option value="${voice.elevenlabsVoiceId || voice.id}">
                                ${voice.name || 'Untitled Voice'}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Language:</label>
                    <select id="languageSelect">
                        <option value="en">English</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                        <option value="it">Italian</option>
                        <option value="pt">Portuguese</option>
                    </select>
                </div>
                <div class="modal-actions">
                    <button id="cancelRender" class="btn-secondary">Cancel</button>
                    <button id="startRender" class="btn-primary">Start Rendering</button>
                </div>
            </div>
        </div>
    `;

    // Add styles
    if (!document.getElementById('books-styles')) {
        const style = document.createElement('style');
        style.id = 'books-styles';
        style.textContent = `
            .books-page {
                background: white;
                border-radius: 12px;
                padding: 2rem;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .books-page h2 {
                margin-bottom: 2rem;
                color: #333;
            }
            .books-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                gap: 1.5rem;
            }
            .book-card {
                background: #f9f9f9;
                border-radius: 12px;
                padding: 1.5rem;
                text-align: center;
                transition: transform 0.3s, box-shadow 0.3s;
            }
            .book-card:hover {
                transform: translateY(-4px);
                box-shadow: 0 8px 16px rgba(0,0,0,0.1);
            }
            .book-cover {
                font-size: 4rem;
                margin-bottom: 1rem;
            }
            .book-card h3 {
                margin-bottom: 0.5rem;
                color: #333;
            }
            .book-author {
                color: #666;
                margin-bottom: 1rem;
                font-size: 0.9rem;
            }
            .book-actions {
                margin-top: 1rem;
            }
            .render-btn {
                width: 100%;
                padding: 0.75rem;
                background: #667eea;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
            }
            .render-btn:hover {
                background: #5568d3;
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
                max-width: 500px;
                width: 90%;
            }
            .modal-content h3 {
                margin-bottom: 1.5rem;
                color: #333;
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
            .form-group select {
                width: 100%;
                padding: 0.75rem;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                font-size: 1rem;
            }
            .form-group select:focus {
                outline: none;
                border-color: #667eea;
            }
            .modal-actions {
                display: flex;
                gap: 1rem;
                justify-content: flex-end;
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

    // Event handlers
    let selectedBookId = null;

    container.querySelectorAll('.render-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedBookId = btn.dataset.bookId;
            document.getElementById('renderModal').classList.remove('hidden');
        });
    });

    const cancelRender = document.getElementById('cancelRender');
    if (cancelRender) {
        cancelRender.addEventListener('click', () => {
            document.getElementById('renderModal').classList.add('hidden');
        });
    }

    const startRender = document.getElementById('startRender');
    if (startRender) {
        startRender.addEventListener('click', async () => {
            const voiceId = document.getElementById('voiceSelect').value;
            const language = document.getElementById('languageSelect').value;

            if (!voiceId) {
                alert('Please select a voice');
                return;
            }

            try {
                const response = await fetch('/api/books/render', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${await user.getIdToken()}`
                    },
                    body: JSON.stringify({
                        bookId: selectedBookId,
                        voiceId,
                        language
                    })
                });

                if (response.ok) {
                    alert('Rendering started! You will be notified when it completes.');
                    document.getElementById('renderModal').classList.add('hidden');
                } else {
                    throw new Error('Failed to start rendering');
                }
            } catch (error) {
                console.error('Error starting render:', error);
                alert('Failed to start rendering: ' + error.message);
            }
        });
    }

    const syncBooks = document.getElementById('syncBooks');
    if (syncBooks) {
        syncBooks.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/audible/sync', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${await user.getIdToken()}`
                    }
                });

                if (response.ok) {
                    alert('Syncing your Audible library... This may take a few minutes.');
                    window.location.reload();
                } else {
                    throw new Error('Failed to sync library');
                }
            } catch (error) {
                console.error('Error syncing books:', error);
                alert('Failed to sync library: ' + error.message);
            }
        });
    }
};

