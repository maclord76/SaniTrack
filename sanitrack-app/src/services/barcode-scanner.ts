import { Html5Qrcode } from 'html5-qrcode';

export async function startBarcodeScan(
  onDetected: (barcode: string) => void,
  onError?: (error: string) => void
): Promise<void> {
  // Créer le conteneur principal
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 9999;
    background: #000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  `;
  document.body.appendChild(overlay);

  // Message d'instruction
  const instruction = document.createElement('p');
  instruction.textContent = 'Placez le code-barres dans le cadre';
  instruction.style.cssText = `
    color: white;
    font-size: 16px;
    margin-bottom: 12px;
    text-align: center;
    font-family: sans-serif;
    z-index: 10000;
  `;
  overlay.appendChild(instruction);

  // Conteneur pour la vidéo - dimensions explicites
  const videoContainer = document.createElement('div');
  videoContainer.id = 'sanitrack-barcode-reader';
  videoContainer.style.cssText = `
    width: 90vw;
    max-width: 400px;
    height: 60vh;
    max-height: 400px;
    overflow: hidden;
    position: relative;
    border-radius: 12px;
  `;
  overlay.appendChild(videoContainer);

  // Bouton annuler
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Annuler';
  cancelBtn.style.cssText = `
    margin-top: 16px;
    padding: 12px 32px;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 16px;
    cursor: pointer;
    font-family: sans-serif;
    z-index: 10000;
  `;
  overlay.appendChild(cancelBtn);

  const scanner = new Html5Qrcode('sanitrack-barcode-reader');
  let stopped = false;

  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    scanner.stop().catch(() => {});
    overlay.remove();
  };

  cancelBtn.onclick = cleanup;

  try {
    await scanner.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 250, height: 150 },
      },
      (decodedText) => {
        cleanup();
        onDetected(decodedText);
      },
      () => {
        // Erreur de décodage ignorée
      }
    );
  } catch (err) {
    cleanup();
    const message = err instanceof Error ? err.message : 'Erreur lors du scan';
    onError?.(message);
  }
}