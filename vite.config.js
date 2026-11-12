import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Build "fichier unique" : tout le code (Three.js compris) est intégré dans dist/index.html,
// ce qui permet d'ouvrir l'application en file:// sur la borne, sans serveur.
// Les fichiers de dist/data/*.js (scénarios, réglages) restent séparés pour être modifiables.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    target: 'es2020',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 4000,
    reportCompressedSize: false,
  },
});
