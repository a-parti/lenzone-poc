import { useState } from 'react';
import { copyCanvas, downloadCanvas, elementToPngCanvas } from '../lib/elementPng';
import useModuleExportTheme from './useModuleExportTheme';

export default function useElementPngExport(ref, filename, options = {}) {
  const { theme: exportTheme, setTheme: setExportTheme, scheme } = useModuleExportTheme();
  const [exporting, setExporting] = useState(false);
  const [copyState, setCopyState] = useState('idle');
  const [downloadState, setDownloadState] = useState('idle');

  const render = () => elementToPngCanvas(ref.current, exportTheme, options);

  const copyPng = async () => {
    setExporting(true);
    setCopyState('copying');
    try {
      await copyCanvas(await render());
      setCopyState('copied');
    } catch (error) {
      console.error('Clipboard PNG export failed:', error);
      setCopyState('error');
    } finally {
      setExporting(false);
      setTimeout(() => setCopyState('idle'), 2200);
    }
  };

  const downloadPng = async () => {
    setExporting(true);
    try {
      downloadCanvas(await render(), `${filename}-${exportTheme}.png`);
      setDownloadState('idle');
    } catch (error) {
      console.error('PNG download failed:', error);
      setDownloadState('error');
      setTimeout(() => setDownloadState('idle'), 2500);
    } finally {
      setExporting(false);
    }
  };

  return { exportTheme, setExportTheme, scheme, exporting, copyState, downloadState, copyPng, downloadPng };
}
