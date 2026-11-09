import {useState} from 'react';
import {Modal, Select} from './ui';
import {deskT} from './i18n';
import type {StudioSettings} from '../backend/settings-model';

export function AccessibilitySettings({
  settings,
  onClose,
  onSave,
  onReset,
  embedded = false,
}: {
  settings: StudioSettings;
  embedded?: boolean;
  onClose: () => void;
  onSave: (settings: StudioSettings) => Promise<unknown>;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const tr = (label: string) => deskT(draft.language, label);
  const accessibility = draft.accessibility;
  const update = (patch: Partial<typeof accessibility>) =>
    setDraft({...draft, accessibility: {...accessibility, ...patch}});

  const content = (
    <div className="ws-accessibility-settings">
      <div className="ws-accessibility-fields">
        <Select
          help="accessibilitySettings.themeSelect"
          optionHelp="common.selectOption"
          label={tr('Theme')}
          value={accessibility.theme}
          onChange={value => update({theme: value as typeof accessibility.theme})}
          options={[
            ['light', 'Light'],
            ['dark', 'Dark'],
            ['high-contrast', 'High contrast'],
            ['system', 'Follow system'],
          ].map(([value, label]) => ({value, label: tr(label)}))}
        />
        <Select
          help="accessibilitySettings.uIScaleSelect"
          optionHelp="common.selectOption"
          label={tr('UI scale')}
          value={String(accessibility.scale)}
          onChange={value => update({scale: Number(value) as typeof accessibility.scale})}
          options={[100, 125, 150, 200].map(value => ({
            value: String(value),
            label: `${value}%`,
          }))}
        />
        <div className="ws-accessibility-toggles">
          {(
            [
              ['largeTargets', 'Large targets'],
              ['strongFocus', 'Strong focus ring'],
              ['reduceMotion', 'Reduce motion'],
              ['shortcutHints', 'Show shortcut hints'],
              ['colorTags', 'Color-independent state tags'],
            ] as const
          ).map(([key, label]) => (
            <label className="ws-setting-toggle" key={key}>
              <input
                type="checkbox"
                checked={accessibility[key]}
                onChange={event => update({[key]: event.target.checked})}
              />
              <span>{tr(label)}</span>
            </label>
          ))}
        </div>
        <Select
          help="accessibilitySettings.modeSelect"
          optionHelp="common.selectOption"
          label={tr('Mode')}
          value={accessibility.mode}
          onChange={value => update({mode: value as typeof accessibility.mode})}
          options={[
            {value: 'simple', label: tr('Simple mode')},
            {value: 'full', label: tr('Full mode')},
          ]}
        />
        <p className="hint">{tr('Essentials first. Advanced tools are in More.')}</p>
        <button type="button" onClick={onReset}>
          {tr('Reset pane sizes')}
        </button>
      </div>
      {error && <p className="ws-accessibility-error" role="alert">{error}</p>}
      <div className="dialog-actions">
        <button type="button" onClick={onClose}>{tr('Cancel')}</button>
        <button
          type="button"
          disabled={busy}
          className="primary"
          onClick={() => {
            setBusy(true);
            void onSave(draft)
              .then(onClose)
              .catch(reason => setError(String(reason)))
              .finally(() => setBusy(false));
          }}
        >
          {tr('Save accessibility settings')}
        </button>
      </div>
    </div>
  );

  return embedded
    ? content
    : <Modal title={tr('Accessibility')} onClose={onClose}>{content}</Modal>;
}
