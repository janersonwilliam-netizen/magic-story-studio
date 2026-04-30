const fs = require('fs');
const content = fs.readFileSync('public/Playground/files/index.js', 'utf8');

const prefix = 'const HTML = `';
const suffix = '`;\n\nexport default {';

const startIndex = content.indexOf(prefix);
const endIndex = content.lastIndexOf(suffix);

if (startIndex !== -1 && endIndex !== -1) {
    let html = content.substring(startIndex + prefix.length, endIndex);
    
    // Unescape the backticks and dollar signs that were escaped in index.js
    html = html.replace(/\\`/g, '`').replace(/\\\$/g, '$');
    
    // Now use JSON.stringify to safely encode the string as a JS literal
    fs.writeFileSync('src/components/playgroundHtml.ts', 'export const playgroundHtml = ' + JSON.stringify(html) + ';\n');
    console.log('Extracted HTML successfully');
} else {
    console.log('Failed to match');
}
