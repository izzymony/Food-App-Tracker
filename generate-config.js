const fs = require('fs');

const apiKey = process.env.GEMINI_KEY || '';
const content = `const CONFIG = { GEMINI_KEY: "${apiKey}" };`;

fs.writeFileSync('config.js', content);
console.log('config.js generated successfully.');
