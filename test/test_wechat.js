const path = require("node:path");
const fs = require("node:fs");
const {findLatestFile, findLatestFileAll} = require("../src/lib/file");
const pr = require("child_process");
const iconv = require("iconv-lite");
const {wechatHelp} = require("../src/lib/wechatHelp");


let wechatFilePath = "E:\\windowsInfo\\Documents\\xwechat_files";

async function main(){
    console.log(await wechatHelp.getLocalWechatAccountList());
}

main()
