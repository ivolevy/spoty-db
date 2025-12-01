# Scripts Esenciales

## 📥 Agregar Canciones

```bash
# Buscar más canciones de artistas que ya están en la BD
npm run sync-more-tracks

# Más canciones por artista
npm run sync-more-tracks -- --tracks-per-artist 30
```

## 🔍 Verificar Canciones

```bash
# Ver cuáles NO son de Dale Play Records
npm run verify-label
```

## 🗑️ Eliminar Canciones Inválidas

```bash
# Eliminar canciones que NO son de Dale Play Records (con confirmación)
npm run remove-non-dale-play

# Eliminar automáticamente sin confirmar
npm run remove-non-dale-play -- --auto
```
