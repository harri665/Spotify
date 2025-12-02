(() => {
    const state = {
        token: null,
        summary: null,
        recent: [],
        recentOffset: 0,
        recentLimit: 50,
        recentTotal: 0,
        isLoadingRecent: false,
        sessions: { items: [], total: 0, loaded: false },
        search: {
            selectedSongs: [],
            results: [],
            terms: '',
            isLoading: false,
            suggestions: [],
            isLoadingSuggestions: false,
            suggestionQuery: '',
            suggestionRequestId: 0,
        },
        calendar: {
            items: [],
            months: 6,
            isLoading: false,
            timeZone: null,
            day: {
                date: null,
                filteredItems: [],
                filteredTotal: 0,
                allItems: [],
                allTotal: 0,
                isLoading: false,
                error: null,
                requestId: 0,
                statusMessage: '',
            },
        },
        jsonEditor: {
            activeFile: 'activity',
            isDirty: false,
            original: '',
            loadedOnce: false,
        },
    };

    const el = {
        loginScreen: document.getElementById('login-screen'),
        loginForm: document.getElementById('login-form'),
        passwordInput: document.getElementById('password-input'),
        loginError: document.getElementById('login-error'),
        mainDashboard: document.getElementById('main-dashboard'),
        sidebar: document.getElementById('dashboard-sidebar'),
        sidebarToggle: document.getElementById('sidebar-toggle'),
        sidebarClose: document.getElementById('sidebar-close'),
        sidebarOverlay: document.getElementById('sidebar-overlay'),
        totalSongs: document.getElementById('total-songs'),
        uniqueArtists: document.getElementById('unique-artists'),
        currentMood: document.getElementById('current-mood'),
        songList: document.getElementById('song-list'),
        recentLastUpdated: document.getElementById('recent-last-updated'),
        refreshRecentBtn: document.getElementById('refresh-recent-btn'),
        recentLoadMore: document.getElementById('recent-load-more'),
        recentCount: document.getElementById('recent-count'),
        sessionCount: document.getElementById('session-count'),
        sessionsContainer: document.getElementById('sessions-container'),
        searchInput: document.getElementById('search-input'),
        searchAddBtn: document.getElementById('search-add-btn'),
        searchClearBtn: document.getElementById('search-clear-btn'),
        searchSelected: document.getElementById('search-selected'),
        searchResults: document.getElementById('search-results'),
        searchSuggestions: document.getElementById('search-suggestions'),
        calendarMonths: document.getElementById('calendar-months'),
        calendarGrid: document.getElementById('calendar-grid'),
        calendarLegend: document.getElementById('calendar-legend'),
        calendarSidebar: document.getElementById('calendar-sidebar'),
        calendarSidebarTitle: document.getElementById('calendar-sidebar-title'),
        calendarSidebarSubtitle: document.getElementById('calendar-sidebar-subtitle'),
        calendarSidebarStatus: document.getElementById('calendar-sidebar-status'),
        calendarSidebarList: document.getElementById('calendar-sidebar-list'),
        calendarSidebarClose: document.getElementById('calendar-sidebar-close'),
        navItems: Array.from(document.querySelectorAll('.nav-item')),
        tabPanes: Array.from(document.querySelectorAll('.tab-pane')),
        jsonFileSelect: document.getElementById('json-file-select'),
        jsonLoadBtn: document.getElementById('json-load-btn'),
        jsonFormatBtn: document.getElementById('json-format-btn'),
        jsonValidateBtn: document.getElementById('json-validate-btn'),
        jsonSaveBtn: document.getElementById('json-save-btn'),
        jsonEditor: document.getElementById('json-editor'),
        jsonLineNumbers: document.getElementById('json-line-numbers'),
        jsonStatus: document.getElementById('json-status'),
        jsonFileName: document.getElementById('json-file-name'),
        jsonSizeMeta: document.getElementById('json-size-meta'),
        jsonSizeStats: document.getElementById('json-size-stats'),
        jsonLines: document.getElementById('json-lines'),
        jsonChars: document.getElementById('json-chars'),
    };

    const SUGGESTION_DEBOUNCE_MS = 200;
    const CLIENT_TIMEZONE = (() => {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        } catch (error) {
            return 'UTC';
        }
    })();
    const AUTO_REFRESH_INTERVAL_MS = 60 * 1000; // Poll backend periodically for fresh activity
    const MOBILE_BREAKPOINT = '(max-width: 1024px)';
    const mobileMediaQuery = typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia(MOBILE_BREAKPOINT)
        : null;
    let suggestionDebounceHandle = null;
    let suggestionAbortController = null;
    let autoRefreshTimer = null;
    let refreshPromise = null;
    let viewportListenerAttached = false;

    function stopAutoRefresh() {
        if (autoRefreshTimer) {
            clearInterval(autoRefreshTimer);
            autoRefreshTimer = null;
        }
    }

    function startAutoRefresh() {
        if (AUTO_REFRESH_INTERVAL_MS <= 0) {
            return;
        }
        stopAutoRefresh();
        autoRefreshTimer = setInterval(() => {
            runRefreshSequence({ forceSessions: true }).catch((error) => {
                console.warn('Auto refresh failed:', error);
            });
        }, AUTO_REFRESH_INTERVAL_MS);
    }

    function isMobileViewport() {
        if (mobileMediaQuery) {
            return mobileMediaQuery.matches;
        }
        return window.innerWidth <= 1024;
    }

    function openSidebar() {
        if (!isMobileViewport()) {
            return;
        }
        document.body.classList.add('sidebar-open');
        syncSidebarAccessibility();
    }

    function closeSidebar() {
        document.body.classList.remove('sidebar-open');
        syncSidebarAccessibility();
    }

    function toggleSidebar() {
        if (document.body.classList.contains('sidebar-open')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    }

    function handleViewportChange() {
        if (!isMobileViewport()) {
            closeSidebar();
        } else {
            syncSidebarAccessibility();
        }
    }

    function syncSidebarAccessibility() {
        const isOpen = document.body.classList.contains('sidebar-open');
        if (el.sidebarToggle) {
            el.sidebarToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        }
        if (el.sidebar) {
            const hidden = isMobileViewport() && !isOpen;
            el.sidebar.setAttribute('aria-hidden', hidden ? 'true' : 'false');
        }
        if (el.sidebarOverlay) {
            el.sidebarOverlay.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        }
    }

    function setLoginVisible(visible) {
        el.loginScreen.style.display = visible ? 'flex' : 'none';
        el.mainDashboard.style.display = visible ? 'none' : 'flex';
        if (visible) {
            el.passwordInput.focus();
            stopAutoRefresh();
            closeSidebar();
        } else {
            handleViewportChange();
        }
    }

    function showLoginError(message) {
        el.loginError.textContent = message;
        el.loginError.style.display = 'block';
    }

    function clearLoginError() {
        el.loginError.textContent = '';
        el.loginError.style.display = 'none';
    }

    function storeToken(token) {
        state.token = token;
        if (token) {
            localStorage.setItem('dashboardToken', token);
        } else {
            localStorage.removeItem('dashboardToken');
        }
    }

    async function rawFetch(url, options = {}, skipAuth = false) {
        const config = { ...options };
        config.headers = new Headers(options.headers || {});
        if (config.body && !(config.body instanceof FormData) && typeof config.body === 'object') {
            config.headers.set('Content-Type', 'application/json');
            config.body = JSON.stringify(config.body);
        }
        if (!skipAuth && state.token && state.token !== 'dev-no-auth') {
            config.headers.set('Authorization', `Bearer ${state.token}`);
        }
        const response = await fetch(url, config);
        if (response.status === 401) {
            handleUnauthorized();
            throw new Error('Unauthorized');
        }
        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || response.statusText);
        }
        if (response.status === 204) {
            return null;
        }
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            return response.json();
        }
        return response.text();
    }

    async function login(password) {
        const data = await rawFetch('/api/login', { method: 'POST', body: { password } }, true);
        return data.token;
    }

    function handleUnauthorized() {
        storeToken(null);
        setLoginVisible(true);
        showLoginError('Session expired. Please log in again.');
    }

    function formatDateTime(value) {
        if (!value) {
            return 'Unknown time';
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value;
        }
        return date.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function formatDuration(minutes) {
        if (!minutes || Number.isNaN(minutes)) {
            return '1 min';
        }
        if (minutes < 60) {
            return `${minutes} min`;
        }
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins ? `${hours}h ${mins}m` : `${hours}h`;
    }

    function formatDateLabel(dateStr) {
        if (!dateStr) {
            return '';
        }
        const parts = dateStr.split('-').map((part) => Number.parseInt(part, 10));
        if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
            return dateStr;
        }
        const [year, month, day] = parts;
        const baseDate = new Date(Date.UTC(year, month - 1, day, 12));
        const timeZone = state.calendar.timeZone || CLIENT_TIMEZONE;
        return new Intl.DateTimeFormat(undefined, {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            timeZone,
        }).format(baseDate);
    }

    function formatTime(value) {
        if (!value) {
            return '';
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value;
        }
        return date.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function formatBytes(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) {
            return '0 B';
        }
        const units = ['B', 'KB', 'MB', 'GB'];
        let value = bytes;
        let unitIndex = 0;
        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex += 1;
        }
        const precision = value < 10 && unitIndex > 0 ? 1 : 0;
        return `${value.toFixed(precision)} ${units[unitIndex]}`;
    }

    const SESSION_COLOR_CLASSES = [
        'session-color-1',
        'session-color-2',
        'session-color-3',
        'session-color-4',
        'session-color-5',
        'session-color-6',
        'session-color-7',
        'session-color-8',
    ];

    function parseDateValue(value) {
        if (!value) {
            return null;
        }
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function getSessionColorClass(sessionId) {
        if (!SESSION_COLOR_CLASSES.length) {
            return 'session-color-default';
        }
        const numericId = Number(sessionId);
        if (!Number.isFinite(numericId)) {
            return 'session-color-default';
        }
        const index = ((Math.abs(Math.trunc(numericId)) - 1) % SESSION_COLOR_CLASSES.length + SESSION_COLOR_CLASSES.length) % SESSION_COLOR_CLASSES.length;
        return SESSION_COLOR_CLASSES[index];
    }

    function groupItemsBySession(items) {
        const groups = [];
        let currentKey = null;
        let currentGroup = null;
        items.forEach((item, idx) => {
            const hasSession = item && item.sessionId !== undefined && item.sessionId !== null;
            const key = hasSession ? `session-${item.sessionId}` : `entry-${idx}`;
            if (!currentGroup || currentKey !== key) {
                currentGroup = {
                    key,
                    sessionId: hasSession ? item.sessionId : null,
                    sessionStart: item ? item.sessionStart : null,
                    items: [],
                };
                groups.push(currentGroup);
                currentKey = key;
            }
            currentGroup.items.push(item);
        });
        return groups;
    }

    function getSessionBounds(items) {
        let startValue = null;
        let startMs = null;
        let endValue = null;
        let endMs = null;
        items.forEach((item) => {
            const startCandidate = item && (item.sessionStart || item.playedAt || item.loggedAt || item.timestamp);
            const endCandidate = item && (item.playedAt || item.loggedAt || item.timestamp || item.sessionStart);
            if (startCandidate) {
                const parsed = parseDateValue(startCandidate);
                if (parsed) {
                    const ms = parsed.getTime();
                    if (startMs === null || ms < startMs) {
                        startMs = ms;
                        startValue = parsed.toISOString();
                    }
                }
            }
            if (endCandidate) {
                const parsedEnd = parseDateValue(endCandidate);
                if (parsedEnd) {
                    const ms = parsedEnd.getTime();
                    if (endMs === null || ms > endMs) {
                        endMs = ms;
                        endValue = parsedEnd.toISOString();
                    }
                }
            }
        });
        return { start: startValue, end: endValue };
    }

    function createRecentSongRow(item) {
        const row = document.createElement('article');
        row.className = 'song-item';
        row.dataset.index = item.__index;
        if (item.sessionId !== undefined && item.sessionId !== null) {
            row.dataset.sessionId = item.sessionId;
        }

        const img = document.createElement('img');
        img.className = 'song-cover';
        img.src = item.imageUrl || '';
        img.alt = `${item.song || 'Song cover'}`;
        img.addEventListener('error', () => {
            img.classList.add('song-cover-placeholder');
            img.src = '';
        });

        const info = document.createElement('div');
        info.className = 'song-info';
        const title = document.createElement('div');
        title.className = 'song-title';
        title.textContent = item.song || 'Unknown song';
        const artist = document.createElement('div');
        artist.className = 'song-artist';
        const subtitleParts = [];
        if (item.artist) {
            subtitleParts.push(item.artist);
        }
        if (item.album) {
            subtitleParts.push(item.album);
        }
        artist.textContent = subtitleParts.length ? subtitleParts.join(' • ') : 'Unknown artist';
        info.appendChild(title);
        info.appendChild(artist);

        const meta = document.createElement('div');
        meta.className = 'song-metadata';
        const timestamp = document.createElement('div');
        timestamp.className = 'song-timestamp';
        timestamp.textContent = formatDateTime(item.playedAt || item.loggedAt || item.timestamp);
        meta.appendChild(timestamp);
        if (item.spotifyUrl) {
            const link = document.createElement('a');
            link.href = item.spotifyUrl;
            link.target = '_blank';
            link.rel = 'noopener';
            link.className = 'spotify-link';
            link.title = 'Open in Spotify';

            const fallback = () => {
                link.classList.remove('spotify-link--image');
                link.innerHTML = '<i class="fab fa-spotify"></i> Play';
            };

            if (item.imageUrl) {
                const cover = document.createElement('img');
                cover.className = 'spotify-link-image';
                cover.src = item.imageUrl;
                cover.alt = item.song ? `Open ${item.song} in Spotify` : 'Open in Spotify';
                cover.addEventListener('error', () => {
                    cover.remove();
                    fallback();
                });
                link.classList.add('spotify-link--image');
                link.appendChild(cover);
            } else {
                fallback();
            }
            meta.appendChild(link);
        }

        row.appendChild(img);
        row.appendChild(info);
        row.appendChild(meta);
        return row;
    }

    function createCalendarSidebarItem(item) {
        const row = document.createElement('div');
        row.className = 'calendar-sidebar-item';
        row.dataset.index = item.__index;
        if (item.sessionId !== undefined && item.sessionId !== null) {
            row.dataset.sessionId = item.sessionId;
        }

        const time = document.createElement('span');
        time.className = 'calendar-sidebar-time';
        time.textContent = formatTime(item.playedAt || item.loggedAt || item.timestamp);
        row.appendChild(time);

        const details = document.createElement('div');
        details.className = 'calendar-sidebar-details';

        const title = document.createElement('div');
        title.className = 'calendar-sidebar-song';
        title.textContent = item.song || 'Unknown song';
        details.appendChild(title);

        const meta = document.createElement('div');
        meta.className = 'calendar-sidebar-meta';
        const metaParts = [];
        if (item.artist) {
            metaParts.push(item.artist);
        }
        if (item.album) {
            metaParts.push(item.album);
        }
        meta.textContent = metaParts.join(' • ') || '—';
        details.appendChild(meta);

        row.appendChild(details);

        if (item.spotifyUrl) {
            const link = document.createElement('a');
            link.className = 'calendar-sidebar-link';
            link.href = item.spotifyUrl;
            link.target = '_blank';
            link.rel = 'noopener';
            link.title = 'Open in Spotify';
            const fallback = () => {
                link.classList.remove('calendar-sidebar-link--image');
                link.innerHTML = '<i class="fab fa-spotify"></i>';
            };

            if (item.imageUrl) {
                const cover = document.createElement('img');
                cover.className = 'calendar-sidebar-link-image';
                cover.src = item.imageUrl;
                cover.alt = item.song ? `Open ${item.song} in Spotify` : 'Open in Spotify';
                cover.addEventListener('error', () => {
                    cover.remove();
                    fallback();
                });
                link.classList.add('calendar-sidebar-link--image');
                link.appendChild(cover);
            } else {
                fallback();
            }
            row.appendChild(link);
        }

        return row;
    }

    function showPopup(kind, message) {
        const div = document.createElement('div');
        div.className = kind === 'error' ? 'json-error-popup' : 'json-success-popup';
        div.textContent = message;
        document.body.appendChild(div);
        setTimeout(() => {
            div.remove();
        }, 4000);
    }

    function renderSummary() {
        const summary = state.summary;
        el.totalSongs.textContent = summary ? summary.totalSongs.toLocaleString() : '—';
        el.uniqueArtists.textContent = summary ? summary.uniqueArtists.toLocaleString() : '—';
        const latest = state.recent.length ? state.recent[0] : null;
        el.currentMood.textContent = latest ? latest.song : '—';
    }
    async function loadSummary() {
        try {
            state.summary = await rawFetch('/api/activity/summary');
            renderSummary();
        } catch (error) {
            showPopup('error', `Unable to load summary: ${error.message}`);
        }
    }

    function renderRecent() {
        if (!el.songList) {
            return;
        }
        el.songList.innerHTML = '';
        if (!state.recent.length) {
            el.songList.innerHTML = '<p class="empty-state">No songs found.</p>';
        } else {
            const fragment = document.createDocumentFragment();
            const sessionGroups = groupItemsBySession(state.recent);
            sessionGroups.forEach((group) => {
                const wrapper = document.createElement('section');
                wrapper.className = `song-session-group session-group ${getSessionColorClass(group.sessionId)}`;

                const bounds = getSessionBounds(group.items);
                const endDate = parseDateValue(bounds.end);

                const header = document.createElement('div');
                header.className = 'session-group-header';

                const title = document.createElement('div');
                title.className = 'session-group-title';
                if (bounds.start) {
                    title.textContent = formatDateTime(bounds.start);
                } else {
                    title.textContent = 'Listening session';
                }
                header.appendChild(title);

                const meta = document.createElement('div');
                meta.className = 'session-group-meta';
                const metaParts = [`${group.items.length.toLocaleString()} play${group.items.length === 1 ? '' : 's'}`];
                if (endDate) {
                    metaParts.push(`ended ${endDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`);
                }
                meta.textContent = metaParts.join(' · ');
                header.appendChild(meta);

                wrapper.appendChild(header);

                const tracks = document.createElement('div');
                tracks.className = 'session-group-tracks';
                group.items.forEach((item) => {
                    tracks.appendChild(createRecentSongRow(item));
                });
                wrapper.appendChild(tracks);

                fragment.appendChild(wrapper);
            });
            el.songList.appendChild(fragment);
        }

        el.recentCount.textContent = state.recentTotal
            ? `Showing ${state.recent.length.toLocaleString()} of ${state.recentTotal.toLocaleString()} plays`
            : '';
        el.recentLastUpdated.textContent = `Last updated ${formatDateTime(new Date().toISOString())}`;
        el.recentLoadMore.style.display = state.recent.length < state.recentTotal ? 'inline-flex' : 'none';
        applySearchHighlights();
    }

    async function loadRecent({ reset = false } = {}) {
        if (state.isLoadingRecent) {
            return;
        }
        state.isLoadingRecent = true;
        if (reset) {
            state.recent = [];
            state.recentOffset = 0;
            el.songList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Loading recent songs...</p></div>';
        }
        try {
            const params = new URLSearchParams({
                offset: state.recentOffset.toString(),
                limit: state.recentLimit.toString(),
            });
            const data = await rawFetch(`/api/activity/recent?${params.toString()}`);
            if (reset) {
                state.recent = data.items || [];
            } else {
                state.recent = state.recent.concat(data.items || []);
            }
            state.recentTotal = data.total || state.recent.length;
            state.recentOffset = state.recent.length;
            renderRecent();
        } catch (error) {
            showPopup('error', `Unable to load recent songs: ${error.message}`);
        } finally {
            state.isLoadingRecent = false;
        }
    }

    function applySearchHighlights() {
        if (!state.search.results.length) {
            el.songList.querySelectorAll('.song-item--highlight').forEach((item) => {
                item.classList.remove('song-item--highlight');
            });
            return;
        }
        const matchIndices = new Set(state.search.results.map((item) => item.__index));
        el.songList.querySelectorAll('.song-item').forEach((row) => {
            if (matchIndices.has(Number(row.dataset.index))) {
                row.classList.add('song-item--highlight');
            } else {
                row.classList.remove('song-item--highlight');
            }
        });
    }

    function cancelSuggestionFetch() {
        if (suggestionDebounceHandle) {
            clearTimeout(suggestionDebounceHandle);
            suggestionDebounceHandle = null;
        }
        if (suggestionAbortController) {
            suggestionAbortController.abort();
            suggestionAbortController = null;
        }
    }

    function clearSearchSuggestions({ keepQuery = false } = {}) {
        cancelSuggestionFetch();
        if (!keepQuery) {
            state.search.suggestionQuery = '';
        }
        state.search.suggestions = [];
        state.search.isLoadingSuggestions = false;
        state.search.suggestionRequestId = 0;
        if (el.searchSuggestions) {
            el.searchSuggestions.innerHTML = '';
            el.searchSuggestions.classList.remove('visible');
            el.searchSuggestions.setAttribute('aria-hidden', 'true');
        }
    }

    function buildSongSuggestions(items) {
        const counts = new Map();
        items.forEach((item) => {
            const songTitle = (item.song || '').trim();
            if (!songTitle) {
                return;
            }
            const key = songTitle.toLowerCase();
            if (!counts.has(key)) {
                counts.set(key, {
                    song: songTitle,
                    artist: item.artist || '',
                    count: 0,
                });
            }
            const entry = counts.get(key);
            entry.count += 1;
            if (!entry.artist && item.artist) {
                entry.artist = item.artist;
            }
        });
        return Array.from(counts.values())
            .sort((a, b) => b.count - a.count || a.song.localeCompare(b.song))
            .slice(0, 8);
    }

    function renderSearchSuggestions() {
        if (!el.searchSuggestions) {
            return;
        }
        const { suggestionQuery, isLoadingSuggestions, suggestions } = state.search;
        if (!suggestionQuery) {
            el.searchSuggestions.innerHTML = '';
            el.searchSuggestions.classList.remove('visible');
            el.searchSuggestions.setAttribute('aria-hidden', 'true');
            return;
        }

        el.searchSuggestions.innerHTML = '';
        el.searchSuggestions.classList.add('visible');
        el.searchSuggestions.setAttribute('aria-hidden', 'false');

        if (isLoadingSuggestions) {
            const loading = document.createElement('div');
            loading.className = 'search-suggestions-loading';
            loading.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Searching songs...</span>';
            el.searchSuggestions.appendChild(loading);
            return;
        }

        if (!suggestions.length) {
            const empty = document.createElement('div');
            empty.className = 'search-suggestions-empty';
            empty.textContent = 'No matching songs found.';
            el.searchSuggestions.appendChild(empty);
            return;
        }

        const list = document.createElement('ul');
        list.className = 'search-suggestions-list';
        suggestions.forEach((suggestion) => {
            const li = document.createElement('li');
            li.className = 'search-suggestion-item';
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'search-suggestion-button';
            button.dataset.song = suggestion.song;

            const title = document.createElement('span');
            title.className = 'search-suggestion-title';
            title.textContent = suggestion.song;
            button.appendChild(title);

            const meta = document.createElement('span');
            meta.className = 'search-suggestion-meta';
            const parts = [];
            if (suggestion.artist) {
                parts.push(suggestion.artist);
            }
            if (suggestion.count) {
                parts.push(`${suggestion.count.toLocaleString()} play${suggestion.count === 1 ? '' : 's'}`);
            }
            meta.textContent = parts.join(' · ');
            button.appendChild(meta);

            li.appendChild(button);
            list.appendChild(li);
        });

        el.searchSuggestions.appendChild(list);
    }

    function addSelectedSongs(songs) {
        let added = false;
        songs.forEach((entry) => {
            const song = entry.trim();
            if (!song) {
                return;
            }
            if (!state.search.selectedSongs.some((item) => item.toLowerCase() === song.toLowerCase())) {
                state.search.selectedSongs.push(song);
                added = true;
            }
        });
        if (!added) {
            return;
        }
        el.searchInput.value = '';
        state.search.terms = '';
        renderSelectedSongs();
        clearSearchSuggestions();
        executeSearch();
    }

    async function loadSearchSuggestions(query) {
        cancelSuggestionFetch();
        if (!query || query.length < 2) {
            clearSearchSuggestions();
            return;
        }

        state.search.suggestionQuery = query;
        state.search.isLoadingSuggestions = true;
        state.search.suggestions = [];
        renderSearchSuggestions();

        const requestId = Date.now();
        state.search.suggestionRequestId = requestId;
        suggestionAbortController = new AbortController();

        try {
            const params = new URLSearchParams({ q: query });
            const data = await rawFetch(`/api/activity/search?${params.toString()}`, { signal: suggestionAbortController.signal });
            if (state.search.suggestionRequestId !== requestId) {
                return;
            }
            const items = Array.isArray(data.items) ? data.items : [];
            state.search.suggestions = buildSongSuggestions(items);
            state.search.isLoadingSuggestions = false;
            renderSearchSuggestions();
        } catch (error) {
            if (error.name === 'AbortError') {
                return;
            }
            if (state.search.suggestionRequestId !== requestId) {
                return;
            }
            state.search.suggestions = [];
            state.search.isLoadingSuggestions = false;
            renderSearchSuggestions();
        } finally {
            if (suggestionAbortController) {
                suggestionAbortController = null;
            }
        }
    }

    function handleSearchInputChange(event) {
        const query = event.target.value.trim();
        cancelSuggestionFetch();
        if (!query) {
            clearSearchSuggestions();
            return;
        }
        if (query.length < 2) {
            clearSearchSuggestions({ keepQuery: true });
            state.search.suggestionQuery = query;
            return;
        }
        state.search.suggestionQuery = query;
        state.search.isLoadingSuggestions = true;
        state.search.suggestions = [];
        renderSearchSuggestions();
        suggestionDebounceHandle = setTimeout(() => {
            loadSearchSuggestions(query);
        }, SUGGESTION_DEBOUNCE_MS);
    }

    function handleSuggestionContainerClick(event) {
        const button = event.target.closest('[data-song]');
        if (!button) {
            return;
        }
        event.preventDefault();
        const song = button.dataset.song || '';
        if (!song) {
            return;
        }
        addSelectedSongs([song]);
    }

    function handleSuggestionOutsideClick(event) {
        if (event.target.closest('.search-input-area')) {
            return;
        }
        clearSearchSuggestions();
    }

    function renderSelectedSongs() {
        el.searchSelected.innerHTML = '';
        if (!state.search.selectedSongs.length) {
            el.searchSelected.innerHTML = '<span class="search-pill empty">No songs selected</span>';
            return;
        }
        const fragment = document.createDocumentFragment();
        state.search.selectedSongs.forEach((song) => {
            const pill = document.createElement('button');
            pill.className = 'search-pill';
            pill.type = 'button';
            pill.dataset.song = song;
            pill.innerHTML = `<span>${song}</span><i class="fas fa-times"></i>`;
            pill.addEventListener('click', () => {
                removeSelectedSong(song);
            });
            fragment.appendChild(pill);
        });
        el.searchSelected.appendChild(fragment);
    }

    function removeSelectedSong(song) {
        state.search.selectedSongs = state.search.selectedSongs.filter((item) => item.toLowerCase() !== song.toLowerCase());
        renderSelectedSongs();
        executeSearch();
    }

    async function executeSearch() {
        if (state.search.isLoading) {
            return;
        }
        state.search.isLoading = true;
        try {
            if (!state.search.selectedSongs.length && !state.search.terms) {
                state.search.results = [];
                renderSearchResults();
                applySearchHighlights();
                await loadCalendar();
                return;
            }
            el.searchResults.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Searching...</p></div>';
            const params = new URLSearchParams();
            if (state.search.terms) {
                params.set('q', state.search.terms);
            }
            if (state.search.selectedSongs.length) {
                params.set('songs', state.search.selectedSongs.join(','));
            }
            const data = await rawFetch(`/api/activity/search?${params.toString()}`);
            state.search.results = data.items || [];
            renderSearchResults();
            applySearchHighlights();
            await loadCalendar();
        } catch (error) {
            showPopup('error', `Search failed: ${error.message}`);
            el.searchResults.innerHTML = '<p class="error-text">Unable to complete search.</p>';
        } finally {
            state.search.isLoading = false;
        }
    }

    function renderSearchResults() {
        el.searchResults.innerHTML = '';
        const results = state.search.results;
        if (!results.length) {
            if (state.search.selectedSongs.length || state.search.terms) {
                el.searchResults.innerHTML = '<p class="empty-state">No matching plays found for the current selection.</p>';
            }
            return;
        }
        const grouped = new Map();
        results.forEach((item) => {
            const key = item.song || 'Unknown song';
            if (!grouped.has(key)) {
                grouped.set(key, []);
            }
            grouped.get(key).push(item);
        });
        const wrapper = document.createElement('div');
        wrapper.className = 'search-result-wrapper';
        for (const [song, items] of grouped.entries()) {
            const card = document.createElement('div');
            card.className = 'search-result-card';
            const header = document.createElement('header');
            header.className = 'search-result-header';
            header.innerHTML = `<h3>${song}</h3><span>${items.length} plays</span>`;
            const list = document.createElement('ul');
            list.className = 'search-result-list';
            items.slice(0, 10).forEach((entry) => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${formatDateTime(entry.playedAt || entry.loggedAt || entry.timestamp)}</span><span>${entry.artist || 'Unknown artist'}</span>`;
                list.appendChild(li);
            });
            if (items.length > 10) {
                const more = document.createElement('div');
                more.className = 'search-result-more';
                more.textContent = `+${items.length - 10} more plays`; 
                card.appendChild(more);
            }
            card.appendChild(header);
            card.appendChild(list);
            wrapper.appendChild(card);
        }
        el.searchResults.appendChild(wrapper);
    }

    async function loadCalendar() {
        if (state.calendar.isLoading) {
            return;
        }
        state.calendar.isLoading = true;
        el.calendarGrid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Building calendar...</p></div>';
        try {
            const params = new URLSearchParams();
            if (typeof state.calendar.months === 'number') {
                params.set('months', state.calendar.months.toString());
            }
            if (state.search.selectedSongs.length) {
                params.set('songs', state.search.selectedSongs.join(','));
            }
            const requestTimeZone = state.calendar.timeZone || CLIENT_TIMEZONE;
            if (requestTimeZone) {
                params.set('tz', requestTimeZone);
            }
            const data = await rawFetch(`/api/activity/calendar?${params.toString()}`);
            state.calendar.items = data.items || [];
            state.calendar.timeZone = data.timeZone || requestTimeZone;
            renderCalendar();
            const selectedDate = state.calendar.day.date;
            if (selectedDate) {
                const exists = state.calendar.items.some((item) => item.date === selectedDate);
                if (!exists) {
                    clearCalendarDaySelection({ message: 'Selected day is not included in this window.' });
                } else {
                    loadCalendarDay(selectedDate, { silent: true });
                }
            }
        } catch (error) {
            showPopup('error', `Unable to load calendar: ${error.message}`);
            el.calendarGrid.innerHTML = '<p class="error-text">Calendar unavailable.</p>';
            renderCalendarSidebar();
        } finally {
            state.calendar.isLoading = false;
        }
    }

    function renderCalendar() {
        el.calendarGrid.innerHTML = '';
        el.calendarLegend.innerHTML = '';
        const items = state.calendar.items;
        if (!items.length) {
            el.calendarGrid.innerHTML = '<p class="empty-state">No plays for the selected window.</p>';
            renderCalendarSidebar();
            return;
        }
        const dataMap = new Map(items.map((item) => [item.date, item]));
        const maxCount = items.reduce((max, item) => Math.max(max, item.count), 0) || 1;
        const selectedDate = state.calendar.day.date;
        const monthKeys = new Set(items.map((item) => item.date.slice(0, 7)));
        const sortedMonths = Array.from(monthKeys).sort();
        const fragment = document.createDocumentFragment();
        sortedMonths.forEach((monthKey) => {
            const [yearStr, monthStr] = monthKey.split('-');
            const year = Number(yearStr);
            const month = Number(monthStr) - 1;
            const monthStart = new Date(Date.UTC(year, month, 1));
            const monthEnd = new Date(Date.UTC(year, month + 1, 0));

            const monthCard = document.createElement('section');
            monthCard.className = 'calendar-month';

            const monthHeader = document.createElement('header');
            monthHeader.className = 'calendar-month-header';
            monthHeader.textContent = new Intl.DateTimeFormat(undefined, {
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
            }).format(monthStart);
            monthCard.appendChild(monthHeader);

            const grid = document.createElement('div');
            grid.className = 'calendar-month-grid';

            const firstWeekday = (monthStart.getUTCDay() + 7) % 7;
            for (let i = 0; i < firstWeekday; i += 1) {
                const filler = document.createElement('div');
                filler.className = 'calendar-day filler';
                grid.appendChild(filler);
            }

            const daysInMonth = monthEnd.getUTCDate();
            for (let day = 1; day <= daysInMonth; day += 1) {
                const dateStr = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
                const item = dataMap.get(dateStr);
                const cell = document.createElement('div');
                cell.className = 'calendar-day';
                cell.dataset.date = dateStr;
                const count = item ? item.count : 0;
                const intensity = Math.ceil((count / maxCount) * 4);
                if (count > 0) {
                    cell.classList.add(`level-${intensity}`);
                    const tooltipLines = [`${count} play${count === 1 ? '' : 's'} on ${formatDateLabel(dateStr)}`];
                    if (item.songs && item.songs.length) {
                        item.songs.slice(0, 3).forEach((songInfo) => {
                            tooltipLines.push(`${songInfo.song}: ${songInfo.count}`);
                        });
                        if (item.songs.length > 3) {
                            tooltipLines.push(`+${item.songs.length - 3} more songs`);
                        }
                    }
                    cell.title = tooltipLines.join('\n');
                } else {
                    cell.classList.add('level-0');
                    cell.title = `No plays on ${formatDateTime(dateStr)}`;
                }
                cell.innerHTML = `<span>${day}</span>`;
                cell.setAttribute('role', 'button');
                cell.setAttribute('tabindex', '0');
                const accessibleLabel = `${formatDateLabel(dateStr)} • ${count.toLocaleString()} play${count === 1 ? '' : 's'}`;
                cell.setAttribute('aria-label', accessibleLabel);
                const isSelected = selectedDate === dateStr;
                if (isSelected) {
                    cell.classList.add('selected');
                }
                cell.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
                cell.addEventListener('click', () => {
                    handleCalendarDaySelection(dateStr);
                });
                cell.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleCalendarDaySelection(dateStr);
                    }
                });
                grid.appendChild(cell);
            }

            monthCard.appendChild(grid);
            fragment.appendChild(monthCard);
        });
        el.calendarGrid.appendChild(fragment);

        const legend = document.createElement('div');
        legend.className = 'calendar-legend-scale';
        legend.innerHTML = `
            <span>Less</span>
            <div class="legend-steps">
                <span class="calendar-day level-0"></span>
                <span class="calendar-day level-1"></span>
                <span class="calendar-day level-2"></span>
                <span class="calendar-day level-3"></span>
                <span class="calendar-day level-4"></span>
            </div>
            <span>More</span>
        `;
        el.calendarLegend.appendChild(legend);
        highlightSelectedCalendarDay();
        renderCalendarSidebar();
    }

    function highlightSelectedCalendarDay({ focus = false } = {}) {
        if (!el.calendarGrid) {
            return;
        }
        const selected = state.calendar.day.date;
        el.calendarGrid.querySelectorAll('.calendar-day').forEach((cell) => {
            if (cell.classList.contains('filler')) {
                return;
            }
            const isSelected = cell.dataset.date === selected;
            cell.classList.toggle('selected', isSelected);
            cell.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
            if (isSelected && focus) {
                cell.focus({ preventScroll: true });
            }
        });
    }

    function renderCalendarSidebar() {
        if (!el.calendarSidebar || !el.calendarSidebarStatus || !el.calendarSidebarList || !el.calendarSidebarTitle || !el.calendarSidebarSubtitle) {
            return;
        }
        const dayState = state.calendar.day;
        if (!dayState.date) {
            el.calendarSidebarTitle.textContent = 'Select a day';
            el.calendarSidebarSubtitle.textContent = dayState.statusMessage || 'Click a day to see every song played.';
            el.calendarSidebarStatus.innerHTML = `<p class="calendar-sidebar-placeholder">${dayState.statusMessage || 'Pick a day from the calendar to view details.'}</p>`;
            el.calendarSidebarList.innerHTML = '';
            if (el.calendarSidebarClose) {
                el.calendarSidebarClose.disabled = true;
                el.calendarSidebarClose.setAttribute('aria-disabled', 'true');
            }
            return;
        }

        if (el.calendarSidebarClose) {
            el.calendarSidebarClose.disabled = false;
            el.calendarSidebarClose.setAttribute('aria-disabled', 'false');
        }

        el.calendarSidebarTitle.textContent = formatDateLabel(dayState.date);

        if (dayState.isLoading) {
            el.calendarSidebarSubtitle.textContent = 'Loading plays...';
            el.calendarSidebarStatus.innerHTML = '<div class="loading loading-inline"><i class="fas fa-spinner fa-spin"></i><p>Loading plays...</p></div>';
            el.calendarSidebarList.innerHTML = '';
            return;
        }

        if (dayState.error) {
            el.calendarSidebarSubtitle.textContent = 'Unable to load day details';
            el.calendarSidebarStatus.innerHTML = `<p class="calendar-sidebar-error">${dayState.error}</p>`;
            el.calendarSidebarList.innerHTML = '';
            return;
        }

        const filteredItems = Array.isArray(dayState.filteredItems) ? dayState.filteredItems : [];
        const allItems = Array.isArray(dayState.allItems) ? dayState.allItems : [];
        const filteredTotal = Number.isFinite(dayState.filteredTotal) ? dayState.filteredTotal : filteredItems.length;
        const allTotal = Number.isFinite(dayState.allTotal) ? dayState.allTotal : allItems.length;
        const hasFilter = state.search.selectedSongs.length > 0;

        if (hasFilter) {
            if (filteredTotal) {
                const selectionLabel = `${filteredTotal.toLocaleString()} match${filteredTotal === 1 ? '' : 'es'} for selected song${state.search.selectedSongs.length === 1 ? '' : 's'}`;
                el.calendarSidebarSubtitle.textContent = selectionLabel;
            } else {
                const noMatchLabel = state.search.selectedSongs.length === 1
                    ? `No matches for "${state.search.selectedSongs[0]}"`
                    : 'No matches for selected songs';
                el.calendarSidebarSubtitle.textContent = noMatchLabel;
            }
        } else {
            if (allTotal) {
                const baseLabel = `${allTotal.toLocaleString()} play${allTotal === 1 ? '' : 's'} recorded`;
                el.calendarSidebarSubtitle.textContent = baseLabel;
            } else {
                el.calendarSidebarSubtitle.textContent = 'No plays recorded for this day.';
            }
        }

        if (!allTotal && !filteredTotal) {
            el.calendarSidebarStatus.innerHTML = '<p class="calendar-sidebar-placeholder">No plays recorded for this day.</p>';
            el.calendarSidebarList.innerHTML = '';
            return;
        }

        el.calendarSidebarStatus.innerHTML = '';
        el.calendarSidebarList.innerHTML = '';

        const buildSection = ({ title, count, description, items, emptyMessage }) => {
            const section = document.createElement('li');
            section.className = 'calendar-sidebar-section';

            const header = document.createElement('div');
            header.className = 'calendar-sidebar-section-header';

            const heading = document.createElement('div');
            heading.className = 'calendar-sidebar-section-title';
            heading.textContent = title;
            header.appendChild(heading);

            const metaParts = [];
            if (Number.isFinite(count)) {
                metaParts.push(`${count.toLocaleString()} play${count === 1 ? '' : 's'}`);
            }
            if (description) {
                metaParts.push(description);
            }
            if (metaParts.length) {
                const meta = document.createElement('div');
                meta.className = 'calendar-sidebar-section-meta';
                meta.textContent = metaParts.join(' · ');
                header.appendChild(meta);
            }

            section.appendChild(header);

            if (!items.length) {
                const placeholder = document.createElement('p');
                placeholder.className = 'calendar-sidebar-placeholder';
                placeholder.textContent = emptyMessage;
                section.appendChild(placeholder);
                return section;
            }

            const sessions = groupItemsBySession(items);
            sessions.forEach((group) => {
                const wrapper = document.createElement('div');
                wrapper.className = `calendar-session-group session-group ${getSessionColorClass(group.sessionId)}`;

                const bounds = getSessionBounds(group.items);
                const startTime = bounds.start ? formatTime(bounds.start) : '';
                const endTime = bounds.end ? formatTime(bounds.end) : '';

                const sessionHeader = document.createElement('div');
                sessionHeader.className = 'session-group-header';

                const titleEl = document.createElement('div');
                titleEl.className = 'session-group-title';
                if (startTime) {
                    titleEl.textContent = endTime && endTime !== startTime ? `${startTime} – ${endTime}` : startTime;
                } else {
                    titleEl.textContent = 'Session';
                }
                sessionHeader.appendChild(titleEl);

                const meta = document.createElement('div');
                meta.className = 'session-group-meta';
                meta.textContent = `${group.items.length.toLocaleString()} play${group.items.length === 1 ? '' : 's'}`;
                sessionHeader.appendChild(meta);

                wrapper.appendChild(sessionHeader);

                const tracks = document.createElement('div');
                tracks.className = 'session-group-tracks';
                group.items.forEach((item) => {
                    tracks.appendChild(createCalendarSidebarItem(item));
                });
                wrapper.appendChild(tracks);

                section.appendChild(wrapper);
            });

            return section;
        };

        const fragment = document.createDocumentFragment();
        if (hasFilter) {
            fragment.appendChild(buildSection({
                title: 'Matches',
                count: filteredTotal,
                description: state.search.selectedSongs.length === 1
                    ? `Filtered by "${state.search.selectedSongs[0]}"`
                    : `Filtered by ${state.search.selectedSongs.length} selected songs`,
                items: filteredItems,
                emptyMessage: 'No matches for the selected songs on this day.',
            }));
        }

        fragment.appendChild(buildSection({
            title: hasFilter ? 'Entire Day' : 'All Plays',
            count: allTotal,
            description: hasFilter ? 'Full play history' : '',
            items: allItems,
            emptyMessage: 'No plays recorded for this day.',
        }));

        el.calendarSidebarList.appendChild(fragment);
    }

    function clearCalendarDaySelection({ message = '' } = {}) {
        const dayState = state.calendar.day;
        dayState.date = null;
        dayState.filteredItems = [];
        dayState.filteredTotal = 0;
        dayState.allItems = [];
        dayState.allTotal = 0;
        dayState.isLoading = false;
        dayState.error = null;
        dayState.requestId = 0;
        dayState.statusMessage = message;
        highlightSelectedCalendarDay();
        renderCalendarSidebar();
    }

    function handleCalendarDaySelection(date) {
        if (!date) {
            return;
        }
        state.calendar.day.statusMessage = '';
        state.calendar.day.date = date;
        highlightSelectedCalendarDay();
        loadCalendarDay(date);
    }

    async function loadCalendarDay(date, { silent = false } = {}) {
        if (!date) {
            return;
        }
        const dayState = state.calendar.day;
        const requestId = Date.now();
        dayState.requestId = requestId;
        dayState.date = date;
        dayState.error = null;
        dayState.statusMessage = '';
        dayState.isLoading = true;
        if (!silent) {
            dayState.filteredItems = [];
            dayState.filteredTotal = 0;
            dayState.allItems = [];
            dayState.allTotal = 0;
        }
        renderCalendarSidebar();

        try {
            const params = new URLSearchParams({ date });
            if (state.search.selectedSongs.length) {
                params.set('songs', state.search.selectedSongs.join(','));
            }
            const requestTimeZone = state.calendar.timeZone || CLIENT_TIMEZONE;
            if (requestTimeZone) {
                params.set('tz', requestTimeZone);
            }
            const data = await rawFetch(`/api/activity/day?${params.toString()}`);
            if (dayState.requestId !== requestId) {
                return;
            }
            const filtered = data.filtered || {};
            const all = data.all || {};
            state.calendar.timeZone = data.timeZone || requestTimeZone;
            dayState.filteredItems = Array.isArray(filtered.items) ? filtered.items : [];
            dayState.filteredTotal = Number.isFinite(filtered.total) ? filtered.total : dayState.filteredItems.length;
            dayState.allItems = Array.isArray(all.items) ? all.items : [];
            dayState.allTotal = Number.isFinite(all.total) ? all.total : dayState.allItems.length;
            dayState.isLoading = false;
            dayState.error = null;
            renderCalendarSidebar();
        } catch (error) {
            if (dayState.requestId !== requestId) {
                return;
            }
            dayState.filteredItems = [];
            dayState.filteredTotal = 0;
            dayState.allItems = [];
            dayState.allTotal = 0;
            dayState.isLoading = false;
            dayState.error = error.message;
            renderCalendarSidebar();
        }
    }

    async function loadSessions({ force = false } = {}) {
        if (state.sessions.loaded && !force) {
            return;
        }
        el.sessionsContainer.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Loading listening sessions...</p></div>';
        try {
            const data = await rawFetch('/api/activity/sessions?limit=50');
            state.sessions.items = data.items || [];
            state.sessions.total = data.total || state.sessions.items.length;
            state.sessions.loaded = true;
            renderSessions();
        } catch (error) {
            el.sessionsContainer.innerHTML = '<p class="error-text">Unable to load sessions.</p>';
            showPopup('error', `Unable to load sessions: ${error.message}`);
        }
    }

    function renderSessions() {
        el.sessionsContainer.innerHTML = '';
        if (!state.sessions.items.length) {
            el.sessionsContainer.innerHTML = '<p class="empty-state">No sessions detected yet.</p>';
            el.sessionCount.textContent = '0 Sessions';
            return;
        }
        const fragment = document.createDocumentFragment();
        state.sessions.items.forEach((session, index) => {
            const card = document.createElement('article');
            card.className = 'session-card';
            const header = document.createElement('div');
            header.className = 'session-header';
            const info = document.createElement('div');
            info.className = 'session-info';
            info.innerHTML = `<h3>Session ${state.sessions.total - index}</h3>
                <div class="session-meta">
                    <span>${formatDateTime(session.start)}</span>
                    <span>${formatDateTime(session.end)}</span>
                    <span>${formatDuration(session.durationMinutes)}</span>
                </div>`;
            header.appendChild(info);
            const mood = document.createElement('div');
            mood.className = 'session-mood-indicator session-mood-neutral';
            mood.textContent = `${session.trackCount} tracks`;
            header.appendChild(mood);
            card.appendChild(header);

            const list = document.createElement('div');
            list.className = 'session-songs';
            const tracksToShow = session.tracks.slice(0, 12);
            tracksToShow.forEach((track) => {
                const item = document.createElement('div');
                item.className = 'session-song';
                const cover = document.createElement('img');
                cover.className = 'session-song-cover';
                cover.src = track.imageUrl || '';
                cover.alt = track.song || 'Track cover';
                cover.addEventListener('error', () => {
                    cover.classList.add('session-song-cover-placeholder');
                    cover.src = '';
                });
                const text = document.createElement('div');
                text.className = 'session-song-info';
                text.innerHTML = `<div class="session-song-title">${track.song || 'Unknown song'}</div>
                    <div class="session-song-artist">${track.artist || 'Unknown artist'}</div>`;
                item.appendChild(cover);
                item.appendChild(text);
                list.appendChild(item);
            });
            card.appendChild(list);
            if (session.tracks.length > tracksToShow.length) {
                const more = document.createElement('div');
                more.className = 'session-toggle';
                const btn = document.createElement('button');
                btn.className = 'session-toggle-btn';
                btn.innerHTML = `<i class="fas fa-list"></i> View all ${session.tracks.length} tracks`;
                btn.addEventListener('click', () => {
                    list.innerHTML = '';
                    session.tracks.forEach((track) => {
                        const item = document.createElement('div');
                        item.className = 'session-song';
                        const cover = document.createElement('img');
                        cover.className = 'session-song-cover';
                        cover.src = track.imageUrl || '';
                        cover.alt = track.song || 'Track cover';
                        cover.addEventListener('error', () => {
                            cover.classList.add('session-song-cover-placeholder');
                            cover.src = '';
                        });
                        const text = document.createElement('div');
                        text.className = 'session-song-info';
                        text.innerHTML = `<div class="session-song-title">${track.song || 'Unknown song'}</div>
                            <div class="session-song-artist">${track.artist || 'Unknown artist'}</div>`;
                        item.appendChild(cover);
                        item.appendChild(text);
                        list.appendChild(item);
                    });
                    btn.remove();
                });
                more.appendChild(btn);
                card.appendChild(more);
            }
            fragment.appendChild(card);
        });
        el.sessionsContainer.appendChild(fragment);
        el.sessionCount.textContent = `${state.sessions.total.toLocaleString()} Sessions`;
    }

    async function runRefreshSequence({ forceSessions = false } = {}) {
        if (refreshPromise) {
            return refreshPromise;
        }
        refreshPromise = (async () => {
            try {
                await loadSummary();
                await loadRecent({ reset: true });
                await executeSearch();
                await loadSessions({ force: forceSessions });
            } finally {
                refreshPromise = null;
            }
        })();
        return refreshPromise;
    }

    function updateJsonMeta(filename, size) {
        el.jsonFileName.textContent = filename === 'activity' ? 'Activity Log' : 'Diary Log';
        el.jsonSizeMeta.textContent = formatBytes(size || 0);
    }

    function updateJsonStats() {
        const content = el.jsonEditor.value;
        const lines = content.split('\n');
        el.jsonLines.textContent = lines.length.toLocaleString();
        el.jsonChars.textContent = content.length.toLocaleString();
        const byteSize = new Blob([content]).size;
        el.jsonSizeStats.textContent = formatBytes(byteSize);
        renderLineNumbers(lines.length);
    }

    function renderLineNumbers(count) {
        const numbers = [];
        for (let i = 1; i <= count; i += 1) {
            numbers.push(i);
        }
        el.jsonLineNumbers.textContent = numbers.join('\n');
    }

    async function loadJsonEditor() {
        el.jsonStatus.textContent = 'Loading...';
        try {
            const file = state.jsonEditor.activeFile;
            const data = await rawFetch(`/api/json?file=${file}`);
            el.jsonEditor.value = data.content || '';
            state.jsonEditor.original = data.content || '';
            state.jsonEditor.isDirty = false;
            state.jsonEditor.loadedOnce = true;
            updateJsonMeta(file, data.size || 0);
            updateJsonStats();
            el.jsonStatus.textContent = '✓ Ready';
        } catch (error) {
            el.jsonStatus.textContent = '⚠️ Unable to load file';
            showPopup('error', `Unable to load JSON: ${error.message}`);
        }
    }

    function formatJsonContent() {
        try {
            const parsed = JSON.parse(el.jsonEditor.value);
            el.jsonEditor.value = JSON.stringify(parsed, null, 2);
            updateJsonStats();
            el.jsonStatus.textContent = '✓ Formatted';
        } catch (error) {
            el.jsonStatus.textContent = '⚠️ Invalid JSON';
            showPopup('error', `Cannot format invalid JSON: ${error.message}`);
        }
    }

    function validateJsonContent() {
        try {
            JSON.parse(el.jsonEditor.value);
            el.jsonStatus.textContent = '✓ JSON is valid';
            showPopup('success', 'JSON is valid');
        } catch (error) {
            el.jsonStatus.textContent = '⚠️ Invalid JSON';
            showPopup('error', `JSON invalid: ${error.message}`);
        }
    }

    async function saveJsonContent() {
        const content = el.jsonEditor.value;
        try {
            JSON.parse(content);
        } catch (error) {
            el.jsonStatus.textContent = '⚠️ Invalid JSON';
            showPopup('error', 'Fix JSON errors before saving.');
            return;
        }
        try {
            await rawFetch('/api/json', {
                method: 'PUT',
                body: {
                    file: state.jsonEditor.activeFile,
                    content,
                },
            });
            el.jsonStatus.textContent = '✓ Saved';
            state.jsonEditor.original = content;
            if (state.jsonEditor.activeFile === 'activity') {
                await runRefreshSequence({ forceSessions: true });
            }
            showPopup('success', 'Changes saved successfully');
        } catch (error) {
            el.jsonStatus.textContent = '⚠️ Save failed';
            showPopup('error', `Unable to save: ${error.message}`);
        }
    }

    function attachEventListeners() {
        if (el.loginForm) {
            el.loginForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                clearLoginError();
                const password = el.passwordInput.value.trim();
                if (!password && state.token !== 'dev-no-auth') {
                    showLoginError('Password required');
                    return;
                }
                try {
                    const token = await login(password);
                    storeToken(token);
                    setLoginVisible(false);
                    await bootstrapAfterLogin();
                } catch (error) {
                    showLoginError('Invalid password, please try again.');
                }
            });
        }

        el.refreshRecentBtn.addEventListener('click', () => {
            loadRecent({ reset: true });
        });

        el.recentLoadMore.addEventListener('click', () => {
            loadRecent();
        });

        el.searchAddBtn.addEventListener('click', () => {
            addSongsFromInput();
        });

        el.searchClearBtn.addEventListener('click', () => {
            state.search.selectedSongs = [];
            state.search.terms = '';
            el.searchInput.value = '';
            renderSelectedSongs();
            executeSearch();
            clearSearchSuggestions();
        });

        el.searchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                addSongsFromInput();
            }
        });

        el.searchInput.addEventListener('input', handleSearchInputChange);

        if (el.searchSuggestions) {
            el.searchSuggestions.addEventListener('mousedown', handleSuggestionContainerClick);
        }

        document.addEventListener('click', handleSuggestionOutsideClick);

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeSidebar();
            }
        });

        el.calendarMonths.addEventListener('change', () => {
            state.calendar.months = Number(el.calendarMonths.value);
            loadCalendar();
        });

        if (el.calendarSidebarClose) {
            el.calendarSidebarClose.addEventListener('click', () => {
                if (el.calendarSidebarClose.disabled) {
                    return;
                }
                clearCalendarDaySelection();
            });
        }

        el.jsonFileSelect.addEventListener('change', () => {
            state.jsonEditor.activeFile = el.jsonFileSelect.value;
            loadJsonEditor();
        });
        el.jsonLoadBtn.addEventListener('click', () => loadJsonEditor());
        el.jsonFormatBtn.addEventListener('click', () => formatJsonContent());
        el.jsonValidateBtn.addEventListener('click', () => validateJsonContent());
        el.jsonSaveBtn.addEventListener('click', () => saveJsonContent());
        el.jsonEditor.addEventListener('input', () => {
            state.jsonEditor.isDirty = el.jsonEditor.value !== state.jsonEditor.original;
            updateJsonStats();
        });

        el.navItems.forEach((item) => {
            item.addEventListener('click', () => {
                const tab = item.dataset.tab;
                setActiveTab(tab);
                if (isMobileViewport()) {
                    closeSidebar();
                }
            });
        });

        if (!viewportListenerAttached) {
            const listener = () => handleViewportChange();
            if (mobileMediaQuery) {
                if (typeof mobileMediaQuery.addEventListener === 'function') {
                    mobileMediaQuery.addEventListener('change', listener);
                } else if (typeof mobileMediaQuery.addListener === 'function') {
                    mobileMediaQuery.addListener(listener);
                }
            }
            window.addEventListener('resize', listener);
            viewportListenerAttached = true;
        }

        if (el.sidebarToggle) {
            el.sidebarToggle.addEventListener('click', () => {
                toggleSidebar();
            });
        }

        if (el.sidebarOverlay) {
            el.sidebarOverlay.addEventListener('click', () => {
                closeSidebar();
            });
        }

        if (el.sidebarClose) {
            el.sidebarClose.addEventListener('click', () => {
                closeSidebar();
            });
        }

        handleViewportChange();
    }

    function addSongsFromInput() {
        const rawValue = el.searchInput.value.trim();
        if (!rawValue) {
            return;
        }
        const entries = rawValue.split(',').map((item) => item.trim()).filter(Boolean);
        addSelectedSongs(entries);
    }

    function setActiveTab(tabId) {
        el.navItems.forEach((item) => {
            item.classList.toggle('active', item.dataset.tab === tabId);
        });
        el.tabPanes.forEach((pane) => {
            pane.classList.toggle('active', pane.id === `${tabId}-tab`);
        });
        if (tabId === 'sessions') {
            loadSessions();
        }
        if (tabId === 'json-editor') {
            if (!state.jsonEditor.loadedOnce) {
                loadJsonEditor();
                state.jsonEditor.loadedOnce = true;
            }
        }
    }

    async function bootstrapAfterLogin() {
        renderSelectedSongs();
        await runRefreshSequence({ forceSessions: true });
        await loadJsonEditor();
        startAutoRefresh();
    }

    async function attemptAutoLogin() {
        const stored = localStorage.getItem('dashboardToken');
        if (!stored) {
            setLoginVisible(true);
            return;
        }
        storeToken(stored);
        try {
            setLoginVisible(false);
            await bootstrapAfterLogin();
        } catch (error) {
            storeToken(null);
            setLoginVisible(true);
        }
    }

    const controller = {
        async refreshAll() {
            await runRefreshSequence({ forceSessions: true });
        },
        logout() {
            storeToken(null);
            state.recent = [];
            state.sessions = { items: [], total: 0, loaded: false };
            setLoginVisible(true);
            clearSearchSuggestions();
            stopAutoRefresh();
        },
        exportTimelineData() {
            if (!state.search.results.length) {
                showPopup('error', 'Run a search before exporting.');
                return;
            }
            const blob = new Blob([JSON.stringify(state.search.results, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = 'timeline-export.json';
            anchor.click();
            URL.revokeObjectURL(url);
        },
        resetTimelineView() {
            state.search.selectedSongs = [];
            state.search.terms = '';
            el.searchInput.value = '';
            renderSelectedSongs();
            executeSearch();
        },
    };

    window.refreshData = () => controller.refreshAll();
    window.logout = () => controller.logout();
    window.dashboard = {
        exportTimelineData: () => controller.exportTimelineData(),
        resetTimelineView: () => controller.resetTimelineView(),
    };
    window.showNewEntryModal = window.showNewEntryModal || (() => showPopup('error', 'Diary editing is not yet configured.'));
    window.closeDiaryModal = window.closeDiaryModal || (() => {});

    function init() {
        attachEventListeners();
        renderCalendarSidebar();
        attemptAutoLogin();
    }

    init();
    window.addEventListener('beforeunload', () => {
        stopAutoRefresh();
    });
})();
