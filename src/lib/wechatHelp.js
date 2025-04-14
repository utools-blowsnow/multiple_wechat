
const fs = require("fs");
const pr = require("child_process");
const iconv = require("iconv-lite");
const path = require("node:path");
const {findLatestFile, findLatestFileAll, findDirName} = require("./file");
const {releaseMutex, downloadHandle, releaseFileLock} = require("./kill");
const {GoConfigError} = require("./error");


class WechatHelp {
    constructor() {
        this.wechatDocumentPath = null;
    }

    /**
     * 获取微信文档路径
     * @returns {Promise<void>}
     */
    async #getWechatDocumentPath() {
        let wechatDocumentPath = this.wechatDocumentPath;
        if (fs.existsSync(wechatDocumentPath)){
            return wechatDocumentPath
        }
        // 1. 尝试从数据库中获取记录的微信文档目录路径
        wechatDocumentPath = window.dbDevice.getItem("wechatFilePath");

        // 2. 尝试从获取默认微信文档目录路径
        if (!fs.existsSync(wechatDocumentPath)){
            let documents = window.utools.getPath('documents');
            wechatDocumentPath = documents + "\\xwechat_files";

            logger.info("init local wechatFilePath",wechatDocumentPath);
        }

        // 3. 尝试从注册表中获取微信文档目录路径
        if (!fs.existsSync(wechatDocumentPath)){
            wechatDocumentPath = await this.#getRegWechatFilePath();

            logger.info("init reg wechatFilePath",wechatDocumentPath);
        }

        if (!fs.existsSync(wechatDocumentPath)){
            throw new GoConfigError("文档路径不存在")
        }

        this.wechatDocumentPath = wechatDocumentPath;

