import React from 'react';
import { Check, Copy, Download, Moon, Sun, X as XIcon } from 'lucide-react';

export default function ExportControls({
  theme,
  onThemeChange,
  onCopy,
  onDownload,
  exporting = false,
  copyState = 'idle',
  downloadState = 'idle',
  label = 'Export'
}) {
  return (
    <div className="export-control" role="group" aria-label={`${label} image`}>
      <span className="export-control-label">{label}</span>
      <button
        type="button"
        onClick={() => onThemeChange('light')}
        disabled={exporting}
        aria-pressed={theme === 'light'}
        title="Preview and export this module in light mode"
        className={theme === 'light' ? 'is-active' : ''}
      >
        <Sun className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Light</span>
      </button>
      <button
        type="button"
        onClick={() => onThemeChange('dark')}
        disabled={exporting}
        aria-pressed={theme === 'dark'}
        title="Preview and export this module in dark mode"
        className={theme === 'dark' ? 'is-active' : ''}
      >
        <Moon className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Dark</span>
      </button>
      <button
        type="button"
        onClick={onCopy}
        disabled={exporting}
        title="Copy PNG to the clipboard"
        aria-label="Copy PNG to clipboard"
      >
        {copyState === 'copied' ? <Check className="w-3.5 h-3.5 text-[var(--pos)]" /> : copyState === 'error' ? <XIcon className="w-3.5 h-3.5 text-[var(--neg)]" /> : <Copy className="w-3.5 h-3.5" />}
        <span>{copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Retry' : 'Copy PNG'}</span>
      </button>
      <button
        type="button"
        onClick={onDownload}
        disabled={exporting}
        title="Download PNG"
        aria-label="Download PNG"
      >
        {downloadState === 'error' ? <XIcon className="w-3.5 h-3.5 text-[var(--neg)]" /> : <Download className="w-3.5 h-3.5" />}
        <span>{downloadState === 'error' ? 'Retry' : 'PNG'}</span>
      </button>
    </div>
  );
}
