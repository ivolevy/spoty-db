const API_BASE = window.location.origin;
let currentAudio = null;
let currentPlayingId = null;

// Manejar callback de autenticación de Spotify
function handleAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const auth = urlParams.get('auth');
    const token = urlParams.get('token');
    const refreshToken = urlParams.get('refresh_token');
    const expiresIn = urlParams.get('expires_in');
    
    if (auth === 'success' && token) {
        localStorage.setItem('spotify_user_token', token);
        if (refreshToken) {
            localStorage.setItem('spotify_refresh_token', refreshToken);
        }
        if (expiresIn) {
            const expiresAt = Date.now() + (parseInt(expiresIn) * 1000);
            localStorage.setItem('spotify_token_expires_at', expiresAt.toString());
        }
        
        fetch(`${API_BASE}/api/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        }).then(() => {
            showNotification('Conectado con Spotify exitosamente', 'success');
        }).catch(err => {
            console.error('Error enviando token al backend:', err);
        });
        
        window.history.replaceState({}, document.title, window.location.pathname);
        updateConnectButton();
    } else if (auth === 'error') {
        const message = urlParams.get('message') || 'Error desconocido';
        showNotification(`Error: ${message}`, 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#1db954' : type === 'error' ? '#e22134' : '#1a1a1a'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        max-width: 400px;
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

function updateConnectButton() {
    const btn = document.getElementById('connectSpotifyBtn');
    const token = localStorage.getItem('spotify_user_token');
    const expiresAt = localStorage.getItem('spotify_token_expires_at');
    
    if (token && expiresAt) {
        const isExpired = Date.now() > parseInt(expiresAt);
        if (isExpired) {
            btn.textContent = 'Connect with Spotify (Expirado)';
            btn.style.opacity = '0.7';
        } else {
            btn.textContent = 'Connected';
            btn.style.opacity = '1';
        }
    } else {
        btn.textContent = 'Connect with Spotify';
        btn.style.opacity = '1';
    }
}

// Sidebar Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const tabName = item.dataset.tab;
        
        // Update nav items
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        // Hide artist detail if showing
        document.getElementById('artistDetailTab').classList.remove('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');
        
        // Update page title
        const titles = {
            tracks: 'Canciones',
            artists: 'Artistas',
            metrics: 'Estadísticas'
        };
        document.getElementById('pageTitle').textContent = titles[tabName];
        
        // Load data if needed
        if (tabName === 'tracks') {
            loadTracks();
        } else if (tabName === 'artists') {
            loadArtists();
        } else if (tabName === 'metrics') {
            loadMetrics();
        }
    });
});

// Load tracks
async function loadTracks() {
    const tracksGrid = document.getElementById('tracksGrid');
    tracksGrid.innerHTML = '<div class="loading">Cargando canciones...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/tracks`);
        const tracks = await response.json();
        
        if (tracks.length === 0) {
            tracksGrid.innerHTML = '<div class="empty-state"><div class="empty-state-title">No hay canciones</div><p>Ejecuta la sincronización para cargar tracks</p></div>';
            return;
        }
        
        tracksGrid.innerHTML = tracks.map(track => {
            const durationMinutes = Math.floor(track.duration_ms / 60000);
            const durationSeconds = Math.floor((track.duration_ms % 60000) / 1000);
            const formattedDuration = `${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`;
            const isPlaying = currentPlayingId === track.spotify_id;
            
            return `
                <div class="track-item" onclick="showTrackDetail('${track.spotify_id}')">
                    ${track.cover_url ? `<img src="${track.cover_url}" alt="${track.name}" class="track-cover">` : '<div class="track-cover"></div>'}
                    <div class="track-info">
                        <div class="track-name">${escapeHtml(track.name)}</div>
                        <div class="track-artist">${escapeHtml(track.artists?.join(', ') || track.artist_main || '')}</div>
                    </div>
                    <div class="track-meta">
                        <span class="track-bpm">${track.bpm ? Math.round(track.bpm) + ' BPM' : '—'}</span>
                        ${track.preview_url ? `
                            <button class="track-preview-btn ${isPlaying ? 'playing' : ''}" onclick="event.stopPropagation(); togglePreview('${track.spotify_id}', '${track.preview_url}')">
                                ${isPlaying ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'}
                            </button>
                        ` : ''}
                        <span class="track-duration">${formattedDuration}</span>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading tracks:', error);
        tracksGrid.innerHTML = '<div class="loading">Error cargando canciones</div>';
    }
}

// Toggle preview
function togglePreview(trackId, previewUrl) {
    if (currentPlayingId === trackId && currentAudio && !currentAudio.paused) {
        // Pause current
        currentAudio.pause();
        currentAudio = null;
        currentPlayingId = null;
        loadTracks(); // Refresh to update button state
    } else {
        // Stop any other playing audio
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
        
        // Play new
        currentAudio = new Audio(previewUrl);
        currentPlayingId = trackId;
        
        currentAudio.addEventListener('ended', () => {
            currentAudio = null;
            currentPlayingId = null;
            loadTracks(); // Refresh to update button state
        });
        
        currentAudio.addEventListener('error', () => {
            showNotification('Error reproduciendo preview', 'error');
            currentAudio = null;
            currentPlayingId = null;
            loadTracks();
        });
        
        currentAudio.play().then(() => {
            loadTracks(); // Refresh to update button state
        }).catch(err => {
            console.error('Error playing preview:', err);
            showNotification('Error reproduciendo preview', 'error');
            currentAudio = null;
            currentPlayingId = null;
            loadTracks();
        });
    }
}

// Show track detail modal
async function showTrackDetail(spotifyId) {
    const modal = document.getElementById('trackModal');
    const modalBody = document.getElementById('modalBody');
    
    modalBody.innerHTML = '<div class="loading">Cargando detalles...</div>';
    modal.classList.add('active');
    
    try {
        const response = await fetch(`${API_BASE}/tracks/${spotifyId}`);
        if (!response.ok) {
            throw new Error('Track no encontrado');
        }
        const track = await response.json();
        
        const durationMinutes = Math.floor(track.duration_ms / 60000);
        const durationSeconds = Math.floor((track.duration_ms % 60000) / 1000);
        const formattedDuration = `${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`;
        
        const releaseDate = track.release_date ? new Date(track.release_date).toLocaleDateString('es-ES', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        }) : 'No disponible';
        
        modalBody.innerHTML = `
            <div class="track-detail-header">
                ${track.cover_url ? `<img src="${track.cover_url}" alt="${track.name}" class="track-detail-cover">` : '<div class="track-detail-cover"></div>'}
                <div class="track-detail-info">
                    <h2 class="track-detail-name">${escapeHtml(track.name)}</h2>
                    <div class="track-detail-artist">${escapeHtml(track.artists?.join(', ') || track.artist_main || '')}</div>
                    <div class="track-detail-meta">
                        <div class="track-detail-meta-item">
                            <span class="track-detail-meta-label">BPM</span>
                            <span class="track-detail-meta-value">${track.bpm ? Math.round(track.bpm) : 'N/A'}</span>
                        </div>
                        <div class="track-detail-meta-item">
                            <span class="track-detail-meta-label">Duración</span>
                            <span class="track-detail-meta-value">${formattedDuration}</span>
                        </div>
                        <div class="track-detail-meta-item">
                            <span class="track-detail-meta-label">Fecha de Lanzamiento</span>
                            <span class="track-detail-meta-value">${releaseDate}</span>
                        </div>
                        <div class="track-detail-meta-item">
                            <span class="track-detail-meta-label">Álbum</span>
                            <span class="track-detail-meta-value">${escapeHtml(track.album || 'N/A')}</span>
                        </div>
                    </div>
                    ${track.preview_url ? `
                        <div style="margin-top: 1.5rem;">
                            <audio controls class="track-detail-preview">
                                <source src="${track.preview_url}" type="audio/mpeg">
                            </audio>
                        </div>
                    ` : ''}
                </div>
            </div>
            ${track.genres && track.genres.length > 0 ? `
                <div class="track-detail-section">
                    <h3 class="track-detail-section-title">Géneros</h3>
                    <div class="track-detail-genres">
                        ${track.genres.map(genre => `<span class="track-detail-genre">${escapeHtml(genre)}</span>`).join('')}
                    </div>
                </div>
            ` : ''}
            <div class="track-detail-section">
                <h3 class="track-detail-section-title">Información Adicional</h3>
                <div class="track-detail-meta">
                    <div class="track-detail-meta-item">
                        <span class="track-detail-meta-label">Spotify ID</span>
                        <span class="track-detail-meta-value" style="font-size: 0.9rem; font-weight: 400;">${track.spotify_id}</span>
                    </div>
                    <div class="track-detail-meta-item">
                        <span class="track-detail-meta-label">Artista Principal</span>
                        <span class="track-detail-meta-value">${escapeHtml(track.artist_main || 'N/A')}</span>
                    </div>
                    <div class="track-detail-meta-item">
                        <span class="track-detail-meta-label">Última Actualización</span>
                        <span class="track-detail-meta-value" style="font-size: 0.9rem; font-weight: 400;">${track.fetched_at ? new Date(track.fetched_at).toLocaleString('es-ES') : 'N/A'}</span>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading track detail:', error);
        modalBody.innerHTML = '<div class="empty-state"><div class="empty-state-title">Error cargando detalles</div><p>' + error.message + '</p></div>';
    }
}

// Close modal
document.getElementById('closeModal')?.addEventListener('click', () => {
    document.getElementById('trackModal').classList.remove('active');
});

document.getElementById('trackModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'trackModal') {
        document.getElementById('trackModal').classList.remove('active');
    }
});

// Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load artists
async function loadArtists() {
    const artistsGrid = document.getElementById('artistsGrid');
    artistsGrid.innerHTML = '<div class="loading">Cargando artistas...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/artists`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const artists = await response.json();
        
        if (!Array.isArray(artists) || artists.length === 0) {
            artistsGrid.innerHTML = '<div class="empty-state"><div class="empty-state-title">No hay artistas</div><p>Ejecuta la sincronización para cargar artistas</p></div>';
            return;
        }
        
        const artistsWithTracks = await Promise.all(
            artists.map(async (artist) => {
                try {
                    if (!artist || !artist.name) {
                        return null;
                    }
                    const tracksResponse = await fetch(`${API_BASE}/artists/${encodeURIComponent(artist.name)}/tracks`);
                    if (!tracksResponse.ok) {
                        console.warn(`Error obteniendo tracks de ${artist.name}:`, tracksResponse.status);
                        return { ...artist, trackCount: 0 };
                    }
                    const tracks = await tracksResponse.json();
                    return { ...artist, trackCount: Array.isArray(tracks) ? tracks.length : 0 };
                } catch (err) {
                    console.error(`Error cargando tracks de ${artist.name}:`, err);
                    return { ...artist, trackCount: 0 };
                }
            })
        );
        
        const validArtists = artistsWithTracks.filter(a => a !== null);
        
        if (validArtists.length === 0) {
            artistsGrid.innerHTML = '<div class="empty-state"><div class="empty-state-title">No hay artistas</div><p>Ejecuta la sincronización para cargar artistas</p></div>';
            return;
        }
        
        artistsGrid.innerHTML = validArtists.map(artist => `
            <div class="artist-item" onclick="showArtistDetail('${escapeHtml(artist.name).replace(/'/g, "\\'")}')">
                <div class="artist-name">${escapeHtml(artist.name)}</div>
                <div class="artist-tracks-count">${artist.trackCount} ${artist.trackCount === 1 ? 'canción' : 'canciones'}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading artists:', error);
        artistsGrid.innerHTML = '<div class="empty-state"><div class="empty-state-title">Error cargando artistas</div><p>' + error.message + '</p></div>';
    }
}

// Show artist detail
async function showArtistDetail(artistName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    // Show artist detail tab
    document.getElementById('artistDetailTab').classList.add('active');
    document.getElementById('pageTitle').textContent = artistName;
    
    const artistDetail = document.getElementById('artistDetail');
    artistDetail.innerHTML = '<div class="loading">Cargando artista...</div>';
    
    try {
        const tracksResponse = await fetch(`${API_BASE}/artists/${encodeURIComponent(artistName)}/tracks`);
        if (!tracksResponse.ok) {
            throw new Error('Artista no encontrado');
        }
        const tracks = await tracksResponse.json();
        
        if (!Array.isArray(tracks) || tracks.length === 0) {
            artistDetail.innerHTML = `
                <div class="artist-detail-header">
                    <h2 class="artist-detail-name">${escapeHtml(artistName)}</h2>
                    <div class="artist-detail-info">No hay canciones disponibles</div>
                </div>
            `;
            return;
        }
        
        artistDetail.innerHTML = `
            <div class="artist-detail-header">
                <h2 class="artist-detail-name">${escapeHtml(artistName)}</h2>
                <div class="artist-detail-info">${tracks.length} ${tracks.length === 1 ? 'canción' : 'canciones'}</div>
            </div>
            <div class="artist-tracks-list">
                ${tracks.map(track => {
                    const durationMinutes = Math.floor(track.duration_ms / 60000);
                    const durationSeconds = Math.floor((track.duration_ms % 60000) / 1000);
                    const formattedDuration = `${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`;
                    const isPlaying = currentPlayingId === track.spotify_id;
                    
                    return `
                        <div class="track-item" onclick="showTrackDetail('${track.spotify_id}')">
                            ${track.cover_url ? `<img src="${track.cover_url}" alt="${track.name}" class="track-cover">` : '<div class="track-cover"></div>'}
                            <div class="track-info">
                                <div class="track-name">${escapeHtml(track.name)}</div>
                                <div class="track-artist">${escapeHtml(track.album || '')}</div>
                            </div>
                            <div class="track-meta">
                                <span class="track-bpm">${track.bpm ? Math.round(track.bpm) + ' BPM' : '—'}</span>
                                ${track.preview_url ? `
                                    <button class="track-preview-btn ${isPlaying ? 'playing' : ''}" onclick="event.stopPropagation(); togglePreview('${track.spotify_id}', '${track.preview_url}')">
                                        ${isPlaying ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'}
                                    </button>
                                ` : ''}
                                <span class="track-duration">${formattedDuration}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } catch (error) {
        console.error('Error loading artist detail:', error);
        artistDetail.innerHTML = '<div class="empty-state"><div class="empty-state-title">Error cargando artista</div><p>' + error.message + '</p></div>';
    }
}

// Go back to artists
function goBackToArtists() {
    document.getElementById('artistDetailTab').classList.remove('active');
    document.querySelector('[data-tab="artists"]').click();
}

// Load metrics
async function loadMetrics() {
    const metricsContainer = document.getElementById('metricsContainer');
    metricsContainer.innerHTML = '<div class="loading">Cargando métricas...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/metrics/global`);
        const metrics = await response.json();
        
        let html = `
            <div class="metric-section">
                <div class="metric-title">Géneros</div>
                <div class="genre-list">
                    ${Object.entries(metrics.genre_distribution || {})
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 10)
                        .map(([genre, count]) => `
                            <div class="genre-tag">${escapeHtml(genre)} (${count})</div>
                        `).join('')}
                </div>
            </div>
        `;
        
        if (metrics.avg_bpm_by_artist && Object.keys(metrics.avg_bpm_by_artist).length > 0) {
            html += `
                <div class="metric-section">
                    <div class="metric-title">BPM Promedio por Artista</div>
                    <div class="bpm-list">
                        ${Object.entries(metrics.avg_bpm_by_artist)
                            .map(([artist, bpm]) => `
                                <div class="bpm-item">
                                    <span class="bpm-artist">${escapeHtml(artist)}</span>
                                    <span class="bpm-value">${Math.round(bpm)} BPM</span>
                                </div>
                            `).join('')}
                    </div>
                </div>
            `;
        }
        
        metricsContainer.innerHTML = html;
    } catch (error) {
        console.error('Error loading metrics:', error);
        metricsContainer.innerHTML = '<div class="loading">Error cargando métricas</div>';
    }
}

// Load global stats
async function loadStats() {
    try {
        const metricsResponse = await fetch(`${API_BASE}/metrics/global`);
        const metrics = await metricsResponse.json();
        
        document.getElementById('totalTracks').textContent = metrics.total_tracks || 0;
        document.getElementById('totalArtists').textContent = Object.keys(metrics.tracks_by_artist || {}).length || 0;
        document.getElementById('avgBpm').textContent = metrics.bpm_average ? Math.round(metrics.bpm_average) + ' BPM' : 'N/A';
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Search functionality
document.getElementById('searchInput')?.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const trackItems = document.querySelectorAll('.track-item');
    
    trackItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.classList.toggle('hidden', !text.includes(searchTerm));
    });
});

// Sync button
document.getElementById('syncBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('syncBtn');
    btn.disabled = true;
    btn.textContent = 'Sincronizando...';
    
    try {
        const tokenStatus = await fetch(`${API_BASE}/api/token/status`);
        const status = await tokenStatus.json();
        
        if (!status.hasToken) {
            const proceed = confirm('No hay token de usuario configurado. Sin él, no se podrá obtener BPM. ¿Deseas continuar de todas formas?');
            if (!proceed) {
                btn.disabled = false;
                btn.textContent = 'Sincronizar';
                return;
            }
        }
        
        const response = await fetch(`${API_BASE}/api/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok || response.status === 202) {
            showNotification('Sincronización iniciada. Esto puede tardar unos minutos...', 'success');
            
            setTimeout(() => {
                loadStats();
                const activeNav = document.querySelector('.nav-item.active');
                if (activeNav?.dataset.tab === 'tracks') {
                    loadTracks();
                } else if (activeNav?.dataset.tab === 'artists') {
                    loadArtists();
                }
            }, 10000);
        } else {
            const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
            showNotification(`Error: ${errorData.error || 'Error al iniciar sincronización'}`, 'error');
        }
    } catch (error) {
        console.error('Error al sincronizar:', error);
        showNotification('Error al iniciar sincronización', 'error');
    } finally {
        setTimeout(() => {
            btn.disabled = false;
            btn.textContent = 'Sincronizar';
        }, 5000);
    }
});

// Connect Spotify button
document.getElementById('connectSpotifyBtn')?.addEventListener('click', () => {
    window.location.href = `${API_BASE}/api/auth/login`;
});

// Refresh button
document.getElementById('refreshBtn')?.addEventListener('click', () => {
    loadStats();
    const activeNav = document.querySelector('.nav-item.active');
    if (activeNav) {
        const tabName = activeNav.dataset.tab;
        if (tabName === 'tracks') {
            loadTracks();
        } else if (tabName === 'artists') {
            loadArtists();
        } else if (tabName === 'metrics') {
            loadMetrics();
        }
    }
});

// Initialize
handleAuthCallback();
updateConnectButton();
loadStats();
loadTracks();
