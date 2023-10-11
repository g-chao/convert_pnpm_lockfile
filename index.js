

import YAML from 'yaml'
import fs from 'fs';
import { readWantedLockfile, writeWantedLockfile } from '@pnpm/lockfile-file';

// the function convertToInlineSpecifiersFormat is not export in '@pnpm/lockfile-file'
// so we need to import it in a ugly way
import { convertToInlineSpecifiersFormat } from './node_modules/.pnpm/@pnpm+lockfile-file@8.1.2_@pnpm+logger@5.0.0/node_modules/@pnpm/lockfile-file/lib/experiments/inlineSpecifiersLockfileConverters.js?'


const args = process.argv;
const pnpmLockfilePath = args[2];

convertLockfile5To6(pnpmLockfilePath);


async function convertLockfile5To6(path){
  console.log(`Start for ${path}`)
  // read lockfile
  const lockfile5 = await readWantedLockfile(path, {ignoreIncompatible: true});
  
  if(lockfile5 && Number(lockfile5.lockfileVersion) !== 6.0) {

    // try to convert from lockfile5 to lockfile6 use builtin function
    const lockfile6 = convertToInlineSpecifiersFormat(lockfile5);
    await writeWantedLockfile(path, lockfile6)

    // handle edge cases
    const original = YAML.parse(fs.readFileSync(`${path}/pnpm-lock.yaml`, 'utf8'));
    
    //add settings
    original.settings = {
      autoInstallPeers: false,
      excludeLinksFromLockfile: false
    }

    original.lockfileVersion = '6.0';
    handleDependency(original?.dependencies);
    handleDependency(original?.devDependencies);

    for (const oldKey in original.packages){

      handlePackageDependency(original.packages[oldKey]?.dependencies);
      handlePackageDependency(original.packages[oldKey]?.devDependencies)
      handlePackageDependency(original.packages[oldKey]?.optionalDependencies)

      //change format
      const keyArray = oldKey.split('/');
      const lastElement = keyArray.pop();
      const newKey = `${keyArray.join('/')}@${handlePackageDependencyVersion(lastElement)}`;
      delete Object.assign(original.packages, {[newKey]: original.packages[oldKey] })[oldKey];


    }

    fs.writeFileSync(`${path}/pnpm-lock.yaml`, YAML.stringify(original));
    
    console.log(`Done for ${path}`)
  }
}

function handleDependency (dependencies = {}) {
  for (const key in dependencies){

    // 3.0.9_react-dom@17.0.2+react@17.0.2 => 3.0.9(react-dom@17.0.2)(react@17.0.2)
    let oldValue = dependencies[key].version;

    // ignore link
    if(oldValue.startsWith('link:')){
      continue;
    }

    //handle registry cases and other special cases
    if(oldValue.startsWith('registry.npmjs.org') || oldValue.startsWith('/')){
      dependencies[key].version = handleNpmRegistry(oldValue);
      continue;
    }
    dependencies[key].version = handlePackageDependencyVersion(oldValue);
  }
  
}

function handlePackageDependency (dependencies = {}) {
  for (const key in dependencies){
    dependencies[key] = handlePackageDependencyVersion(dependencies[key]);
  }
}

function handlePackageDependencyVersion (version = '') {
  if(version.startsWith('link:')){
    return version;
  }

  if(version.startsWith('registry.npmjs.org') || version.startsWith('/')){
    return handleNpmRegistry(version);
  }

  version = version.includes('_') ? `${version})` : version;
  version = version.replace('_', '(');
  version = version.replace('+', '/');
  return version;
}

function handleNpmRegistry(version = ''){
  const valueArray = version.split('/');
  const lastElement = valueArray.pop();
  const newValue = `${valueArray.join('/')}@${handlePackageDependencyVersion(lastElement)}`;

  return newValue;
}


