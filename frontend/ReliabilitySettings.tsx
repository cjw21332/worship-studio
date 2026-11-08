import {useDeskTranslate} from './i18n';
import {useEffect, useState} from 'react';
import {Modal, Select, Button} from './ui';
import type {UpdateStatus} from '../backend/update';
import type {DiagnosticSnapshot} from '../backend/diagnostics';

export function ReliabilitySettings({onClose, embedded = false}: { onClose: () => void; embedded?: boolean }) {
  const tr = useDeskTranslate();

  const [report, setReport] = useState<DiagnosticSnapshot | null>(null);
  const [updates, setUpdates] = useState<UpdateStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [channel, setChannel] = useState<'stable' | 'beta'>('stable');
  const [feedUrl, setFeedUrl] = useState('');

  useEffect(() => {
    let active = true;
    void Promise.all([window.studio.diagnostics('report'), window.studio.updates('status')]).then(
      ([report, status]) => {
        if (!active) return;
        setReport(report);
        setUpdates(status);
        setEnabled(status.settings.enabled);
        setChannel(status.settings.channel);
        setFeedUrl(status.settings.feedUrl);
      }
    ).catch(e => {
      if (active) setError(String(e));
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!updates || !['checking', 'downloading'].includes(updates.state)) return;
    const timer = setInterval(() => {
      void window.studio.updates('status').then(setUpdates).catch(() => {});
    }, 1000);
    return () => clearInterval(timer);
  }, [updates?.state]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const diagnostic = (action: 'copy' | 'export') =>
    run(async () => {
      const result = await window.studio.diagnostics(action);
      setMessage(result.canceled ? 'Export canceled.' : result.message);
    });

  const update = (action: 'configure' | 'check' | 'download' | 'install') =>
    run(async () => {
      const result = await window.studio.updates(action, action === 'configure' ? { enabled, channel, feedUrl } : action === 'install' ? { confirmed: true } : {});
      setUpdates(result);
    });

  const statusBadge = (label: string, state: string, variant: 'info' | 'warning' | 'success' = 'info') => {
    const variantStyles = {
      info: 'var(--muted)',
      warning: 'var(--warning)',
      success: 'var(--success)',
    };
    return (
      <span
        className="badge"
        style={{
          background: variantStyles[variant] || variantStyles.info,
          borderColor: variantStyles[variant] || variantStyles.info,
          color: variantStyles[variant] === 'var(--accent-ink)' ? 'var(--accent-ink)' : 'var(--ink)',
        }}
      >
        {label}: {state}
      </span>
    );
  };

  const content = (
    <>
      {error && (
        <p role="alert" className="error" style={{color: 'var(--danger-ink)', marginBottom: '12px'}}>
          {error}
        </p>
      )}
      {message && (
        <p role="status" style={{marginBottom: '12px'}}>
          {message}
        </p>
      )}

      {/* Diagnostic Card */}
      <div className="card" style={{marginBottom: '24px'}}>
        <h3 style={{margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600'}}>
          {tr("Diagnostic information")}
        </h3>
        <p className="hint" style={{fontSize: '13px', color: 'var(--muted)', marginBottom: '12px'}}>
          {tr("Share app versions, content counts, output status and performance readings to help diagnose a problem. Lyrics, verse text, file paths and credentials are excluded.")}
        </p>
        {report && (
          <div style={{display: 'grid', gap: '8px'}}>
            <div className="row" style={{fontSize: '13px'}}>
              <span>{tr("Worship Studio")} {report.runtime.appVersion}</span>
              <span>{report.counters.songCount ?? 0} {tr("songs")}</span>
              <span>{report.counters.itemCount ?? 0} {tr("service items")}</span>
            </div>
            <div className="row">
              {statusBadge("Status", "Active", "success")}
              {statusBadge("Runtime", report.runtime.duration ?? "unknown", "info")}
            </div>
          </div>
        )}
        <div className="row" style={{marginTop: '12px', gap: '8px'}}>
          <button data-help-id="reliabilitySettings.copyDiagnosticInfo" disabled={busy} onClick={() => void diagnostic('copy')}>
            {tr("Copy diagnostic info")}
          </button>
          <button data-help-id="reliabilitySettings.exportDiagnosticFile" disabled={busy} onClick={() => void diagnostic('export')}>
            {tr("Export diagnostic file")}
          </button>
        </div>
      </div>

      {/* App Updates Card */}
      <div className="card" style={{marginBottom: '24px'}}>
        <h3 style={{margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600'}}>
          {tr("App updates")}
        </h3>
        <p className="hint" style={{fontSize: '13px', color: 'var(--muted)', marginBottom: '12px'}}>
          {tr("Checks and downloads run only when requested. Enter the HTTPS feed supplied by your release publisher. Install updates after the service has finished.")}
        </p>
        <label className="row" style={{fontSize: '13px', marginBottom: '8px'}}>
          <input
            data-help-id="reliabilitySettings.enableUpdateChecks"
            type="checkbox"
            checked={enabled}
            disabled={busy}
            onChange={e => setEnabled(e.target.checked)}
          />
          {tr("Enable update checks")}
        </label>
        <Select
          help="reliabilitySettings.updateChannelSelect"
          optionHelp="common.selectOption"
          label={tr("Update channel")}
          value={channel}
          onChange={value => setChannel(value as 'stable' | 'beta')}
          options={[
            { value: 'stable', label: 'Stable' },
            { value: 'beta', label: 'Beta' },
          ]}
        />
        <label style={{fontSize: '13px', margin: '8px 0'}}>
          {tr("Update feed URL")}
          <input
            data-help-id="reliabilitySettings.feedUrl"
            type="url"
            value={feedUrl}
            disabled={busy}
            placeholder={tr("https://releases.example.org/worship-studio/")}
            onChange={e => setFeedUrl(e.target.value)}
          />
        </label>
        <div className="row" style={{marginTop: '12px', gap: '8px', justifyContent: 'flex-end'}}>
          <button data-help-id="reliabilitySettings.saveUpdateSettings" disabled={busy} onClick={() => void update('configure')}>
            {tr("Save update settings")}
          </button>
          <button
            data-help-id="reliabilitySettings.checkForUpdates"
            disabled={busy || !updates?.settings.enabled || !updates.settings.feedUrl}
            onClick={() => void update('check')}
          >
            {tr("Check for updates")}
          </button>
        </div>

        {/* Update status */}
        {updates && (
          <p role="status" style={{marginTop: '8px', fontSize: '13px'}}>
            {updates.message}{updates.state === 'downloading' && updates.progress !== undefined ? ` ${Math.round(updates.progress)}%` : ''}
          </p>
        )}

        {/* Update action buttons */}
        {updates?.state === 'available' && (
          <button data-help-id="reliabilitySettings.downloadVersion" disabled={busy} onClick={() => void update('download')}>
            {tr("Download version")} {updates.version}
          </button>
        )}

        {updates?.state === 'downloaded' && (
          <button
            data-help-id="reliabilitySettings.installAndRestart"
            disabled={busy}
            onClick={() => {
              if (window.confirm('Finish the service and restart Worship Studio to install the downloaded update?')) void update('install');
            }}
          >
            {tr("Install and restart")}
          </button>
        )}
      </div>
    </>
  );

  return embedded ? content : (
    <Modal title={tr("Diagnostics and updates")} onClose={onClose}>
      {content}
    </Modal>
  );
}