
const fs = require("fs");
const pr = require("child_process");
const iconv = require("iconv-lite");
const axios = require("axios");
const path = require("node:path");
// const logger = require('./logger').createLogger( 'd:\\log.log');
class GoConfigError extends Error{}

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
            wechatDocumentPath = documents + "\\WeChat Files";

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
        let dataPath = path.join(tmpWechatDocumentPath, "All Users", "config", "config.data");
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

    async #downloadByGithub(githubUrl, options = {}) {
        return await Promise.race([
            axios.get("https://cdn.jsdelivr.net/gh/utools-blowsnow/multiple_wechat@multiple/multiple_wechat.js", options),
            axios.get("https://mirror.ghproxy.com/" + githubUrl, options),
        ]);
    }
    /**
     * 获取多开程序路径
     * @returns {Promise<*>}
     */
    async #getBinPath() {

        let exePath = window.dbDevice.getItem("multiple_wechat");

        logger.info("getBinPath",exePath);

        if (!exePath || !fs.existsSync(exePath)) {
            throw new GoConfigError("多开程序不存在，请先下载多开程序");
        }


        return exePath;
    }

    async getLocalWechatAccountList() {
        let wechatFilePath = await this.#getWechatDocumentPath();
        let configDirPath = wechatFilePath + "\\All Users\\config";
        if (!fs.existsSync(configDirPath)){
            throw new Error("未配置微信文档路径");
        }
        // 扫描路径下所有的 .data结尾的文件
        let files = fs.readdirSync(configDirPath);
        let wxList = [];

        logger.info("扫到本地data文件列表", files)

        for (const file of files) {
            if (file.endsWith(".data") && file !== "config.data"){
                logger.info("解析data文件", configDirPath + "\\" + file)
                try {
                    let wxData = await this.#parseWxData(configDirPath + "\\" + file);
                    wxList.push(wxData);
                }catch (e){
                    logger.error('解析微信数据失败', configDirPath + "\\" + file ,e)
                }
            }
        }
        return wxList;
    }

    /**
     * 读取当前登陆的微信数据
     */
    async #loadWxData(){
        let configPath = await this.configPath();

        logger.info("loadWxData configPath",configPath);

        if (!fs.existsSync(configPath)){
            throw new Error("未登录，无法获取登陆信息");
        }
        return this.#parseWxData(configPath)
    }

    async #parseWxData(wechatIdDataPath){
        // \WeChat Files\All Users\config\config.data
        let configText = fs.readFileSync(wechatIdDataPath, 'utf8');

        let matches = configText.match(/\\([^\\]*?)\\config\\AccInfo\.dat/);
        if (!matches) {
            throw new Error("解析微信ID失败，请重新登录");
        }
        let wxid = matches[1];
        // 获取到wxid了

        let wechatFilePath = await this.#getWechatDocumentPath()
        // 获取账号名称
        let accInfoPath = wechatFilePath + "\\" + wxid + "\\config\\AccInfo.dat";
        let accInfoText = fs.readFileSync(accInfoPath, 'utf8');
        let accInfoMatches = accInfoText.match(/https?:\/\/[a-zA-Z0-9_/\.]+/);
        let wxPic = "./logo.png";
        if (accInfoMatches) {
            wxPic = accInfoMatches[0];
        }

        logger.info("loadWxData wxid", wxid);
        logger.info("loadWxData wxPic", wxPic);

        // 获取微信名称
        // 获取 accInfoText 最后一行
        let accInfoLines = accInfoText.split("\n");
        let accInfoLine = "";
        for (const line of accInfoLines) {
            if (line.includes(wxPic)) {
                accInfoLine = line;
                break;
            }
        }

        let accountNamematchs = accInfoLine.match(/[\u4e00-\u9fa5a-zA-Z\-_]+/);
        let wxName = "未知识别名称_" + wxid;
        if (accountNamematchs) {
            wxName = accountNamematchs[0];
        }

        return {
            id: wxid,
            logo: wxPic,
            name: wxName,
            path: wechatIdDataPath,
            isLogin: this.isAccountLoggedIn(wechatFilePath + "\\" + wxid)
        }
    }

    async configPath(){
        let wechatFilePath = await this.#getWechatDocumentPath()
        if (!wechatFilePath){
            throw new GoConfigError("文档路径不存在")
        }
        return wechatFilePath + "\\All Users\\config\\config.data";
    }


    /**
     * 启动微信
     * @returns {Promise<void>}
     * @param itemData
     */
    async startWx(itemData=null) {
        let configPath = await this.configPath();

        // if (fs.existsSync(configPath)) fs.unlinkSync(configPath);

        // 重新登陆一个新的微信账号
        if (itemData){
            if (!fs.existsSync(itemData.path)){
                throw new Error("微信账号信息不存在");
            }

            // 复制保存的微信账号登陆信息  覆盖文件
            fs.copyFileSync(itemData.path, configPath, fs.constants.COPYFILE_EXCL);
        }

        let binPath = await this.#getBinPath();

        // 启动微信
        window.utools.shellOpenPath(binPath);

        utools.showNotification("正在等待微信登陆，登陆完成将保存登陆信息")

        // 监听微信登陆完成
        let configPathStats = fs.existsSync(configPath) ? fs.statSync(configPath): null;
        // 新开个定时任务
        logger.log("ready 定时任务监听登陆完成", configPath, fs.existsSync(configPath), configPathStats)
        return new Promise((resolve, reject) => {
            let intervalTimer = setInterval(() => {
                let nowConfigPathStats = fs.statSync(configPath);
                if (configPathStats == null || configPathStats.mtimeMs !== nowConfigPathStats.mtimeMs){
                    clearInterval(intervalTimer)
                    logger.log("登陆成功", nowConfigPathStats)
                    this.saveWxData()
                    resolve()
                }
                logger.log("检测登陆是否成功")
            }, 100)
        })
    }

    deleteWechat(itemData) {

    }

    /**
     * 保存微信登陆数据
     * @returns {{id}|*}
     */
    async saveWxData(){
        let wechatFilePath = await this.#getWechatDocumentPath();

        let wxData = await this.#loadWxData();
        if (!wxData || !wxData.id){   // 获取失败了
            throw new Error("获取微信用户数据失败");
        }
        // 备份一次下次快捷登陆使用
        let configPath = await this.configPath();
        fs.copyFileSync(configPath,wechatFilePath + "\\All Users\\config\\"+wxData.id+".data");

        // 记录本次登陆的微信账号信息
        window.dbDevice.setItem("wx_" + wxData.id,JSON.stringify(wxData));

        return wxData;
    }

    async downloadWechatMultipleExe(){
        utools.showNotification("正在下载多开程序，请等待下载完毕");

        const githubUrl = 'https://github.com/utools-blowsnow/multiple_wechat/releases/download/multiple_wechat.exe/multiple_wechat.exe';
        const response = await this.#downloadByGithub(githubUrl, {
            responseType: 'arraybuffer',
            onDownloadProgress: p => {
                logger.info("download progress", p);
            }
        })

        const {status, data} = response;

        let exePath = utools.getPath("downloads") + "\\multiple_wechat.exe";

        if (status !== 200) {
            utools.shellOpenExternal('https://github.com/utools-blowsnow/multiple_wechat/releases/tag/multiple_wechat.exe')
            throw(new Error("多开程序下载失败，请手动下载，放置目录：" + exePath));
        }

        const buf = new Uint8Array(data);
        fs.writeFileSync(exePath, Buffer.from(buf), { mode: 0o755 });

        utools.showNotification("多开程序已下载成功，下载路径：" + exePath);

        window.dbDevice.setItem("multiple_wechat",exePath);
    }

    isAccountLoggedIn(accountPath){
        const msgFolder = path.join(accountPath, 'Msg');
        console.log(`检查 ${msgFolder} 中`);
        if (!fs.existsSync(msgFolder)) {
            return false;
        }

        let shmCount = 0;
        let walCount = 0;

        const files = fs.readdirSync(msgFolder);
        for (const file of files) {
            if (file.endsWith('.db-shm')) {
                shmCount += 1;
                console.log(`有 ${shmCount} 个 shm`);
            } else if (file.endsWith('.db-wal')) {
                walCount += 1;
            }

            if (shmCount >= 5 && walCount >= 5) {
                console.log("CheckLogined：已经符合了");
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
    GoConfigError
};
