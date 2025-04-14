const {exec} = require('child_process');
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const fetch = require('node-fetch');  // 引入 node-fetch@2
const AdmZip = require('adm-zip');
const {GoConfigError} = require("./error");

const basePath = path.join(os.homedir(), "multiple_wechat");
if (!fs.existsSync(basePath)){
    fs.mkdirSync(basePath, {recursive: true});
}
// 1. 设置文件路径和 URL
const HANDLE_EXE_PATH = path.join(basePath, 'handle.exe');
const HANDLE_ZIP_PATH = path.join(basePath, 'Handle.zip');
const HANDLE_ZIP_URL = 'https://download.sysinternals.com/files/Handle.zip';
const WECHAT_MUTEX_NAME = "XWeChat_App_Instance_Identity_Mutex_Name";

function closeHandle(pid, handleId) {
    return new Promise((resolve, reject) => {
        let powershell = 'powershell'
        if (fs.existsSync("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe")){
            powershell = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"
        }
        setTimeout(() => {
            resolve();
        }, 3000)
        let command = `${powershell} Start-Process "${HANDLE_EXE_PATH}" -ArgumentList @('-c','${handleId}','-p','${pid}','-y') -Verb RunAs -Wait`;
        exec(command, (err, stdout) => {
            logger.info(`执行命令：${command}`);

            resolve(stdout);
        });
    })
}

// 2. 自动下载 handle.exe（如果不存在）
function downloadHandle() {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(HANDLE_EXE_PATH)) {
            return resolve('handle.exe 已存在');
        }

        logger.info('下载 handle.exe...');

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
                        logger.info('下载 Handle.zip 完成，正在解压...');
                        try {
                            const zip = new AdmZip(HANDLE_ZIP_PATH);
                            zip.extractAllTo(basePath, true);  // 解压到当前目录
                            fs.unlinkSync(HANDLE_ZIP_PATH); // 解压完成后删除 ZIP 文件
                            resolve('handle.exe 下载并解压成功！');
                        } catch (err) {
                            logger.error(`解压失败: ${err.message}`)
                            reject(`解压失败: ${err.message}`);
                        }
                    });
                });
            })
            .catch(err => {
                logger.error(`下载失败: ${err.message}`)
                reject(`下载失败: ${err.message}`)
            });
    });
}

// 3. 查找互斥体并释放
function releaseMutex() {
    if (!fs.existsSync(HANDLE_EXE_PATH)){
        throw new GoConfigError("handle.exe 不存在，请先下载");
    }
    return new Promise((resolve, reject) => {
        exec(`"${HANDLE_EXE_PATH}" -accepteula -p weixin -a ${WECHAT_MUTEX_NAME}`, (err, stdout, stderr) => {
            if (err || stderr) {
                logger.error('未能查找到互斥体.')
                return reject('未能查找到互斥体');
            }

            const match = stdout.match(/pid: (\d+)\s+type: (.*?)\s+([a-zA-Z0-9]+):/i);
            if (!match) {
                logger.error('未能查找到互斥体.')
                return reject('未找到互斥体');
            }

            const [, pid, type, handleId] = match;
            logger.info(`找到互斥体：PID=${pid}, 句柄=${handleId}`);

            closeHandle(pid, handleId)
                .then(resolve)
                .catch(reject)
        });
    });
}

/**
 * 关闭其他程序对文件的锁
 * @param {string} filePath - 文件路径
 */
function releaseFileLock(filePath) {
    return new Promise((resolve, reject) => {
        // 使用 handle.exe 查找占用文件的进程和句柄
        exec(`${HANDLE_EXE_PATH} -p weixin "${filePath}"`, (err, stdout, stderr) => {
            if (err) {
                logger.error(`Error finding file lock: ${stderr || err.message}`)
                return reject(`Error finding file lock: ${stderr || err.message}`);
            }

            // 解析 handle.exe 的输出，找到占用文件的 PID 和句柄 ID
            const matches = stdout.match(/pid: (\d+)\s+type: (.*?)\s+([a-zA-Z0-9]+):/ig);
            if (!matches) {
                logger.error('No process or handle found locking the file.')
                return reject('No process or handle found locking the file.');
            }
            for (const content of matches) {
                const match = content.match(/pid: (\d+)\s+type: (.*?)\s+([a-zA-Z0-9]+):/i);
                const [, pid, type, handleId] = match;
                logger.info(`File is locked by process with PID: ${pid}, Handle ID: ${handleId}`);
                // 使用 handle.exe 关闭特定的句柄
                exec(`${HANDLE_EXE_PATH} -c ${handleId} -p ${pid} -y`, (closeErr, closeStdout, closeStderr) => {
                    if (closeErr) {
                        return reject(`Error releasing file lock: ${closeStderr || closeErr.message}`);
                    }
                    logger.info(`Handle ${handleId} for PID ${pid} released successfully.`);
                    resolve();
                });
            }
        });
    });
}

module.exports = {
    releaseMutex,
    downloadHandle,
    releaseFileLock,
    HANDLE_EXE_PATH
}
