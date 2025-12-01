const API_BASE = window.location.origin;

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
        
        console.log('='.repeat(80));
        console.log('✅ TOKEN DE SPOTIFY OBTENIDO');
        console.log('='.repeat(80));
        console.log(`SPOTIFY_USER_TOKEN=${token}`);
        console.log('='.repeat(80));
        
        fetch(`${API_BASE}/api/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        }).then(() => {
            showNotification('✅ Conectado con Spotify exitosamente', 'success');
        }).catch(err => {
            console.error('Error enviando token al backend:', err);
            showNotification('✅ Conectado, pero hubo un error guardando el token en el servidor.', 'error');
        });
        
        window.history.replaceState({}, document.title, window.location.pathname);
        updateConnectButton();
    } else if (auth === 'error') {
        const message = urlParams.get('message') || 'Error desconocido';
        showNotification(`❌ Error: ${message}`, 'error');
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
            btn.textContent = '✅ Connected';
            btn.style.opacity = '1';
        }
    } else {
        btn.textContent = 'Connect with Spotify';
        btn.style.opacity = '1';
    }
}

function createParticles() {
    const particlesContainer = document.getElementById('particles');
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 20 + 's';
        particle.style.animationDuration = (15 + Math.random() * 10) + 's';
        particlesContainer.appendChild(particle);
    }
}

// Sidebar Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const tabName = item.dataset.tab;
        
        // Update nav items
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
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
        
        tracksGrid.innerHTML = tracks.map(track => `
            <div class="track-card" onclick="showTrackDetail('${track.spotify_id}')">
                ${track.cover_url ? `<img src="${track.cover_url}" alt="${track.name}" class="track-cover">` : '<div class="track-cover"></div>'}
                <div class="track-name">${escapeHtml(track.name)}</div>
                <div class="track-artist">${escapeHtml(track.artists?.join(', ') || track.artist_main || '')}</div>
                <div class="track-info">
                    <span class="track-bpm">${track.bpm ? Math.round(track.bpm) + ' BPM' : '—'}</span>
                    ${track.preview_url ? `<button class="track-preview" onclick="event.stopPropagation(); playPreview('${track.preview_url}')">▶</button>` : '<span style="color: var(--text-secondary); font-size: 0.85rem;">Sin preview</span>'}
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading tracks:', error);
        tracksGrid.innerHTML = '<div class="loading">Error cargando canciones</div>';
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

// Play preview
function playPreview(url) {
    const audio = new Audio(url);
    audio.play().catch(err => {
        console.error('Error playing preview:', err);
        showNotification('Error reproduciendo preview', 'error');
    });
}

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
            <div class="artist-card" onclick="loadArtistTracks('${artist.name.replace(/'/g, "\\'")}')">
                <div class="artist-name">${escapeHtml(artist.name)}</div>
                <div class="artist-tracks">${artist.trackCount} ${artist.trackCount === 1 ? 'canción' : 'canciones'}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading artists:', error);
        artistsGrid.innerHTML = '<div class="empty-state"><div class="empty-state-title">Error cargando artistas</div><p>' + error.message + '</p></div>';
    }
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
        
        // Mini stats in sidebar
        document.getElementById('totalTracksMini').textContent = metrics.total_tracks || 0;
        document.getElementById('totalArtistsMini').textContent = Object.keys(metrics.tracks_by_artist || {}).length || 0;
        
        const tracksResponse = await fetch(`${API_BASE}/tracks`);
        const tracks = await tracksResponse.json();
        if (tracks.length > 0) {
            const lastUpdate = new Date(tracks[0].fetched_at);
            document.getElementById('lastUpdate').textContent = lastUpdate.toLocaleDateString('es-ES');
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Search functionality
document.getElementById('searchInput')?.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const trackCards = document.querySelectorAll('.track-card');
    
    trackCards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.classList.toggle('hidden', !text.includes(searchTerm));
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
            showNotification('✅ Sincronización iniciada. Esto puede tardar unos minutos...', 'success');
            
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
            showNotification(`❌ Error: ${errorData.error || 'Error al iniciar sincronización'}`, 'error');
        }
    } catch (error) {
        console.error('Error al sincronizar:', error);
        showNotification('❌ Error al iniciar sincronización', 'error');
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

// Load artist tracks
function loadArtistTracks(artistName) {
    document.querySelector('[data-tab="tracks"]').click();
    setTimeout(() => {
        document.getElementById('searchInput').value = artistName;
        document.getElementById('searchInput').dispatchEvent(new Event('input'));
    }, 100);
}

// Initialize
createParticles();
handleAuthCallback();
updateConnectButton();
loadStats();
loadTracks();
