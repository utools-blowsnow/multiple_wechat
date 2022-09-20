const fs = require("fs");
let documents = window.utools.getPath('documents');
const path = require('path')

let configPath = documents + "\\WeChat Files\\All Users\\config\\config.data";



function startWx(wxid=0){
    // 重新登陆一个新的微信账号
    fs.unlinkSync(configPath);

    if (wxid && fs.existsSync(documents + "\\WeChat Files\\All Users\\config\\"+wxid+".data")){
        fs.copyFileSync(documents + "\\WeChat Files\\All Users\\config\\"+wxid+".data",configPath);
    }

    let exeData = window.utools.db.get("multiple_wechat");
    let exePath = null;

    if (!exeData || !fs.existsSync(exeData.data)){
        // window.utools.showNotification("未设置多开程序路径，请下载文件后设置");

        let list = window.utools.showOpenDialog({
            title: "请选择多开程序路径",
            filters: [{ 'name': 'multiple_wechat.exe', extensions: ['exe'] }],
            properties: ['openFile']
        })

        if (list && list.length > 0){
            exePath = list[0];
        }else{
            window.utools.copyText('https://github.com/utools-blowsnow/multiple_wechat/raw/master/multiple_wechat.exe')
            window.utools.showNotification("设置失败，下载地址已复制到剪切板");
            return;
        }

        window.utools.db.put({
            _id: "multiple_wechat",
            data: exePath
        });

    }else{
        exePath =  exeData.data;
    }
    // 启动微信
    window.utools.shellOpenPath(exePath);
}
function loadWxData(){
    // \WeChat Files\All Users\config\config.data
    let configText = fs.readFileSync(configPath, 'utf8');
    let matches = configText.match(/\\WeChat Files\\(.*?)\\config/);
    let wxid = matches[1];
    // 获取到wxid了


    // 获取账号名称
    let accInfoPath = documents + "\\WeChat Files\\" + wxid + "\\config\\AccInfo.dat";
    let accInfoText = fs.readFileSync(accInfoPath, 'utf8');
    let accInfoMatches = accInfoText.match(/http:\/\/wx.qlogo.cn[a-zA-Z0-9_/]+/);
    let wxPic = accInfoMatches[0];

    // 获取微信名称
    let fileObjs = fs.readdirSync(documents + "\\WeChat Files\\" + wxid);
    let wxName = "未知名称："  + wxid;
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
    let wxData = loadWxData();
    if (!wxData.id){   // 获取失败了
        return false;
    }
    // 备份一次下次快捷登陆使用
    fs.copyFileSync(configPath,documents + "\\WeChat Files\\All Users\\config\\"+wxData.id+".data");


    // 记录本次登陆的微信账号信息
    window.utools.db.put({
        _id: "wx_" + wxData.id,
        data: JSON.stringify(wxData)
    })

    return wxData;
}


window.exports = {
    "wechat_list": { // 注意：键对应的是 plugin.json 中的 features.code
        mode: "list",  // 列表模式
        args: {
            // 进入插件应用时调用（可选）
            enter: (action, callbackSetList) => {
                // 获取记录的微信列表
                let docs = window.utools.db.allDocs("wx_");
                let list = [];
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

                let data = saveWxData();
                if (data === false){
                    window.utools.showNotification("保存微信账号失败");
                    return;
                }else{
                    window.utools.showNotification("保存微信账号成功：" + data.name);
                }

                window.utools.outPlugin();
            }
        }
    }
}
