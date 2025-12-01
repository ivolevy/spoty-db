const API_BASE = window.location.origin;

// Crear partículas animadas
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

// Tabs
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        
        // Update tabs
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');
        
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
    tracksGrid.innerHTML = '<div class="loading">Cargando tracks...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/tracks`);
        const tracks = await response.json();
        
        console.log(`📥 Frontend recibió ${tracks.length} tracks de la API`);
        
        if (tracks.length === 0) {
            tracksGrid.innerHTML = '<div class="empty-state"><div class="empty-state-title">No hay canciones</div><p>Ejecuta la sincronización para cargar tracks</p></div>';
            return;
        }
        
        // Filtrar tracks que tengan al menos nombre (por si hay datos corruptos)
        const validTracks = tracks.filter(track => track && track.name);
        console.log(`✅ Tracks válidos para mostrar: ${validTracks.length} (de ${tracks.length} totales)`);
        
        tracksGrid.innerHTML = validTracks.map(track => `
            <div class="track-card">
                ${track.cover_url ? `<img src="${track.cover_url}" alt="${track.name}" class="track-cover">` : '<div class="track-cover"></div>'}
                <div class="track-name">${track.name}</div>
                <div class="track-artist">${track.artists?.join(', ') || track.artist_main}</div>
                <div class="track-info">
                    <span class="track-bpm">${track.bpm ? Math.round(track.bpm) + ' BPM' : '—'}</span>
                    ${track.preview_url ? `<audio controls class="track-preview"><source src="${track.preview_url}" type="audio/mpeg"></audio>` : '<span style="color: var(--text-secondary); font-size: 0.85rem;">Sin preview</span>'}
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading tracks:', error);
        tracksGrid.innerHTML = '<div class="loading">Error cargando tracks</div>';
    }
}

// Load artists
async function loadArtists() {
    const artistsGrid = document.getElementById('artistsGrid');
    artistsGrid.innerHTML = '<div class="loading">Cargando artistas...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/artists`);
        const artists = await response.json();
        
        if (artists.length === 0) {
            artistsGrid.innerHTML = '<div class="empty-state"><div class="empty-state-title">No hay artistas</div><p>Ejecuta la sincronización para cargar artistas</p></div>';
            return;
        }
        
        // Load tracks for each artist
        const artistsWithTracks = await Promise.all(
            artists.map(async (artist) => {
                const tracksResponse = await fetch(`${API_BASE}/artists/${encodeURIComponent(artist.name)}/tracks`);
                const tracks = await tracksResponse.json();
                return { ...artist, trackCount: tracks.length };
            })
        );
        
        artistsGrid.innerHTML = artistsWithTracks.map(artist => `
            <div class="artist-card" onclick="loadArtistTracks('${artist.name}')">
                <div class="artist-name">${artist.name}</div>
                <div class="artist-tracks">${artist.trackCount} ${artist.trackCount === 1 ? 'canción' : 'canciones'}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading artists:', error);
        artistsGrid.innerHTML = '<div class="loading">Error cargando artistas</div>';
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
                            <div class="genre-tag">${genre} (${count})</div>
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
                                    <span class="bpm-artist">${artist}</span>
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
        
        // Get last update from tracks
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

// Sync button - ejecuta sincronización
document.getElementById('syncBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('syncBtn');
    btn.disabled = true;
    btn.textContent = 'Sincronizando...';
    
    try {
        const response = await fetch(`${API_BASE}/api/cron`);
        if (response.ok) {
            // Esperar un poco y luego refrescar
            setTimeout(() => {
                loadStats();
                const activeTab = document.querySelector('.tab.active');
                if (activeTab?.dataset.tab === 'tracks') {
                    loadTracks();
                }
            }, 2000);
        } else {
            alert('Error al iniciar sincronización');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al iniciar sincronización');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Sincronizar';
    }
});

// Refresh button
document.getElementById('refreshBtn')?.addEventListener('click', () => {
    loadStats();
    const activeTab = document.querySelector('.tab.active');
    if (activeTab) {
        const tabName = activeTab.dataset.tab;
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
    // Switch to tracks tab and filter
    document.querySelector('[data-tab="tracks"]').click();
    setTimeout(() => {
        document.getElementById('searchInput').value = artistName;
        document.getElementById('searchInput').dispatchEvent(new Event('input'));
    }, 100);
}

// Initialize
createParticles();
loadStats();
loadTracks();