        return wechatDocumentPath;
    }

    saveWechatFilePath(tmpWechatDocumentPath){
        // 校验微信文档目录是否有问题
        let dataPath = path.join(tmpWechatDocumentPath, "all_users", "config", "global_config");
        if (!fs.existsSync(dataPath)){
            throw new Error("微信文档路径不正确")
        }

        this.wechatDocumentPath = tmpWechatDocumentPath;

        window.dbDevice.setItem("wechatFilePath", tmpWechatDocumentPath);
    }

    /**
     * 从注册表中获取微信文档路径
     * @returns {Promise<unknown>}
     */
    #getRegWechatFilePath(){
        // 从注册表中获取微信文档路径
        const CODE_PAGE = {
            '936': 'gbk',
            '65001': 'utf-8'
        };

        return new Promise((resolve, reject) => {
            pr.exec('chcp', function (_err, _stdout, _stderr){
                if (_err) {
                    reject(_err)
                }
                const page = _stdout.replace(/[^0-9]/ig, "");
                let _encoding = CODE_PAGE[page]

                pr.exec("REG QUERY HKEY_CURRENT_USER\\Software\\Tencent\\WeChat /v FileSavePath",{ encoding: 'buffer'},function(error,stdout,stderr){
                    if (_err) {
                        reject(_err)
                    }
                    let data;
                    if (_encoding === 'uft8'){
                        data = stdout.toString()
                    }else{
                        data = iconv.decode(stdout, "gbk").toString()
                    }
                    logger.info("getRegWechatFilePath",data);
                    let matches = data.match(/[a-zA-Z]*?:.*/)
                    if (matches) resolve(matches[0]);

                    resolve(null)
                });
            })
        })

    }

    #getRegWechatExeFilePath(){
        // 从注册表中获取微信文档路径
        const CODE_PAGE = {
            '936': 'gbk',
            '65001': 'utf-8'
        };

        return new Promise((resolve, reject) => {
            pr.exec('chcp', function (_err, _stdout, _stderr){
                if (_err) {
                    reject(_err)
                }
                const page = _stdout.replace(/[^0-9]/ig, "");
                let _encoding = CODE_PAGE[page]

                pr.exec("REG QUERY HKEY_CURRENT_USER\\Software\\Tencent\\Weixin /v InstallPath",{ encoding: 'buffer'},function(error,stdout,stderr){
                    if (_err) {
                        reject(_err)
                    }
                    let data;
                    if (_encoding === 'uft8'){
                        data = stdout.toString()
                    }else{
                        data = iconv.decode(stdout, "gbk").toString()
                    }
                    logger.info("getRegWechatExeFilePath",data);
                    let matches = data.match(/[a-zA-Z]*?:.*/)
                    if (matches) resolve(matches[0]);

                    resolve(null)
                });
            })
        })
    }


    async getLocalWechatAccountList() {
        let wechatFilePath = await this.#getWechatDocumentPath();
        let configDirPath = path.join(wechatFilePath, "all_users", "plugin_save_config");
        if (!fs.existsSync(configDirPath)){
            throw new GoConfigError("未配置微信文档路径");
        }
        let paths = fs.readdirSync(configDirPath);
        let wxList = [];

        logger.info("扫到本地记录的文件列表", paths)

        for (const path of paths) {
            const wxidPath = configDirPath + "\\" + path
            const wxidStats = fs.statSync(wxidPath);
            if (!wxidStats.isDirectory()) continue;
            const wxid = wxidPath.split("\\").pop();

            const wxidRealPath = findDirName(wechatFilePath, wxid)

            logger.info("保存wxidRealPath", wxidRealPath, wxidPath + "\\logo.png");

            wxList.push({
                id: wxid,
                logo: wxidPath + "\\logo.png",
                name: wxid,
                path: wxidPath,
                accountPath: wxidRealPath,
                isLogin: this.isAccountLoggedIn(wxidRealPath)
            });
        }
        return wxList;
    }

    /**
     * 启动微信
     * @returns {Promise<void>}
     * @param itemData
     */
    async startWx(itemData=null) {
        let wechatFilePath = await this.#getWechatDocumentPath();

        // await releaseFileLock(wechatFilePath + "\\all_users\\config\\global_config")
        // await releaseFileLock(wechatFilePath + "\\all_users\\config\\global_config.crc")

        // 重新登陆一个新的微信账号
        if (itemData){
            if (!fs.existsSync(itemData.path)){
                throw new Error("微信账号信息不存在");
            }
            // 复制保存的微信账号登陆信息  覆盖文件
            fs.copyFileSync(itemData.path + "\\global_config", wechatFilePath + "\\all_users\\config\\global_config");
            fs.copyFileSync(itemData.path + "\\global_config.crc", wechatFilePath + "\\all_users\\config\\global_config.crc");
        }else{
            fs.rmSync(wechatFilePath + "\\all_users\\config\\global_config")
            fs.rmSync(wechatFilePath + "\\all_users\\config\\global_config.crc")
        }

        logger.info("startWx")

        // 1. 杀掉互斥进程
        await releaseMutex().catch(e => {
            logger.error("杀进程锁失败", e.message)
        })

        // 2. 获取微信进程路径
        let binPath = await this.#getRegWechatExeFilePath();
        binPath = binPath + "\\Weixin.exe"
        logger.info("binPath", binPath)
        if (!binPath || !fs.existsSync(binPath)){
            throw new Error("获取微信EXE路径失败");
        }


        // 3. 启动微信
        window.utools.shellOpenPath(binPath);

        utools.showNotification("登陆完成后请自行保存微信登录信息")
    }

    deleteWechat(itemData) {
        if (!fs.existsSync(itemData.path)){
            throw new Error("微信账号信息不存在");
        }
        fs.rmdirSync(itemData.path, {recursive: true});
    }

    /**
     * 保存微信登陆数据
     * @returns {{id}|*}
     */
    async saveWxData(){
        let wechatFilePath = await this.#getWechatDocumentPath();

        // 查找 \all_users\login 目录下的 key_info.db 文件最后更新时间
        let loginPath = path.join(wechatFilePath, "all_users", "login");
        if (!fs.existsSync(loginPath)){
            throw new Error("微信登陆目录不存在，请检查是否已登录/微信文档路径有误");
        }

        const latestPath = findLatestFile(loginPath, "key_info.db-shm")
        if (!latestPath){
            throw new Error("微信登陆目录下没有 key_info.db 文件");
        }

        // wxid
        let wxid = latestPath.split("\\").pop();
        let wxData = {
            id: wxid,
        }
        if (!wxData || !wxData.id){   // 获取失败了
            throw new Error("获取微信用户数据失败");
        }

        // 备份一次下次快捷登陆使用
        const wxidPath = path.join(wechatFilePath, "all_users", "plugin_save_config", wxData.id);
        if (!fs.existsSync(wxidPath)){
            fs.mkdirSync(wxidPath, {recursive: true});
        }

        fs.copyFileSync(wechatFilePath + "\\all_users\\config\\global_config",wxidPath + "\\global_config");
        fs.copyFileSync(wechatFilePath + "\\all_users\\config\\global_config.crc",wxidPath + "\\global_config.crc");
        const lastImgPath = findLatestFileAll(wechatFilePath + "\\all_users\\head_imgs\\0")
        if (lastImgPath){
            fs.copyFileSync(lastImgPath,wxidPath + "\\logo.png");
        }

        wxData = {
            id: wxid,
            logo: wxidPath + "\\logo.png",
            name: wxid,
            path: wxidPath,
            isLogin: this.isAccountLoggedIn(wechatFilePath + "\\" + wxid)
        }

        // 记录本次登陆的微信账号信息
        window.dbDevice.setItem("wx_" + wxData.id,JSON.stringify(wxData));

        return wxData;
    }

    isAccountLoggedIn(accountPath){
        const msgFolder = path.join(accountPath, 'db_storage', 'message');
        logger.info(`检查 ${msgFolder} 中`);
        if (!fs.existsSync(msgFolder)) {
            logger.info(`检查 ${msgFolder} 不存在，跳过`);
            return false;
        }

        let shmCount = 0;
        let walCount = 0;

        const files = fs.readdirSync(msgFolder);
        for (const file of files) {
            if (file.endsWith('.db-shm')) {
                shmCount += 1;
                logger.info(`有 ${shmCount} 个 shm`);
            } else if (file.endsWith('.db-wal')) {
                walCount += 1;
            }

            if (shmCount >= 4 && walCount >= 4) {
                logger.info("CheckLogined：已经符合了");
                return true;
            }
        }

        return false;
    }

}


let wechatHelp = new WechatHelp();
// wechatHelp.wechatFilePath = 'D:\\Administrator\\Documents\\WeChat Files'
// wechatHelp.getLocalWechatAccountList().then(r => r => {
//     console.log(r);
// })
// console.log(wechatHelp.isAccountLoggedIn('D:\\Administrator\\Documents\\WeChat Files\\wxid_yjvyrw614h6p22'))
module.exports = {
    wechatHelp,
};
