// Timeline Component for Spotify Dashboard - Performance Monitoring Style
class TimelineComponent {
    constructor(container, options = {}) {
        this.container = container;
        this.data = [];
        this.filteredData = [];
        this.currentRange = { start: null, end: null };
        this.zoomStack = [];
        this.selectedSections = [];
        this.sampleRate = 'auto'; // auto, hour, day, week, month
        this.viewMode = 'activity'; // Initialize viewMode
        
        // Configuration
        this.options = {
            height: options.height || 400,
            margin: { top: 20, right: 60, bottom: 80, left: 80 },
            colors: {
                primary: '#1db954',
                secondary: '#1ed760',
                background: '#191414',
                grid: '#2a2a2a',
                text: '#ffffff',
                muted: '#b3b3b3',
                mood: {
                    energetic: '#ff4757',
                    sad: '#3742fa',
                    love: '#ff6b81',
                    chill: '#2ed573',
                    breakup: '#8c7ae6',
                    angry: '#ff3838',
                    nostalgic: '#ffa502',
                    confident: '#ff6348',
                    melodic: '#48CAE4',
                    experimental: '#9c88ff',
                    neutral: '#747d8c'
                }
            },
            ...options
        };

        this.init();
    }

    init() {
        this.setupDOM();
        this.setupEventListeners();
        this.render();
    }

