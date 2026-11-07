import git from 'isomorphic-git';
import fs from 'fs';
import path from 'path';

const dir = '.';

async function initAndCommit() {
  console.log('Initializing Git repository with isomorphic-git...');
  await git.init({ fs, dir });

  // List of files and directories to add
  const filesToAdd = [
    '.env.example',
    '.gitignore',
    'package.json',
    'package-lock.json',
    'README.md',
    'start.bat',
    'start.ps1',
    'server/index.js',
    'server/config.js',
    'server/routes/analyze.js',
    'server/routes/generate.js',
    'server/routes/parseData.js',
    'server/routes/preview.js',
    'server/services/excelService.js',
    'server/services/geminiService.js',
    'server/services/pdfService.js',
    'server/utils/coordinateConverter.js',
    'server/utils/sanitizer.js',
    'public/index.html',
    'public/css/style.css',
    'public/js/app.js',
    'public/js/canvasEditor.js',
    'public/js/uploader.js',
    'public/assets/sample-students.csv',
    'public/assets/sample-template.pdf',
    'public/assets/sample-template.svg',
    'scripts/generateSampleCertificate.js',
    'scripts/testServer.js'
  ];

  for (const filepath of filesToAdd) {
    if (fs.existsSync(path.resolve(filepath))) {
      await git.add({ fs, dir, filepath });
    }
  }

  console.log('All project files staged (excluding .env and node_modules).');

  const sha = await git.commit({
    fs,
    dir,
    author: {
      name: 'mvl-vijaya',
      email: 'mvl-vijaya@users.noreply.github.com'
    },
    message: 'Initial commit: Bulk Certify web application with Gemini Vision AI'
  });

  console.log('Committed successfully with SHA:', sha);

  // Set remote origin
  try {
    await git.addRemote({
      fs,
      dir,
      remote: 'origin',
      url: 'https://github.com/mvl-vijaya/Bulk-Certify.git',
      force: true
    });
    console.log('Remote origin set to https://github.com/mvl-vijaya/Bulk-Certify.git');
  } catch (rErr) {
    console.log('Remote already exists or set:', rErr.message);
  }

  // Branch set to main
  await git.branch({ fs, dir, ref: 'main', object: sha });
  console.log('Branch set to main.');
}

initAndCommit().catch(err => console.error('Git error:', err));
