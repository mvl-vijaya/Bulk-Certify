import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import fs from 'fs';

const token = process.argv[2] || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

async function push() {
  console.log('Attempting push to https://github.com/mvl-vijaya/Bulk-Certify.git...');
  if (!token) {
    console.log('⚠️ No GITHUB_TOKEN environment variable detected.');
  }

  const pushResult = await git.push({
    fs,
    http,
    dir: '.',
    remote: 'origin',
    ref: 'main',
    force: true,
    onAuth: () => {
      if (token) {
        return { username: token };
      }
      return undefined;
    }
  });

  console.log('Push result:', pushResult);
}

push().catch(err => {
  console.error('Push error:', err.message);
});
