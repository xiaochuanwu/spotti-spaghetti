// CSV and ZIP Export Service
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { getSafeFileName, toCSV } from './csv.js';

export const exporter = {
  // Convert playlist tracks list to standard CSV string
  toCSV,

  // Generate safe filename for a playlist
  getSafeFileName,

  // Export single playlist tracks as CSV
  exportCSV(playlistName, tracks) {
    const csv = this.toCSV(tracks);
    const fileName = this.getSafeFileName(playlistName) + ".csv";
    
    // Prefix UTF-8 BOM (\uFEFF) to make sure Excel opens it correctly with Chinese characters
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    saveAs(blob, fileName);
  },

  // Export multiple playlists as a single ZIP file containing separate CSVs
  async exportZIP(playlistsWithTracks, zipName = "spotify_playlists.zip") {
    const zip = new JSZip();
    const usedFileNames = new Set();

    playlistsWithTracks.forEach(({ playlistName, tracks }) => {
      const csv = this.toCSV(tracks);
      let baseName = this.getSafeFileName(playlistName);
      let fileName = baseName + ".csv";
      
      // De-duplicate file names (e.g. pop.csv, pop_1.csv)
      let count = 1;
      while (usedFileNames.has(fileName)) {
        fileName = `${baseName}_${count}.csv`;
        count++;
      }
      usedFileNames.add(fileName);

      // Add file to ZIP (with UTF-8 BOM)
      zip.file(fileName, "\uFEFF" + csv);
    });

    const contentBlob = await zip.generateAsync({ type: "blob" });
    saveAs(contentBlob, zipName);
  }
};
