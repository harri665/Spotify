// Modern Spotify Dashboard JavaScript
class SpotifyDashboard {
    constructor() {
        this.activities = [];
        this.analytics = {};
        this.diaryEntries = [];
        this.currentTab = 'recent';
        this.filteredActivities = [];
        this.sessionId = localStorage.getItem('sessionId');
        this.isAuthenticated = false;
        
        this.init();
    }

    async init() {
        // Check authentication first
        if (this.sessionId) {
            const isValid = await this.verifySession();
            if (isValid) {
                this.showDashboard();
                this.setupEventListeners();
                await this.loadData();
                this.startAutoRefresh();
            } else {
                this.showLogin();
            }
        } else {
            this.showLogin();
        }
        
        this.setupLoginHandlers();
    }

    showLogin() {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('main-dashboard').style.display = 'none';
        this.isAuthenticated = false;
    }

    showDashboard() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-dashboard').style.display = 'flex';
        this.isAuthenticated = true;
    }

    setupLoginHandlers() {
        const loginForm = document.getElementById('login-form');
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleLogin();
        });
    }

    async handleLogin() {
        const passwordInput = document.getElementById('password-input');
        const loginBtn = document.querySelector('.login-btn');
        const errorDiv = document.getElementById('login-error');
        
        const password = passwordInput.value;
        
        if (!password) {
            this.showLoginError('Please enter a password');
            return;
        }
        
        // Show loading state
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
        errorDiv.style.display = 'none';
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.sessionId = data.sessionId;
                localStorage.setItem('sessionId', this.sessionId);
                this.showDashboard();
                this.setupEventListeners();
                await this.loadData();
                this.startAutoRefresh();
            } else {
                this.showLoginError(data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showLoginError('Connection error. Please try again.');
        } finally {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        }
    }

    showLoginError(message) {
        const errorDiv = document.getElementById('login-error');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }

    async verifySession() {
        try {
            const response = await fetch('/api/auth/verify', {
                headers: {
                    'X-Session-ID': this.sessionId
                }
            });
            return response.ok;
        } catch (error) {
            console.error('Session verification error:', error);
            return false;
        }
    }

    async logout() {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'X-Session-ID': this.sessionId
                }
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            localStorage.removeItem('sessionId');
            this.sessionId = null;
            this.showLogin();
        }
    }

    // Add session ID to all API requests
    async authenticatedFetch(url, options = {}) {
        if (!this.sessionId) {
            throw new Error('No session ID');
        }
        
        const headers = {
            'X-Session-ID': this.sessionId,
            ...options.headers
        };
        
        const response = await fetch(url, {
            ...options,
            headers
        });
        
        if (response.status === 401) {
            this.logout();
            throw new Error('Authentication failed');
        }
        
        return response;
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Modal functionality
        const modal = document.getElementById('song-modal');
        const closeBtn = document.querySelector('.close');
        
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        // Diary form
        const diaryForm = document.getElementById('diary-form');
        diaryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveDiaryEntry();
        });

        // Diary modal
        const diaryModal = document.getElementById('diary-modal');
        window.addEventListener('click', (e) => {
            if (e.target === diaryModal) {
                this.closeDiaryModal();
            }
        });
    }

    switchTab(tabName) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        this.currentTab = tabName;

        // Load specific tab content
        switch(tabName) {
            case 'recent':
                this.renderRecentSongs();
                break;
            case 'sessions':
                this.renderSessions();
                break;
            case 'diary':
                this.renderDiary();
                break;
            case 'analytics':
                this.renderAnalytics();
                break;
            case 'moods':
                this.renderMoodAnalysis();
                break;
            case 'patterns':
                this.renderListeningPatterns();
                break;
            case 'json-editor':
                if (!this.jsonEditor) {
                    this.initJsonEditor();
                }
                break;
        }
    }

    async loadData() {
        try {
            // Load activities and analytics in parallel
            const [activitiesResponse, analyticsResponse] = await Promise.all([
                this.authenticatedFetch('/api/spotify-activity'),
                this.authenticatedFetch('/api/analytics')
            ]);

            this.activities = await activitiesResponse.json();
            this.analytics = await analyticsResponse.json();
            this.filteredActivities = [...this.activities];

            // Load diary entries if on diary tab
            if (this.currentTab === 'diary') {
                await this.loadDiaryEntries();
            }

            this.updateQuickStats();
            this.renderCurrentTab();
        } catch (error) {
            console.error('Error loading data:', error);
            if (error.message !== 'Authentication failed') {
                this.showError('Failed to load data');
            }
        }
    }

    updateQuickStats() {
        document.getElementById('total-songs').textContent = this.analytics.totalSongs || 0;
        document.getElementById('unique-artists').textContent = this.analytics.uniqueArtists || 0;
        
        const currentMood = this.activities.length > 0 ? 
            this.activities[0].moodType || 'neutral' : 'neutral';
        document.getElementById('current-mood').textContent = 
            this.formatMoodName(currentMood);
    }

    formatMoodName(mood) {
        return mood.charAt(0).toUpperCase() + mood.slice(1);
    }

    renderCurrentTab() {
        switch(this.currentTab) {
            case 'recent':
                this.renderRecentSongs();
                break;
            case 'sessions':
                this.renderSessions();
                break;
            case 'diary':
                this.renderDiary();
                break;
            case 'analytics':
                this.renderAnalytics();
                break;
            case 'moods':
                this.renderMoodAnalysis();
                break;
            case 'patterns':
                this.renderListeningPatterns();
                break;
        }
    }

    renderRecentSongs() {
        const container = document.getElementById('song-list');
        
        if (this.filteredActivities.length === 0) {
            container.innerHTML = `
                <div class="loading">
                    <i class="fas fa-music"></i>
                    <p>No songs found matching your filter</p>
                </div>
            `;
            return;
        }

        const songsHTML = this.filteredActivities.map(activity => {
            const timestamp = new Date(activity.loggedAt);
            const timeString = this.formatRelativeTime(timestamp);
            
            return `
                <div class="song-item" onclick="dashboard.showSongDetails('${activity.id}')">
                    <img src="${activity.imageUrl || this.getPlaceholderImage()}" 
                         alt="Album cover" 
                         class="song-cover"
                         onerror="this.src='${this.getPlaceholderImage()}'">
                    <div class="song-info">
                        <div class="song-title">${this.escapeHtml(activity.song)}</div>
                        <div class="song-artist">${this.escapeHtml(activity.artist)}</div>
                        <div class="song-album">${this.escapeHtml(activity.album)}</div>
                    </div>
                    <div class="song-metadata">
                        <span class="mood-tag mood-${activity.moodType || 'neutral'}">
                            ${this.getMoodIcon(activity.moodType)} ${this.formatMoodName(activity.moodType || 'neutral')}
                        </span>
                        <span class="song-timestamp">${timeString}</span>
                        <a href="${activity.spotifyUrl}" target="_blank" class="spotify-link" onclick="event.stopPropagation()">
                            <i class="fab fa-spotify"></i> Open
                        </a>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = songsHTML;
    }

    renderSessions() {
        const container = document.getElementById('sessions-container');
        const sessions = this.analytics.sessions || [];
        
        // Update session count
        document.getElementById('session-count').textContent = 
            `${sessions.length} Session${sessions.length !== 1 ? 's' : ''}`;
        
        if (sessions.length === 0) {
            container.innerHTML = `
                <div class="loading">
                    <i class="fas fa-music"></i>
                    <p>No listening sessions found</p>
                </div>
            `;
            return;
        }

        const sessionsHTML = sessions.map(session => {
            const startTime = new Date(session.startTime);
            const endTime = new Date(session.endTime);
            const duration = this.formatDuration(session.duration || 0);
            const timeRange = `${startTime.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}`;
            const dateStr = startTime.toLocaleDateString();
            
            const songsHTML = session.songs.map(song => `
                <div class="session-song">
                    <img src="${song.imageUrl || this.getPlaceholderImage()}" 
                         alt="Album cover" 
                         class="session-song-cover"
                         onerror="this.src='${this.getPlaceholderImage()}'">
                    <div class="session-song-info">
                        <div class="session-song-title">${this.escapeHtml(song.song)}</div>
                        <div class="session-song-artist">${this.escapeHtml(song.artist)}</div>
                    </div>
                    <div class="session-song-mood mood-${song.mood || 'neutral'}"></div>
                </div>
            `).join('');
            
            return `
                <div class="session-card" onclick="dashboard.toggleSession('${session.id}')">
                    <div class="session-header">
                        <div class="session-info">
                            <h3>
                                ${this.getSessionIcon(session.sessionMood)}
                                ${this.formatSessionTitle(session.sessionMood)} Session
                            </h3>
                            <div class="session-meta">
                                <span><i class="fas fa-calendar"></i> ${dateStr}</span>
                                <span><i class="fas fa-clock"></i> ${timeRange}</span>
                                <span class="session-duration">
                                    <i class="fas fa-hourglass-half"></i> ${duration}
                                </span>
                                <span><i class="fas fa-music"></i> ${session.songs.length} songs</span>
                            </div>
                        </div>
                        <div class="session-mood-indicator session-mood-${session.sessionMood}">
                            ${this.getSessionMoodIcon(session.sessionMood)}
                            ${this.formatSessionMood(session.sessionMood)}
                        </div>
                    </div>
                    <div class="session-songs session-expandable" id="session-${session.id}">
                        ${songsHTML}
                    </div>
                    ${session.songs.length > 6 ? `
                        <div class="session-toggle">
                            <button class="session-toggle-btn" onclick="event.stopPropagation(); dashboard.toggleSessionExpansion('${session.id}')">
                                <i class="fas fa-chevron-down"></i>
                                <span>Show all ${session.songs.length} songs</span>
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        container.innerHTML = sessionsHTML;

        // Initially collapse sessions with many songs
        sessions.forEach(session => {
            if (session.songs.length > 6) {
                const element = document.getElementById(`session-${session.id}`);
                if (element) {
                    element.style.maxHeight = '200px';
                }
            }
        });
    }

    toggleSession(sessionId) {
        // Handle session card click - could expand/collapse or show details
        console.log('Session clicked:', sessionId);
    }

    toggleSessionExpansion(sessionId) {
        const element = document.getElementById(`session-${sessionId}`);
        const button = element.parentElement.querySelector('.session-toggle-btn');
        
        if (element.classList.contains('expanded')) {
            element.classList.remove('expanded');
            element.style.maxHeight = '200px';
            button.innerHTML = '<i class="fas fa-chevron-down"></i><span>Show all songs</span>';
        } else {
            element.classList.add('expanded');
            element.style.maxHeight = 'none';
            button.innerHTML = '<i class="fas fa-chevron-up"></i><span>Show less</span>';
        }
    }

    formatDuration(milliseconds) {
        const minutes = Math.floor(milliseconds / 60000);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            const remainingMinutes = minutes % 60;
            return `${hours}h ${remainingMinutes}m`;
        }
        return `${minutes}m`;
    }

    getSessionIcon(mood) {
        const icons = {
            intense: '🔥',
            mixed: '🎭',
            chill: '😌',
            energetic: '⚡',
            sad: '💙',
            love: '💕',
            breakup: '💔',
            nostalgic: '🌅',
            confident: '👑',
            neutral: '🎵'
        };
        return icons[mood] || icons.neutral;
    }

    getSessionMoodIcon(mood) {
        const icons = {
            intense: '🌶️',
            mixed: '🎨',
            chill: '🧊',
            energetic: '⚡',
            sad: '💧',
            love: '💖',
            breakup: '🖤',
            nostalgic: '📸',
            confident: '💎',
            neutral: '➖'
        };
        return icons[mood] || icons.neutral;
    }

    formatSessionTitle(mood) {
        const titles = {
            intense: 'Emotional',
            mixed: 'Mixed Vibes',
            chill: 'Relaxing',
            energetic: 'High Energy',
            sad: 'Melancholy',
            love: 'Romantic',
            breakup: 'Heartbreak',
            nostalgic: 'Nostalgic',
            confident: 'Confidence Boost',
            neutral: 'Casual Listening'
        };
        return titles[mood] || titles.neutral;
    }

    formatSessionMood(mood) {
        return mood.charAt(0).toUpperCase() + mood.slice(1);
    }

    // Diary Methods
    async loadDiaryEntries() {
        try {
            const response = await this.authenticatedFetch('/api/diary');
            this.diaryEntries = await response.json();
        } catch (error) {
            console.error('Error loading diary entries:', error);
            if (error.message !== 'Authentication failed') {
                this.showError('Failed to load diary entries');
            }
        }
    }

    async renderDiary() {
        const container = document.getElementById('diary-container');
        
        // Load diary entries if not loaded
        if (this.diaryEntries.length === 0) {
            await this.loadDiaryEntries();
        }
        
        if (this.diaryEntries.length === 0) {
            container.innerHTML = `
                <div class="loading">
                    <i class="fas fa-book-open"></i>
                    <p>No diary entries yet. Start writing your thoughts!</p>
                </div>
            `;
            return;
        }

        const entriesHTML = this.diaryEntries.map(entry => {
            const createdDate = new Date(entry.createdAt);
            const formattedDate = createdDate.toLocaleDateString();
            const formattedTime = createdDate.toLocaleTimeString();
            
            const preview = entry.content.length > 200 ? 
                entry.content.substring(0, 200) + '...' : entry.content;
            
            const tagsHTML = entry.tags && entry.tags.length > 0 ? 
                entry.tags.map(tag => `<span class="diary-tag">${tag.trim()}</span>`).join('') : '';
            
            return `
                <div class="diary-entry" onclick="dashboard.viewDiaryEntry('${entry.id}')">
                    <div class="diary-entry-header">
                        <div>
                            <div class="diary-entry-title">${this.escapeHtml(entry.title)}</div>
                            <div class="diary-entry-meta">
                                <span><i class="fas fa-calendar"></i> ${formattedDate}</span>
                                <span><i class="fas fa-clock"></i> ${formattedTime}</span>
                                <span class="diary-entry-mood diary-mood-${entry.mood}">
                                    ${this.getDiaryMoodIcon(entry.mood)} ${this.formatMoodName(entry.mood)}
                                </span>
                            </div>
                        </div>
                        <div class="diary-entry-actions">
                            <button class="diary-action-btn" onclick="event.stopPropagation(); dashboard.editDiaryEntry('${entry.id}')" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="diary-action-btn delete" onclick="event.stopPropagation(); dashboard.deleteDiaryEntry('${entry.id}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="diary-entry-content preview">${this.escapeHtml(preview)}</div>
                    ${tagsHTML ? `<div class="diary-entry-tags">${tagsHTML}</div>` : ''}
                </div>
            `;
        }).join('');

        container.innerHTML = entriesHTML;
    }

    async showNewEntryModal() {
        this.resetDiaryForm();
        document.getElementById('diary-modal-title').textContent = 'New Diary Entry';
        document.getElementById('diary-modal').style.display = 'block';
    }

    async editDiaryEntry(entryId) {
        const entry = this.diaryEntries.find(e => e.id === entryId);
        if (!entry) return;

        // Fill form with existing data
        document.getElementById('diary-entry-id').value = entry.id;
        document.getElementById('diary-title').value = entry.title;
        document.getElementById('diary-content').value = entry.content;
        document.getElementById('diary-mood').value = entry.mood;
        document.getElementById('diary-tags').value = entry.tags ? entry.tags.join(', ') : '';
        
        document.getElementById('diary-modal-title').textContent = 'Edit Diary Entry';
        document.getElementById('diary-modal').style.display = 'block';
    }

    async viewDiaryEntry(entryId) {
        const entry = this.diaryEntries.find(e => e.id === entryId);
        if (!entry) return;

        // You could implement a read-only view modal here
        // For now, just open in edit mode
        this.editDiaryEntry(entryId);
    }

    async deleteDiaryEntry(entryId) {
        if (!confirm('Are you sure you want to delete this diary entry? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await this.authenticatedFetch(`/api/diary/${entryId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await this.loadDiaryEntries();
                this.renderDiary();
            } else {
                throw new Error('Failed to delete entry');
            }
        } catch (error) {
            console.error('Error deleting diary entry:', error);
            this.showError('Failed to delete diary entry');
        }
    }

    async saveDiaryEntry() {
        const entryId = document.getElementById('diary-entry-id').value;
        const title = document.getElementById('diary-title').value.trim();
        const content = document.getElementById('diary-content').value.trim();
        const mood = document.getElementById('diary-mood').value;
        const tagsInput = document.getElementById('diary-tags').value.trim();
        
        if (!title || !content) {
            this.showError('Title and content are required');
            return;
        }

        const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

        const entryData = { title, content, mood, tags };

        try {
            let response;
            if (entryId) {
                // Update existing entry
                response = await this.authenticatedFetch(`/api/diary/${entryId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(entryData)
                });
            } else {
                // Create new entry
                response = await this.authenticatedFetch('/api/diary', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(entryData)
                });
            }

            if (response.ok) {
                this.closeDiaryModal();
                await this.loadDiaryEntries();
                this.renderDiary();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save entry');
            }
        } catch (error) {
            console.error('Error saving diary entry:', error);
            this.showError('Failed to save diary entry');
        }
    }

    resetDiaryForm() {
        document.getElementById('diary-entry-id').value = '';
        document.getElementById('diary-title').value = '';
        document.getElementById('diary-content').value = '';
        document.getElementById('diary-mood').value = 'neutral';
        document.getElementById('diary-tags').value = '';
    }

    closeDiaryModal() {
        document.getElementById('diary-modal').style.display = 'none';
        this.resetDiaryForm();
    }

    getDiaryMoodIcon(mood) {
        const icons = {
            happy: '😊',
            sad: '😢',
            excited: '🤩',
            angry: '😡',
            peaceful: '😌',
            anxious: '😰',
            love: '❤️',
            grateful: '🙏',
            confused: '😕',
            neutral: '😐'
        };
        return icons[mood] || icons.neutral;
    }

    renderAnalytics() {
        this.renderTopArtists();
        this.renderListeningFrequency();
    }

    renderTopArtists() {
        const container = document.getElementById('top-artists-chart');
        const topArtists = this.analytics.topArtists || [];

        if (topArtists.length === 0) {
            container.innerHTML = '<div class="chart-loading">No artist data available</div>';
            return;
        }

        const maxCount = Math.max(...topArtists.map(a => a.count));
        
        const artistsHTML = topArtists.map(artist => {
            const percentage = (artist.count / maxCount) * 100;
            return `
                <div style="display: flex; align-items: center; margin-bottom: 15px;">
                    <div style="flex: 1; margin-right: 15px;">
                        <div style="color: #fff; font-weight: 600; margin-bottom: 5px;">
                            ${this.escapeHtml(artist.artist)}
                        </div>
                        <div style="background: #2a2a2a; height: 8px; border-radius: 4px; overflow: hidden;">
                            <div style="background: #1db954; height: 100%; width: ${percentage}%; transition: width 0.5s ease;"></div>
                        </div>
                    </div>
                    <div style="color: #1db954; font-weight: bold; min-width: 40px; text-align: right;">
                        ${artist.count}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = artistsHTML;
    }

    renderListeningFrequency() {
        const container = document.getElementById('listening-frequency');
        const dailyCount = this.analytics.listeningPatterns?.daily || 0;
        
        container.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3rem; color: #1db954; font-weight: bold; margin-bottom: 10px;">
                    ${dailyCount}
                </div>
                <div style="color: #b3b3b3; font-size: 1.1rem;">
                    Days with activity
                </div>
            </div>
        `;
    }

    renderMoodAnalysis() {
        const container = document.getElementById('mood-distribution');
        const moodData = this.analytics.moodDistribution || {};

        if (Object.keys(moodData).length === 0) {
            container.innerHTML = '<div class="loading">No mood data available</div>';
            return;
        }

        const moodCards = Object.entries(moodData).map(([mood, count]) => {
            return `
                <div class="mood-card">
                    <div class="mood-icon">${this.getMoodIcon(mood)}</div>
                    <div class="mood-count">${count}</div>
                    <div class="mood-label">${this.formatMoodName(mood)}</div>
                </div>
            `;
        }).join('');

        container.innerHTML = moodCards;
    }

    renderListeningPatterns() {
        const container = document.getElementById('hourly-pattern');
        const hourlyData = this.analytics.listeningPatterns?.hourly || {};

        if (Object.keys(hourlyData).length === 0) {
            container.innerHTML = '<div class="chart-loading">No pattern data available</div>';
            return;
        }

        const maxCount = Math.max(...Object.values(hourlyData));
        const hours = Array.from({length: 24}, (_, i) => i);

        const hourlyHTML = hours.map(hour => {
            const count = hourlyData[hour] || 0;
            const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
            const displayHour = hour === 0 ? '12 AM' : 
                               hour < 12 ? `${hour} AM` : 
                               hour === 12 ? '12 PM' : `${hour - 12} PM`;

            return `
                <div style="display: flex; align-items: center; margin-bottom: 10px;">
                    <div style="width: 60px; font-size: 0.9rem; color: #b3b3b3;">
                        ${displayHour}
                    </div>
                    <div style="flex: 1; margin: 0 10px;">
                        <div style="background: #2a2a2a; height: 6px; border-radius: 3px; overflow: hidden;">
                            <div style="background: #1db954; height: 100%; width: ${percentage}%; transition: width 0.5s ease;"></div>
                        </div>
                    </div>
                    <div style="width: 30px; text-align: right; font-size: 0.9rem; color: #1db954;">
                        ${count}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = hourlyHTML;
    }

    showSongDetails(songId) {
        const song = this.activities.find(a => a.id === songId);
        if (!song) return;

        const modal = document.getElementById('song-modal');
        const modalBody = document.getElementById('modal-body');

        const timestamp = new Date(song.loggedAt);
        
        modalBody.innerHTML = `
            <div style="text-align: center;">
                <img src="${song.imageUrl || this.getPlaceholderImage()}" 
                     alt="Album cover" 
                     style="width: 200px; height: 200px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.3);">
                <h2 style="color: #fff; margin-bottom: 10px;">${this.escapeHtml(song.song)}</h2>
                <h3 style="color: #1db954; margin-bottom: 5px;">${this.escapeHtml(song.artist)}</h3>
                <p style="color: #b3b3b3; margin-bottom: 20px;">${this.escapeHtml(song.album)}</p>
                <div style="margin-bottom: 20px;">
                    <span class="mood-tag mood-${song.moodType || 'neutral'}">
                        ${this.getMoodIcon(song.moodType)} ${this.formatMoodName(song.moodType || 'neutral')}
                    </span>
                </div>
                <p style="color: #b3b3b3; margin-bottom: 20px;">
                    Played on ${timestamp.toLocaleDateString()} at ${timestamp.toLocaleTimeString()}
                </p>
                <a href="${song.spotifyUrl}" target="_blank" class="spotify-link" style="font-size: 1rem; padding: 12px 24px;">
                    <i class="fab fa-spotify"></i> Open in Spotify
                </a>
            </div>
        `;

        modal.style.display = 'block';
    }

    filterByMood() {
        const selectedMood = document.getElementById('mood-filter').value;
        
        if (!selectedMood) {
            this.filteredActivities = [...this.activities];
        } else {
            this.filteredActivities = this.activities.filter(activity => 
                (activity.moodType || 'neutral') === selectedMood
            );
        }
        
        this.renderRecentSongs();
    }

    getMoodIcon(mood) {
        const icons = {
            energetic: '🔥',
            sad: '😢',
            love: '❤️',
            chill: '😌',
            breakup: '💔',
            angry: '😡',
            nostalgic: '🌅',
            confident: '😎',
            melodic: '🎵',
            experimental: '🎨',
            neutral: '🎶'
        };
        return icons[mood] || icons.neutral;
    }

    formatRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }

    getPlaceholderImage() {
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjMzMzIiByeD0iOCIvPgo8cGF0aCBkPSJNMjAgMjBIMjVWMjVIMjBWMjBaIiBmaWxsPSIjNjY2Ii8+CjxwYXRoIGQ9Ik0zMCAyMEgzNVYyNUgzMFYyMFoiIGZpbGw9IiM2NjYiLz4KPHA+</i>text IHg9IjMwIiB5PSI0NSIgZmlsbD0iIzY2NiIgZm9udC1zaXplPSI4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5ObyBJbWFnZTwvdGV4dD4KPC9zdmc+';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        console.error(message);
        // Could implement a toast notification here
    }

    async refreshData() {
        const refreshBtn = document.querySelector('.refresh-btn');
        const originalHTML = refreshBtn.innerHTML;
        
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
        refreshBtn.disabled = true;

        try {
            await this.loadData();
            
            // Brief success indication
            refreshBtn.innerHTML = '<i class="fas fa-check"></i> Updated!';
            setTimeout(() => {
                refreshBtn.innerHTML = originalHTML;
                refreshBtn.disabled = false;
            }, 1000);
        } catch (error) {
            refreshBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
            setTimeout(() => {
                refreshBtn.innerHTML = originalHTML;
                refreshBtn.disabled = false;
            }, 2000);
        }
    }

    startAutoRefresh() {
        // Auto-refresh every 30 seconds
        setInterval(() => {
            this.loadData();
        }, 30000);
    }

    // JSON Editor functionality
    async initJsonEditor() {
        const fileSelect = document.getElementById('json-file-select');
        const loadBtn = document.getElementById('json-load-btn');
        const saveBtn = document.getElementById('json-save-btn');
        const formatBtn = document.getElementById('json-format-btn');
        const validateBtn = document.getElementById('json-validate-btn');
        const editor = document.getElementById('json-editor');

        if (!editor) return; // JSON editor not available

        this.jsonEditor = {
            currentFile: 'activity',
            originalContent: '',
            isModified: false
        };

        // File selection
        fileSelect.addEventListener('change', (e) => {
            this.jsonEditor.currentFile = e.target.value;
            this.loadJsonFile();
        });

        // Button events
        loadBtn.addEventListener('click', () => this.loadJsonFile());
        saveBtn.addEventListener('click', () => this.saveJsonFile());
        formatBtn.addEventListener('click', () => this.formatJson());
        validateBtn.addEventListener('click', () => this.validateJson());

        // Editor events
        editor.addEventListener('input', () => this.onJsonContentChange());
        editor.addEventListener('scroll', () => this.updateJsonLineNumbers());

        // Load initial file
        await this.loadJsonFile();
    }

    async loadJsonFile() {
        try {
            const response = await this.authenticatedFetch(`/api/raw/${this.jsonEditor.currentFile}`);

            if (!response.ok) {
                throw new Error(`Failed to load ${this.jsonEditor.currentFile} data`);
            }

            const data = await response.json();
            this.jsonEditor.originalContent = JSON.stringify(data, null, 2);
            
            const editor = document.getElementById('json-editor');
            editor.value = this.jsonEditor.originalContent;
            
            this.jsonEditor.isModified = false;
            this.updateJsonUI();
            this.updateJsonLineNumbers();
            this.updateJsonStats();

            this.showJsonSuccess(`Loaded ${this.jsonEditor.currentFile} data successfully`);
        } catch (error) {
            console.error('Error loading file:', error);
            this.showJsonError(`Failed to load ${this.jsonEditor.currentFile} data: ${error.message}`);
        }
    }

    async saveJsonFile() {
        try {
            const editor = document.getElementById('json-editor');
            const content = editor.value;

            // Validate JSON before saving
            JSON.parse(content);

            const response = await this.authenticatedFetch(`/api/raw/${this.jsonEditor.currentFile}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ data: JSON.parse(content) })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save file');
            }

            this.jsonEditor.originalContent = content;
            this.jsonEditor.isModified = false;
            this.updateJsonUI();

            this.showJsonSuccess(`Saved ${this.jsonEditor.currentFile} data successfully`);
        } catch (error) {
            console.error('Error saving file:', error);
            if (error instanceof SyntaxError) {
                this.showJsonError('Invalid JSON format. Please fix syntax errors before saving.');
            } else {
                this.showJsonError(`Failed to save ${this.jsonEditor.currentFile} data: ${error.message}`);
            }
        }
    }

    formatJson() {
        try {
            const editor = document.getElementById('json-editor');
            const parsed = JSON.parse(editor.value);
            editor.value = JSON.stringify(parsed, null, 2);
            
            this.onJsonContentChange();
            this.updateJsonLineNumbers();
            this.updateJsonStats();
            
            this.showJsonSuccess('JSON formatted successfully');
        } catch (error) {
            this.showJsonError('Invalid JSON format. Cannot format.');
        }
    }

    validateJson() {
        try {
            const editor = document.getElementById('json-editor');
            JSON.parse(editor.value);
            
            const status = document.getElementById('json-status');
            status.className = 'json-editor-status text-success';
            status.innerHTML = '✓ Valid JSON';
            
            this.showJsonSuccess('JSON is valid');
        } catch (error) {
            const status = document.getElementById('json-status');
            status.className = 'json-editor-status text-danger';
            status.innerHTML = '✗ Invalid JSON';
            
            this.showJsonError(`JSON Error: ${error.message}`);
        }
    }

    onJsonContentChange() {
        const editor = document.getElementById('json-editor');
        this.jsonEditor.isModified = editor.value !== this.jsonEditor.originalContent;
        this.updateJsonUI();
        this.updateJsonStats();
        
        // Auto-validate
        try {
            JSON.parse(editor.value);
            const status = document.getElementById('json-status');
            status.className = 'json-editor-status text-success';
            status.innerHTML = '✓ Valid JSON';
        } catch (error) {
            const status = document.getElementById('json-status');
            status.className = 'json-editor-status text-warning';
            status.innerHTML = '⚠ Syntax Error';
        }
    }

    updateJsonUI() {
        const saveBtn = document.getElementById('json-save-btn');
        const fileName = document.getElementById('json-file-name');
        
        if (saveBtn) {
            saveBtn.disabled = !this.jsonEditor.isModified;
            saveBtn.textContent = this.jsonEditor.isModified ? '💾 Save Changes' : '💾 Saved';
        }
        
        if (fileName) {
            fileName.textContent = `${this.jsonEditor.currentFile}.json${this.jsonEditor.isModified ? ' (modified)' : ''}`;
        }
    }

    updateJsonLineNumbers() {
        const editor = document.getElementById('json-editor');
        const lineNumbers = document.getElementById('json-line-numbers');
        
        if (!editor || !lineNumbers) return;
        
        const lines = editor.value.split('\n').length;
        const numbers = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
        lineNumbers.textContent = numbers;
        
        // Sync scroll
        lineNumbers.scrollTop = editor.scrollTop;
    }

    updateJsonStats() {
        const editor = document.getElementById('json-editor');
        if (!editor) return;
        
        const content = editor.value;
        const lines = content.split('\n').length;
        const chars = content.length;
        const size = new Blob([content]).size;
        
        const linesSpan = document.getElementById('json-lines');
        const charsSpan = document.getElementById('json-chars');
        const sizeSpan = document.getElementById('json-size');
        
        if (linesSpan) linesSpan.textContent = lines;
        if (charsSpan) charsSpan.textContent = chars;
        if (sizeSpan) sizeSpan.textContent = this.formatBytes(size);
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showJsonError(message) {
        this.showJsonPopup(message, 'error');
    }

    showJsonSuccess(message) {
        this.showJsonPopup(message, 'success');
    }

    showJsonPopup(message, type) {
        // Remove existing popups
        document.querySelectorAll('.json-error-popup, .json-success-popup').forEach(popup => {
            popup.remove();
        });

        const popup = document.createElement('div');
        popup.className = type === 'error' ? 'json-error-popup' : 'json-success-popup';
        popup.textContent = message;
        
        document.body.appendChild(popup);
        
        // Auto remove after 4 seconds
        setTimeout(() => {
            popup.remove();
        }, 4000);
    }
}

// Global functions for inline event handlers
window.filterByMood = function() {
    dashboard.filterByMood();
};

window.refreshData = function() {
    dashboard.refreshData();
};

window.toggleSessionExpansion = function(sessionId) {
    dashboard.toggleSessionExpansion(sessionId);
};

window.logout = function() {
    dashboard.logout();
};

window.showNewEntryModal = function() {
    dashboard.showNewEntryModal();
};

window.closeDiaryModal = function() {
    dashboard.closeDiaryModal();
};

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new SpotifyDashboard();
});
