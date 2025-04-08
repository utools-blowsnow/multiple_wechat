
window.dbDevice = {
    getItem: function (name){
        let device = utools.getNativeId();
        name = name + "_" + device
        logger.log("dbDevice.getItem",name)
        return  utools.dbStorage.getItem(name)
    },
    setItem: function (name, value) {
        let device = utools.getNativeId();
        name = name + "_" + device
        logger.log("dbDevice.setItem",name)
        return utools.dbStorage.setItem(name, value)
    },
    deleteItem: function (name) {
        let device = utools.getNativeId();
        name = name + "_" + device
        logger.log("dbDevice.deleteItem",name)
        return utools.dbStorage.removeItem(name)
    }
}

if (utools.isDev()) {
    window.logger = require('./logger').createLogger( __dirname + "/../../log.log");
}else{
    // node 获取temp目录
    const os = require('os');
    let tempDir = os.tmpdir();
    window.logger = require('./logger').createLogger(tempDir + '\\log.log');
}
