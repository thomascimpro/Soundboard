const fs = require('fs');
const path = require('path');

const settingsPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@react-native',
  'gradle-plugin',
  'settings.gradle.kts',
);

if (!fs.existsSync(settingsPath)) {
  console.log('Gradle Foojay patch skipped: React Native Gradle settings not found.');
  process.exit(0);
}

const current = fs.readFileSync(settingsPath, 'utf8');
const fixed = current.replace(
  'org.gradle.toolchains.foojay-resolver-convention").version("0.5.0")',
  'org.gradle.toolchains.foojay-resolver-convention").version("1.0.0")',
);

if (fixed !== current) {
  fs.writeFileSync(settingsPath, fixed);
  console.log('Gradle Foojay patch applied.');
} else {
  console.log('Gradle Foojay patch not needed.');
}
