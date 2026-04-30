const fs = require('fs');
const content = fs.readFileSync('public/Playground/files/index.js', 'utf8');

const prefix = 'const HTML = `';
const suffix = '`;\n\nexport default {';

const startIndex = content.indexOf(prefix);
const endIndex = content.lastIndexOf(suffix);

if (startIndex !== -1 && endIndex !== -1) {
    let html = content.substring(startIndex + prefix.length, endIndex);
    
    // We need to escape backticks and ${} to embed it inside a javascript template literal
    let escapedHtml = html.replace(/`/g, '\\`').replace(/\$/g, '\\$');
    
    fs.writeFileSync('src/components/playgroundHtml.ts', 'export const playgroundHtml = `\n' + escapedHtml + '\n`;\n');
    console.log('Extracted HTML successfully');
} else {
    console.log('Failed to match');
}
