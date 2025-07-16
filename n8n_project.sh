#!/bin/bash

# Modo de uso: ./generar_estructura.sh nombre-del-proyecto

nombre_proyecto_kebab=$1
nombre_proyecto_cammel=$(echo "$1" | sed -r 's/(^|-)([a-z])/echo \2 | tr -d "-" | tr a-z A-Z/e')

# Crear el directorio del proyecto
mkdir "n8n-$nombre_proyecto_kebab"
cd "n8n-$nombre_proyecto_kebab" || exit

# Crear tsconfig.json
cat <<EOT > tsconfig.json
{
  "compilerOptions": {
    "target": "es2021",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": ".",
    "strict": true,
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true
  },
  "include": ["nodes/**/*.ts"],
  "exclude": ["node_modules"]
}
EOT

# Crear gulpfile.js
cat <<EOT > gulpfile.js
const { src, dest, task } = require('gulp');

function buildIcons() {
  return src('nodes/**/*.svg').pipe(dest('dist/nodes/'));
}

task('build:icons', buildIcons);
task('default', task('build:icons'));

module.exports = {
  'build:icons': buildIcons,
};
EOT

# Crear .gitignore
cat <<EOT > .gitignore
node_modules/
dist/
.vscode/
EOT

# Crear package.json
cat <<EOT > package.json
{
  "name": "n8n-nodes-$nombre_proyecto_kebab",
  "version": "1.0.0",
  "description": "n8n community node for ",
  "license": "MIT",
  "author": "junforever",
  "main": "dist/nodes/$nombre_proyecto_cammel/$nombre_proyecto_cammel.node.js",
  "files": [
    "dist"
  ],
  "keywords": [
    "n8n",
    "n8n-community-node",
    "$nombre_proyecto_kebab"
  ],
  "scripts": {
    "build": "tsc && gulp build:icons"
  },
  "n8n": {
    "n8nNodesApiVersion": 1,
    "credentials": [],
    "nodes": [
      "dist/nodes/$nombre_proyecto_cammel/$nombre_proyecto_cammel.node.js"
    ]
  },
  "devDependencies": {
    "@types/node": "^24.0.10",
    "gulp": "^5.0.1",
    "n8n-workflow": "^1.82.0",
    "typescript": "^5.8.3"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/junforever/n8n-nodes-$nombre_proyecto_kebab.git"
  }
}
EOT

# Crear la estructura de directorios y archivo node.ts
mkdir -p "nodes/$nombre_proyecto_cammel"
cat <<EOT > "nodes/$nombre_proyecto_cammel/$nombre_proyecto_cammel.node.ts"
import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
EOT