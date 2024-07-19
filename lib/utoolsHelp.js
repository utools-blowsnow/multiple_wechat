
window.db = function (name, value = undefined) {
    // 更新数据
    if (value !== undefined) {
        utools.dbStorage.setItem(value)
        return;
    }
    return utools.dbStorage.getItem(name)
}

window.dbDevice = function (name, value = undefined) {
    let device = utools.getNativeId();
    name = name + "_" + device

    return window.db(name, value)
}

if (process.env.NODE_ENV === 'development') {
    window.logger = require('./logger').createLogger('d:\\log.log');
}else{
    // node 获取temp目录
    const os = require('os');
    let tempDir = os.tmpdir();
    window.logger = require('./logger').createLogger(tempDir + '\\log.log');
}
