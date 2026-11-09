import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {clampV2Layout, getResponsiveLayout} from '../frontend/ui-v2/layout';
import {checkWSContrast, wsThemes} from '../frontend/ui-v2/tokens';
import {contrastRatio} from '../frontend/desk-tokens';

test('operator themes meet their documented text and control contrast', () => {
  const violations = checkWSContrast().filter(
    result => result.ratio + 0.01 < result.minimum,
  );

  assert.deepEqual(violations, []);
});

test('light theme outlines are visible against every light workspace surface', () => {
  const light = wsThemes.light;
  const surfaces = [light['bg-app'], light['bg-pane'], light['bg-pane-alt'], light['bg-hover']];

  for (const outline of [light.border, light['border-control']]) {
    for (const surface of surfaces) {
      assert.ok(
        contrastRatio(outline, surface) >= 3,
        `${outline} outline must contrast with ${surface} by at least 3:1`,
      );
    }
  }
});

test('operator theme stylesheet matches the tested theme tokens', async () => {
  const stylesheet = await readFile(
    new URL('../frontend/ui-v2/colors.css', import.meta.url),
    'utf8',
  );

  for (const [theme, colors] of Object.entries(wsThemes)) {
    const selector = theme === 'high-contrast' ? 'high-contrast' : theme;
    const block = stylesheet.match(
      new RegExp(
        `:root\\[data-operator-ui=v2\\]\\[data-theme="${selector}"\\],\\.ws-theme-${selector}\\{([^}]*)\\}`,
      ),
    )?.[1];

    assert.ok(block, `Missing ${theme} theme stylesheet`);
    const declarations = new Map(
      block.split(';').map(declaration => {
        const [name, value] = declaration.split(':');
        return [name.trim(), value.trim()];
      }),
    );

    for (const [token, value] of Object.entries(colors)) {
      assert.equal(declarations.get(`--ws-${token}`), value, `${theme}: ${token}`);
    }
  }
});

test('light mode outlines icon controls, the service work area, and editable title', async () => {
  const stylesheet = await readFile(
    new URL('../frontend/ui-v2/light-mode.css', import.meta.url),
    'utf8',
  );

  for (const selector of ['.ws-icon-button', '.ws-service', '.ws-service-title input']) {
    assert.ok(stylesheet.includes(selector), `Missing light-mode outline for ${selector}`);
  }
  assert.match(stylesheet, /border-color:\s*var\(--ws-border-control\)/);
  assert.match(stylesheet, /\.ws-service[\s\S]*?border:\s*1px solid var\(--ws-border\)/);
});

test('output settings use labeled responsive controls and grouped action rows', async () => {
  const component = await readFile(
    new URL('../frontend/OutputSettings.tsx', import.meta.url),
    'utf8',
  );
  const stylesheet = await readFile(
    new URL('../frontend/ui-v2/dialogs.css', import.meta.url),
    'utf8',
  );

  assert.match(component, /className="output-controls"/);
  assert.match(component, /className="output-control-field"/);
  assert.match(component, /className="output-actions"/);
  assert.doesNotMatch(component, /className="output-more"/);
  assert.match(stylesheet, /\.output-controls\{display:grid/);
  assert.match(stylesheet, /@media\(max-width:680px\)[\s\S]*?\.output-controls\{grid-template-columns/);
  assert.match(stylesheet, /@media\(max-width:480px\)[\s\S]*?\.output-controls\{grid-template-columns:minmax\(0,1fr\)/);
});

test('operator pane widths preserve saved sizes and fit supported window widths', () => {
  const saved = {library: 300, presentation: 420, serviceRatio: 60};
  assert.deepEqual(clampV2Layout(saved, 1366), saved);

  for (const width of [1024, 1280, 1920]) {
    const layout = getResponsiveLayout(width);
    const fixedWidth = 72 + 8 + 8 + 340;

    assert.ok(layout.library >= 240);
    assert.ok(layout.presentation >= 320);
    assert.ok(layout.library + layout.presentation + fixedWidth <= width);
  }
});
