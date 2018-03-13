    Module = {};
    if (typeof basedirForWasmFiles === 'undefined') {
        basedirForWasmFiles = "";
    }
    var wasmURL = basedirForWasmFiles + 'xzdec.wasm';
    var wasmXHR = new XMLHttpRequest();
    wasmXHR.open('GET', wasmURL, true);
    wasmXHR.responseType = 'arraybuffer';
    wasmXHR.onload = function () {
        if (wasmXHR.status === 200 || wasmXHR.status === 0) {
            Module.wasmBinary = wasmXHR.response;
        }

        var memoryInitializer = basedirForWasmFiles + 'xzdec.js.mem';
        if (typeof Module['locateFile'] === 'function') {
            memoryInitializer = Module['locateFile'](memoryInitializer);
        } else if (Module['memoryInitializerPrefixURL']) {
            memoryInitializer = Module['memoryInitializerPrefixURL'] + memoryInitializer;
        }
        Module['memoryInitializerRequestURL'] = memoryInitializer;
        var meminitXHR = Module['memoryInitializerRequest'] = new XMLHttpRequest();
        meminitXHR.open('GET', memoryInitializer, true);
        meminitXHR.responseType = 'arraybuffer';
        meminitXHR.send(null);

        var script = document.createElement('script');
        script.src = basedirForWasmFiles + "js/lib/xzdec.js";
        document.body.appendChild(script);

    };
    wasmXHR.send(null);