
window.db = function (name, value = undefined) {
    let obj = utools.db.get(name);

    // 更新数据
    if (value !== undefined) {
        let putData = {
            _id: name,
            data: value,
        }
        if (obj && obj._rev) {
            putData._rev = obj._rev;
        }
        utools.db.put(putData)
        return;
    }
    if (obj == null) return null;
    return obj.data;
}

if (process.env.NODE_ENV === 'development') {
    window.logger = require('./logger').createLogger('d:\\log.log');
}else{
    // node 获取temp目录
    const os = require('os');
    let tempDir = os.tmpdir();
    window.logger = require('./logger').createLogger(tempDir + '\\log.log');
}
