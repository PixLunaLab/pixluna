// @ts-nocheck
// Sync from rslib
import wasmModule from '../../../rslib/lib/wasm_bg.wasm'


const imports: any = {}

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });

cachedTextDecoder.decode();

function decodeText(ptr, len) {
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let WASM_VECTOR_LEN = 0;

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}
/**
 * @param {Uint8Array} input
 * @param {number} compression_level
 * @returns {Uint8Array}
 */
export function quality_image(input, compression_level) {
    const ptr0 = passArray8ToWasm0(input, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.quality_image(ptr0, len0, compression_level);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
};

/**
 * @param {Uint8Array} input
 * @param {number} compression_level
 * @returns {Uint8Array}
 */
export function mix_image(input, compression_level) {
    const ptr0 = passArray8ToWasm0(input, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.mix_image(ptr0, len0, compression_level);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
};

/**
 * @param {Uint8Array} input
 * @param {boolean} is_flip
 * @param {number} flip_mode
 * @param {boolean} confusion
 * @param {boolean} compress
 * @param {number} compression_level
 * @param {boolean} has_regular_url
 * @returns {Uint8Array}
 */
export function process_image(input, is_flip, flip_mode, confusion, compress, compression_level, has_regular_url) {
    const ptr0 = passArray8ToWasm0(input, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.process_image(ptr0, len0, is_flip, flip_mode, confusion, compress, compression_level, has_regular_url);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
};

/**
 * @param {Uint8Array} input
 * @returns {string}
 */
export function detect_mime(input) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passArray8ToWasm0(input, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.detect_mime(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
};

imports.__wbg_random_7ed63a0b38ee3b75 = function() {
    const ret = Math.random();
    return ret;
};

imports.__wbg_wbindgenthrow_451ec1a8469d7eb6 = function(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
};

imports.__wbindgen_init_externref_table = function() {
    const table = wasm.__wbindgen_export_0;
    const offset = table.grow(4);
    table.set(0, undefined);
    table.set(offset + 0, undefined);
    table.set(offset + 1, null);
    table.set(offset + 2, true);
    table.set(offset + 3, false);
    ;
};



const wasmModuleBuffer = wasmModule instanceof Uint8Array
  ? wasmModule
  : new Uint8Array(wasmModule)

const wasmInstance = new WebAssembly.Instance(new WebAssembly.Module(wasmModuleBuffer), { __wbindgen_placeholder__: imports })
wasm = wasmInstance.exports
wasm.__wbindgen_start()
