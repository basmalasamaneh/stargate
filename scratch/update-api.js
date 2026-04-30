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
            // We want to replace exactly '/api/' or "/api/" or `/api/` 
            // Note: We also need to avoid replacing '/api/v1/' to '/api/v1/v1/'
            let newContent = content.replace(/'\/api\/(?!v1\/)/g, "'/api/v1/");
            newContent = newContent.replace(/\"\/api\/(?!v1\/)/g, '\"/api/v1/');
            newContent = newContent.replace(/\`\/api\/(?!v1\/)/g, '\`/api/v1/');
            if (content !== newContent) {
                fs.writeFileSync(file, newContent, 'utf8');
                console.log('Updated ' + file);
            }
        });
    }
});