    setupDOM() {
        this.container.innerHTML = `
            <div class="timeline-component">
                <div class="timeline-controls">
                    <div class="timeline-controls-left">
                        <div class="timeline-sample-controls">
                            <label>Sample Rate:</label>
                            <select id="timeline-sample-rate" class="timeline-select">
                                <option value="auto">Auto</option>
                                <option value="minute">Per Minute</option>
                                <option value="hour">Per Hour</option>
                                <option value="day">Per Day</option>
                                <option value="week">Per Week</option>
                                <option value="month">Per Month</option>
                            </select>
                        </div>
                        <div class="timeline-view-controls">
                            <label>View Mode:</label>
                            <select id="timeline-view-mode" class="timeline-select">
                                <option value="activity">Activity Volume</option>
                                <option value="mood">Mood Distribution</option>
                                <option value="artists">Artist Activity</option>
                                <option value="sessions">Session Analysis</option>
                            </select>
                        </div>
                        <div class="timeline-range-controls">
                            <label>Time Range:</label>
                            <select id="timeline-time-range" class="timeline-select">
                                <option value="12h">Last 12 Hours</option>
                                <option value="24h">Last 24 Hours</option>
                                <option value="3d">Last 3 Days</option>
                                <option value="1w">Last Week</option>
                                <option value="1m">Last Month</option>
                                <option value="3m">Last 3 Months</option>
                                <option value="1y">Last Year</option>
                                <option value="all">All Time</option>
                            </select>
                        </div>
                    </div>
                    <div class="timeline-controls-right">
                        <button id="timeline-zoom-out" class="timeline-btn" title="Zoom Out">
                            <i class="fas fa-search-minus"></i>
                        </button>
                        <button id="timeline-reset-zoom" class="timeline-btn" title="Reset Zoom">
                            <i class="fas fa-home"></i>
                        </button>
                        <button id="timeline-solo-selection" class="timeline-btn" title="Solo Selection">
                            <i class="fas fa-crop-alt"></i>
                        </button>
                        <button id="timeline-clear-selection" class="timeline-btn" title="Clear Selection">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="timeline-info">
                    <div class="timeline-range-info">
                        <span id="timeline-current-range">Full Range</span>
                        <span id="timeline-data-points" class="timeline-muted">0 points</span>
                    </div>
                    <div class="timeline-selection-info">
                        <span id="timeline-selection-range"></span>
                        <span id="timeline-selection-stats" class="timeline-muted"></span>
                    </div>
                </div>
                <div class="timeline-canvas-container">
                    <canvas id="timeline-canvas" class="timeline-canvas"></canvas>
                    <div class="timeline-overlay" id="timeline-overlay">
                        <div class="timeline-tooltip" id="timeline-tooltip"></div>
                        <div class="timeline-crosshair" id="timeline-crosshair"></div>
                        <div class="timeline-selection-box" id="timeline-selection-box"></div>
                    </div>
                </div>
                <div class="timeline-legend" id="timeline-legend">
                    <!-- Dynamic legend content -->
                </div>
            </div>
        `;

        // Get canvas and context
        this.canvas = this.container.querySelector('#timeline-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.overlay = this.container.querySelector('#timeline-overlay');
        this.tooltip = this.container.querySelector('#timeline-tooltip');
        this.crosshair = this.container.querySelector('#timeline-crosshair');
        this.selectionBox = this.container.querySelector('#timeline-selection-box');
        
        this.setupCanvas();
    }

    setupCanvas() {
        const rect = this.container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = (rect.width - this.options.margin.left - this.options.margin.right) * dpr;
        this.canvas.height = this.options.height * dpr;
        
        this.canvas.style.width = `${rect.width - this.options.margin.left - this.options.margin.right}px`;
        this.canvas.style.height = `${this.options.height}px`;
        
        this.ctx.scale(dpr, dpr);
        
        this.canvasWidth = this.canvas.width / dpr;
        this.canvasHeight = this.canvas.height / dpr;
    }

    setupEventListeners() {
        // Sample rate change
        this.container.querySelector('#timeline-sample-rate').addEventListener('change', (e) => {
            this.sampleRate = e.target.value;
            this.processData();
            this.render();
        });

        // View mode change
        this.container.querySelector('#timeline-view-mode').addEventListener('change', (e) => {
            this.viewMode = e.target.value;
            this.render();
        });

        // Time range change
        this.container.querySelector('#timeline-time-range').addEventListener('change', (e) => {
            this.applyTimeRange(e.target.value);
        });

        // Zoom controls
        this.container.querySelector('#timeline-zoom-out').addEventListener('click', () => {
            this.zoomOut();
        });

        this.container.querySelector('#timeline-reset-zoom').addEventListener('click', () => {
            this.resetZoom();
        });

        this.container.querySelector('#timeline-solo-selection').addEventListener('click', () => {
            this.soloSelection();
        });

        this.container.querySelector('#timeline-clear-selection').addEventListener('click', () => {
            this.clearSelection();
        });

        // Canvas interactions
        this.setupCanvasEvents();

        // Window resize
        window.addEventListener('resize', () => {
            this.setupCanvas();
            this.render();
        });
    }

    setupCanvasEvents() {
        let isSelecting = false;
        let selectionStart = null;
        let isDragging = false;
        let dragStart = null;

        this.overlay.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            if (e.shiftKey) {
                // Start selection
                isSelecting = true;
                selectionStart = { x, y };
                this.selectionBox.style.display = 'block';
                this.selectionBox.style.left = `${x}px`;
                this.selectionBox.style.top = `${y}px`;
                this.selectionBox.style.width = '0px';
                this.selectionBox.style.height = '0px';
            } else {
                // Start dragging/panning
                isDragging = true;
                dragStart = { x, y };
                this.overlay.style.cursor = 'grabbing';
            }
        });

