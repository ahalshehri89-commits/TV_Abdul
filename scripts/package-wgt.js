import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.resolve(projectRoot, 'dist');
const outputWgt = path.resolve(distDir, 'TV_Abdul.wgt');
const rootWgt = path.resolve(projectRoot, 'TV_Abdul.wgt');

async function packageWgt() {
  console.log('📦 Starting TV_Abdul.wgt packaging...');

  if (!fs.existsSync(distDir)) {
    console.error('❌ dist/ directory not found! Run "npm run build" first.');
    process.exit(1);
  }

  // Ensure config.xml and icon.png exist in dist
  const configXmlSrc = path.resolve(projectRoot, 'config.xml');
  const configXmlDest = path.resolve(distDir, 'config.xml');
  const iconSrc = path.resolve(projectRoot, 'public', 'icon.png');
  const iconDest = path.resolve(distDir, 'icon.png');

  if (fs.existsSync(configXmlSrc)) {
    fs.copyFileSync(configXmlSrc, configXmlDest);
    console.log('✔ Copied config.xml into dist/');
  } else {
    console.warn('⚠ config.xml not found at project root!');
  }

  if (fs.existsSync(iconSrc)) {
    fs.copyFileSync(iconSrc, iconDest);
    console.log('✔ Copied icon.png into dist/');
  }

  // Create zip stream for .wgt
  const output = fs.createWriteStream(outputWgt);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Maximum compression
  });

  output.on('close', () => {
    const sizeKb = (archive.pointer() / 1024).toFixed(2);
    console.log(`✅ Successfully generated: ${outputWgt} (${sizeKb} KB)`);
    // Also copy to root for quick access
    fs.copyFileSync(outputWgt, rootWgt);
    console.log(`✅ Copied to project root: ${rootWgt}`);
    console.log('\nReady for Samsung Smart TV installation via Tizen Studio or SDB.');
  });

  archive.on('warning', (err) => {
    if (err.code === 'ENOENT') {
      console.warn('Archiver warning:', err);
    } else {
      throw err;
    }
  });

  archive.on('error', (err) => {
    throw err;
  });

  archive.pipe(output);

  // Append all files from dist except .wgt files
  archive.glob('**/*', {
    cwd: distDir,
    ignore: ['*.wgt']
  });

  await archive.finalize();
}

packageWgt().catch((err) => {
  console.error('Packaging failed:', err);
  process.exit(1);
});
