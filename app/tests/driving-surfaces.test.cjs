const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const app = path.resolve(__dirname, '..');

for (const platform of ['ios', 'android', 'web']) {
  test(`${platform} resolves the correct driving adapter`, () => {
    const { resolve } = require('metro-resolver');
    const config = require('../metro.config');
    const context = {
      originModulePath: path.join(app, 'app/driving-context.tsx'),
      sourceExts: config.resolver.sourceExts,
      assetExts: new Set(config.resolver.assetExts),
      preferNativePlatform: true,
      mainFields: config.resolver.resolverMainFields,
      nodeModulesPaths: [], customResolverOptions: {},
      redirectModulePath: p => p, getPackage: () => null, getPackageForModule: () => null,
      doesFileExist: fs.existsSync,
      fileSystemLookup(p) {
        try {
          const stat = fs.statSync(p);
          return { exists: true, type: stat.isDirectory() ? 'd' : 'f', realPath: fs.realpathSync(p) };
        } catch { return { exists: false }; }
      },
    };
    const result = resolve(context, '../lib/driving-surfaces', platform);
    assert.equal(result.filePath, path.join(app, `lib/driving-surfaces${platform === 'ios' ? '.ios' : ''}.tsx`));
  });
}

function adapter({ available = true, startError = null, timeline = [] } = {}) {
  const snapshots = [];
  const activities = [];
  let registrations = 0;
  let starts = 0;
  let updates = 0;
  let ends = 0;
  const native = {
    DriveWidget: { getTimeline: async () => timeline, updateSnapshot: value => snapshots.push(value), reload() {} },
    DriveActivity: {
      getInstances: () => activities,
      start() {
        if (startError) throw startError;
        starts++;
        activities.push({ update: async () => { updates++; }, end: async () => { ends++; activities.length = 0; } });
      },
    },
  };
  const code = ts.transpileModule(fs.readFileSync(path.join(app, 'lib/driving-surfaces.ios.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require(name) {
    if (name === 'expo-modules-core') return { requireOptionalNativeModule: () => available ? {} : null };
    if (name === './driving-widgets.ios') { registrations++; return native; }
    throw new Error(`Unexpected dependency: ${name}`);
  }});
  return { api: exports, snapshots, counts: () => ({ registrations, starts, updates, ends }) };
}
const trip = { zone: 'Toronto sample trip', context: 'School approach', score: 84, speedKmh: 38, active: true };

test('opening the app registers layouts and seeds an honest idle widget', async () => {
  const subject = adapter();
  const result = await subject.api.initializeDriveSurfaces();
  assert.equal(result.widget, true);
  assert.equal(subject.counts().registrations, 1);
  assert.equal(subject.snapshots[0].score, null);
  assert.equal(subject.snapshots[0].active, false);
});

test('opening the app preserves the existing widget timeline', async () => {
  const subject = adapter({ timeline: [{ props: trip }] });
  await subject.api.initializeDriveSurfaces();
  assert.equal(subject.snapshots.length, 0);
});

test('Expo Go never loads the native widget implementation', async () => {
  const subject = adapter({ available: false });
  assert.match((await subject.api.initializeDriveSurfaces()).error, /Expo Go/);
  assert.equal((await subject.api.syncDriveSurfaces(trip)).widget, false);
  assert.equal(subject.counts().registrations, 0);
});

test('activity updates reuse the existing instance and finish leaves a stopped widget', async () => {
  const subject = adapter();
  await subject.api.syncDriveSurfaces(trip);
  await subject.api.syncDriveSurfaces({ ...trip, score: 90 });
  assert.deepEqual(subject.counts(), { registrations: 1, starts: 1, updates: 1, ends: 0 });
  await subject.api.endDriveSurfaces();
  assert.equal(subject.counts().ends, 1);
  assert.equal(subject.snapshots.at(-1).active, false);
  assert.equal(subject.snapshots.at(-1).speedKmh, 0);
  assert.equal(subject.snapshots.at(-1).score, 90);
});

test('a blocked Live Activity keeps the widget working and returns a visible error', async () => {
  const subject = adapter({ startError: new Error('Activities disabled') });
  const result = await subject.api.syncDriveSurfaces(trip);
  assert.equal(result.widget, true);
  assert.equal(result.liveActivity, false);
  assert.match(result.error, /Activities disabled/);
});

test('Expo compiles both actual layouts into executable widget strings', () => {
  const babel = require('@babel/core');
  const compiled = babel.transformFileSync(path.join(app, 'lib/driving-widgets.ios.tsx'), {
    presets: [[require.resolve('babel-preset-expo'), { jsxRuntime: 'automatic' }]],
    caller: { name: 'metro', bundler: 'metro', platform: 'ios' }, cwd: app,
  }).code;
  const layouts = {};
  vm.runInNewContext(compiled, { exports: {}, require: name => name === 'expo-widgets' ? {
    createWidget: (name, layout) => { layouts.widget = layout; assert.equal(name, 'DriveContext'); },
    createLiveActivity: (name, layout) => { layouts.activity = layout; assert.equal(name, 'DriveContext'); },
  } : {} });
  const runtime = {
    _jsx: (type, props) => ({ type, props }), _jsxs: (type, props) => ({ type, props }),
    VStack: 'VStack', HStack: 'HStack', Text: 'Text', Spacer: 'Spacer',
    padding: x => x, font: x => x, foregroundStyle: x => x,
  };
  assert.equal(typeof layouts.widget, 'string');
  assert.equal(typeof layouts.activity, 'string');
  const widget = vm.runInNewContext(`(${layouts.widget})`, runtime);
  const activity = vm.runInNewContext(`(${layouts.activity})`, runtime);
  assert.match(JSON.stringify(widget(trip)), /84 score/);
  assert.match(JSON.stringify(widget({ ...trip, score: null, active: false })), /Waiting for a drive/);
  const view = activity(trip);
  for (const key of ['banner', 'compactLeading', 'compactTrailing', 'minimal', 'expandedCenter']) assert.ok(view[key]);
});
