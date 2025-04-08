const fs = require('fs');
const path = require('path');

// 查找目录下指定文件最新的
function findLatestFile(findDir, fileName) {
    let latestTime = 0;
    let latestPath = null;

    // 遍历登录目录下的所有子目录
    const loginDirs = fs.readdirSync(findDir);
    for (const dir of loginDirs) {
        const dirPath = path.join(findDir, dir);
        if (fs.statSync(dirPath).isDirectory()) {
            const keyInfoPath = path.join(dirPath, fileName);
            // 检查 key_info.db 是否存在
            if (fs.existsSync(keyInfoPath)) {
                const fileStats = fs.statSync(keyInfoPath);
                // 比较文件修改时间，保留最新的
                if (fileStats.mtimeMs > latestTime) {
                    latestTime = fileStats.mtimeMs;
                    latestPath = dirPath;
                }
            }
        }
    }

    return latestPath;
}

function findDirName(findDir, name){
    // 遍历登录目录下的所有子目录
    const loginDirs = fs.readdirSync(findDir);
    for (const dir of loginDirs) {
        const dirPath = path.join(findDir, dir);
        if (fs.statSync(dirPath).isDirectory()) {
            if (dir.includes(name)){
                return dirPath;
            }
        }
    }

    return null;
}

// 查找目录下指定文件最新的
function findLatestFileAll(findDir, filterDir=null, filterFile=null) {
    let latestTime = 0;
    let latestPath = null;

    function loop(findDir){
        // 遍历登录目录下的所有子目录
        const loginDirs = fs.readdirSync(findDir);
        for (const dir of loginDirs) {
            const dirPath = path.join(findDir, dir);
            const fileStats = fs.statSync(dirPath);
            if (fileStats.isDirectory()) {
                if (!filterDir || filterDir(dirPath)){
                    loop(dirPath);
                }
            }else if (fileStats.isFile()){
                if (filterFile && !filterFile(dirPath)){
                    continue
                }
                // 比较文件修改时间，保留最新的
                if (fileStats.mtimeMs > latestTime) {
                    latestTime = fileStats.mtimeMs;
                    latestPath = dirPath;
                }
            }
        }
    }

    loop(findDir);

    return latestPath;
}


module.exports = {
    findLatestFile,
    findLatestFileAll,
    findDirName
}
