import { readFileSync, writeFileSync, mkdirSync } from 'fs';

// Create dist directory if it doesn't exist
try {
  mkdirSync('dist', { recursive: true });
} catch (e) {
  // Directory already exists
}

// Copy Worker files to dist/
const worker = readFileSync('src/worker.js', 'utf8');
const chatroom = readFileSync('src/chatroom.js', 'utf8');
const personas = readFileSync('src/personas.js', 'utf8');

writeFileSync('dist/worker.js', worker);
writeFileSync('dist/chatroom.js', chatroom);
writeFileSync('dist/personas.js', personas);

console.log('✅ Worker build complete! Files written to dist/');
console.log('📦 Frontend files in public/ will be deployed separately to Pages');
