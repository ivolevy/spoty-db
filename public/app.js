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
        
        // No need to hide artist detail tab anymore (using modal)
        
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
            // Restaurar título original
            document.getElementById('pageTitle').textContent = 'Canciones';
            loadTracks();
            loadModuleMetrics('tracks');
        } else if (tabName === 'artists') {
            loadArtists();
            loadModuleMetrics('artists');
        } else if (tabName === 'metrics') {
            loadMetrics();
            loadModuleMetrics('metrics');
        }
    });
});

// Load tracks
async function loadTracks(genre = null) {
    const tracksGrid = document.getElementById('tracksGrid');
    tracksGrid.innerHTML = '<div class="loading">Cargando canciones...</div>';
    
    try {
        const url = genre ? `${API_BASE}/tracks?genre=${encodeURIComponent(genre)}` : `${API_BASE}/tracks`;
        const response = await fetch(url);
        const tracks = await response.json();
        
        if (tracks.length === 0) {
            const message = genre 
                ? `<div class="empty-state-title">No hay canciones del género "${escapeHtml(genre)}"</div><p>Intenta con otro género</p>`
                : '<div class="empty-state-title">No hay canciones</div><p>Ejecuta la sincronización para cargar tracks</p>';
            tracksGrid.innerHTML = `<div class="empty-state">${message}</div>`;
            return;
        }
        
        // Mostrar filtro activo si hay género
        let filterIndicator = '';
        if (genre) {
            filterIndicator = `
                <div class="genre-filter-indicator">
                    <span>Filtrando por: <strong>${escapeHtml(genre)}</strong></span>
                    <button onclick="loadTracks()" class="clear-filter-btn">Limpiar filtro</button>
                </div>
            `;
        }
        
        tracksGrid.innerHTML = filterIndicator + tracks.map(track => {
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

// Show tracks filtered by genre in modal
async function showGenreTracks(genre) {
    const modal = document.getElementById('trackModal');
    const modalBody = document.getElementById('modalBody');
    
    modalBody.innerHTML = '<div class="loading">Cargando canciones del género...</div>';
    modal.classList.add('active');
    
    try {
        const response = await fetch(`${API_BASE}/tracks?genre=${encodeURIComponent(genre)}`);
        if (!response.ok) {
            throw new Error('Error obteniendo tracks');
        }
        const genreTracks = await response.json();
        
        if (genreTracks.length === 0) {
            modalBody.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-title">No se encontraron canciones</div>
                    <p>No hay canciones disponibles para el género "${escapeHtml(genre)}".</p>
                </div>
            `;
            return;
        }
        
        modalBody.innerHTML = `
            <div class="genre-detail-header">
                <h2 class="genre-detail-name">Género: ${escapeHtml(genre)}</h2>
                <div class="genre-detail-meta">
                    <span>${genreTracks.length} ${genreTracks.length === 1 ? 'canción' : 'canciones'}</span>
                </div>
            </div>
            <div class="genre-search-container">
                <input type="text" id="genreSearchInput" class="genre-search-input" placeholder="Buscar canciones..." onkeyup="filterGenreTracks('${escapeHtml(genre).replace(/'/g, "\\'")}')">
            </div>
            <div class="genre-tracks-list" id="genreTracksList">
                ${renderGenreTracks(genreTracks)}
            </div>
        `;
        
        // Guardar las tracks originales para el filtro
        window.currentGenreTracks = genreTracks;
        window.currentGenre = genre;
    } catch (error) {
        console.error('Error loading genre tracks:', error);
        modalBody.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-title">Error</div>
                <p>No se pudieron cargar las canciones del género.</p>
            </div>
        `;
    }
}

// Render genre tracks
function renderGenreTracks(tracks) {
    return tracks.map((track, index) => {
        const durationMinutes = Math.floor(track.duration_ms / 60000);
        const durationSeconds = Math.floor((track.duration_ms % 60000) / 1000);
        const formattedDuration = `${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`;
        const isPlaying = currentPlayingId === track.spotify_id;
        
        return `
            <div class="genre-track-item" onclick="showTrackDetail('${track.spotify_id}')">
                ${track.cover_url ? `<img src="${track.cover_url}" alt="${escapeHtml(track.name)}" class="genre-track-cover">` : '<div class="genre-track-cover"></div>'}
                <div class="genre-track-info">
                    <div class="genre-track-name">${escapeHtml(track.name)}</div>
                    <div class="genre-track-artist">${escapeHtml(track.artists?.join(', ') || track.artist_main || '')}</div>
                </div>
                <div class="genre-track-meta">
                    ${track.preview_url ? `
                        <button class="genre-track-preview-btn ${isPlaying ? 'playing' : ''}" onclick="event.stopPropagation(); togglePreview('${track.spotify_id}', '${track.preview_url}')">
                            ${isPlaying ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'}
                        </button>
                    ` : ''}
                    <span class="genre-track-duration">${formattedDuration}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Filter genre tracks
function filterGenreTracks(genre) {
    const searchInput = document.getElementById('genreSearchInput');
    const searchTerm = searchInput.value.toLowerCase();
    const tracksList = document.getElementById('genreTracksList');
    
    if (!window.currentGenreTracks) return;
    
    const filteredTracks = window.currentGenreTracks.filter(track => {
        const trackName = (track.name || '').toLowerCase();
        const trackArtist = (track.artists?.join(', ') || track.artist_main || '').toLowerCase();
        return trackName.includes(searchTerm) || trackArtist.includes(searchTerm);
    });
    
    tracksList.innerHTML = renderGenreTracks(filteredTracks);
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

// Show album tracks modal
async function showAlbumTracks(albumName, artistName) {
    const modal = document.getElementById('trackModal');
    const modalBody = document.getElementById('modalBody');
    
    modalBody.innerHTML = '<div class="loading">Cargando canciones del álbum...</div>';
    modal.classList.add('active');
    
    try {
        // Obtener todas las canciones y filtrar por álbum
        const response = await fetch(`${API_BASE}/tracks`);
        if (!response.ok) {
            throw new Error('Error obteniendo tracks');
        }
        const allTracks = await response.json();
        
        // Filtrar por nombre de álbum y artista (si está disponible)
        const albumTracks = allTracks.filter((track) => {
            const trackAlbum = track.album || '';
            const trackArtist = track.artist_main || (track.artists && track.artists.length > 0 ? track.artists[0] : '');
            return trackAlbum.toLowerCase() === albumName.toLowerCase() && 
                   (artistName === '' || trackArtist.toLowerCase() === artistName.toLowerCase());
        });
        
        if (albumTracks.length === 0) {
            modalBody.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-title">No se encontraron canciones</div>
                    <p>No hay canciones disponibles para este álbum.</p>
                </div>
            `;
            return;
        }
        
        // Obtener la portada del primer track
        const coverUrl = albumTracks[0].cover_url || null;
        
        modalBody.innerHTML = `
            <div class="album-detail-header">
                ${coverUrl ? `<img src="${coverUrl}" alt="${escapeHtml(albumName)}" class="album-detail-cover">` : '<div class="album-detail-cover"></div>'}
                <div class="album-detail-info">
                    <h2 class="album-detail-name">${escapeHtml(albumName)}</h2>
                    <div class="album-detail-artist">${escapeHtml(artistName || '')}</div>
                    <div class="album-detail-meta">
                        <span>${albumTracks.length} ${albumTracks.length === 1 ? 'canción' : 'canciones'}</span>
                    </div>
                </div>
            </div>
            <div class="album-search-container">
                <input type="text" id="albumSearchInput" class="album-search-input" placeholder="Buscar canciones..." onkeyup="filterAlbumTracks()">
            </div>
            <div class="album-tracks-list" id="albumTracksList">
                ${renderAlbumTracks(albumTracks)}
            </div>
        `;
        
        // Guardar las tracks originales para el filtro
        window.currentAlbumTracks = albumTracks;
    } catch (error) {
        console.error('Error loading album tracks:', error);
        modalBody.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-title">Error</div>
                <p>No se pudieron cargar las canciones del álbum.</p>
            </div>
        `;
    }
}

// Render album tracks
function renderAlbumTracks(tracks) {
    return tracks.map((track, index) => {
        const durationMinutes = Math.floor(track.duration_ms / 60000);
        const durationSeconds = Math.floor((track.duration_ms % 60000) / 1000);
        const formattedDuration = `${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`;
        const isPlaying = currentPlayingId === track.spotify_id;
        
        return `
            <div class="album-track-item" onclick="showTrackDetail('${track.spotify_id}')">
                <div class="album-track-number">${index + 1}</div>
                <div class="album-track-info">
                    <div class="album-track-name">${escapeHtml(track.name)}</div>
                    <div class="album-track-artist">${escapeHtml(track.artists?.join(', ') || track.artist_main || '')}</div>
                </div>
                <div class="album-track-meta">
                    ${track.preview_url ? `
                        <button class="album-track-preview-btn ${isPlaying ? 'playing' : ''}" onclick="event.stopPropagation(); togglePreview('${track.spotify_id}', '${track.preview_url}')">
                            ${isPlaying ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'}
                        </button>
                    ` : ''}
                    <span class="album-track-duration">${formattedDuration}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Filter album tracks
function filterAlbumTracks() {
    const searchInput = document.getElementById('albumSearchInput');
    const searchTerm = searchInput.value.toLowerCase();
    const tracksList = document.getElementById('albumTracksList');
    
    if (!window.currentAlbumTracks) return;
    
    const filteredTracks = window.currentAlbumTracks.filter(track => {
        const trackName = (track.name || '').toLowerCase();
        const trackArtist = (track.artists?.join(', ') || track.artist_main || '').toLowerCase();
        return trackName.includes(searchTerm) || trackArtist.includes(searchTerm);
    });
    
    tracksList.innerHTML = renderAlbumTracks(filteredTracks);
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

// Show artist detail in modal
async function showArtistDetail(artistName) {
    const modal = document.getElementById('trackModal');
    const modalBody = document.getElementById('modalBody');
    
    modalBody.innerHTML = '<div class="loading">Cargando artista...</div>';
    modal.classList.add('active');
    
    try {
        const tracksResponse = await fetch(`${API_BASE}/artists/${encodeURIComponent(artistName)}/tracks`);
        if (!tracksResponse.ok) {
            throw new Error('Artista no encontrado');
        }
        const tracks = await tracksResponse.json();
        
        if (!Array.isArray(tracks) || tracks.length === 0) {
            modalBody.innerHTML = `
                <div class="artist-detail-header">
                    <h2 class="artist-detail-name">${escapeHtml(artistName)}</h2>
                    <div class="artist-detail-info">No hay canciones disponibles</div>
                </div>
                <div class="empty-state">
                    <p>Este artista no tiene canciones guardadas.</p>
                </div>
            `;
            return;
        }
        
        modalBody.innerHTML = `
            <div class="artist-detail-header">
                <h2 class="artist-detail-name">${escapeHtml(artistName)}</h2>
                <div class="artist-detail-info">${tracks.length} ${tracks.length === 1 ? 'canción' : 'canciones'}</div>
            </div>
            <div class="artist-search-container">
                <input type="text" id="artistSearchInput" class="artist-search-input" placeholder="Buscar canciones..." onkeyup="filterArtistTracks('${escapeHtml(artistName).replace(/'/g, "\\'")}')">
            </div>
            <div class="artist-tracks-list" id="artistTracksList">
                ${renderArtistTracks(tracks)}
            </div>
        `;
        
        // Guardar las tracks originales para el filtro
        window.currentArtistTracks = tracks;
        window.currentArtistName = artistName;
    } catch (error) {
        console.error('Error loading artist detail:', error);
        modalBody.innerHTML = '<div class="empty-state"><div class="empty-state-title">Error cargando artista</div><p>' + error.message + '</p></div>';
    }
}

// Render artist tracks
function renderArtistTracks(tracks) {
    return tracks.map(track => {
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
    }).join('');
}

// Filter artist tracks
function filterArtistTracks(artistName) {
    const searchInput = document.getElementById('artistSearchInput');
    const searchTerm = searchInput.value.toLowerCase();
    const tracksList = document.getElementById('artistTracksList');
    
    if (!window.currentArtistTracks) return;
    
    const filteredTracks = window.currentArtistTracks.filter(track => {
        const trackName = (track.name || '').toLowerCase();
        const trackAlbum = (track.album || '').toLowerCase();
        return trackName.includes(searchTerm) || trackAlbum.includes(searchTerm);
    });
    
    tracksList.innerHTML = renderArtistTracks(filteredTracks);
}

// Go back to artists (no longer needed, using modal)
function goBackToArtists() {
    // Function kept for compatibility but no longer needed
    document.querySelector('[data-tab="artists"]').click();
}

// Load module-specific metrics (summary cards)
async function loadModuleMetrics(module) {
    const statsSummary = document.getElementById('statsSummary');
    
    try {
        const response = await fetch(`${API_BASE}/metrics/global`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const metrics = await response.json();
        
        let html = '';
        
        if (module === 'tracks') {
            // Métricas para módulo de Canciones - TODAS las métricas
            html = `
                <div class="metric-summary-card">
                    <div class="metric-summary-value">${metrics.total_tracks || 0}</div>
                    <div class="metric-summary-label">Total Canciones</div>
                </div>
                <div class="metric-summary-card">
                    <div class="metric-summary-value">${metrics.unique_artists || 0}</div>
                    <div class="metric-summary-label">Artistas</div>
                </div>
                <div class="metric-summary-card">
                    <div class="metric-summary-value">${metrics.unique_albums || 0}</div>
                    <div class="metric-summary-label">Álbumes</div>
                </div>
                <div class="metric-summary-card">
                    <div class="metric-summary-value">${metrics.total_duration_formatted || '0m'}</div>
                    <div class="metric-summary-label">Duración Total</div>
                </div>
                <div class="metric-summary-card">
                    <div class="metric-summary-value">${metrics.bpm_average ? Math.round(metrics.bpm_average) : 'N/A'}</div>
                    <div class="metric-summary-label">BPM Promedio</div>
                </div>
            `;
        } else if (module === 'artists') {
            // Métricas para módulo de Artistas - TODAS las métricas
            html = `
                <div class="metric-summary-card">
                    <div class="metric-summary-value">${metrics.unique_artists || 0}</div>
                    <div class="metric-summary-label">Total Artistas</div>
                </div>
                <div class="metric-summary-card">
                    <div class="metric-summary-value">${metrics.total_tracks || 0}</div>
                    <div class="metric-summary-label">Total Canciones</div>
                </div>
                <div class="metric-summary-card">
                    <div class="metric-summary-value">${metrics.unique_albums || 0}</div>
                    <div class="metric-summary-label">Álbumes</div>
                </div>
                <div class="metric-summary-card">
                    <div class="metric-summary-value">${metrics.total_duration_formatted || '0m'}</div>
                    <div class="metric-summary-label">Duración Total</div>
                </div>
                <div class="metric-summary-card">
                    <div class="metric-summary-value">${metrics.bpm_average ? Math.round(metrics.bpm_average) : 'N/A'}</div>
                    <div class="metric-summary-label">BPM Promedio</div>
                </div>
            `;
        } else if (module === 'metrics') {
            // Métricas para módulo de Estadísticas (todas)
            html = `
                <div class="metric-summary-card">
                    <div class="metric-summary-value">${metrics.total_tracks || 0}</div>
                    <div class="metric-summary-label">Total Canciones</div>
                </div>
                <div class="metric-summary-card">
                    <div class="metric-summary-value">${metrics.unique_artists || 0}</div>
                    <div class="metric-summary-label">Artistas</div>
                </div>
                <div class="metric-summary-card">
                    <div class="metric-summary-value">${metrics.unique_albums || 0}</div>
                    <div class="metric-summary-label">Álbumes</div>
                </div>
                <div class="metric-summary-card">
                    <div class="metric-summary-value">${metrics.total_duration_formatted || '0m'}</div>
                    <div class="metric-summary-label">Duración Total</div>
                </div>
                <div class="metric-summary-card">
                    <div class="metric-summary-value">${metrics.bpm_average ? Math.round(metrics.bpm_average) : 'N/A'}</div>
                    <div class="metric-summary-label">BPM Promedio</div>
                </div>
            `;
        }
        
        statsSummary.innerHTML = html;
    } catch (error) {
        console.error('Error loading module metrics:', error);
        statsSummary.innerHTML = '<div class="metric-summary-card"><div class="metric-summary-value">-</div><div class="metric-summary-label">Error</div></div>';
    }
}

// Load metrics
let allMetrics = null;

async function loadMetrics() {
    const metricsContainer = document.getElementById('metricsContainer');
    metricsContainer.innerHTML = '<div class="loading">Cargando métricas...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/metrics/global`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        allMetrics = await response.json();
        console.log('Métricas recibidas del servidor:', allMetrics);
        
        // Asegurar que todas las propiedades existan
        allMetrics = {
            total_tracks: allMetrics.total_tracks || 0,
            unique_artists: allMetrics.unique_artists || 0,
            unique_albums: allMetrics.unique_albums || 0,
            total_duration_formatted: allMetrics.total_duration_formatted || '0m',
            bpm_average: allMetrics.bpm_average || null,
            top_artists: allMetrics.top_artists || [],
            top_albums: allMetrics.top_albums || [],
            genre_distribution: allMetrics.genre_distribution || {},
            avg_bpm_by_artist: allMetrics.avg_bpm_by_artist || {},
            tracks_by_artist: allMetrics.tracks_by_artist || {}
        };
        
        console.log('Métricas procesadas:', allMetrics);
        
        // Siempre renderizar métricas
        renderMetrics();
    } catch (error) {
        console.error('Error loading metrics:', error);
        metricsContainer.innerHTML = `<div class="empty-state"><div class="empty-state-title">Error cargando métricas</div><p>${error.message}</p><p>Verifica la consola para más detalles</p></div>`;
    }
}

function renderMetrics() {
    if (!allMetrics) {
        document.getElementById('metricsContainer').innerHTML = '<div class="empty-state"><div class="empty-state-title">No hay métricas disponibles</div><p>Ejecuta la sincronización para generar métricas</p></div>';
        return;
    }
    
    // Obtener la pestaña activa
    const activeTab = document.querySelector('.metric-tab-btn.active')?.dataset.tab || 'artists';
    
    const limitNum = Infinity; // Mostrar todos sin límite
    const metricsContainer = document.getElementById('metricsContainer');
    let html = '';
    
    // Mostrar solo la sección de la pestaña activa
    if (activeTab === 'artists') {
        const topArtists = (allMetrics.top_artists || []).slice(0, limitNum);
        
        if (topArtists.length > 0) {
            const maxTracks = topArtists[0].trackCount || 1;
            html += `
                <div class="metric-section">
                    <div class="metric-title">Top Artistas</div>
                    <div class="top-artists-list">
                        ${topArtists.map((artist, index) => {
                            const percentage = (artist.trackCount / maxTracks) * 100;
                            return `
                                <div class="top-artist-item" onclick="showArtistDetail('${escapeHtml(artist.name).replace(/'/g, "\\'")}')">
                                    <div class="top-artist-rank">${index + 1}</div>
                                    <div class="top-artist-info">
                                        <div class="top-artist-name">${escapeHtml(artist.name)}</div>
                                        <div class="top-artist-meta">
                                            <span>${artist.durationFormatted}</span>
                                            <span>•</span>
                                            <span>${artist.trackCount} canciones</span>
                                        </div>
                                    </div>
                                    <div class="top-artist-bar">
                                        <div class="top-artist-bar-fill" style="width: ${percentage}%"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="metric-section">
                    <div class="metric-title">Top Artistas</div>
                    <div class="empty-state">
                        <p>No hay artistas disponibles. Ejecuta la sincronización para cargar datos.</p>
                    </div>
                </div>
            `;
        }
    } else if (activeTab === 'albums') {
        const topAlbums = (allMetrics.top_albums || []).slice(0, limitNum);
        
        if (topAlbums.length > 0) {
            html += `
                <div class="metric-section">
                    <div class="metric-title">Top Álbumes</div>
                    <div class="top-albums-list">
                        ${topAlbums.map(album => `
                            <div class="top-album-item" onclick="showAlbumTracks('${escapeHtml(album.name).replace(/'/g, "\\'")}', '${escapeHtml(album.artist).replace(/'/g, "\\'")}')">
                                ${album.cover ? `<img src="${album.cover}" alt="${escapeHtml(album.name)}" class="top-album-cover">` : '<div class="top-album-cover"></div>'}
                                <div class="top-album-info">
                                    <div class="top-album-name">${escapeHtml(album.name)}</div>
                                    <div class="top-album-tracks">${album.trackCount} canciones</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="metric-section">
                    <div class="metric-title">Top Álbumes</div>
                    <div class="empty-state">
                        <p>No hay álbumes disponibles. Ejecuta la sincronización para cargar datos.</p>
                    </div>
                </div>
            `;
        }
    } else if (activeTab === 'genres') {
        const genres = Object.entries(allMetrics.genre_distribution || {})
            .sort(([,a], [,b]) => b - a)
            .slice(0, limitNum);
        
        if (genres.length > 0) {
            html += `
                <div class="metric-section">
                    <div class="metric-title">Géneros</div>
                    <div class="genre-list">
                        ${genres.map(([genre, count]) => `
                            <div class="genre-tag" onclick="showGenreTracks('${escapeHtml(genre).replace(/'/g, "\\'")}')" style="cursor: pointer;">
                                ${escapeHtml(genre)} (${count})
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="metric-section">
                    <div class="metric-title">Géneros</div>
                    <div class="empty-state">
                        <p>No hay géneros disponibles. Ejecuta la sincronización para cargar datos.</p>
                    </div>
                </div>
            `;
        }
    }
    
    // Verificar si hay contenido
    const hasContent = html.includes('metric-section');
    
    if (!hasContent && allMetrics.total_tracks === 0) {
        html += '<div class="empty-state"><div class="empty-state-title">No hay datos disponibles</div><p>Ejecuta la sincronización para cargar canciones y generar métricas</p></div>';
    }
    
    metricsContainer.innerHTML = html;
    
    // Log para debug
    console.log('Métricas renderizadas. Total tracks:', allMetrics.total_tracks);
    console.log('Top artists:', allMetrics.top_artists?.length || 0);
    console.log('Top albums:', allMetrics.top_albums?.length || 0);
}

// Metric tab handlers - switch between tabs
document.querySelectorAll('.metric-tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        // Remove active class from all tabs
        document.querySelectorAll('.metric-tab-btn').forEach(b => b.classList.remove('active'));
        // Add active class to clicked tab
        this.classList.add('active');
        // Re-render metrics
        renderMetrics();
    });
});

// Export functions for metrics
async function exportMetricsToPDF() {
    if (!allMetrics) {
        showNotification('No hay métricas disponibles para exportar', 'error');
        return;
    }
    
    const activeTab = document.querySelector('.metric-tab-btn.active')?.dataset.tab || 'artists';
    await exportMetricsToPDFByType(activeTab);
}

async function exportMetricsToCSV() {
    if (!allMetrics) {
        showNotification('No hay métricas disponibles para exportar', 'error');
        return;
    }
    
    const activeTab = document.querySelector('.metric-tab-btn.active')?.dataset.tab || 'artists';
    await exportMetricsToCSVByType(activeTab);
}

async function exportAllMetricsToPDF() {
    if (!allMetrics) {
        showNotification('No hay métricas disponibles para exportar', 'error');
        return;
    }
    await exportMetricsToPDFByType('all');
}

async function exportAllMetricsToCSV() {
    if (!allMetrics) {
        showNotification('No hay métricas disponibles para exportar', 'error');
        return;
    }
    await exportMetricsToCSVByType('all');
}

async function exportMetricsToPDFByType(type = 'artists') {
    try {
        if (!allMetrics) {
            showNotification('No hay métricas disponibles', 'error');
            return;
        }
        
        // Verificar si jsPDF está disponible
        if (!window.jspdf) {
            showNotification('Cargando biblioteca PDF...', 'info');
            await new Promise((resolve) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
                script.onload = resolve;
                document.head.appendChild(script);
            });
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        
        // Configuración
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const headerHeight = 35;
        let yPos = margin;
        let currentPage = 1;
        
        // Función para dibujar encabezado de página
        const drawHeader = (title) => {
            doc.setFillColor(29, 185, 84);
            doc.rect(0, 0, pageWidth, headerHeight, 'F');
            doc.setFontSize(20);
            doc.setTextColor(255, 255, 255);
            doc.setFont(undefined, 'bold');
            doc.text(title, pageWidth / 2, 18, { align: 'center' });
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            doc.text(`Página ${currentPage}`, pageWidth - margin, 18, { align: 'right' });
        };
        
        // Función para agregar nueva página
        const addNewPage = (title) => {
            doc.addPage();
            currentPage++;
            drawHeader(title);
            yPos = headerHeight + 15;
        };
        
        const titles = {
            'artists': 'Top Artistas',
            'albums': 'Top Álbumes',
            'genres': 'Géneros',
            'all': 'Todas las Métricas'
        };
        
        const title = titles[type] || 'Métricas';
        drawHeader(title);
        yPos = headerHeight + 15;
        
        // Información general
        const infoBoxHeight = 20;
        doc.setFillColor(248, 248, 248);
        doc.setDrawColor(29, 185, 84);
        doc.setLineWidth(0.5);
        doc.rect(margin, yPos, pageWidth - 2 * margin, infoBoxHeight, 'FD');
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        doc.setFont(undefined, 'normal');
        doc.text(`Fecha de exportación: ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin + 8, yPos + 12);
        yPos += infoBoxHeight + 15;
        
        // Exportar según el tipo
        if (type === 'artists' || type === 'all') {
            if (yPos > pageHeight - 40) addNewPage(title);
            doc.setFontSize(16);
            doc.setTextColor(29, 185, 84);
            doc.setFont(undefined, 'bold');
            doc.text('Top Artistas', margin, yPos);
            yPos += 10;
            
            const topArtists = allMetrics.top_artists || [];
            if (topArtists.length > 0) {
                const headers = ['#', 'Artista', 'Canciones', 'Duración Total', 'BPM Promedio'];
                const colWidths = [15, 80, 30, 35, 30];
                const startX = margin;
                const rowHeight = 8;
                
                // Encabezados
                doc.setFillColor(29, 185, 84);
                doc.rect(startX, yPos, pageWidth - 2 * margin, rowHeight, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(9);
                doc.setFont(undefined, 'bold');
                let xPos = startX;
                headers.forEach((header, i) => {
                    doc.text(header, xPos + colWidths[i] / 2, yPos + 5, { align: 'center' });
                    xPos += colWidths[i];
                });
                yPos += rowHeight;
                
                // Datos
                doc.setFontSize(8);
                doc.setFont(undefined, 'normal');
                topArtists.forEach((artist, index) => {
                    if (yPos + rowHeight > pageHeight - margin - 5) {
                        addNewPage(title);
                        // Redibujar encabezados
                        doc.setFillColor(29, 185, 84);
                        doc.rect(startX, yPos, pageWidth - 2 * margin, rowHeight, 'F');
                        doc.setTextColor(255, 255, 255);
                        doc.setFontSize(9);
                        doc.setFont(undefined, 'bold');
                        xPos = startX;
                        headers.forEach((header, i) => {
                            doc.text(header, xPos + colWidths[i] / 2, yPos + 5, { align: 'center' });
                            xPos += colWidths[i];
                        });
                        yPos += rowHeight;
                    }
                    
                    doc.setFillColor(index % 2 === 0 ? 252 : 255, 252, 252);
                    doc.rect(startX, yPos, pageWidth - 2 * margin, rowHeight, 'F');
                    doc.setTextColor(40, 40, 40);
                    
                    xPos = startX;
                    doc.text((index + 1).toString(), xPos + 4, yPos + 5);
                    xPos += colWidths[0];
                    doc.text(artist.name.substring(0, 35), xPos + 3, yPos + 5, { maxWidth: colWidths[1] - 6 });
                    xPos += colWidths[1];
                    doc.text(artist.trackCount.toString(), xPos + colWidths[2] / 2, yPos + 5, { align: 'center' });
                    xPos += colWidths[2];
                    doc.text(artist.durationFormatted || 'N/A', xPos + colWidths[3] / 2, yPos + 5, { align: 'center' });
                    xPos += colWidths[3];
                    doc.text(artist.avgBpm ? Math.round(artist.avgBpm).toString() : 'N/A', xPos + colWidths[4] / 2, yPos + 5, { align: 'center' });
                    yPos += rowHeight;
                });
            } else {
                doc.setFontSize(10);
                doc.setTextColor(100, 100, 100);
                doc.text('No hay datos de artistas disponibles', margin, yPos);
                yPos += 10;
            }
            yPos += 15;
        }
        
        if (type === 'albums' || type === 'all') {
            if (yPos > pageHeight - 40) addNewPage(title);
            doc.setFontSize(16);
            doc.setTextColor(29, 185, 84);
            doc.setFont(undefined, 'bold');
            doc.text('Top Álbumes', margin, yPos);
            yPos += 10;
            
            const topAlbums = allMetrics.top_albums || [];
            if (topAlbums.length > 0) {
                const headers = ['#', 'Álbum', 'Artista', 'Canciones'];
                const colWidths = [15, 80, 60, 25];
                const startX = margin;
                const rowHeight = 8;
                
                doc.setFillColor(29, 185, 84);
                doc.rect(startX, yPos, pageWidth - 2 * margin, rowHeight, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(9);
                doc.setFont(undefined, 'bold');
                let xPos = startX;
                headers.forEach((header, i) => {
                    doc.text(header, xPos + colWidths[i] / 2, yPos + 5, { align: 'center' });
                    xPos += colWidths[i];
                });
                yPos += rowHeight;
                
                doc.setFontSize(8);
                doc.setFont(undefined, 'normal');
                topAlbums.forEach((album, index) => {
                    if (yPos + rowHeight > pageHeight - margin - 5) {
                        addNewPage(title);
                        doc.setFillColor(29, 185, 84);
                        doc.rect(startX, yPos, pageWidth - 2 * margin, rowHeight, 'F');
                        doc.setTextColor(255, 255, 255);
                        doc.setFontSize(9);
                        doc.setFont(undefined, 'bold');
                        xPos = startX;
                        headers.forEach((header, i) => {
                            doc.text(header, xPos + colWidths[i] / 2, yPos + 5, { align: 'center' });
                            xPos += colWidths[i];
                        });
                        yPos += rowHeight;
                    }
                    
                    doc.setFillColor(index % 2 === 0 ? 252 : 255, 252, 252);
                    doc.rect(startX, yPos, pageWidth - 2 * margin, rowHeight, 'F');
                    doc.setTextColor(40, 40, 40);
                    
                    xPos = startX;
                    doc.text((index + 1).toString(), xPos + 4, yPos + 5);
                    xPos += colWidths[0];
                    doc.text(album.name.substring(0, 35), xPos + 3, yPos + 5, { maxWidth: colWidths[1] - 6 });
                    xPos += colWidths[1];
                    doc.text(album.artist.substring(0, 25), xPos + 3, yPos + 5, { maxWidth: colWidths[2] - 6 });
                    xPos += colWidths[2];
                    doc.text(album.trackCount.toString(), xPos + colWidths[3] / 2, yPos + 5, { align: 'center' });
                    yPos += rowHeight;
                });
            } else {
                doc.setFontSize(10);
                doc.setTextColor(100, 100, 100);
                doc.text('No hay datos de álbumes disponibles', margin, yPos);
                yPos += 10;
            }
            yPos += 15;
        }
        
        if (type === 'genres' || type === 'all') {
            if (yPos > pageHeight - 40) addNewPage(title);
            doc.setFontSize(16);
            doc.setTextColor(29, 185, 84);
            doc.setFont(undefined, 'bold');
            doc.text('Géneros', margin, yPos);
            yPos += 10;
            
            const genres = Object.entries(allMetrics.genre_distribution || {})
                .sort(([,a], [,b]) => b - a);
            
            if (genres.length > 0) {
                const headers = ['#', 'Género', 'Canciones'];
                const colWidths = [15, 140, 25];
                const startX = margin;
                const rowHeight = 8;
                
                doc.setFillColor(29, 185, 84);
                doc.rect(startX, yPos, pageWidth - 2 * margin, rowHeight, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(9);
                doc.setFont(undefined, 'bold');
                let xPos = startX;
                headers.forEach((header, i) => {
                    doc.text(header, xPos + colWidths[i] / 2, yPos + 5, { align: 'center' });
                    xPos += colWidths[i];
                });
                yPos += rowHeight;
                
                doc.setFontSize(8);
                doc.setFont(undefined, 'normal');
                genres.forEach(([genre, count], index) => {
                    if (yPos + rowHeight > pageHeight - margin - 5) {
                        addNewPage(title);
                        doc.setFillColor(29, 185, 84);
                        doc.rect(startX, yPos, pageWidth - 2 * margin, rowHeight, 'F');
                        doc.setTextColor(255, 255, 255);
                        doc.setFontSize(9);
                        doc.setFont(undefined, 'bold');
                        xPos = startX;
                        headers.forEach((header, i) => {
                            doc.text(header, xPos + colWidths[i] / 2, yPos + 5, { align: 'center' });
                            xPos += colWidths[i];
                        });
                        yPos += rowHeight;
                    }
                    
                    doc.setFillColor(index % 2 === 0 ? 252 : 255, 252, 252);
                    doc.rect(startX, yPos, pageWidth - 2 * margin, rowHeight, 'F');
                    doc.setTextColor(40, 40, 40);
                    
                    xPos = startX;
                    doc.text((index + 1).toString(), xPos + 4, yPos + 5);
                    xPos += colWidths[0];
                    doc.text(genre.substring(0, 50), xPos + 3, yPos + 5, { maxWidth: colWidths[1] - 6 });
                    xPos += colWidths[1];
                    doc.text(count.toString(), xPos + colWidths[2] / 2, yPos + 5, { align: 'center' });
                    yPos += rowHeight;
                });
            } else {
                doc.setFontSize(10);
                doc.setTextColor(100, 100, 100);
                doc.text('No hay datos de géneros disponibles', margin, yPos);
            }
        }
        
        const fileName = type === 'all' 
            ? `metricas_completas_${new Date().toISOString().split('T')[0]}.pdf`
            : `metricas_${type}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
        showNotification('PDF exportado exitosamente', 'success');
    } catch (error) {
        console.error('Error exportando a PDF:', error);
        showNotification('Error al exportar PDF', 'error');
    }
}

async function exportMetricsToCSVByType(type = 'artists') {
    try {
        if (!allMetrics) {
            showNotification('No hay métricas disponibles', 'error');
            return;
        }
        
        let csvContent = '';
        const dateStr = new Date().toISOString().split('T')[0];
        
        if (type === 'artists' || type === 'all') {
            const topArtists = allMetrics.top_artists || [];
            csvContent += 'Top Artistas\n';
            csvContent += '#,Artista,Canciones,Duración Total,BPM Promedio\n';
            topArtists.forEach((artist, index) => {
                csvContent += `${index + 1},"${(artist.name || '').replace(/"/g, '""')}",${artist.trackCount || 0},"${artist.durationFormatted || 'N/A'}",${artist.avgBpm ? Math.round(artist.avgBpm) : 'N/A'}\n`;
            });
            csvContent += '\n';
        }
        
        if (type === 'albums' || type === 'all') {
            const topAlbums = allMetrics.top_albums || [];
            csvContent += 'Top Álbumes\n';
            csvContent += '#,Álbum,Artista,Canciones\n';
            topAlbums.forEach((album, index) => {
                csvContent += `${index + 1},"${(album.name || '').replace(/"/g, '""')}","${(album.artist || '').replace(/"/g, '""')}",${album.trackCount || 0}\n`;
            });
            csvContent += '\n';
        }
        
        if (type === 'genres' || type === 'all') {
            const genres = Object.entries(allMetrics.genre_distribution || {})
                .sort(([,a], [,b]) => b - a);
            csvContent += 'Géneros\n';
            csvContent += '#,Género,Canciones\n';
            genres.forEach(([genre, count], index) => {
                csvContent += `${index + 1},"${genre.replace(/"/g, '""')}",${count}\n`;
            });
        }
        
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        const fileName = type === 'all' 
            ? `metricas_completas_${dateStr}.csv`
            : `metricas_${type}_${dateStr}.csv`;
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification('CSV exportado exitosamente', 'success');
    } catch (error) {
        console.error('Error exportando a CSV:', error);
        showNotification('Error al exportar CSV', 'error');
    }
}

async function exportToCSV() {
    try {
        const response = await fetch(`${API_BASE}/tracks`);
        if (!response.ok) {
            throw new Error('Error obteniendo tracks');
        }
        const tracks = await response.json();
        
        // Crear CSV
        const headers = ['#', 'Canción', 'Artistas', 'Artista Principal', 'Álbum', 'Fecha Lanzamiento', 'Duración (ms)', 'Duración', 'BPM', 'Géneros', 'Preview URL', 'Cover URL'];
        const rows = tracks.map((track, index) => {
            const durationMinutes = Math.floor(track.duration_ms / 60000);
            const durationSeconds = Math.floor((track.duration_ms % 60000) / 1000);
            const formattedDuration = `${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`;
            
            return [
                index + 1,
                track.name || '',
                (track.artists || []).join('; '),
                track.artist_main || '',
                track.album || '',
                track.release_date || '',
                track.duration_ms || 0,
                formattedDuration,
                track.bpm ? Math.round(track.bpm) : '',
                (track.genres || []).join('; '),
                track.preview_url || '',
                track.cover_url || ''
            ];
        });
        
        // Convertir a CSV
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => {
                const cellStr = String(cell || '');
                // Escapar comillas y envolver en comillas si contiene comas o comillas
                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                    return `"${cellStr.replace(/"/g, '""')}"`;
                }
                return cellStr;
            }).join(','))
        ].join('\n');
        
        // Crear blob y descargar
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `canciones_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification('CSV exportado exitosamente', 'success');
    } catch (error) {
        console.error('Error exportando a CSV:', error);
        showNotification('Error al exportar CSV', 'error');
    }
}

// Load global stats
// loadStats() removida - ahora se usa loadModuleMetrics()

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
document.addEventListener('DOMContentLoaded', () => {
    const syncBtn = document.getElementById('syncBtn');
    if (!syncBtn) {
        console.error('❌ Botón syncBtn no encontrado en el DOM');
        return;
    }
    
    console.log('✅ Botón syncBtn encontrado, agregando event listener...');
    
    syncBtn.addEventListener('click', async () => {
        console.log('🖱️ Botón Sincronizar clickeado');
        const btn = document.getElementById('syncBtn');
        btn.disabled = true;
        btn.textContent = 'Sincronizando...';
        
        try {
            console.log(`🔍 Verificando token en: ${API_BASE}/api/token/status`);
            const tokenStatus = await fetch(`${API_BASE}/api/token/status`);
            const status = await tokenStatus.json();
            console.log('📊 Estado del token:', status);
            
            if (!status.hasToken) {
                const proceed = confirm('No hay token de usuario configurado. Sin él, no se podrá obtener BPM. ¿Deseas continuar de todas formas?');
                if (!proceed) {
                    btn.disabled = false;
                    btn.textContent = 'Sincronizar';
                    return;
                }
            }
            
            console.log(`🚀 Llamando a: ${API_BASE}/api/sync`);
            const response = await fetch(`${API_BASE}/api/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log(`📡 Respuesta recibida: ${response.status} ${response.statusText}`);
            
            if (response.ok || response.status === 202) {
                const responseData = await response.json().catch(() => ({}));
                console.log('✅ Sincronización iniciada:', responseData);
                showNotification('Sincronización iniciada. Esto puede tardar unos minutos...', 'success');
                
                setTimeout(() => {
                    const activeNav = document.querySelector('.nav-item.active');
                    const tabName = activeNav?.dataset.tab || 'tracks';
                    loadModuleMetrics(tabName);
                    if (activeNav?.dataset.tab === 'tracks') {
                        loadTracks();
                    } else if (activeNav?.dataset.tab === 'artists') {
                        loadArtists();
                    } else if (activeNav?.dataset.tab === 'metrics') {
                        loadMetrics();
                    }
                }, 10000);
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
                console.error('❌ Error en respuesta:', errorData);
                showNotification(`Error: ${errorData.error || 'Error al iniciar sincronización'}`, 'error');
            }
        } catch (error) {
            console.error('❌ Error al sincronizar:', error);
            showNotification('Error al iniciar sincronización', 'error');
        } finally {
            setTimeout(() => {
                btn.disabled = false;
                btn.textContent = 'Sincronizar';
            }, 5000);
        }
    });
    
    console.log('✅ Event listener agregado al botón syncBtn');
});

// Connect Spotify button
document.getElementById('connectSpotifyBtn')?.addEventListener('click', () => {
    window.location.href = `${API_BASE}/api/auth/login`;
});

// Refresh button
document.getElementById('refreshBtn')?.addEventListener('click', () => {
    const activeNav = document.querySelector('.nav-item.active');
    if (activeNav) {
        const tabName = activeNav.dataset.tab || 'tracks';
        loadModuleMetrics(tabName);
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
loadTracks();
loadModuleMetrics('tracks');
