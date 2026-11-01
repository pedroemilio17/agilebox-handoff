// O processo principal informa o modo de vidro na URL (`?glass=css|native|opaque`).
export function applyGlassMode(): void {
  const mode = new URLSearchParams(window.location.search).get('glass')
  if (mode !== null) document.documentElement.dataset.glass = mode
}
