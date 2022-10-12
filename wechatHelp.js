const fs = require("fs");
const pr = require("child_process");
const iconv = require("iconv-lite");

// 尝试从数据库中获取记录的微信文档路径
let wechatFilePath;

class WechatHelp{

    constructor() {
        this.#init();
    }

    async #init(){

        wechatFilePath = window.db("wechatFilePath");

        logger.info("init db wechatFilePath",wechatFilePath);

        if (!fs.existsSync(wechatFilePath)){
            // 尝试所以默认获取微信文档目录
            let documents = window.utools.getPath('documents');
            wechatFilePath = documents + "\\WeChat Files";

            logger.info("init local wechatFilePath",wechatFilePath);

        }

        // 可能后续迁移了微信文档目录
        if (!fs.existsSync(wechatFilePath)){

            wechatFilePath = await this.#getRegWechatFilePath();

            logger.info("init reg wechatFilePath",wechatFilePath);

        }

        if (!fs.existsSync(wechatFilePath)){
            window.db("wechatFilePath",wechatFilePath);
        }
    }

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
                    let matches = data.match(/[a-zA-Z]*?:.*/)
                    if (matches) resolve(matches[0]);

                    resolve(null)
                });
            })
        })

    }

    wechatFilePath(){
        return wechatFilePath;
    }

    configPath(){
        return wechatFilePath + "\\All Users\\config\\config.data";
    }

    getExePath(){
        let exePath = window.db("multiple_wechat");

        if (!exePath || !fs.existsSync(exePath)){

            let list = window.utools.showOpenDialog({
                title: "请选择多开程序路径",
                filters: [{ 'name': 'multiple_wechat.exe', extensions: ['exe'] }],
                properties: ['openFile']
            })

            if (!list || list.length === 0){
                utools.shellOpenExternal('https://github.com/utools-blowsnow/multiple_wechat/releases/tag/multiple_wechat.exe')
                throw new Error("请下载多开程序后，使用程序设置多开程序路径");
            }

            exePath = list[0];

            if (exePath.indexOf("multiple_wechat.exe") === -1){
                utools.shellOpenExternal('https://github.com/utools-blowsnow/multiple_wechat/releases/tag/multiple_wechat.exe')
                throw new Error("请下载多开程序后，使用程序设置多开程序路径");
            }

            window.db("multiple_wechat",exePath);

        }

        return exePath;
    }

    getWechatFilesPath(){
        logger.info("getWechatFilesPath",wechatFilePath);

        if (!fs.existsSync(wechatFilePath)){
            let list = window.utools.showOpenDialog({
                title: "请选择微信文档 WeChat Files 目录",
                properties: ['openDirectory']
            })

            if (!list || list.length === 0){
                throw new Error("选择目录失败");
            }

            wechatFilePath = list[0];

            if (wechatFilePath.split("\\").pop() !== "WeChat Files"){
                throw new Error("请选择微信文档 WeChat Files 目录");
            }

            window.db("wechatFilePath",wechatFilePath)
        }

        return wechatFilePath;
    }

    startWx(wxid=0){
        // 重新登陆一个新的微信账号
        let configPath = this.configPath();
        if (fs.existsSync(configPath)) fs.unlinkSync(configPath);

        if (wxid && fs.existsSync(wechatFilePath + "\\All Users\\config\\"+wxid+".data")){
            fs.copyFileSync(wechatFilePath + "\\All Users\\config\\"+wxid+".data", configPath);
        }

        let exePath = this.getExePath();

        // 启动微信
        window.utools.shellOpenPath(exePath);
    }

    loadWxData(){
        let configPath = this.configPath();
        if (!fs.existsSync(configPath)){
            throw new Error("未登录，无法获取登陆信息");
        }

        // let data = fs.readFileSync(configPath);

        // \WeChat Files\All Users\config\config.data
        let configText = fs.readFileSync(configPath, 'utf8');
        let matches = configText.match(/wxid_[a-zA-Z0-9]*/);
        if (!matches){
            throw new Error("解析微信ID失败，请重新登录");
        }
        let wxid = matches[0];
        // 获取到wxid了

        // 获取账号名称
        let accInfoPath = wechatFilePath + "\\" + wxid + "\\config\\AccInfo.dat";
        let accInfoText = fs.readFileSync(accInfoPath, 'utf8');
        let accInfoMatches = accInfoText.match(/http:\/\/wx.qlogo.cn[a-zA-Z0-9_/]+/);
        let wxPic = accInfoMatches[0];

        // 获取微信名称

        // 获取 accInfoText 最后一行
        let accInfoLines = accInfoText.split("\n");
        let accInfoLine = "";
        for (const line of accInfoLines) {
            if (line.includes("wx.qlogo.cn")){
                accInfoLine = line;
                break;
            }
        }

        let accountNamematchs = accInfoLine.match(/[\u4e00-\u9fa5a-zA-Z\-_]+/);
        let wxName = "获取名称失败："  + wxid;
        if (accountNamematchs.length > 0) {
            wxName = accountNamematchs[0];
        }

        return {
            id: wxid,
            logo: wxPic,
            name: wxName,
        }

    }

    saveWxData(){
        if (!this.getWechatFilesPath()){
            throw new Error("获取微信文档 WeChat Files 目录失败");
        }

        let wxData = this.loadWxData();
        if (!wxData || !wxData.id){   // 获取失败了
            throw new Error("获取微信用户数据失败");
        }
        // 备份一次下次快捷登陆使用
        fs.copyFileSync(this.configPath(),wechatFilePath + "\\All Users\\config\\"+wxData.id+".data");

        // 记录本次登陆的微信账号信息
        window.db("wx_" + wxData.id,JSON.stringify(wxData));

        return wxData;
    }
}

let wechatHelp = new WechatHelp();

module.exports = wechatHelp;
