const fs = require("fs");
let documents = window.utools.getPath('documents');
const path = require('path')

let wechatFilePath = documents + "\\WeChat Files";
if (!fs.existsSync(wechatFilePath)){
    let wechatFilePathData = window.utools.db.get("wechatFilePath");
    if (wechatFilePathData){
        wechatFilePath = wechatFilePathData.data;
    }
}

function configPath(){
    return wechatFilePath + "\\All Users\\config\\config.data";
}
function getExePath(){
    let exeData = window.utools.db.get("multiple_wechat");
    let exePath = null;


    if (!exeData || !fs.existsSync(exeData.data)){

        let list = window.utools.showOpenDialog({
            title: "请选择多开程序路径",
            filters: [{ 'name': 'multiple_wechat.exe', extensions: ['exe'] }],
            properties: ['openFile']
        })

        if (!list || list.length === 0){
            window.utools.copyText('https://github.com/utools-blowsnow/multiple_wechat/raw/master/multiple_wechat.exe')
            window.utools.showNotification("设置失败，多开程序下载地址已复制到剪切板");
            return false;
        }

        exePath = list[0];

        if (exePath.indexOf("multiple_wechat.exe") === -1){
            window.utools.copyText('https://github.com/utools-blowsnow/multiple_wechat/raw/master/multiple_wechat.exe')
            window.utools.showNotification("请下载多开程序，下载地址已复制到剪切板");
            return false;
        }

        window.utools.db.put({
            _id: "multiple_wechat",
            data: exePath
        });

    }else{
        exePath =  exeData.data;
    }

    return exePath;
}
function getWechatFilesPath(){
    if (!fs.existsSync(wechatFilePath)){
        let list = window.utools.showOpenDialog({
            title: "请选择微信文档 WeChat Files 目录",
            properties: ['openDirectory']
        })
        if (!list || list.length === 0){
            window.utools.showNotification("选择目录失败");
            return false;
        }

        wechatFilePath = list[0];

        if (wechatFilePath.split("\\").pop() !== "WeChat Files"){
            window.utools.showNotification("请选择微信文档 WeChat Files 目录");
            return false;
        }

        window.utools.db.put({
            _id: "wechatFilePath",
            data: wechatFilePath
        })
    }

    return wechatFilePath;
}

function startWx(wxid=0){
    // 重新登陆一个新的微信账号
    if (fs.existsSync(configPath())) fs.unlinkSync(configPath());

    if (wxid && fs.existsSync(wechatFilePath + "\\All Users\\config\\"+wxid+".data")){
        fs.copyFileSync(wechatFilePath + "\\All Users\\config\\"+wxid+".data",configPath());
    }

    let exePath = getExePath();
    if (!exePath) return false;

    // 启动微信
    window.utools.shellOpenPath(exePath);
}
function loadWxData(){
    if (!fs.existsSync(configPath())){
        window.utools.showNotification("未登录，无法获取登陆信息");
        return false;
    }


    // \WeChat Files\All Users\config\config.data
    let configText = fs.readFileSync(configPath(), 'utf8');
    let matches = configText.match(/wxid_[a-zA-Z0-9]*/);
    if (!matches) return false;
    let wxid = matches[0];
    // 获取到wxid了

    // 获取账号名称
    let accInfoPath = wechatFilePath + "\\" + wxid + "\\config\\AccInfo.dat";
    let accInfoText = fs.readFileSync(accInfoPath, 'utf8');
    let accInfoMatches = accInfoText.match(/http:\/\/wx.qlogo.cn[a-zA-Z0-9_/]+/);
    let wxPic = accInfoMatches[0];

    // 获取微信名称
    let fileObjs = fs.readdirSync(wechatFilePath + "\\" + wxid);
    let wxName = "获取名称失败："  + wxid;
    for (const fileObj of fileObjs) {
        if (fileObj.startsWith("account_")){
            wxName = fileObj.split("_")[1];
            break;
        }
    }


    return {
        id: wxid,
        logo: wxPic,
        name: wxName,
    }

}
function saveWxData(){
    if (!getWechatFilesPath()){
        return false;
    }

    let wxData = loadWxData();
    if (!wxData || !wxData.id){   // 获取失败了
        return false;
    }
    // 备份一次下次快捷登陆使用
    fs.copyFileSync(configPath(),wechatFilePath + "\\All Users\\config\\"+wxData.id+".data");

    // 记录本次登陆的微信账号信息
    window.utools.db.put({
        _id: "wx_" + wxData.id,
        data: JSON.stringify(wxData)
    })

    return wxData;
}

window.saveWxData = saveWxData;
window.startWx = startWx;

window.exports = {
    "wechat_list": { // 注意：键对应的是 plugin.json 中的 features.code
        mode: "list",  // 列表模式
        args: {
            // 进入插件应用时调用（可选）
            enter: (action, callbackSetList) => {
                // 获取记录的微信列表
                let docs = window.utools.db.allDocs("wx_");
                let list = [];
                list.push({
                    title: "多开一个微信",
                    description: "多开一个微信,保存登陆信息",
                    icon: "./logo.png",
                    id: 0
                })

                for (let item of docs) {
                    let data = JSON.parse(item.data);
                    list.push({
                        title: data.name,
                        description: data.id,
                        icon: data.logo,
                        id: data.id
                    })
                }

                // 如果进入插件应用就要显示列表数据
                callbackSetList(list)
            },
            // 子输入框内容变化时被调用 可选 (未设置则无搜索)
            search: (action, searchWord, callbackSetList) => {
                // 获取一些数据
                let docs = window.utools.db.allDocs("wx_");
                let list = [];
                list.push({
                    title: "多开一个微信",
                    description: "多开一个微信,保存登陆信息",
                    icon: "./logo.png",
                    id: 0
                })
                for (let item of docs) {
                    let data = JSON.parse(item.data);
                    if (data.name.indexOf(searchWord) !== -1) {
                        list.push({
                            title: data.name,
                            description: data.id,
                            icon: data.logo,
                            id: data.id
                        })
                    }
                }

                // 执行 callbackSetList 显示出来
                callbackSetList(list)
            },
            // 用户选择列表中某个条目时被调用
            select: (action, itemData, callbackSetList) => {
                window.utools.hideMainWindow()
                startWx(itemData.id);
                window.utools.outPlugin()
            },
            // 子输入框为空时的占位符，默认为字符串"搜索"
            placeholder: "搜索"
        }
    },
    "wechat_start": {
        mode: "none",
        args: {
            // 进入插件应用时调用
            enter: (action) => {
                window.utools.hideMainWindow()

                startWx(0);

                window.utools.outPlugin();
            }
        }
    },
    "wechat_save": {
        mode: "none",
        args: {
            // 进入插件应用时调用
            enter: (action) => {
                window.utools.hideMainWindow()
                let data = null;
                try {
                    data = saveWxData();
                }catch (e){
                    // window.utools.showNotification("保存失败：" + e.message);
                    //
                    // fs.writeFileSync("C:\\error.txt", JSON.stringify(e, Object.getOwnPropertyNames(e), 2));

                }
                if (data === false){
                    window.utools.showNotification("保存微信账号失败");
                }else{
                    window.utools.showNotification("保存微信账号成功：" + data.name);
                }

                window.utools.outPlugin();
            }
        }
    }
}
