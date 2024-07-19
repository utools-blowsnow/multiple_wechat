require('./lib/utoolsHelp')

let wechatHelp = require( './lib/wechatHelp');

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
                    description: "多开一个微信,登陆后记得回来输入“确认登陆”保存登陆信息",
                    icon: "./logo.png",
                    id: 0
                })

                for (let item of docs) {
                    if (!item._id.includes(utools.getNativeId())){
                        continue
                    }
                    let data = JSON.parse(item.value);
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
                    description: "多开一个微信,登陆后记得回来输入“确认登陆”保存登陆信息",
                    icon: "./logo.png",
                    id: 0
                })
                for (let item of docs) {
                    if (!item._id.includes(utools.getNativeId())){
                        continue
                    }
                    let data = JSON.parse(item.value);
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
            select: async (action, itemData, callbackSetList) => {
                window.utools.hideMainWindow()
                try {
                    await wechatHelp.startWx(itemData.id);
                } catch (e) {
                    window.utools.showNotification("启动失败：" + e.message);
                }
                window.utools.outPlugin()
            },
            // 子输入框为空时的占位符，默认为字符串"搜索"
            placeholder: "搜索"
        }
    },
    "wechat_delete_list": { // 注意：键对应的是 plugin.json 中的 features.code
        mode: "list",  // 列表模式
        args: {
            // 进入插件应用时调用（可选）
            enter: (action, callbackSetList) => {
                // 获取记录的微信列表
                let docs = window.utools.db.allDocs("wx_");

                let list = [];
                for (let item of docs) {
                    if (!item._id.includes(utools.getNativeId())){
                        continue
                    }
                    let data = JSON.parse(item.value);
                    list.push({
                        key: item._id,
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
                    if (!item._id.includes(utools.getNativeId())){
                        continue
                    }
                    let data = JSON.parse(item.value);
                    if (data.name.indexOf(searchWord) !== -1) {
                        list.push({
                            key: item._id,
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
            select: async (action, itemData, callbackSetList) => {
                window.utools.hideMainWindow()
                try {
                    utools.dbStorage.removeItem(itemData.key);
                } catch (e) {
                    window.utools.showNotification("删除失败：" + e.message);
                }
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
            enter: async (action) => {
                window.utools.hideMainWindow()

                try {
                    await wechatHelp.startWx(0);
                } catch (e) {
                    window.utools.showNotification("启动失败：" + e.message);
                }

                window.utools.outPlugin();
            }
        }
    },
    "wechat_save": {
        mode: "none",
        args: {
            // 进入插件应用时调用
            enter: async (action) => {
                window.utools.hideMainWindow()
                try {
                    let data = await wechatHelp.saveWxData();
                    window.utools.showNotification("保存微信账号成功：" + data.name);
                } catch (e) {
                    logger.error(e)
                    window.utools.showNotification("保存失败：" + e.message);
                }

                window.utools.outPlugin();
            }
        }
    },
    "wechat_file_path": {
        mode: "none",
        args: {
            // 进入插件应用时调用
            enter: ({ code, type, payload }) => {
                window.utools.hideMainWindow()

                if (payload.length > 0){

                    window.dbDevice.setItem("wechatFilePath", payload[0].path);

                    wechatHelp.reloadWechatFilePath();

                    window.utools.showNotification("保存成功：" + payload[0].path);
                }else{
                    window.utools.showNotification("保存失败");
                }

                window.utools.outPlugin();
            }
        }
    },
    "wechat_multiple_exe": {
        mode: "none",
        args: {
            // 进入插件应用时调用
            enter: ({ code, type, payload }) => {
                window.utools.hideMainWindow()

                if (payload.length > 0){
                    window.dbDevice.setItem("multiple_wechat", payload[0].path);

                    window.utools.showNotification("保存成功：" + payload[0].path);
                }else{
                    window.utools.showNotification("保存失败");
                }

                window.utools.outPlugin();
            }
        }
    },
    "download_wechat_multiple_exe": {
        mode: "none",
        args: {
            // 进入插件应用时调用
            enter: async ({code, type, payload}) => {
                window.utools.hideMainWindow()

                try {
                    await wechatHelp.downloadWechatMultipleExe();
                } catch (e) {
                    window.utools.showNotification("下载失败：" + e.message);
                }

                window.utools.outPlugin();
            }
        }
    },
}
