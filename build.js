const path = require('path');
const fs = require('fs');
const nodeModulesPath = path.join(process.cwd(),'preload.js');

require('@vercel/ncc')(nodeModulesPath, {
    // provide a custom cache path or disable caching
    cache: false,
    // externals to leave as requires of the build
    externals: ["externalpackage"],
    // directory outside of which never to emit assets
    filterAssetBase: process.cwd(), // default
    minify: false, // default
    sourceMap: false, // default
    assetBuilds: false, // default
    sourceMapBasePrefix: '../', // default treats sources as output-relative
    // when outputting a sourcemap, automatically include
    // source-map-support in the output file (increases output by 32kB).
    sourceMapRegister: true, // default
    watch: false, // default
    license: '', // default does not generate a license file
    v8cache: false, // default
    quiet: false, // default
    debugLog: false // default
}).then(({ code, map, assets }) => {
    fs.writeFileSync(path.join(process.cwd(),'dist', 'preload.js'), code, 'utf-8');
})
