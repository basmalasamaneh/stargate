const fs = require('fs');
const path = require('path');
const folders = ['../sky-ui/app', '../sky-ui/components', '../sky-ui/contexts', '../sky-ui/lib'];
function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkDir(file));
        } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
            results.push(file);
        }
    });
    return results;
}
folders.forEach(folder => {
    if(fs.existsSync(folder)){
        walkDir(folder).forEach(file => {
            let content = fs.readFileSync(file, 'utf8');
            let newContent = content.replace(/\/api\/v1\/v1\//g, '/api/v1/');
            newContent = newContent.replace(/ui-avatars\.com\/api\/v1\//g, 'ui-avatars.com/api/');
            if (content !== newContent) {
                fs.writeFileSync(file, newContent, 'utf8');
                console.log('Fixed duplicate v1 in ' + file);
            }
        });
    }
});
