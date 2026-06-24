import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const ROOT = join(import.meta.dirname, '..');

function pruneMessages(fileName) {
  const path = join(ROOT, 'messages', fileName);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const admin = data.admin;

  if (!admin) {
    console.warn(`No admin section in ${fileName}`);
    return;
  }

  delete admin.tabs?.contentStudio;
  delete admin.tabs?.data;

  delete admin.shell?.tabs?.['content-studio'];
  delete admin.shell?.tabHint?.['content-studio'];
  delete admin.shell?.setup?.steps?.contentStudioSync;
  delete admin.shell?.activity?.contentStudioSync;
  delete admin.shell?.help?.['content-studio'];
  delete admin.shell?.risk?.['content-studio'];
  delete admin.shell?.subCrumbs?.['content-studio'];

  if (admin.tooltips) {
    delete admin.tooltips;
  }

  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`Pruned admin content-studio keys in ${fileName}`);
}

pruneMessages('en.json');
pruneMessages('he.json');
