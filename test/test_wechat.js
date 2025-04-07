const path = require("node:path");
const fs = require("node:fs");
const {findLatestFile, findLatestFileAll} = require("../lib/file");
const pr = require("child_process");
const iconv = require("iconv-lite");
const {wechatHelp} = require("../lib/wechatHelp");


let wechatFilePath = "E:\\windowsInfo\\Documents\\xwechat_files";

async function main(){
    console.log(await wechatHelp.getLocalWechatAccountList());
}

main()
