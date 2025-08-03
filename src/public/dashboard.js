// Modern Spotify Dashboard JavaScript
class SpotifyDashboard {
    constructor() {
        this.activities = [];
        this.analytics = {};
        this.currentTab = 'recent';
        this.filteredActivities = [];
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadData();
        this.startAutoRefresh();
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

    async loadData() {
        try {
            // Load activities and analytics in parallel
            const [activitiesResponse, analyticsResponse] = await Promise.all([
                fetch('/api/lila-activity'),
                fetch('/api/analytics')
            ]);

            this.activities = await activitiesResponse.json();
            this.analytics = await analyticsResponse.json();
            this.filteredActivities = [...this.activities];

            this.updateQuickStats();
            this.renderCurrentTab();
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load data');
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
}

// Global functions for inline event handlers
window.filterByMood = function() {
    dashboard.filterByMood();
};

window.refreshData = function() {
    dashboard.refreshData();
};

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new SpotifyDashboard();
});
