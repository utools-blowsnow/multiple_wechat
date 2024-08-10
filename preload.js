require('./lib/utoolsHelp')

let {wechatHelp, GoConfigError} = require( './lib/wechatHelp');

async function buildWechatList() {
    // 获取记录的微信列表
    let localWechatList = await wechatHelp.getLocalWechatAccountList()
    let list = [];
    for (let data of localWechatList) {
        list.push({
            title: data.name  + (data.isLogin ? ' - [在线]': ''),
            description: data.id,
            icon: data.logo,
            id: data.id,
            path: data.path
        })
    }
    return list;
}

window.exports = {
    "wechat_list": { // 注意：键对应的是 plugin.json 中的 features.code
        mode: "list",  // 列表模式
        args: {
            // 进入插件应用时调用（可选）
            enter: async (action, callbackSetList) => {
                let list = []
                try{
                    list = await buildWechatList();
                }catch (e) {
                    logger.error("获取列表失败",e)
                    window.utools.showNotification("获取列表失败：" + e.message);
                    if (e instanceof GoConfigError){
                        window.utools.redirect('多开配置')
                    }
                    return
                }
                list.unshift({
                    title: "多开一个微信",
                    description: "多开一个微信,登陆后记得回来输入“确认登陆”保存登陆信息",
                    icon: "./logo.png",
                    id: 0
                })

                // 如果进入插件应用就要显示列表数据
                callbackSetList(list)
            },
            // 子输入框内容变化时被调用 可选 (未设置则无搜索)
            search: async (action, searchWord, callbackSetList) => {

                let list = await buildWechatList();

                list = list.filter(item => item.name.includes(searchWord))
                list.unshift({
                    title: "多开一个微信",
                    description: "多开一个微信,登陆后记得回来输入“确认登陆”保存登陆信息",
                    icon: "./logo.png",
                    id: 0
                })

                // 执行 callbackSetList 显示出来
                callbackSetList(list)
            },
            // 用户选择列表中某个条目时被调用
            select: async (action, itemData, callbackSetList) => {
                window.utools.hideMainWindow()

                try {
                    if (itemData.id === 0) itemData = null
                    await wechatHelp.startWx(itemData);

                } catch (e) {
                    logger.error("启动微信失败",e)
                    window.utools.showNotification("启动失败：" + e.message);
                    if (e instanceof GoConfigError){
                        window.utools.redirect('多开配置')
                    }
                    return
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
            enter: async (action, callbackSetList) => {
                let list = []
                try{
                    list = await buildWechatList();
                }catch (e) {
                    logger.error("获取列表失败",e)
                    window.utools.showNotification("获取列表失败：" + e.message);
                    if (e instanceof GoConfigError){
                        window.utools.redirect('多开配置')
                    }
                    return
                }
                // 如果进入插件应用就要显示列表数据
                callbackSetList(list)
            },
            // 子输入框内容变化时被调用 可选 (未设置则无搜索)
            search: async (action, searchWord, callbackSetList) => {
                // 获取一些数据
                let list = await buildWechatList();
                list = list.filter(item => item.name.includes(searchWord))

                // 执行 callbackSetList 显示出来
                callbackSetList(list)
            },
            // 用户选择列表中某个条目时被调用
            select: async (action, itemData, callbackSetList) => {
                window.utools.hideMainWindow()
                try {
                    wechatHelp.deleteWechat(itemData)
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

                logger.log("快开启动微信多开")
                try {
                    await wechatHelp.startWx(null);
                } catch (e) {
                    logger.error("快开启动失败" , typeof e,e)
                    window.utools.showNotification("启动失败：" + e.message);
                    if (e instanceof GoConfigError){
                        utools.redirect('多开配置')
                    }
                    return
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
                    logger.error("保存微信账号失败",e)
                    window.utools.showNotification("保存失败：" + e.message);
                    if (e instanceof GoConfigError){
                        window.utools.redirect('多开配置')
                    }
                }

                window.utools.outPlugin();
            }
        }
    },
    "config": { // 注意：键对应的是 plugin.json 中的 features.code
        mode: "list",  // 列表模式
        args: {
            // 进入插件应用时调用（可选）
            enter: async (action, callbackSetList) => {
                let list = [];
                list.push({
                    title: "下载微信多开软件",
                    description: "回车即确认同意从互联网下载多开软件用于执行多开微信",
                    icon: "./logo.png",
                    id: 0
                })
                list.push({
                    title: "设置微信文档路径",
                    description: "请粘贴微信文档路径到Utools输入框",
                    icon: "./logo.png",
                    id: 1
                })
                // 如果进入插件应用就要显示列表数据
                callbackSetList(list)
            },
            // 用户选择列表中某个条目时被调用
            select: async (action, itemData, callbackSetList) => {
                window.utools.hideMainWindow()

                if (itemData.id === 0){
                    try {
                        await wechatHelp.downloadWechatMultipleExe();
                    } catch (e) {
                        window.utools.showNotification("下载失败：" + e.message);
                    }
                }else if (itemData.id === 1){
                    window.utools.showNotification("请粘贴微信文档路径到Utools输入框");
                }

                window.utools.outPlugin();
            },
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
    "wechat_file_path": {
        mode: "none",
        args: {
            // 进入插件应用时调用
            enter: ({ code, type, payload }) => {
                window.utools.hideMainWindow()

                if (payload.length > 0){

                    try {
                        wechatHelp.saveWechatFilePath(payload[0].path);
                    }catch (e){
                        window.utools.showNotification("保存失败：" + e.message);
                        return
                    }

                    window.utools.showNotification("保存成功：" + payload[0].path);
                }else{
                    window.utools.showNotification("保存失败");
                }

                window.utools.outPlugin();
            }
        }
    },
}
