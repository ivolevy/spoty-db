/**
 * Utilidades para normalizar y comparar labels de discográficas
 * Maneja variantes de "Dale Play Records" y labels extendidos
 */

/**
 * Normaliza un texto para comparación (minúsculas, sin espacios extra)
 */
export function normalizeLabel(label: string | null | undefined): string {
  if (!label) return '';
  
  return label
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' '); // Normalizar espacios múltiples
}

/**
 * Verifica si un label contiene el término de búsqueda (normalizado)
 * Maneja variantes como:
 * - "Dale Play Records"
 * - "DALE PLAY RECORDS"
 * - "Dale play records"
 * - "DalePlay Records"
 * - "Dale Play Records / Sony Music"
 * - "Dale Play Records (Under exclusive license...)"
 */
export function matchesLabel(
  label: string | null | undefined,
  searchTerm: string
): boolean {
  const normalizedLabel = normalizeLabel(label);
  const normalizedSearch = normalizeLabel(searchTerm);

  if (!normalizedLabel || !normalizedSearch) {
    return false;
  }

  // Buscar el término normalizado dentro del label normalizado
  // Esto captura variantes como "dale play records" en "dale play records / sony music"
  return normalizedLabel.includes(normalizedSearch);
}

/**
 * Extrae el label principal de un label extendido
 * Ejemplo: "Dale Play Records / Sony Music" -> "Dale Play Records"
 */
export function extractMainLabel(label: string | null | undefined): string {
  if (!label) return '';
  
  // Remover información entre paréntesis
  let cleaned = label.replace(/\([^)]*\)/g, '').trim();
  
  // Si hay un "/", tomar la primera parte
  if (cleaned.includes('/')) {
    cleaned = cleaned.split('/')[0].trim();
  }
  
  return cleaned;
}

