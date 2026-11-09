import {useState} from 'react';
import {
  Activity,
  Languages,
  Monitor,
  Radio,
  SlidersHorizontal,
  FolderOpen,
} from 'lucide-react';
import {Modal} from '../ui';
import {AccessibilitySettings} from '../AccessibilitySettings';
import {ExtrasSettings} from '../ExtrasSettings';
import {ReliabilitySettings} from '../ReliabilitySettings';
import {Button} from './primitives';
import {useText} from './text';
import type {DeskController} from './types';
import './dialogs.css';

const sections = [
  {label: 'Appearance and Accessibility', Icon: SlidersHorizontal},
  {label: 'Language', Icon: Languages},
  {label: 'Workspace and Backup', Icon: FolderOpen},
  {label: 'Outputs', Icon: Monitor},
  {label: 'Remote and Clicker', Icon: Radio},
  {label: 'Diagnostics and Updates', Icon: Activity},
];

export function Settings({c, onClose}: {c: DeskController; onClose: () => void}) {
  const tr = useText();
  const [section, setSection] = useState(0);
  const [more, setMore] = useState(c.settings.accessibility.mode === 'full');
  const [songLines, setSongLines] = useState(
    localStorage.getItem('studio-max-lines') || '4',
  );
  const saveLanguage = (language: 'en' | 'fil') =>
    void c.saveSettings({...c.settings, language});

  return (
    <Modal title={tr('Settings')} onClose={onClose} wide>
      <div className="ws-settings">
        <nav className="ws-section-nav" aria-label={tr('Settings sections')}>
          {sections.map(({label, Icon}, index) => (
            (index < 4 || more) && (
              <button
                type="button"
                key={label}
                aria-current={section === index ? 'page' : undefined}
                onClick={() => setSection(index)}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{tr(label)}</span>
              </button>
            )
          ))}
          {!more && (
            <button type="button" className="ws-section-more" onClick={() => setMore(true)}>
              {tr('More')}
            </button>
          )}
        </nav>

        <section
          className={`ws-settings-content${section === 0 ? ' ws-settings-appearance' : ''}`}
          aria-label={tr(sections[section].label)}
        >
          <h3>{tr(sections[section].label)}</h3>
          {section === 0 && (
            <>
              <Button
                help="settings.textStylesByContentType"
                onClick={() => void c.command('text-styles')}
              >
                {tr('Text styles by content type')}
              </Button>
              <AccessibilitySettings
                embedded
                settings={c.settings}
                onClose={onClose}
                onSave={c.saveSettings}
                onReset={() => void c.command('reset-panes')}
              />
            </>
          )}
          {section === 1 && (
            <label>
              {tr('Language')}
              <select
                data-help-id="settings.language"
                aria-label={tr('Language')}
                value={c.settings.language}
                onChange={event => saveLanguage(event.target.value as 'en' | 'fil')}
              >
                <option data-help-id="settings.english" value="en">English</option>
                <option data-help-id="settings.filipino" value="fil">Filipino</option>
              </select>
            </label>
          )}
          {section === 2 && (
            <div className="stack">
              <label>
                {tr('Workspace')}
                <p className="ws-path" title={c.info.path}>{c.info.path}</p>
              </label>
              <label>
                {tr('Default song lines per slide')}
                <select
                  value={songLines}
                  onChange={event => {
                    setSongLines(event.target.value);
                    localStorage.setItem('studio-max-lines', event.target.value);
                  }}
                >
                  {[2, 3, 4, 6].map(value => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </label>
              <Button help="settings.copyWorkspacePath" onClick={() => void c.command('copy-path')}>
                {tr('Copy workspace path')}
              </Button>
              <Button
                help="settings.chooseWorkspaceFolder"
                onClick={() => void c.act(() => window.studio.chooseWorkspace())}
              >
                {tr('Choose workspace folder')}
              </Button>
              <Button help="settings.welcomeGuide" onClick={() => void c.command('welcome')}>
                {tr('Welcome guide')}
              </Button>
              <Button help="settings.backUpSettings" onClick={() => void c.command('backup-settings')}>
                {tr('Back up settings')}
              </Button>
              <Button
                help="settings.restoreSettingsBackup"
                onClick={() => void c.act(async () => {
                  const value = await window.studio.extras('restore');
                  if (value.settings) await c.saveSettings(value.settings);
                })}
              >
                {tr('Restore settings backup')}
              </Button>
              <Button
                help="settings.resetSettings"
                onClick={() => void c.act(async () => {
                  const value = await window.studio.extras('reset');
                  if (value.settings) await c.saveSettings(value.settings);
                })}
              >
                {tr('Reset settings')}
              </Button>
              <Button help="settings.resetPaneSizes" onClick={() => void c.command('reset-panes')}>
                {tr('Reset pane sizes')}
              </Button>
              <p className="hint">{tr('Restoring settings never arms an output.')}</p>
            </div>
          )}
          {section === 3 && (
            <Button
              help="settings.outputsAndDisplays"
              onClick={() => void c.command('outputs')}
            >
              {tr('Outputs and displays…')}
            </Button>
          )}
          {section === 4 && (
            <ExtrasSettings
              embedded
              onClose={onClose}
              onChanged={settings => void c.saveSettings(settings)}
            />
          )}
          {section === 5 && <ReliabilitySettings embedded onClose={onClose} />}
        </section>
      </div>
    </Modal>
  );
}
