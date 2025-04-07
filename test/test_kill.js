const {exec} = require('child_process');
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const fetch = require('node-fetch');  // 引入 node-fetch@2
const AdmZip = require('adm-zip');   // 引入 adm-zip 用于解压缩

function closeHandle(pid, handleId) {
    return new Promise((resolve, reject) => {
        exec(`powershell Start-Process "E:\\windowsInfo\\Downloads\\Handle\\handle.exe" -ArgumentList '-c', '${handleId}', '-p', '${pid}', '-y' -Verb RunAs -Wait`, (err, stdout) => {
            resolve(stdout);
        });
    })
}

const basePath = path.join(os.tmpdir(), "multiple_wechat");
if (!fs.existsSync(basePath)){
    fs.mkdirSync(basePath, {recursive: true});
}
// 1. 设置文件路径和 URL
const HANDLE_EXE_PATH = path.join(basePath, 'handle.exe');
const HANDLE_ZIP_PATH = path.join(basePath, 'Handle.zip');
const HANDLE_ZIP_URL = 'https://download.sysinternals.com/files/Handle.zip';
const WECHAT_MUTEX_NAME = "XWeChat_App_Instance_Identity_Mutex_Name";

// 2. 自动下载 handle.exe（如果不存在）
function downloadHandle() {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(HANDLE_EXE_PATH)) {
            return resolve('handle.exe 已存在');
        }

        console.log('下载 handle.exe...');

        // 下载 ZIP 文件
        fetch(HANDLE_ZIP_URL)
            .then(res => {
                if (res.status !== 200) {
                    throw new Error('下载失败');
                }

                // 将文件流写入到 Handle.zip
                const file = fs.createWriteStream(HANDLE_ZIP_PATH);
                res.body.pipe(file);

                // 下载完成后解压
                file.on('finish', () => {
                    file.close(() => {
                        console.log('下载 Handle.zip 完成，正在解压...');
                        try {
                            const zip = new AdmZip(HANDLE_ZIP_PATH);
                            zip.extractAllTo(basePath, true);  // 解压到当前目录
                            fs.unlinkSync(HANDLE_ZIP_PATH); // 解压完成后删除 ZIP 文件
                            resolve('handle.exe 下载并解压成功！');
                        } catch (err) {
                            reject(`解压失败: ${err.message}`);
                        }
                    });
                });
            })
            .catch(err => reject(`下载失败: ${err.message}`));
    });
}

// 3. 查找互斥体并释放
function releaseMutex() {
    return new Promise((resolve, reject) => {
        exec(`"${HANDLE_EXE_PATH}" -accepteula -p weixin -a ${WECHAT_MUTEX_NAME}`, (err, stdout, stderr) => {
            if (err || stderr) {
                return reject('未能查找到互斥体');
            }

            const match = stdout.match(/pid: (\d+)\s+type: (.*?)\s+([a-zA-Z0-9]+):/i);
            if (!match) {
                return reject('未找到互斥体');
            }

            const [, pid, type, handleId] = match;
            console.log(`找到互斥体：PID=${pid}, 句柄=${handleId}`);

            closeHandle(pid, handleId)
                .then(resolve)
                .catch(reject)
        });
    });
}


// 4. 主程序：下载 handle.exe 并释放互斥体
async function kill() {
    const downloadMessage = await downloadHandle();
    console.log(downloadMessage);

    const releaseMessage = await releaseMutex();
    console.log(releaseMessage);
}

module.exports = kill