        this.overlay.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            if (isSelecting && selectionStart) {
                // Update selection box
                const width = Math.abs(x - selectionStart.x);
                const height = Math.abs(y - selectionStart.y);
                const left = Math.min(x, selectionStart.x);
                const top = Math.min(y, selectionStart.y);

                this.selectionBox.style.left = `${left}px`;
                this.selectionBox.style.top = `${top}px`;
                this.selectionBox.style.width = `${width}px`;
                this.selectionBox.style.height = `${height}px`;
            } else if (isDragging && dragStart) {
                // Pan the view
                const deltaX = x - dragStart.x;
                this.panView(deltaX);
                dragStart = { x, y };
            } else {
                // Update tooltip and crosshair
                this.updateTooltip(x, y);
                this.updateCrosshair(x, y);
            }
        });

        this.overlay.addEventListener('mouseup', (e) => {
            if (isSelecting) {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                if (selectionStart) {
                    this.handleSelection(selectionStart.x, selectionStart.y, x, y);
                }
                
                this.selectionBox.style.display = 'none';
                isSelecting = false;
                selectionStart = null;
            }

            if (isDragging) {
                isDragging = false;
                dragStart = null;
                this.overlay.style.cursor = 'crosshair';
            }
        });

        this.overlay.addEventListener('mouseleave', () => {
            this.tooltip.style.display = 'none';
            this.crosshair.style.display = 'none';
        });

        this.overlay.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoomAtPoint(x, zoomFactor);
        });

        // Double-click to zoom to selection
        this.overlay.addEventListener('dblclick', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            this.zoomAtPoint(x, 2);
        });
    }

    setData(data) {
        this.data = [...data];
        
        // Default to last 12 hours view
        this.applyTimeRange('12h');
    }

    applyTimeRange(range) {
        const now = new Date();
        let startTime;

        switch (range) {
            case '12h':
                startTime = new Date(now.getTime() - 12 * 60 * 60 * 1000);
                break;
            case '24h':
                startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '3d':
                startTime = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
                break;
            case '1w':
                startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '1m':
                startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '3m':
                startTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            case '1y':
                startTime = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                break;
            case 'all':
            default:
                this.currentRange = { start: null, end: null };
                this.processData();
                this.render();
                this.updateRangeSelector();
                return;
        }

        // Set the range and ensure we have data in this period
        const dataInRange = this.data.filter(item => {
            const timestamp = new Date(item.loggedAt);
            return timestamp >= startTime && timestamp <= now;
        });

        if (dataInRange.length === 0) {
            // If no data in the selected range, fall back to all available data
            console.warn(`No data found in the last ${range}, showing all available data`);
            this.currentRange = { start: null, end: null };
        } else {
            this.currentRange = { start: startTime, end: now };
        }

        this.processData();
        this.render();
        this.updateRangeSelector();
    }

    updateRangeSelector() {
        const selector = this.container.querySelector('#timeline-time-range');
        if (!this.currentRange.start) {
            selector.value = 'all';
        }
        // Keep the current selection - this method is mainly for programmatic updates
    }

    processData() {
        if (this.data.length === 0) {
            this.filteredData = [];
            return;
        }

        // Sort data by timestamp
        const sortedData = [...this.data].sort((a, b) => new Date(a.loggedAt) - new Date(b.loggedAt));
        
        // Apply current range filter
        let rangeFiltered = sortedData;
        if (this.currentRange.start && this.currentRange.end) {
            rangeFiltered = sortedData.filter(item => {
                const timestamp = new Date(item.loggedAt);
                return timestamp >= this.currentRange.start && timestamp <= this.currentRange.end;
            });
        }

        // Sample the data based on sample rate
        this.filteredData = this.sampleData(rangeFiltered);
        
        // Update info display
        this.updateInfo();
    }

    sampleData(data) {
        if (data.length === 0) return [];

        const timeRange = new Date(data[data.length - 1].loggedAt) - new Date(data[0].loggedAt);
        const autoSampleRate = this.getAutoSampleRate(timeRange, data.length);
        const effectiveRate = this.sampleRate === 'auto' ? autoSampleRate : this.sampleRate;

        return this.groupDataByRate(data, effectiveRate);
    }

    getAutoSampleRate(timeRange, dataLength) {
        const hours = timeRange / (1000 * 60 * 60);
        const pointsPerHour = dataLength / hours;

        // Adapt sampling based on time range and data density
        if (hours <= 12) {
            // For 12 hours or less, show more granular data
            return pointsPerHour > 5 ? 'hour' : 'minute';
        } else if (hours <= 24) {
            // For 24 hours, use hourly sampling
            return 'hour';
        } else if (hours <= 24 * 7) {
            // For up to a week, use hourly or daily
            return pointsPerHour > 2 ? 'day' : 'hour';
        } else if (hours <= 24 * 30) {
            // For up to a month, use daily sampling
            return 'day';
        } else if (hours <= 24 * 90) {
            // For up to 3 months, use weekly sampling
            return 'week';
        } else {
            // For longer periods, use monthly sampling
            return 'month';
        }
    }

    groupDataByRate(data, rate) {
        const grouped = new Map();

        data.forEach(item => {
            const timestamp = new Date(item.loggedAt);
            let key;

            switch (rate) {
                case 'minute':
                    key = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate(), 
                                 timestamp.getHours(), timestamp.getMinutes()).getTime();
                    break;
                case 'hour':
                    key = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate(), 
                                 timestamp.getHours()).getTime();
                    break;
                case 'day':
                    key = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate()).getTime();
                    break;
                case 'week':
                    const week = new Date(timestamp);
                    week.setDate(timestamp.getDate() - timestamp.getDay());
                    key = new Date(week.getFullYear(), week.getMonth(), week.getDate()).getTime();
                    break;
                case 'month':
                    key = new Date(timestamp.getFullYear(), timestamp.getMonth()).getTime();
                    break;
                default:
                    key = timestamp.getTime();
            }

            if (!grouped.has(key)) {
                grouped.set(key, {
                    timestamp: new Date(key),
                    items: [],
                    count: 0,
                    moods: {},
                    artists: {},
                    totalDuration: 0
                });
            }

            const group = grouped.get(key);
            group.items.push(item);
            group.count++;
            
            // Count moods
            const mood = item.moodType || 'neutral';
            group.moods[mood] = (group.moods[mood] || 0) + 1;
            
            // Count artists
            group.artists[item.artist] = (group.artists[item.artist] || 0) + 1;
        });

        return Array.from(grouped.values()).sort((a, b) => a.timestamp - b.timestamp);
    }

    render() {
        this.clearCanvas();
        
        if (this.filteredData.length === 0) {
            this.drawEmptyState();
            return;
        }

        this.calculateScales();
        this.drawGrid();
        this.drawData();
        this.drawAxes();
        this.updateLegend();
    }

    clearCanvas() {
        this.ctx.fillStyle = this.options.colors.background;
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    }

    calculateScales() {
        const padding = 20;
        
        this.xScale = {
            domain: [
                this.filteredData[0].timestamp,
                this.filteredData[this.filteredData.length - 1].timestamp
            ],
            range: [padding, this.canvasWidth - padding]
        };

        const maxValue = Math.max(...this.filteredData.map(d => d.count));
        this.yScale = {
            domain: [0, maxValue],
            range: [this.canvasHeight - padding, padding]
        };
    }

    drawGrid() {
        this.ctx.strokeStyle = this.options.colors.grid;
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([2, 2]);

        // Horizontal grid lines
        const yTicks = 5;
        for (let i = 0; i <= yTicks; i++) {
            const y = this.yScale.range[1] + (this.yScale.range[0] - this.yScale.range[1]) * (i / yTicks);
            this.ctx.beginPath();
            this.ctx.moveTo(this.xScale.range[0], y);
            this.ctx.lineTo(this.xScale.range[1], y);
            this.ctx.stroke();
        }

        // Vertical grid lines
        const xTicks = 8;
        for (let i = 0; i <= xTicks; i++) {
            const x = this.xScale.range[0] + (this.xScale.range[1] - this.xScale.range[0]) * (i / xTicks);
            this.ctx.beginPath();
            this.ctx.moveTo(x, this.yScale.range[0]);
            this.ctx.lineTo(x, this.yScale.range[1]);
            this.ctx.stroke();
        }

        this.ctx.setLineDash([]);
    }

    drawData() {
        switch (this.viewMode) {
            case 'activity':
                this.drawActivityView();
                break;
            case 'mood':
                this.drawMoodView();
                break;
            case 'artists':
                this.drawArtistsView();
                break;
            case 'sessions':
                this.drawSessionsView();
                break;
            default:
                this.drawActivityView();
        }
    }

    drawActivityView() {
        // Draw activity volume as bars
        this.ctx.fillStyle = this.options.colors.primary;
        
        const barWidth = Math.max(2, (this.xScale.range[1] - this.xScale.range[0]) / this.filteredData.length * 0.8);
        
        this.filteredData.forEach(point => {
            const x = this.scaleX(point.timestamp) - barWidth / 2;
            const y = this.scaleY(point.count);
            const height = this.yScale.range[0] - y;
            
            this.ctx.fillRect(x, y, barWidth, height);
        });

        // Draw trend line
        this.ctx.strokeStyle = this.options.colors.secondary;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        
        this.filteredData.forEach((point, index) => {
            const x = this.scaleX(point.timestamp);
            const y = this.scaleY(point.count);
            
            if (index === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        });
        
        this.ctx.stroke();
    }

    drawMoodView() {
        // Stacked bar chart for mood distribution
        const barWidth = Math.max(2, (this.xScale.range[1] - this.xScale.range[0]) / this.filteredData.length * 0.8);
        
        this.filteredData.forEach(point => {
            const x = this.scaleX(point.timestamp) - barWidth / 2;
            let currentY = this.yScale.range[0];
            
            Object.entries(point.moods).forEach(([mood, count]) => {
                const height = (count / point.count) * (this.yScale.range[0] - this.scaleY(point.count));
                currentY -= height;
                
                this.ctx.fillStyle = this.options.colors.mood[mood] || this.options.colors.mood.neutral;
                this.ctx.fillRect(x, currentY, barWidth, height);
            });
        });
    }

    drawArtistsView() {
        // Top artists as colored segments
        const barWidth = Math.max(2, (this.xScale.range[1] - this.xScale.range[0]) / this.filteredData.length * 0.8);
        const artistColors = this.generateArtistColors();
        
        this.filteredData.forEach(point => {
            const x = this.scaleX(point.timestamp) - barWidth / 2;
            let currentY = this.yScale.range[0];
            
            Object.entries(point.artists).forEach(([artist, count]) => {
                const height = (count / point.count) * (this.yScale.range[0] - this.scaleY(point.count));
                currentY -= height;
                
                this.ctx.fillStyle = artistColors[artist] || this.options.colors.muted;
                this.ctx.fillRect(x, currentY, barWidth, height);
            });
        });
    }

    drawSessionsView() {
        // Session analysis with intensity markers
        this.ctx.fillStyle = this.options.colors.primary;
        this.ctx.strokeStyle = this.options.colors.secondary;
        this.ctx.lineWidth = 1;
        
        const barWidth = Math.max(2, (this.xScale.range[1] - this.xScale.range[0]) / this.filteredData.length * 0.8);
        
        this.filteredData.forEach(point => {
            const x = this.scaleX(point.timestamp) - barWidth / 2;
            const y = this.scaleY(point.count);
            const height = this.yScale.range[0] - y;
            
            // Base activity
            this.ctx.fillRect(x, y, barWidth, height);
            
            // Session intensity overlay
            const intensity = this.calculateSessionIntensity(point);
            this.ctx.globalAlpha = intensity;
            this.ctx.fillStyle = this.options.colors.secondary;
            this.ctx.fillRect(x, y, barWidth, height);
            this.ctx.globalAlpha = 1;
        });
    }

    calculateSessionIntensity(point) {
        // Calculate session intensity based on mood diversity and activity
        const moodCount = Object.keys(point.moods).length;
        const maxIntensity = Math.min(point.count / 10, 1); // Cap at 10 songs for max intensity
        const diversityBonus = Math.min(moodCount / 5, 0.5); // Up to 50% bonus for diversity
        
        return Math.min(maxIntensity + diversityBonus, 1);
    }

    drawAxes() {
        this.ctx.fillStyle = this.options.colors.text;
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        
        // X-axis labels (time)
        const xTicks = 6;
        for (let i = 0; i <= xTicks; i++) {
            const ratio = i / xTicks;
            const timestamp = new Date(
                this.xScale.domain[0].getTime() + 
                (this.xScale.domain[1].getTime() - this.xScale.domain[0].getTime()) * ratio
            );
            const x = this.xScale.range[0] + (this.xScale.range[1] - this.xScale.range[0]) * ratio;
            
            this.ctx.fillText(this.formatAxisTime(timestamp), x, this.canvasHeight - 5);
        }
        
        // Y-axis labels (count)
        this.ctx.textAlign = 'right';
        const yTicks = 5;
        for (let i = 0; i <= yTicks; i++) {
            const value = (this.yScale.domain[1] - this.yScale.domain[0]) * (i / yTicks);
            const y = this.yScale.range[1] + (this.yScale.range[0] - this.yScale.range[1]) * (i / yTicks);
            
            this.ctx.fillText(Math.round(value).toString(), this.xScale.range[0] - 10, y + 4);
        }
    }

    scaleX(timestamp) {
        const ratio = (timestamp - this.xScale.domain[0]) / (this.xScale.domain[1] - this.xScale.domain[0]);
        return this.xScale.range[0] + ratio * (this.xScale.range[1] - this.xScale.range[0]);
    }

    scaleY(value) {
        const ratio = (value - this.yScale.domain[0]) / (this.yScale.domain[1] - this.yScale.domain[0]);
        return this.yScale.range[0] - ratio * (this.yScale.range[0] - this.yScale.range[1]);
    }

    updateTooltip(x, y) {
        const point = this.getDataPointAtX(x);
        if (!point) {
            this.tooltip.style.display = 'none';
            return;
        }

        const content = this.generateTooltipContent(point);
        this.tooltip.innerHTML = content;
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = `${x + 10}px`;
        this.tooltip.style.top = `${y - 10}px`;
    }

    updateCrosshair(x, y) {
        this.crosshair.style.display = 'block';
        this.crosshair.style.left = `${x}px`;
        this.crosshair.style.top = `${y}px`;
    }

    generateTooltipContent(point) {
        const time = this.formatTooltipTime(point.timestamp);
        let content = `<div class="tooltip-time">${time}</div>`;
        content += `<div class="tooltip-count">Songs: ${point.count}</div>`;
        
        if (Object.keys(point.moods).length > 0) {
            content += '<div class="tooltip-moods">';
            Object.entries(point.moods)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3)
                .forEach(([mood, count]) => {
                    content += `<span class="tooltip-mood mood-${mood}">${mood}: ${count}</span>`;
                });
            content += '</div>';
        }
        
        return content;
    }

    getDataPointAtX(x) {
        if (this.filteredData.length === 0) return null;
        
        const timestamp = this.unscaleX(x);
        
        // Find closest data point
        let closest = this.filteredData[0];
        let minDistance = Math.abs(timestamp - closest.timestamp);
        
        for (const point of this.filteredData) {
            const distance = Math.abs(timestamp - point.timestamp);
            if (distance < minDistance) {
                minDistance = distance;
                closest = point;
            }
        }
        
        return closest;
    }

    unscaleX(x) {
        const ratio = (x - this.xScale.range[0]) / (this.xScale.range[1] - this.xScale.range[0]);
        return new Date(this.xScale.domain[0].getTime() + ratio * (this.xScale.domain[1].getTime() - this.xScale.domain[0].getTime()));
    }

    handleSelection(x1, y1, x2, y2) {
        const startX = Math.min(x1, x2);
        const endX = Math.max(x1, x2);
        
        const startTime = this.unscaleX(startX);
        const endTime = this.unscaleX(endX);
        
        this.selectedSections.push({ start: startTime, end: endTime });
        this.updateSelectionInfo();
    }

    zoomAtPoint(x, factor) {
        const centerTime = this.unscaleX(x);
        const currentSpan = this.xScale.domain[1].getTime() - this.xScale.domain[0].getTime();
        const newSpan = currentSpan / factor;
        
        const newStart = new Date(centerTime.getTime() - newSpan * (centerTime.getTime() - this.xScale.domain[0].getTime()) / currentSpan);
        const newEnd = new Date(centerTime.getTime() + newSpan * (this.xScale.domain[1].getTime() - centerTime.getTime()) / currentSpan);
        
        this.zoomToRange(newStart, newEnd);
    }

    zoomToRange(start, end) {
        // Store current range for zoom stack
        this.zoomStack.push({
            start: new Date(this.currentRange.start || this.data[0]?.loggedAt),
            end: new Date(this.currentRange.end || this.data[this.data.length - 1]?.loggedAt)
        });
        
        this.currentRange = { start: new Date(start), end: new Date(end) };
        this.processData();
        this.render();
    }

    zoomOut() {
        if (this.zoomStack.length > 0) {
            const previousRange = this.zoomStack.pop();
            this.currentRange = previousRange;
            this.processData();
            this.render();
        }
    }

    resetZoom() {
        this.zoomStack = [];
        
        // Don't reset the time range - keep current preset selection
        const currentTimeRange = this.container.querySelector('#timeline-time-range').value;
        if (currentTimeRange !== 'all') {
            // Keep the current time range selection
            this.processData();
        } else {
            // Only reset to full data if "All Time" is selected
            this.currentRange = { start: null, end: null };
            this.processData();
        }
        
        this.render();
    }

    soloSelection() {
        if (this.selectedSections.length > 0) {
            const selection = this.selectedSections[this.selectedSections.length - 1];
            this.zoomToRange(selection.start, selection.end);
            this.clearSelection();
        }
    }

    clearSelection() {
        this.selectedSections = [];
        this.updateSelectionInfo();
    }

    panView(deltaX) {
        const timespan = this.xScale.domain[1].getTime() - this.xScale.domain[0].getTime();
        const timeDelta = (deltaX / (this.xScale.range[1] - this.xScale.range[0])) * timespan;
        
        const newStart = new Date(this.xScale.domain[0].getTime() - timeDelta);
        const newEnd = new Date(this.xScale.domain[1].getTime() - timeDelta);
        
        // Constrain to data bounds
        const dataStart = new Date(this.data[0]?.loggedAt);
        const dataEnd = new Date(this.data[this.data.length - 1]?.loggedAt);
        
        if (newStart >= dataStart && newEnd <= dataEnd) {
            this.currentRange = { start: newStart, end: newEnd };
            this.processData();
            this.render();
        }
    }

    updateInfo() {
        // Update range info
        const rangeEl = this.container.querySelector('#timeline-current-range');
        const pointsEl = this.container.querySelector('#timeline-data-points');
        const infoEl = this.container.querySelector('.timeline-info');
        
        if (this.currentRange.start && this.currentRange.end) {
            const rangeText = this.getTimeRangeDescription();
            rangeEl.textContent = rangeText;
            
            // Add visual indicator based on how recent the data is
            const now = new Date();
            const diffHours = (now.getTime() - this.currentRange.start.getTime()) / (1000 * 60 * 60);
            
            infoEl.classList.remove('recent-data', 'historical-data');
            if (diffHours <= 24) {
                infoEl.classList.add('recent-data');
            } else if (diffHours <= 24 * 7) {
                infoEl.classList.add('historical-data');
            }
        } else {
            rangeEl.textContent = 'Full Range (All Time)';
            infoEl.classList.remove('recent-data', 'historical-data');
        }
        
        const sampleRateText = this.sampleRate === 'auto' ? 'Auto-sampled' : `Per ${this.sampleRate}`;
        pointsEl.textContent = `${this.filteredData.length} points (${sampleRateText})`;
    }

    getTimeRangeDescription() {
        if (!this.currentRange.start || !this.currentRange.end) return 'All Time';
        
        const now = new Date();
        const diffMs = now.getTime() - this.currentRange.start.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        
        if (diffHours <= 12) {
            return 'Last 12 Hours';
        } else if (diffHours <= 24) {
            return 'Last 24 Hours';
        } else if (diffDays <= 3) {
            return 'Last 3 Days';
        } else if (diffDays <= 7) {
            return 'Last Week';
        } else if (diffDays <= 30) {
            return 'Last Month';
        } else if (diffDays <= 90) {
            return 'Last 3 Months';
        } else if (diffDays <= 365) {
            return 'Last Year';
        } else {
            return `${this.formatInfoTime(this.currentRange.start)} - ${this.formatInfoTime(this.currentRange.end)}`;
        }
    }

    updateSelectionInfo() {
        const selectionRangeEl = this.container.querySelector('#timeline-selection-range');
        const selectionStatsEl = this.container.querySelector('#timeline-selection-stats');
        
        if (this.selectedSections.length > 0) {
            const selection = this.selectedSections[this.selectedSections.length - 1];
            selectionRangeEl.textContent = `Selection: ${this.formatInfoTime(selection.start)} - ${this.formatInfoTime(selection.end)}`;
            
            // Calculate stats for selection
            const selectionData = this.data.filter(item => {
                const timestamp = new Date(item.loggedAt);
                return timestamp >= selection.start && timestamp <= selection.end;
            });
            
            selectionStatsEl.textContent = `${selectionData.length} songs selected`;
        } else {
            selectionRangeEl.textContent = '';
            selectionStatsEl.textContent = '';
        }
    }

    updateLegend() {
        const legend = this.container.querySelector('#timeline-legend');
        
        switch (this.viewMode) {
            case 'mood':
                this.renderMoodLegend(legend);
                break;
            case 'artists':
                this.renderArtistLegend(legend);
                break;
            default:
                legend.innerHTML = '';
        }
    }

    renderMoodLegend(legend) {
        const moods = new Set();
        this.filteredData.forEach(point => {
            Object.keys(point.moods).forEach(mood => moods.add(mood));
        });
        
        let html = '<div class="legend-title">Moods</div><div class="legend-items">';
        moods.forEach(mood => {
            html += `
                <div class="legend-item">
                    <div class="legend-color" style="background: ${this.options.colors.mood[mood]}"></div>
                    <span>${mood}</span>
                </div>
            `;
        });
        html += '</div>';
        
        legend.innerHTML = html;
    }

    generateArtistColors() {
        const artists = new Set();
        this.filteredData.forEach(point => {
            Object.keys(point.artists).forEach(artist => artists.add(artist));
        });
        
        const colors = {};
        const hueStep = 360 / artists.size;
        Array.from(artists).forEach((artist, index) => {
            colors[artist] = `hsl(${index * hueStep}, 70%, 60%)`;
        });
        
        return colors;
    }

    formatAxisTime(timestamp) {
        const now = new Date();
        const diffHours = (now - timestamp) / (1000 * 60 * 60);
        
        if (diffHours < 24) {
            return timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } else if (diffHours < 24 * 7) {
            return timestamp.toLocaleDateString('en-US', { weekday: 'short', hour: '2-digit' });
        } else {
            return timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    }

    formatTooltipTime(timestamp) {
        return timestamp.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatInfoTime(timestamp) {
        return timestamp.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    drawEmptyState() {
        this.ctx.fillStyle = this.options.colors.muted;
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        
        let message = 'No data available';
        if (this.currentRange.start && this.currentRange.end) {
            const rangeDesc = this.getTimeRangeDescription();
            message = `No data available for ${rangeDesc}`;
        }
        
        this.ctx.fillText(message, this.canvasWidth / 2, this.canvasHeight / 2 - 10);
        
        // Show suggestion
        this.ctx.font = '12px Arial';
        this.ctx.fillStyle = this.options.colors.text;
        this.ctx.fillText('Try selecting a different time range or check if data is being tracked', 
                         this.canvasWidth / 2, this.canvasHeight / 2 + 15);
    }

    // Public methods for external control
    refreshData(newData) {
        this.data = [...newData];
        
        // Preserve current time range selection
        const currentTimeRange = this.container.querySelector('#timeline-time-range').value;
        if (currentTimeRange && currentTimeRange !== 'all') {
            this.applyTimeRange(currentTimeRange);
        } else {
            this.processData();
            this.render();
        }
    }

    exportSelection() {
        if (this.selectedSections.length === 0) return null;
        
        const selection = this.selectedSections[this.selectedSections.length - 1];
        return this.data.filter(item => {
            const timestamp = new Date(item.loggedAt);
            return timestamp >= selection.start && timestamp <= selection.end;
        });
    }

    getVisibleData() {
        return this.filteredData;
    }

    getCurrentRange() {
        return { ...this.currentRange };
    }
}

// Export for use in main dashboard
window.TimelineComponent = TimelineComponent;
