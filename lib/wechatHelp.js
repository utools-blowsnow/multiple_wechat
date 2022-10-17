const fs = require("fs");
const pr = require("child_process");
const iconv = require("iconv-lite");
const axios = require("axios");

class WechatHelp{

    constructor() {
        this.#getWechatFilePath().then((path) => {
            this.wechatFilePath = path;
        })
    }

    /**
     * 获取微信文档路径
     * @returns {Promise<void>}
     */
    async #getWechatFilePath(){
        // 1. 尝试从数据库中获取记录的微信文档目录路径
        let wechatFilePath = window.db("wechatFilePath");

        // 2. 尝试从获取默认微信文档目录路径
        if (!fs.existsSync(wechatFilePath)){
            let documents = window.utools.getPath('documents');
            wechatFilePath = documents + "\\WeChat Files";

            logger.info("init local wechatFilePath",wechatFilePath);
        }

        // 3. 尝试从注册表中获取微信文档目录路径
        if (!fs.existsSync(wechatFilePath)){

            wechatFilePath = await this.#getRegWechatFilePath();

            logger.info("init reg wechatFilePath",wechatFilePath);

        }

        // 保存 微信文档目录路径 到数据库中去
        if (fs.existsSync(wechatFilePath)){
            window.db("wechatFilePath",wechatFilePath);
        }

        return wechatFilePath;
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
                    let matches = data.match(/[a-zA-Z]*?:.*/)
                    if (matches) resolve(matches[0]);

                    resolve(null)
                });
            })
        })

    }

    /**
     * 获取多开程序路径
     * @returns {Promise<*>}
     */
    async #getBinPath() {
        let exePath = window.db("multiple_wechat");

        if (!fs.existsSync(exePath)) {
            // 自动下载
            utools.showNotification("正在尝试自动下载多开程序，请等待下载完毕");

            const downloadUrl = "https://ghproxy.com/https://github.com/utools-blowsnow/multiple_wechat/releases/download/multiple_wechat.exe/multiple_wechat.exe";

            const {status, data} = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                onDownloadProgress: p => {
                    logger.info("download progress", p);
                }
            });

            if (status !== 200) {
                utools.shellOpenExternal('https://github.com/utools-blowsnow/multiple_wechat/releases/tag/multiple_wechat.exe')
                throw("多开程序下载失败，请手动下载");
            }

            utools.showNotification("多开程序已下载成功，下载路径：" + exePath);

            exePath = utools.getPath("downloads") + "\\multiple_wechat.exe";
            const buf = new Uint8Array(data);
            fs.writeFileSync(exePath, Buffer.from(buf), { mode: 0o755 });

            window.db("multiple_wechat",exePath);

        }

        return exePath;
    }

    /**
     * 读取当前登陆的微信数据
     */
    #loadWxData(){
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
        let accInfoPath = this.wechatFilePath + "\\" + wxid + "\\config\\AccInfo.dat";
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

    configPath(){
        return this.wechatFilePath + "\\All Users\\config\\config.data";
    }

    /**
     * 启动微信
     * @param wxid 0为启动一个新的微信
     * @returns {Promise<void>}
     */
    async startWx(wxid = 0) {
        // 重新登陆一个新的微信账号
        let configPath = this.configPath();
        if (fs.existsSync(configPath)) fs.unlinkSync(configPath);

        // 复制保存的微信账号登陆信息
        if (wxid && fs.existsSync(this.wechatFilePath + "\\All Users\\config\\" + wxid + ".data")) {
            fs.copyFileSync(this.wechatFilePath + "\\All Users\\config\\" + wxid + ".data", configPath);
        }

        let binPath = await this.#getBinPath();

        // 启动微信
        window.utools.shellOpenPath(binPath);

        if (wxid === 0 && window.db("show_tip") !== "1"){  // 打开一个新的微信
            window.db("show_tip","1");
            utools.showNotification("多开帮助：启动微信后，请在登陆成功后，在utools中输入“确认登陆”即可保存当前登陆信息，下次可以直接在“多开列表”中查看/快捷登陆");
        }
    }

    /**
     * 保存微信登陆数据
     * @returns {{id}|*}
     */
    async saveWxData(){
        if (!this.wechatFilePath){
            throw new Error("获取微信文档 WeChat Files 目录失败");
        }

        let wxData = this.#loadWxData();
        if (!wxData || !wxData.id){   // 获取失败了
            throw new Error("获取微信用户数据失败");
        }
        // 备份一次下次快捷登陆使用
        fs.copyFileSync(this.configPath(),this.wechatFilePath + "\\All Users\\config\\"+wxData.id+".data");

        // 记录本次登陆的微信账号信息
        window.db("wx_" + wxData.id,JSON.stringify(wxData));

        return wxData;
    }
}


let wechatHelp = new WechatHelp();

module.exports = wechatHelp;
