const fs = require('fs');
const path = require('path');

const apiPath = path.resolve('../sky-ui/app/api');
const v1Path = path.join(apiPath, 'v1');

if (!fs.existsSync(v1Path)) {
    fs.mkdirSync(v1Path);
}

const itemsToMove = ['auth', 'users', '[...path]'];

itemsToMove.forEach(item => {
    const src = path.join(apiPath, item);
    const dest = path.join(v1Path, item);
    
    if (fs.existsSync(src)) {
        // Move directory
        try {
            fs.renameSync(src, dest);
            console.log(`Moved ${item} to v1/${item}`);
        } catch (e) {
            console.error(`Failed to move ${item}:`, e);
        }
    }
});
